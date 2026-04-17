"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, Pencil, Trash2 } from "lucide-react";
import type { TaskWithMySubmission } from "@/lib/db/types";
import { SwipeRow } from "@/components/ui/swipe-row";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { TasksEmptyToday } from "@/components/states/tasks-empty-today";
import { TasksEmptyAllDone } from "@/components/states/tasks-empty-all-done";
import {
  toggleSubmissionAction,
  deleteTaskAction,
} from "@/app/app/_actions/tasks";
import { calculateUrgency, type Urgency } from "@/lib/task-utils";
import { subjectColor } from "@/lib/task-subjects";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// Types / reducer
// -----------------------------------------------------------------------------

type Buckets = {
  pending: TaskWithMySubmission[];
  overdue: TaskWithMySubmission[];
  doneToday: TaskWithMySubmission[];
};

type OptimisticAction =
  | { type: "toggle"; taskId: string; status: "PENDING" | "SUBMITTED" }
  | { type: "delete"; taskId: string }
  | { type: "replace"; state: Buckets };

function applyToggle(
  state: Buckets,
  taskId: string,
  status: "PENDING" | "SUBMITTED",
): Buckets {
  // Find the task in any bucket.
  const all = [...state.pending, ...state.overdue, ...state.doneToday];
  const task = all.find((t) => t.id === taskId);
  if (!task) return state;

  const updated: TaskWithMySubmission = {
    ...task,
    mySubmission: {
      status,
      submittedAt: status === "SUBMITTED" ? new Date().toISOString() : null,
    },
  };

  // Remove from all buckets, then re-insert into the correct one.
  const pending = state.pending.filter((t) => t.id !== taskId);
  const overdue = state.overdue.filter((t) => t.id !== taskId);
  const doneToday = state.doneToday.filter((t) => t.id !== taskId);

  // Decide original bucket by looking at deadline vs "today".
  // We don't recompute overdue/today strictly — we put it back in whichever
  // list it came from (pending vs overdue) when transitioning to PENDING.
  const wasOverdue = state.overdue.some((t) => t.id === taskId);
  const wasDoneToday = state.doneToday.some((t) => t.id === taskId);
  const wasTodayPending = state.pending.some((t) => t.id === taskId);

  if (status === "SUBMITTED") {
    // If the task was a Today task, move to doneToday. Overdue simply
    // disappears from the list on completion.
    if (wasTodayPending || wasDoneToday) {
      return { pending, overdue, doneToday: [...doneToday, updated] };
    }
    // Overdue -> SUBMITTED: remove entirely from view.
    return { pending, overdue, doneToday };
  }

  // status === "PENDING"
  if (wasOverdue) {
    return { pending, overdue: [...overdue, updated], doneToday };
  }
  return { pending: [...pending, updated], overdue, doneToday };
}

function applyDelete(state: Buckets, taskId: string): Buckets {
  return {
    pending: state.pending.filter((t) => t.id !== taskId),
    overdue: state.overdue.filter((t) => t.id !== taskId),
    doneToday: state.doneToday.filter((t) => t.id !== taskId),
  };
}

function optimisticReducer(state: Buckets, action: OptimisticAction): Buckets {
  switch (action.type) {
    case "toggle":
      return applyToggle(state, action.taskId, action.status);
    case "delete":
      return applyDelete(state, action.taskId);
    case "replace":
      return action.state;
  }
}

// -----------------------------------------------------------------------------
// Date / time helpers
// -----------------------------------------------------------------------------

const DATE_LABEL_FMT = new Intl.DateTimeFormat("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

const TIME_FMT = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const SHORT_DATE_FMT = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
});

