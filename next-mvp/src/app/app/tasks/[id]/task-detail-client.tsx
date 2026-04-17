"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { subjectColor } from "@/lib/task-subjects";
import { cn } from "@/lib/utils";
import {
  deleteTaskAction,
  toggleSubmissionAction,
  updateTaskAction,
} from "@/app/app/_actions/tasks";
import type { TaskWithMySubmission } from "@/lib/db/types";

type Props = {
  task: TaskWithMySubmission;
  creatorDisplayName: string | null;
  currentUserId: string;
};

const DEADLINE_FMT = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const SUBMITTED_FMT = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const parts = DEADLINE_FMT.formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const mo = String(Number(get("month")));
  const day = String(Number(get("day")));
  const wd = get("weekday");
  const hh = get("hour").padStart(2, "0");
  const mm = get("minute").padStart(2, "0");
  return `${y}/${mo}/${day}(${wd}) ${hh}:${mm}`;
}

function formatRelative(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diffMs = d.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const overdue = diffMs < 0;

  if (absMs < HOUR) {
    const mins = Math.max(1, Math.round(absMs / MIN));
    return overdue ? `${mins}分超過` : `残り${mins}分`;
  }
  if (absMs < DAY) {
    const hrs = Math.round(absMs / HOUR);
    return overdue ? `${hrs}時間超過` : `残り${hrs}時間`;
  }
  const days = Math.round(absMs / DAY);
  return overdue ? `${days}日超過` : `残り${days}日`;
}

function toLocalDatetimeInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocalDatetimeInput(v: string): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, day, hh, mm] = m;
  const d = new Date(
    Number(y),
    Number(mo) - 1,
    Number(day),
    Number(hh),
    Number(mm),
    0,
    0,
  );
  return isNaN(d.getTime()) ? null : d;
}

