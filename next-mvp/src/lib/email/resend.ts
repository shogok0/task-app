import { Resend } from "resend";

export type EmailSendResult =
  | { ok: true; id: string; stub?: boolean }
  | { ok: false; error: string };

let cached: Resend | null | undefined;

function getClient(): Resend | null {
  if (cached !== undefined) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    cached = null;
    return null;
  }
  cached = new Resend(key);
  return cached;
}

export type DeadlineReminderParams = {
  to: string;
  userDisplayName: string;
  taskTitle: string;
  taskSubject?: string | null;
  deadlineAt: Date;
  taskUrl: string;
};

export async function sendDeadlineReminderEmail(
  params: DeadlineReminderParams
): Promise<EmailSendResult> {
  const client = getClient();
  const from = process.env.RESEND_FROM ?? "Task App <onboarding@resend.dev>";
  const subject = `[締切リマインダー] ${params.taskTitle}`;
  const html = buildReminderHtml(params);
  const text = buildReminderText(params);

  if (!client) {
    // Dev stub: log and return a fake id so downstream code paths behave.
    console.log("[email:stub] would send", { to: params.to, subject });
    return { ok: true, id: `stub_${crypto.randomUUID()}`, stub: true };
  }

  try {
    const { data, error } = await client.emails.send({
      from,
      to: [params.to],
      subject,
      html,
      text,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function formatJpDeadline(d: Date): string {
  // Format as "2026年4月20日(月) 23:59" in JST.
  const jst = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(d);
  return jst;
}

function buildReminderHtml(p: DeadlineReminderParams): string {
  // minimal, email-client-safe HTML (no external CSS, inline styles, preheader)
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><title>締切リマインダー</title></head>
<body style="margin:0;padding:24px;background:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Yu Gothic UI',sans-serif;color:#000;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;">
    <p style="margin:0 0 8px;font-size:13px;color:#8E8E93;">課題管理</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">締切が近づいています</h1>
    <p style="margin:0 0 4px;font-size:15px;color:#3C3C43;">${escapeHtml(p.userDisplayName)} さん</p>
    <div style="margin:20px 0;padding:16px;background:#F2F2F7;border-radius:12px;">
      ${p.taskSubject ? `<div style="font-size:12px;color:#007AFF;font-weight:600;margin-bottom:4px;">${escapeHtml(p.taskSubject)}</div>` : ""}
      <div style="font-size:17px;font-weight:600;margin-bottom:8px;">${escapeHtml(p.taskTitle)}</div>
      <div style="font-size:15px;color:#FF3B30;">${escapeHtml(formatJpDeadline(p.deadlineAt))}</div>
    </div>
    <p style="margin:0 0 20px;font-size:15px;color:#3C3C43;">アプリを開いて詳細を確認してください。</p>
    <a href="${p.taskUrl}" style="display:inline-block;padding:12px 20px;background:#007AFF;color:#fff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600;">課題を開く</a>
    <p style="margin:32px 0 0;font-size:12px;color:#8E8E93;">このメールは通知設定で有効化されているため送信されています。</p>
  </div>
</body>
</html>`;
}

function buildReminderText(p: DeadlineReminderParams): string {
  return [
    "課題管理 - 締切リマインダー",
    "",
    `${p.userDisplayName} さん`,
    "",
    `課題: ${p.taskTitle}${p.taskSubject ? ` (${p.taskSubject})` : ""}`,
    `締切: ${formatJpDeadline(p.deadlineAt)}`,
    "",
    `詳細: ${p.taskUrl}`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
