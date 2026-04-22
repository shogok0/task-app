type IcalTask = {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  deadlineAt: string;
  updatedAt?: string | null;
};

const PROD_ID = "-//Task App//MVP//JA";
const EVENT_DURATION_MS = 30 * 60 * 1000;

function toUtcIcsDateTime(value: Date): string {
  const y = value.getUTCFullYear().toString().padStart(4, "0");
  const m = (value.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = value.getUTCDate().toString().padStart(2, "0");
  const hh = value.getUTCHours().toString().padStart(2, "0");
  const mm = value.getUTCMinutes().toString().padStart(2, "0");
  const ss = value.getUTCSeconds().toString().padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function escapeIcsText(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function toSummary(task: IcalTask): string {
  const subjectPrefix = task.subject?.trim() ? `${task.subject.trim()} ` : "";
  return `【課題】${subjectPrefix}${task.title}`;
}

function toDescription(task: IcalTask, appUrl?: string | null): string | null {
  const lines: string[] = [];
  if (task.description?.trim()) {
    lines.push(task.description.trim());
  }
  const normalizedAppUrl = appUrl?.trim().replace(/\/+$/, "") ?? "";
  if (normalizedAppUrl) {
    lines.push(`タスク詳細: ${normalizedAppUrl}/app/tasks/${task.id}`);
  }
  return lines.length > 0 ? lines.join("\n\n") : null;
}

export function buildIcalFeed(
  tasks: IcalTask[],
  options?: {
    appUrl?: string | null;
    calendarName?: string;
    now?: Date;
  },
): string {
  const now = options?.now ?? new Date();
  const calendarName = options?.calendarName ?? "課題管理";

  const rows: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `PRODID:${PROD_ID}`,
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];

  for (const task of tasks) {
    const end = new Date(task.deadlineAt);
    if (Number.isNaN(end.getTime())) continue;
    const start = new Date(end.getTime() - EVENT_DURATION_MS);
    const dtstamp = toUtcIcsDateTime(now);
    const dtstart = toUtcIcsDateTime(start);
    const dtend = toUtcIcsDateTime(end);
    const lastModified = task.updatedAt
      ? toUtcIcsDateTime(new Date(task.updatedAt))
      : dtstamp;
    const summary = escapeIcsText(toSummary(task));
    const description = toDescription(task, options?.appUrl);

    rows.push("BEGIN:VEVENT");
    rows.push(`UID:task-${task.id}@task-app`);
    rows.push(`DTSTAMP:${dtstamp}`);
    rows.push(`DTSTART:${dtstart}`);
    rows.push(`DTEND:${dtend}`);
    rows.push(`LAST-MODIFIED:${lastModified}`);
    rows.push(`SUMMARY:${summary}`);
    if (description) {
      rows.push(`DESCRIPTION:${escapeIcsText(description)}`);
    }
    rows.push("END:VEVENT");
  }

  rows.push("END:VCALENDAR");
  return `${rows.join("\r\n")}\r\n`;
}

