"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Trash2, Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { SwipeRow } from "@/components/ui/swipe-row";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/ui/toast";
import { MonthCalendar } from "@/components/app/month-calendar";
import type { TaskWithMySubmission } from "@/lib/db/types";
import {
  toggleSubmissionAction,
  deleteTaskAction,
} from "@/app/app/_actions/tasks";

type View = "list" | "calendar";

type Props = {
  tasks: TaskWithMySubmission[];
  initialView: View;
  nowIso: string;
};

const WEEKDAYS_SHORT_JA = ["日", "月", "火", "水", "木", "金", "土"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toLocalDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfLocalDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function daysBetween(fromMidnight: Date, toMidnight: Date): number {
  // Both should be local midnight.
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((toMidnight.getTime() - fromMidnight.getTime()) / MS);
}

function bucketLabel(taskDayMid: Date, nowDayMid: Date): string {
  const diff = daysBetween(nowDayMid, taskDayMid);
  const weekday = WEEKDAYS_SHORT_JA[taskDayMid.getDay()];
  if (diff === 1) return "明日";
  if (diff === 2) return "明後日";
  if (diff <= 7) return `${diff}日後 (${weekday})`;
  return `${taskDayMid.getMonth() + 1}/${taskDayMid.getDate()} (${weekday})`;
}

function dayHeaderLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = WEEKDAYS_SHORT_JA[date.getDay()];
  return `${y}/${m}/${d} (${weekday})`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

type Bucket = {
  dayKey: string;
  dayMid: Date;
  label: string;
  tasks: TaskWithMySubmission[];
};

function groupTasksByDay(
  tasks: TaskWithMySubmission[],
  nowDayMid: Date,
): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const t of tasks) {
    const dd = new Date(t.deadlineAt);
    const mid = startOfLocalDay(dd);
    const key = toLocalDayKey(mid);
    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        dayKey: key,
        dayMid: mid,
        label: bucketLabel(mid, nowDayMid),
        tasks: [],
      };
      map.set(key, bucket);
    }
    bucket.tasks.push(t);
  }
  return Array.from(map.values()).sort(
    (a, b) => a.dayMid.getTime() - b.dayMid.getTime(),
  );
}

