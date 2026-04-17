"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  LogOut,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { Group, MembershipRole, Profile, TaskWithMySubmission } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SwipeRow } from "@/components/ui/swipe-row";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { useQuickAdd } from "@/components/app/quick-add-provider";
import {
  toggleSubmissionAction,
  deleteTaskAction,
} from "@/app/app/_actions/tasks";
import { leaveGroupAction } from "@/app/app/_actions/groups";
import { calculateUrgency, type Urgency } from "@/lib/task-utils";
import { subjectColor } from "@/lib/task-subjects";
import { cn } from "@/lib/utils";

type MemberWithRole = Profile & { role: MembershipRole };

type Props = {
  group: Group;
  members: MemberWithRole[];
  tasks: TaskWithMySubmission[];
  myRole: MembershipRole | null;
  nowIso: string;
};

const ROLE_LABEL: Record<MembershipRole, string> = {
  ADMIN: "教師",
  MEMBER: "生徒",
};

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

const TIME_FMT = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const SHORT_DATE_FMT = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
});

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
// Optimistic state for tasks
// -----------------------------------------------------------------------------

type OptimisticAction =
  | { type: "toggle"; taskId: string; status: "PENDING" | "SUBMITTED" }
  | { type: "delete"; taskId: string }
  | { type: "replace"; state: TaskWithMySubmission[] };

