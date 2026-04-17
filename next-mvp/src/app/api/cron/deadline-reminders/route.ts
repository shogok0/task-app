import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendDeadlineReminderEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  // 1) Get all users with email_enabled = true + email_address
  const { data: settings, error: sErr } = await supabase
    .from("notification_settings")
    .select("user_id, email_address, remind_before_days")
    .eq("email_enabled", true);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  let processed = 0,
    sent = 0,
    skipped = 0,
    failed = 0;

  for (const s of settings ?? []) {
    // Resolve the destination email: settings.email_address OR fall back to auth.users email
    let to = s.email_address;
    if (!to) {
      const { data: userData } = await supabase.auth.admin.getUserById(s.user_id);
      to = userData?.user?.email ?? null;
    }
    if (!to) {
      skipped++;
      continue;
    }

    // Calculate the target window for this user:
    // deadline_at within [now + remind_before_days*24h, now + (remind_before_days+1)*24h)
    const now = new Date();
    const days = s.remind_before_days ?? 1;
    const from = new Date(now.getTime() + days * 86_400_000);
    const to_ = new Date(now.getTime() + (days + 1) * 86_400_000);

    // Find this user's PENDING submissions with tasks in that window (not deleted, status OPEN)
    const { data: rows, error: qErr } = await supabase
      .from("task_submissions")
      .select(
        "id, task_id, status, tasks:tasks(id, title, subject, deadline_at, status, deleted_at, scope_type, group_id, owner_user_id)",
      )
      .eq("user_id", s.user_id)
      .eq("status", "PENDING")
      .gte("tasks.deadline_at", from.toISOString())
      .lt("tasks.deadline_at", to_.toISOString());
    if (qErr) continue;

    // Get user's display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", s.user_id)
      .maybeSingle();
    const displayName = profile?.display_name ?? "ユーザー";

    for (const row of rows ?? []) {
      const task = (row as any).tasks;
      if (!task || task.deleted_at || task.status !== "OPEN") {
        skipped++;
        continue;
      }
      processed++;

      const scheduledFor = new Date(task.deadline_at); // use deadline_at as canonical scheduled_for for dedup

      // Try to insert a delivery row — UNIQUE constraint will conflict on duplicate
      const { data: inserted, error: insErr } = await supabase
        .from("notification_deliveries")
        .insert({
          user_id: s.user_id,
          task_id: task.id,
          channel: "EMAIL",
          notification_type: "DEADLINE_REMINDER",
          scheduled_for: scheduledFor.toISOString(),
          status: "QUEUED",
        })
        .select("id")
        .single();

      if (insErr) {
        // unique_violation → already scheduled/sent → skip
        if ((insErr as any).code === "23505") {
          skipped++;
          continue;
        }
        failed++;
        continue;
      }

      // Send the email
      const taskUrl = `${appUrl}/app/tasks/${task.id}`;
      const result = await sendDeadlineReminderEmail({
        to,
        userDisplayName: displayName,
        taskTitle: task.title,
        taskSubject: task.subject,
        deadlineAt: new Date(task.deadline_at),
        taskUrl,
      });

      if (result.ok) {
        await supabase
          .from("notification_deliveries")
          .update({
            status: "SENT",
            provider_message_id: result.id,
            sent_at: new Date().toISOString(),
          })
          .eq("id", inserted!.id);
        sent++;
      } else {
        await supabase
          .from("notification_deliveries")
          .update({ status: "FAILED", error_message: result.error })
          .eq("id", inserted!.id);
        failed++;
      }
    }
  }

  return NextResponse.json({ processed, sent, skipped, failed });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