function eventsByDayFrom(
  tasks: TaskWithMySubmission[],
): Record<string, { personal: number; group: number }> {
  const out: Record<string, { personal: number; group: number }> = {};
  for (const t of tasks) {
    const key = toLocalDayKey(new Date(t.deadlineAt));
    if (!out[key]) out[key] = { personal: 0, group: 0 };
    if (t.scopeType === "GROUP") out[key].group += 1;
    else out[key].personal += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------

export function UpcomingClient({
  tasks,
  initialView,
  nowIso,
}: Props): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { show } = useToast();
  const [pending, startTransition] = React.useTransition();

  const [view, setView] = React.useState<View>(initialView);
  const now = React.useMemo(() => new Date(nowIso), [nowIso]);
  const nowDayMid = React.useMemo(() => startOfLocalDay(now), [now]);
  const todayKey = React.useMemo(() => toLocalDayKey(nowDayMid), [nowDayMid]);

  const [calYear, setCalYear] = React.useState(now.getFullYear());
  const [calMonth, setCalMonth] = React.useState(now.getMonth()); // 0-11

  const [sheetDayKey, setSheetDayKey] = React.useState<string | null>(null);

  const buckets = React.useMemo(
    () => groupTasksByDay(tasks, nowDayMid),
    [tasks, nowDayMid],
  );

  const eventsByDay = React.useMemo(() => eventsByDayFrom(tasks), [tasks]);

  const tasksForSheetDay = React.useMemo(() => {
    if (!sheetDayKey) return [];
    return tasks
      .filter((t) => toLocalDayKey(new Date(t.deadlineAt)) === sheetDayKey)
      .sort(
        (a, b) =>
          new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime(),
      );
  }, [sheetDayKey, tasks]);

  const setViewAndQuery = (next: View) => {
    setView(next);
    const params = new URLSearchParams();
    if (next === "calendar") params.set("view", "calendar");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // --- Actions -----------------------------------------------------------

  const toggleDone = (task: TaskWithMySubmission) => {
    const currently = task.mySubmission?.status === "SUBMITTED";
    const nextStatus = currently ? "PENDING" : "SUBMITTED";
    startTransition(async () => {
      const res = await toggleSubmissionAction({
        taskId: task.id,
        status: nextStatus,
      });
      if (!res.ok) {
        show({ title: "更新に失敗しました", description: res.error, variant: "error" });
        return;
      }
      show({
        title: nextStatus === "SUBMITTED" ? "完了にしました" : "未完了に戻しました",
        variant: "success",
      });
      router.refresh();
    });
  };

  const deleteTask = (task: TaskWithMySubmission) => {
    startTransition(async () => {
      const res = await deleteTaskAction({ taskId: task.id });
      if (!res.ok) {
        show({ title: "削除に失敗しました", description: res.error, variant: "error" });
        return;
      }
      show({ title: "タスクを削除しました", variant: "success" });
      router.refresh();
    });
  };

  // --- Render ------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
      <header className="sticky top-0 z-10 -mx-4 px-4 pt-2 pb-3 bg-[color:var(--color-bg)]/90 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <h1 className="text-ios-title1 font-semibold text-[color:var(--color-text-primary)]">
            予定
          </h1>
        </div>
        <div className="mt-3">
          <SegmentedControl value={view} onChange={setViewAndQuery} />
        </div>
      </header>

      {view === "list" ? (
        <ListView
          buckets={buckets}
          todayKey={todayKey}
          pending={pending}
          onToggle={toggleDone}
          onDelete={deleteTask}
        />
      ) : (
        <div className="pt-4 pb-6">
          <MonthCalendar
            year={calYear}
            month={calMonth}
            eventsByDay={eventsByDay}
            todayIso={todayKey}
            onDayTap={(key) => setSheetDayKey(key)}
            onMonthChange={(y, m) => {
              setCalYear(y);
              setCalMonth(m);
            }}
          />
        </div>
      )}

      <BottomSheet
        open={sheetDayKey !== null}
        onOpenChange={(o) => {
          if (!o) setSheetDayKey(null);
        }}
        title={sheetDayKey ? dayHeaderLabel(sheetDayKey) : undefined}
        snapPoints={[0.6, 0.9]}
      >
        {sheetDayKey && (
          <DayTaskList
            tasks={tasksForSheetDay}
            pending={pending}
            onToggle={toggleDone}
            onDelete={deleteTask}
          />
        )}
      </BottomSheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

function SegmentedControl({
  value,
  onChange,
}: {
  value: View;
  onChange: (v: View) => void;
}): React.JSX.Element {
  const options: { id: View; label: string }[] = [
    { id: "list", label: "リスト" },
    { id: "calendar", label: "カレンダー" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="表示切り替え"
      className="grid grid-cols-2 gap-1 rounded-[var(--radius-lg)] bg-[color:var(--color-surface)] p-1"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "tap-target rounded-[calc(var(--radius-lg)-4px)] px-3 py-1.5 text-ios-subhead font-semibold transition-colors",
              active
                ? "bg-[color:var(--color-surface-2)] text-[color:var(--color-text-primary)] shadow-sm"
                : "text-[color:var(--color-text-secondary)]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------------

function ListView({
  buckets,
  todayKey,
  pending,
  onToggle,
  onDelete,
}: {
  buckets: Bucket[];
  todayKey: string;
  pending: boolean;
  onToggle: (t: TaskWithMySubmission) => void;
  onDelete: (t: TaskWithMySubmission) => void;
}): React.JSX.Element {
  if (buckets.length === 0) {
    return (
      <div className="py-20 text-center text-ios-body text-[color:var(--color-text-secondary)]">
        予定はありません
      </div>
    );
  }

  return (
    <div className="pb-6">
      {buckets.map((bucket) => (
        <section key={bucket.dayKey} aria-labelledby={`bucket-${bucket.dayKey}`}>
          <h2
            id={`bucket-${bucket.dayKey}`}
            className="sticky top-[108px] z-[5] -mx-4 flex items-center justify-between bg-[color:var(--color-bg)]/90 px-4 py-2 text-ios-headline backdrop-blur-xl"
          >
            <span className="text-[color:var(--color-text-primary)]">
              {bucket.label}
            </span>
            <span className="text-ios-footnote text-[color:var(--color-text-secondary)]">
              {bucket.tasks.length}件
            </span>
          </h2>
          <ul role="list" className="divide-y divide-[color:var(--color-separator)]">
            {bucket.tasks.map((t) => (
              <UpcomingTaskRow
                key={t.id}
                task={t}
                pending={pending}
                onToggle={onToggle}
                onDelete={onDelete}
                isToday={bucket.dayKey === todayKey}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task row (duplicated locally per spec — don't couple to Today's row)
// ---------------------------------------------------------------------------

function UpcomingTaskRow({
  task,
  pending,
  onToggle,
  onDelete,
  isToday: _isToday,
}: {
  task: TaskWithMySubmission;
  pending: boolean;
  onToggle: (t: TaskWithMySubmission) => void;
  onDelete: (t: TaskWithMySubmission) => void;
  isToday?: boolean;
}): React.JSX.Element {
  const done = task.mySubmission?.status === "SUBMITTED";
  const isGroup = task.scopeType === "GROUP";
  return (
    <li>
      <SwipeRow
        disabled={pending}
        leftActions={[
          {
            key: "toggle",
            label: done ? "未完了" : "完了",
            color: done ? "gray" : "green",
            icon: <Check size={18} aria-hidden="true" />,
            onAction: () => onToggle(task),
          },
        ]}
        rightActions={[
          {
            key: "delete",
            label: "削除",
            color: "red",
            icon: <Trash2 size={18} aria-hidden="true" />,
            onAction: () => onDelete(task),
          },
        ]}
      >
        <div className="flex items-start gap-3 px-1 py-3">
          <Checkbox
            size="md"
            checked={done}
            onCheckedChange={() => onToggle(task)}
            aria-label={done ? "未完了に戻す" : "完了にする"}
            disabled={pending}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {task.subject && (
                <span className="text-ios-caption1 text-[color:var(--color-text-secondary)] truncate">
                  {task.subject}
                </span>
              )}
              {isGroup && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-warning)]/15 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-warning)]">
                  <Users size={10} aria-hidden="true" />
                  {task.groupName ?? "グループ"}
                </span>
              )}
            </div>
            <div
              className={cn(
                "text-ios-body text-[color:var(--color-text-primary)] truncate",
                done && "line-through text-[color:var(--color-text-tertiary)]",
              )}
            >
              {task.title}
            </div>
            <div className="text-ios-footnote text-[color:var(--color-text-secondary)]">
              {formatTime(task.deadlineAt)}
            </div>
          </div>
        </div>
      </SwipeRow>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Day list used inside BottomSheet
// ---------------------------------------------------------------------------

function DayTaskList({
  tasks,
  pending,
  onToggle,
  onDelete,
}: {
  tasks: TaskWithMySubmission[];
  pending: boolean;
  onToggle: (t: TaskWithMySubmission) => void;
  onDelete: (t: TaskWithMySubmission) => void;
}): React.JSX.Element {
  if (tasks.length === 0) {
    return (
      <div className="py-12 text-center text-ios-body text-[color:var(--color-text-secondary)]">
        この日の予定はありません
      </div>
    );
  }
  return (
    <ul role="list" className="divide-y divide-[color:var(--color-separator)]">
      {tasks.map((t) => (
        <UpcomingTaskRow
          key={t.id}
          task={t}
          pending={pending}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