function reducer(
  state: TaskWithMySubmission[],
  action: OptimisticAction,
): TaskWithMySubmission[] {
  switch (action.type) {
    case "toggle":
      return state.map((t) =>
        t.id === action.taskId
          ? {
              ...t,
              mySubmission: {
                status: action.status,
                submittedAt:
                  action.status === "SUBMITTED"
                    ? new Date().toISOString()
                    : null,
              },
            }
          : t,
      );
    case "delete":
      return state.filter((t) => t.id !== action.taskId);
    case "replace":
      return action.state;
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function GroupDetailClient({
  group,
  members,
  tasks,
  myRole,
  nowIso,
}: Props): React.JSX.Element {
  const router = useRouter();
  const toast = useToast();
  const quickAdd = useQuickAdd();

  const now = React.useMemo(() => new Date(nowIso), [nowIso]);
  const isAdmin = myRole === "ADMIN";

  const [optimistic, dispatch] = React.useOptimistic<
    TaskWithMySubmission[],
    OptimisticAction
  >(tasks, reducer);

  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const [leavePending, startLeaveTransition] = React.useTransition();
  const [, startTaskTransition] = React.useTransition();

  const handleCopyCode = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      toast.show({ title: "コピーしました", variant: "success" });
    } catch {
      toast.show({
        title: "コピーに失敗しました",
        description: "手動でコードを選択してコピーしてください",
        variant: "error",
      });
    }
  }, [group.inviteCode, toast]);

  const handleToggle = React.useCallback(
    (taskId: string, next: "PENDING" | "SUBMITTED") => {
      startTaskTransition(async () => {
        dispatch({ type: "toggle", taskId, status: next });
        const res = await toggleSubmissionAction({ taskId, status: next });
        if (!res.ok) {
          dispatch({ type: "replace", state: tasks });
          toast.show({
            title: "更新に失敗しました",
            description: res.error,
            variant: "error",
          });
        }
      });
    },
    [dispatch, tasks, toast],
  );

  const handleDelete = React.useCallback(
    (taskId: string) => {
      startTaskTransition(async () => {
        dispatch({ type: "delete", taskId });
        const res = await deleteTaskAction({ taskId });
        if (!res.ok) {
          dispatch({ type: "replace", state: tasks });
          toast.show({
            title: "削除に失敗しました",
            description: res.error,
            variant: "error",
          });
        }
      });
    },
    [dispatch, tasks, toast],
  );

  const handleLeave = React.useCallback(() => {
    startLeaveTransition(async () => {
      const res = await leaveGroupAction({ groupId: group.id });
      if (res.ok) {
        toast.show({ title: "グループから退出しました", variant: "success" });
        router.push("/app/settings");
        router.refresh();
        return;
      }
      setLeaveOpen(false);
      if (res.code === "LAST_ADMIN") {
        toast.show({
          title: "退出できません",
          description:
            "あなたが最後の管理者です。別のメンバーを管理者に昇格させてから退出してください。",
          variant: "error",
        });
      } else {
        toast.show({
          title: "退出に失敗しました",
          description: res.error,
          variant: "error",
        });
      }
    });
  }, [group.id, router, toast]);

  return (
    <div className="pb-12">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-[color:var(--color-separator)] bg-[color:var(--color-bg)]/80 px-2 py-2 backdrop-blur">
        <Link
          href="/app/settings"
          aria-label="戻る"
          className="tap-target inline-flex items-center justify-center rounded-full text-[color:var(--color-accent)]"
        >
          <ArrowLeft className="h-6 w-6" aria-hidden />
        </Link>
        <h1 className="truncate text-ios-headline">{group.name}</h1>
      </header>

      {/* Hero card */}
      <section className="px-4 pt-4">
        <div className="rounded-[var(--radius-lg)] bg-[color:var(--color-surface)] p-4">
          <h2 className="text-ios-title2 text-[color:var(--color-text-primary)]">
            {group.name}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-ios-footnote text-[color:var(--color-text-secondary)]">
              メンバー {members.length}人
            </span>
            {myRole ? (
              <span
                className={cn(
                  "text-ios-caption1 rounded-full px-2 py-0.5",
                  isAdmin
                    ? "bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]"
                    : "bg-[color:var(--color-surface-2)] text-[color:var(--color-text-secondary)]",
                )}
              >
                あなた: {ROLE_LABEL[myRole]}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {/* Invite code (ADMIN only) */}
      {isAdmin ? (
        <section className="mt-4 px-4">
          <div className="rounded-[var(--radius-lg)] bg-[color:var(--color-surface)] p-4">
            <p className="text-ios-subhead text-[color:var(--color-text-secondary)]">
              招待コード
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <code className="text-ios-title3 font-mono tracking-widest text-[color:var(--color-text-primary)]">
                {group.inviteCode}
              </code>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Copy className="h-4 w-4" aria-hidden />}
                onClick={handleCopyCode}
              >
                コピー
              </Button>
            </div>
            <p className="mt-2 text-ios-footnote text-[color:var(--color-text-tertiary)]">
              このコードを生徒に共有してください。
            </p>
          </div>
        </section>
      ) : null}

      {/* Admin add-task button */}
      {isAdmin ? (
        <section className="mt-4 px-4">
          <Button
            fullWidth
            leftIcon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={() => quickAdd.open(group.id)}
          >
            グループ課題を追加
          </Button>
        </section>
      ) : null}

      {/* Tasks */}
      <section aria-labelledby="group-tasks-heading" className="mt-6">
        <div className="flex items-center gap-2 px-4 pb-2">
          <h2
            id="group-tasks-heading"
            className="text-ios-headline text-[color:var(--color-text-primary)]"
          >
            課題
          </h2>
          <span
            className="text-ios-footnote text-[color:var(--color-text-secondary)]"
            aria-label={`${optimistic.length}件`}
          >
            ({optimistic.length})
          </span>
        </div>
        {optimistic.length === 0 ? (
          <p className="px-4 text-ios-footnote text-[color:var(--color-text-tertiary)]">
            課題はまだありません。
          </p>
        ) : (
          <ul role="list" className="divide-y divide-[color:var(--color-separator)]">
            {optimistic.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                now={now}
                canDelete={isAdmin}
                onToggle={(next) => handleToggle(task.id, next)}
                onDelete={() => handleDelete(task.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Members */}
      <section aria-labelledby="members-heading" className="mt-6">
        <div className="flex items-center gap-2 px-4 pb-2">
          <h2
            id="members-heading"
            className="text-ios-headline text-[color:var(--color-text-primary)]"
          >
            メンバー
          </h2>
          <span
            className="text-ios-footnote text-[color:var(--color-text-secondary)]"
            aria-label={`${members.length}人`}
          >
            ({members.length})
          </span>
        </div>
        <ul
          role="list"
          className="divide-y divide-[color:var(--color-separator)] border-y border-[color:var(--color-separator)] bg-[color:var(--color-surface)]"
        >
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="truncate text-ios-body text-[color:var(--color-text-primary)]">
                {m.displayName || "(名前未設定)"}
              </span>
              <span
                className={cn(
                  "text-ios-caption1 rounded-full px-2 py-0.5",
                  m.role === "ADMIN"
                    ? "bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]"
                    : "bg-[color:var(--color-surface-2)] text-[color:var(--color-text-secondary)]",
                )}
              >
                {ROLE_LABEL[m.role]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Destructive: leave */}
      <section className="mt-10 px-4">
        <Button
          variant="destructive"
          fullWidth
          leftIcon={<LogOut className="h-4 w-4" aria-hidden />}
          onClick={() => setLeaveOpen(true)}
        >
          このグループから退出
        </Button>
      </section>

      <BottomSheet
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="グループから退出しますか？"
        snapPoints={[0.4]}
      >
        <div className="space-y-4 pt-2">
          <p className="text-ios-callout text-[color:var(--color-text-secondary)]">
            退出すると、このグループの課題は表示されなくなります。再参加には招待コードが必要です。
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="destructive"
              fullWidth
              loading={leavePending}
              onClick={handleLeave}
            >
              退出する
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setLeaveOpen(false)}
              disabled={leavePending}
            >
              キャンセル
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TaskRow
// -----------------------------------------------------------------------------

type TaskRowProps = {
  task: TaskWithMySubmission;
  now: Date;
  canDelete: boolean;
  onToggle: (next: "PENDING" | "SUBMITTED") => void;
  onDelete: () => void;
};

function TaskRow({
  task,
  now,
  canDelete,
  onToggle,
  onDelete,
}: TaskRowProps): React.JSX.Element {
  const submitted = task.mySubmission?.status === "SUBMITTED";
  const deadline = new Date(task.deadlineAt);
  const urgency = calculateUrgency(deadline, now);
  const subj = subjectColor(task.subject);
  const detailHref = `/app/tasks/${task.id}`;

  const rightActions = [
    {
      key: "edit",
      label: "編集",
      icon: <Pencil className="h-4 w-4" aria-hidden />,
      color: "blue" as const,
      onAction: () => {
        window.location.assign(detailHref);
      },
    },
    ...(canDelete
      ? [
          {
            key: "del",
            label: "削除",
            icon: <Trash2 className="h-4 w-4" aria-hidden />,
            color: "red" as const,
            onAction: () => onDelete(),
          },
        ]
      : []),
  ];

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
        rightActions={rightActions}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="shrink-0">
            <Checkbox
              checked={submitted}
              onCheckedChange={(v) => onToggle(v ? "SUBMITTED" : "PENDING")}
              aria-label={submitted ? "完了を取り消す" : "完了にする"}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
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