function formatTodayLabel(d: Date): string {
  return DATE_LABEL_FMT.format(d);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDeadline(deadlineIso: string, now: Date): string {
  const deadline = new Date(deadlineIso);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const hhmm = TIME_FMT.format(deadline);
  if (sameDay(deadline, now)) return `締切 ${hhmm}`;
  if (sameDay(deadline, tomorrow)) return `締切 明日 ${hhmm}`;
  return `締切 ${SHORT_DATE_FMT.format(deadline)} ${hhmm}`;
}

// -----------------------------------------------------------------------------
// Urgency presentation
// -----------------------------------------------------------------------------

const URGENCY_CLASS: Record<Urgency, string> = {
  overdue: "bg-[color:var(--color-danger)]",
  high: "bg-[color:var(--color-warning)]",
  medium: "bg-[color:var(--color-accent)]",
  low: "bg-[color:var(--color-text-tertiary)]",
};

const URGENCY_LABEL: Record<Urgency, string> = {
  overdue: "期限切れ",
  high: "急ぎ（当日）",
  medium: "数日以内",
  low: "余裕あり",
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

type Props = {
  pending: TaskWithMySubmission[];
  overdue: TaskWithMySubmission[];
  doneToday: TaskWithMySubmission[];
  nowIso: string;
};

export function TodayClient({
  pending,
  overdue,
  doneToday,
  nowIso,
}: Props): React.JSX.Element {
  const now = React.useMemo(() => new Date(nowIso), [nowIso]);
  const toast = useToast();

  // Server state (rehydrated by Next's revalidation on each server action).
  const serverState = React.useMemo<Buckets>(
    () => ({ pending, overdue, doneToday }),
    [pending, overdue, doneToday],
  );

  const [optimistic, dispatch] = React.useOptimistic<
    Buckets,
    OptimisticAction
  >(serverState, optimisticReducer);

  // Collapsible completed section.
  const [doneOpen, setDoneOpen] = React.useState(false);

  const [isPending, startTransition] = React.useTransition();

  const handleToggle = React.useCallback(
    (taskId: string, next: "PENDING" | "SUBMITTED") => {
      startTransition(async () => {
        dispatch({ type: "toggle", taskId, status: next });
        const res = await toggleSubmissionAction({ taskId, status: next });
        if (!res.ok) {
          // Revert by forcing the current server snapshot.
          dispatch({ type: "replace", state: serverState });
          toast.show({
            title: "更新に失敗しました",
            description: res.error,
            variant: "error",
          });
        }
      });
    },
    [dispatch, serverState, toast],
  );

  const handleDelete = React.useCallback(
    (taskId: string) => {
      startTransition(async () => {
        dispatch({ type: "delete", taskId });
        const res = await deleteTaskAction({ taskId });
        if (!res.ok) {
          dispatch({ type: "replace", state: serverState });
          toast.show({
            title: "削除に失敗しました",
            description: res.error,
            variant: "error",
          });
        }
      });
    },
    [dispatch, serverState, toast],
  );

  const showEmptyToday =
    optimistic.pending.length === 0 &&
    optimistic.overdue.length === 0 &&
    optimistic.doneToday.length === 0;

  const showAllDone =
    optimistic.pending.length === 0 &&
    optimistic.overdue.length === 0 &&
    optimistic.doneToday.length > 0;

  return (
    <div aria-busy={isPending}>
      <header className="px-4 pt-6 pb-3">
        <p className="text-ios-footnote text-[color:var(--color-text-secondary)]">
          {formatTodayLabel(now)}
        </p>
        <h1 className="text-ios-title1">今日</h1>
      </header>

      {/* Overdue */}
      {optimistic.overdue.length > 0 && (
        <section aria-labelledby="overdue-heading" className="mt-4">
          <div className="flex items-center gap-2 px-4 pb-2">
            <AlertTriangle
              className="h-4 w-4 text-[color:var(--color-danger)]"
              aria-hidden
            />
            <h2
              id="overdue-heading"
              className="text-ios-headline text-[color:var(--color-danger)]"
            >
              期限切れ
            </h2>
            <span
              className="text-ios-footnote text-[color:var(--color-text-secondary)]"
              aria-label={`${optimistic.overdue.length}件`}
            >
              ({optimistic.overdue.length})
            </span>
          </div>
          <ul role="list" className="divide-y divide-[color:var(--color-separator)]">
            {optimistic.overdue.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                now={now}
                overdueStripe
                onToggle={(next) => handleToggle(task.id, next)}
                onDelete={() => handleDelete(task.id)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Today pending / empty states */}
      {showEmptyToday ? (
        <div className="mt-6">
          <TasksEmptyToday />
        </div>
      ) : showAllDone ? (
        <div className="mt-6">
          <TasksEmptyAllDone />
        </div>
      ) : (
        optimistic.pending.length > 0 && (
          <section aria-labelledby="today-heading" className="mt-4">
            <div className="flex items-center gap-2 px-4 pb-2">
              <h2
                id="today-heading"
                className="text-ios-headline text-[color:var(--color-text-primary)]"
              >
                やること
              </h2>
              <span
                className="text-ios-footnote text-[color:var(--color-text-secondary)]"
                aria-label={`${optimistic.pending.length}件`}
              >
                ({optimistic.pending.length})
              </span>
            </div>
            <ul role="list" className="divide-y divide-[color:var(--color-separator)]">
              {optimistic.pending.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  now={now}
                  onToggle={(next) => handleToggle(task.id, next)}
                  onDelete={() => handleDelete(task.id)}
                />
              ))}
            </ul>
          </section>
        )
      )}

      {/* Completed today (collapsible) */}
      {optimistic.doneToday.length > 0 && (
        <section aria-labelledby="done-heading" className="mt-6">
          <button
            type="button"
            onClick={() => setDoneOpen((v) => !v)}
            aria-expanded={doneOpen}
            aria-controls="done-today-list"
            className="flex w-full items-center justify-between px-4 py-2 text-left"
          >
            <h2
              id="done-heading"
              className="text-ios-headline text-[color:var(--color-text-secondary)]"
            >
              本日完了 {optimistic.doneToday.length}件
            </h2>
            <span
              aria-hidden
              className="text-ios-footnote text-[color:var(--color-text-tertiary)]"
            >
              {doneOpen ? "閉じる" : "表示"}
            </span>
          </button>
          {doneOpen && (
            <ul
              id="done-today-list"
              role="list"
              className="divide-y divide-[color:var(--color-separator)]"
            >
              {optimistic.doneToday.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  now={now}
                  onToggle={(next) => handleToggle(task.id, next)}
                  onDelete={() => handleDelete(task.id)}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// TaskRow
// -----------------------------------------------------------------------------

type TaskRowProps = {
  task: TaskWithMySubmission;
  now: Date;
  overdueStripe?: boolean;
  onToggle: (next: "PENDING" | "SUBMITTED") => void;
  onDelete: () => void;
};

function TaskRow({
  task,
  now,
  overdueStripe,
  onToggle,
  onDelete,
}: TaskRowProps): React.JSX.Element {
  const submitted = task.mySubmission?.status === "SUBMITTED";
  const deadline = new Date(task.deadlineAt);
  const urgency = calculateUrgency(deadline, now);
  const subj = subjectColor(task.subject);

  const detailHref = `/app/tasks/${task.id}`;

  return (
    <li>
      <SwipeRow
        leftActions={[
          {
            key: "done",
            label: submitted ? "戻す" : "完了",
            icon: <Check className="h-4 w-4" aria-hidden />,
            color: "green",
            onAction: () => onToggle(submitted ? "PENDING" : "SUBMITTED"),
          },
        ]}
        rightActions={[
          {
            key: "edit",
            label: "編集",
            icon: <Pencil className="h-4 w-4" aria-hidden />,
            color: "blue",
            onAction: () => {
              // Navigate to detail (edit lives on detail page).
              window.location.assign(detailHref);
            },
          },
          {
            key: "del",
            label: "削除",
            icon: <Trash2 className="h-4 w-4" aria-hidden />,
            color: "red",
            onAction: () => onDelete(),
          },
        ]}
      >
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-3",
            overdueStripe &&
              "border-l-4 border-l-[color:var(--color-danger)]",
          )}
        >
          {/* Checkbox */}
          <div className="shrink-0">
            <Checkbox
              checked={submitted}
              onCheckedChange={(v) => onToggle(v ? "SUBMITTED" : "PENDING")}
              aria-label={submitted ? "完了を取り消す" : "完了にする"}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Main content — the tap target for navigation */}
          <Link
            href={detailHref}
            prefetch={false}
            className="min-w-0 flex-1 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
          >
            <div
              className={cn(
                "text-ios-body truncate text-[color:var(--color-text-primary)]",
                submitted &&
                  "line-through text-[color:var(--color-text-secondary)]",
              )}
            >
              {task.title}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {task.subject ? (
                <span
                  className={cn(
                    "text-ios-caption1 rounded-full px-2 py-0.5",
                    subj.bg,
                    subj.text,
                  )}
                >
                  {task.subject}
                </span>
              ) : null}
              {task.groupName ? (
                <span className="text-ios-caption1 rounded-full bg-[color:var(--color-surface)] px-2 py-0.5 text-[color:var(--color-text-secondary)]">
                  {task.groupName}
                </span>
              ) : null}
              <span
                className={cn(
                  "text-ios-caption1 text-[color:var(--color-text-secondary)]",
                  urgency === "overdue" && "text-[color:var(--color-danger)]",
                )}
              >
                {formatDeadline(task.deadlineAt, now)}
              </span>
            </div>
          </Link>

          {/* Urgency dot */}
          <span
            role="img"
            aria-label={URGENCY_LABEL[urgency]}
            className={cn(
              "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
              URGENCY_CLASS[urgency],
            )}
          />
        </div>
      </SwipeRow>
    </li>
  );
}
