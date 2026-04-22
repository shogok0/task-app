type CalendarSyncTask = {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  deadlineAt: string;
};

type GoogleCalendarEventDateTime = {
  dateTime: string;
};

type GoogleCalendarEventInput = {
  summary: string;
  description?: string;
  start: GoogleCalendarEventDateTime;
  end: GoogleCalendarEventDateTime;
  extendedProperties?: {
    private?: Record<string, string>;
  };
};

const DEFAULT_NEXT_PATH = "/app/today";
const EVENT_DURATION_MS = 30 * 60 * 1000;

export function sanitizeNextPath(
  nextPath: string | null | undefined,
  fallback = DEFAULT_NEXT_PATH,
): string {
  if (!nextPath || !nextPath.startsWith("/")) return fallback;
  if (nextPath.startsWith("//")) return fallback;
  return nextPath;
}

export function buildGoogleCalendarEventInput(
  task: CalendarSyncTask,
  appUrl?: string | null,
): GoogleCalendarEventInput {
  const rawDeadline = new Date(task.deadlineAt);
  const end = Number.isNaN(rawDeadline.getTime()) ? new Date() : rawDeadline;
  const start = new Date(end.getTime() - EVENT_DURATION_MS);

  const subjectPrefix = task.subject?.trim() ? `${task.subject.trim()} ` : "";
  const summary = `【課題】${subjectPrefix}${task.title}`;

  const descriptionLines: string[] = [];
  if (task.description?.trim()) {
    descriptionLines.push(task.description.trim());
  }

  const normalizedAppUrl = appUrl?.trim().replace(/\/+$/, "") ?? "";
  if (normalizedAppUrl) {
    descriptionLines.push(`タスク詳細: ${normalizedAppUrl}/app/tasks/${task.id}`);
  }

  return {
    summary,
    description: descriptionLines.length > 0 ? descriptionLines.join("\n\n") : undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: {
      private: {
        source: "task-app",
        taskId: task.id,
      },
    },
  };
}

