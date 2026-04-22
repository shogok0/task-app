import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  getIcalFeedTokenByToken,
  touchIcalFeedTokenAccessedAt,
} from "@/lib/db/repositories/ical-feeds";
import { buildIcalFeed } from "@/lib/ical/ics";

type Row = Record<string, unknown>;

type TaskRow = {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  deadline_at: string;
  updated_at: string | null;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : String(v);
}

function mapTaskRow(row: Row): TaskRow {
  return {
    id: asString(row.id),
    title: asString(row.title),
    subject: asStringOrNull(row.subject),
    description: asStringOrNull(row.description),
    deadline_at: asString(row.deadline_at),
    updated_at: asStringOrNull(row.updated_at),
  };
}

async function listIcalTasksForUser(userId: string): Promise<TaskRow[]> {
  const supabase = createSupabaseServiceClient();

  const { data: personalRows, error: personalError } = await supabase
    .from("tasks")
    .select("id,title,subject,description,deadline_at,updated_at")
    .eq("scope_type", "PERSONAL")
    .eq("owner_user_id", userId)
    .eq("status", "OPEN")
    .is("deleted_at", null);
  if (personalError) throw personalError;

  const { data: memberships, error: membershipError } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", userId)
    .is("left_at", null);
  if (membershipError) throw membershipError;

  const groupIds = (memberships ?? []).map((row) => asString((row as Row).group_id));
  let groupRows: TaskRow[] = [];
  if (groupIds.length > 0) {
    const { data, error } = await supabase
      .from("tasks")
      .select("id,title,subject,description,deadline_at,updated_at")
      .eq("scope_type", "GROUP")
      .in("group_id", groupIds)
      .eq("status", "OPEN")
      .is("deleted_at", null);
    if (error) throw error;
    groupRows = (data ?? []).map((row) => mapTaskRow(row as Row));
  }

  const merged = [...(personalRows ?? []).map((row) => mapTaskRow(row as Row)), ...groupRows];
  if (merged.length === 0) return [];

  const taskIds = merged.map((task) => task.id);
  const { data: submissions, error: submissionError } = await supabase
    .from("task_submissions")
    .select("task_id,status")
    .eq("user_id", userId)
    .in("task_id", taskIds);
  if (submissionError) throw submissionError;

  const submittedTaskIds = new Set(
    (submissions ?? [])
      .filter((row) => asString((row as Row).status) === "SUBMITTED")
      .map((row) => asString((row as Row).task_id)),
  );

  return merged
    .filter((task) => !submittedTaskIds.has(task.id))
    .sort((a, b) => a.deadline_at.localeCompare(b.deadline_at));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!token || token.length < 12) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const supabase = createSupabaseServiceClient();
  const feedToken = await getIcalFeedTokenByToken(supabase, token);
  if (!feedToken) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const tasks = await listIcalTasksForUser(feedToken.userId);
  const appUrl = process.env.APP_URL ?? null;
  const ics = buildIcalFeed(
    tasks.map((task) => ({
      id: task.id,
      title: task.title,
      subject: task.subject,
      description: task.description,
      deadlineAt: task.deadline_at,
      updatedAt: task.updated_at,
    })),
    { appUrl, calendarName: "課題管理 (TimeTree)" },
  );

  await touchIcalFeedTokenAccessedAt(supabase, token);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Disposition": 'inline; filename="task-app.ics"',
    },
  });
}