export function TaskDetailClient({
  task,
  creatorDisplayName,
  currentUserId,
}: Props): React.JSX.Element {
  const router = useRouter();
  const { show } = useToast();
  const [togglePending, startToggle] = React.useTransition();
  const [savePending, startSave] = React.useTransition();
  const [deletePending, startDelete] = React.useTransition();

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  // Edit form state
  const [title, setTitle] = React.useState(task.title);
  const [subject, setSubject] = React.useState(task.subject ?? "");
  const [description, setDescription] = React.useState(task.description ?? "");
  const [deadlineLocal, setDeadlineLocal] = React.useState(
    toLocalDatetimeInputValue(task.deadlineAt),
  );
  const [titleError, setTitleError] = React.useState<string | null>(null);
  const [deadlineError, setDeadlineError] = React.useState<string | null>(null);

  const isSubmitted = task.mySubmission?.status === "SUBMITTED";
  const submittedAt = task.mySubmission?.submittedAt ?? null;
  const isGroupTask = task.scopeType === "GROUP";
  const isCreator = task.createdBy === currentUserId;

  const chipColor = subjectColor(task.subject);

  const onBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/app/today");
    }
  };

  const handleToggle = () => {
    const nextStatus = isSubmitted ? "PENDING" : "SUBMITTED";
    startToggle(async () => {
      const res = await toggleSubmissionAction({
        taskId: task.id,
        status: nextStatus,
      });
      if (res.ok) {
        show({
          variant: "success",
          title: nextStatus === "SUBMITTED" ? "提出済みにしました" : "未提出に戻しました",
        });
        router.refresh();
      } else {
        show({
          variant: "error",
          title: "更新に失敗しました",
          description: res.error,
        });
      }
    });
  };

  const openEdit = () => {
    setTitle(task.title);
    setSubject(task.subject ?? "");
    setDescription(task.description ?? "");
    setDeadlineLocal(toLocalDatetimeInputValue(task.deadlineAt));
    setTitleError(null);
    setDeadlineError(null);
    setMenuOpen(false);
    setEditOpen(true);
  };

  const handleSave = () => {
    let ok = true;
    const trimmedTitle = title.trim();
    const parsedDeadline = parseLocalDatetimeInput(deadlineLocal);
    if (trimmedTitle === "") {
      setTitleError("タスク名を入力してください");
      ok = false;
    }
    if (!parsedDeadline) {
      setDeadlineError("締切を入力してください");
      ok = false;
    }
    if (!ok || !parsedDeadline) return;

    const trimmedSubject = subject.trim();
    const trimmedDescription = description.trim();

    startSave(async () => {
      const res = await updateTaskAction({
        taskId: task.id,
        patch: {
          title: trimmedTitle,
          subject: trimmedSubject === "" ? null : trimmedSubject,
          description: trimmedDescription === "" ? null : trimmedDescription,
          deadlineAt: parsedDeadline.toISOString(),
        },
      });
      if (res.ok) {
        show({ variant: "success", title: "更新しました" });
        setEditOpen(false);
        router.refresh();
      } else {
        show({
          variant: "error",
          title: "更新に失敗しました",
          description: res.error,
        });
      }
    });
  };

  const handleDelete = () => {
    startDelete(async () => {
      const res = await deleteTaskAction({ taskId: task.id });
      if (res.ok) {
        show({ variant: "success", title: "削除しました" });
        setConfirmDeleteOpen(false);
        router.push("/app/today");
      } else {
        show({
          variant: "error",
          title: "削除に失敗しました",
          description: res.error,
        });
      }
    });
  };

  const openDeleteConfirm = () => {
    setMenuOpen(false);
    setConfirmDeleteOpen(true);
  };

  return (
    <div className="mx-auto max-w-xl">
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-2 py-2 bg-[color:var(--color-bg)]/85 backdrop-blur-md"
        style={{ paddingTop: "calc(var(--sa-top) + 8px)" }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="戻る"
          className="tap-target inline-flex items-center gap-1 rounded-full px-2 text-[color:var(--color-accent)]"
        >
          <ChevronLeft size={22} aria-hidden="true" />
          <span className="text-ios-callout">戻る</span>
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="メニューを開く"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="tap-target inline-flex items-center justify-center rounded-full text-[color:var(--color-text-primary)]"
        >
          <MoreHorizontal size={22} aria-hidden="true" />
        </button>
      </div>

      <div className="px-4 pb-10 pt-2">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {task.subject ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-ios-footnote",
                  chipColor.bg,
                  chipColor.text,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("inline-block h-1.5 w-1.5 rounded-full", chipColor.dot)}
                />
                <span>{task.subject}</span>
              </span>
            ) : null}
            {isGroupTask && task.groupName ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-surface)] px-3 py-1 text-ios-footnote text-[color:var(--color-text-secondary)]">
                <Users size={12} aria-hidden="true" />
                <span>{task.groupName}</span>
              </span>
            ) : null}
          </div>
          <h1 className="text-ios-title2 text-[color:var(--color-text-primary)] break-words">
            {task.title}
          </h1>
        </div>

        {/* Meta list */}
        <dl className="mt-5 overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--color-surface-2)]">
          <MetaRow label="締切">
            <div className="flex flex-col items-end">
              <span className="text-ios-body text-[color:var(--color-text-primary)]">
                {formatDeadline(task.deadlineAt)}
              </span>
              <span className="text-ios-footnote text-[color:var(--color-text-secondary)]">
                {formatRelative(task.deadlineAt)}
              </span>
            </div>
          </MetaRow>
          <MetaRow label="作成者">
            <span className="text-ios-body text-[color:var(--color-text-primary)]">
              {creatorDisplayName ?? "…"}
              {isCreator ? (
                <span className="ml-1 text-ios-footnote text-[color:var(--color-text-secondary)]">
                  (あなた)
                </span>
              ) : null}
            </span>
          </MetaRow>
          <MetaRow label="状態" last>
            <div className="flex flex-col items-end">
              <span
                className={cn(
                  "text-ios-body",
                  isSubmitted
                    ? "text-[color:var(--color-success)]"
                    : "text-[color:var(--color-text-primary)]",
                )}
              >
                {isSubmitted ? "提出済み" : "未提出"}
              </span>
              {isSubmitted && submittedAt ? (
                <span className="text-ios-footnote text-[color:var(--color-text-secondary)]">
                  {SUBMITTED_FMT.format(new Date(submittedAt))}
                </span>
              ) : null}
            </div>
          </MetaRow>
        </dl>

        {/* Description */}
        {task.description && task.description.trim() !== "" ? (
          <section className="mt-5" aria-label="詳細">
            <h2 className="mb-2 text-ios-caption1 uppercase tracking-wide text-[color:var(--color-text-secondary)]">
              詳細
            </h2>
            <div className="rounded-[var(--radius-lg)] bg-[color:var(--color-surface-2)] p-4 text-ios-body text-[color:var(--color-text-primary)] whitespace-pre-wrap break-words">
              {task.description}
            </div>
          </section>
        ) : null}

        {/* Primary action */}
        <div className="mt-8">
          {isSubmitted ? (
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              onClick={handleToggle}
              loading={togglePending}
              disabled={togglePending}
              className="text-[color:var(--color-danger)]"
            >
              未提出に戻す
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleToggle}
              loading={togglePending}
              disabled={togglePending}
            >
              完了にする
            </Button>
          )}
        </div>
      </div>

      {/* Kebab menu sheet */}
      <BottomSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        snapPoints={[0.35]}
        title="タスク操作"
      >
        <div className="flex flex-col gap-2" role="menu" aria-label="タスク操作">
          <button
            type="button"
            role="menuitem"
            onClick={openEdit}
            className="tap-target flex items-center gap-3 rounded-[var(--radius-md)] bg-[color:var(--color-surface)] px-4 py-3 text-left text-ios-body text-[color:var(--color-text-primary)] active:bg-[color:var(--color-surface-2)]"
          >
            <Pencil size={20} aria-hidden="true" />
            <span>編集</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={openDeleteConfirm}
            className="tap-target flex items-center gap-3 rounded-[var(--radius-md)] bg-[color:var(--color-surface)] px-4 py-3 text-left text-ios-body text-[color:var(--color-danger)] active:bg-[color:var(--color-surface-2)]"
          >
            <Trash2 size={20} aria-hidden="true" />
            <span>削除</span>
          </button>
        </div>
      </BottomSheet>

      {/* Edit sheet */}
      <BottomSheet
        open={editOpen}
        onOpenChange={(next) => {
          if (savePending) return;
          setEditOpen(next);
        }}
        snapPoints={[0.9]}
        title="タスクを編集"
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-4">
            <TextField
              label="タスク名"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(null);
              }}
              error={titleError ?? undefined}
              placeholder="例: 数学ワーク p.42"
            />
            <TextField
              label="科目"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="例: 数学"
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-ios-subhead text-[color:var(--color-text-secondary)]">
                締切
              </span>
              <input
                type="datetime-local"
                value={deadlineLocal}
                onChange={(e) => {
                  setDeadlineLocal(e.target.value);
                  if (deadlineError) setDeadlineError(null);
                }}
                aria-invalid={deadlineError ? true : undefined}
                className={cn(
                  "h-12 w-full rounded-[var(--radius-md)] border px-4",
                  "bg-[color:var(--color-surface-2)]",
                  "text-ios-body text-[color:var(--color-text-primary)]",
                  "outline-none transition-colors",
                  "focus:ring-2 focus:ring-[color:var(--color-accent)]/20",
                  deadlineError
                    ? "border-[color:var(--color-danger)] focus:border-[color:var(--color-danger)]"
                    : "border-[color:var(--color-separator)] focus:border-[color:var(--color-accent)]",
                )}
              />
              {deadlineError ? (
                <p
                  role="alert"
                  className="text-ios-footnote text-[color:var(--color-danger)]"
                >
                  {deadlineError}
                </p>
              ) : null}
            </label>
            <Textarea
              label="詳細"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="任意のメモ・手順など"
              rows={5}
            />
          </div>
          <div
            className="sticky bottom-0 -mx-4 mt-4 flex items-center justify-end gap-2 border-t border-[color:var(--color-separator)] bg-[color:var(--color-surface-2)] px-4 pt-3"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <Button
              variant="ghost"
              onClick={() => setEditOpen(false)}
              disabled={savePending}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={savePending}
              disabled={savePending}
            >
              保存
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Delete confirmation sheet */}
      <BottomSheet
        open={confirmDeleteOpen}
        onOpenChange={(next) => {
          if (deletePending) return;
          setConfirmDeleteOpen(next);
        }}
        snapPoints={[0.35]}
        title="タスクを削除"
      >
        <div className="flex h-full flex-col">
          <div className="flex-1">
            <p className="text-ios-body text-[color:var(--color-text-primary)]">
              削除してもよろしいですか？
            </p>
            <p className="mt-2 text-ios-footnote text-[color:var(--color-text-secondary)]">
              この操作は取り消せません。
            </p>
          </div>
          <div className="sticky bottom-0 flex items-center justify-end gap-2 pt-3">
            <Button
              variant="ghost"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={deletePending}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              loading={deletePending}
              disabled={deletePending}
            >
              削除する
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function MetaRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-4 py-3",
        !last && "border-b border-[color:var(--color-separator)]",
      )}
    >
      <dt className="text-ios-subhead text-[color:var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

