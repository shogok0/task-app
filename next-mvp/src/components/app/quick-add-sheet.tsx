"use client";

import * as React from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuickAdd } from "@/components/app/quick-add-provider";
import { useToast } from "@/components/ui/toast";
import { parseJpInput } from "@/lib/nlp/parse-jp-date";
import { subjectColor } from "@/lib/task-subjects";
import {
  createPersonalTaskAction,
  createGroupTaskAction,
} from "@/app/app/_actions/tasks";
import { cn } from "@/lib/utils";

export type QuickAddGroup = {
  id: string;
  name: string;
  role: "MEMBER" | "ADMIN";
};

type Props = {
  groups: QuickAddGroup[];
};

type Scope = { kind: "personal" } | { kind: "group"; groupId: string };

const DEADLINE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDeadlinePill(d: Date): string {
  // Render like "YYYY/M/D(曜) HH:MM" using ja-JP locale parts.
  const parts = DEADLINE_FORMATTER.formatToParts(d);
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

/**
 * Format a Date for an `<input type="datetime-local">` value, in LOCAL time.
 * Returns "YYYY-MM-DDTHH:MM".
 */
function toLocalDatetimeInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${mo}-${day}T${hh}:${mm}`;
}

function parseLocalDatetimeInput(v: string): Date | null {
  if (!v) return null;
  // Input format: "YYYY-MM-DDTHH:MM". Parse as local time.
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

export function QuickAddSheet({ groups }: Props): React.JSX.Element {
  const { isOpen, close, presetGroupId } = useQuickAdd();
  const { show } = useToast();
  const [pending, startTransition] = React.useTransition();

  const adminGroups = React.useMemo(
    () => groups.filter((g) => g.role === "ADMIN"),
    [groups],
  );

  // --- Form state ---
  const [inputText, setInputText] = React.useState<string>("");
  const [nowAtFocus, setNowAtFocus] = React.useState<Date>(() => new Date());
  const [scope, setScope] = React.useState<Scope>({ kind: "personal" });
  const [overrideDeadline, setOverrideDeadline] = React.useState<string>("");
  const [description, setDescription] = React.useState<string>("");
  const [showDescription, setShowDescription] = React.useState<boolean>(false);
  const [titleError, setTitleError] = React.useState<string | null>(null);
  const [deadlineError, setDeadlineError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Re-initialize state on open.
  React.useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    setNowAtFocus(now);
    setInputText("");
    setOverrideDeadline("");
    setDescription("");
    setShowDescription(false);
    setTitleError(null);
    setDeadlineError(null);
    setFormError(null);

    if (
      presetGroupId &&
      adminGroups.some((g) => g.id === presetGroupId)
    ) {
      setScope({ kind: "group", groupId: presetGroupId });
    } else {
      setScope({ kind: "personal" });
    }

    // Focus input after sheet mounts.
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, presetGroupId, adminGroups]);

  // Parse NLP in useMemo, keyed to inputText and the captured `nowAtFocus`.
  const parsed = React.useMemo(
    () => parseJpInput(inputText, nowAtFocus),
    [inputText, nowAtFocus],
  );

  // Effective deadline: override (if set) beats NLP-extracted.
  const overrideDate = React.useMemo(
    () => parseLocalDatetimeInput(overrideDeadline),
    [overrideDeadline],
  );
  const effectiveDeadline: Date | null = overrideDate ?? parsed.deadlineAt;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (titleError) setTitleError(null);
    if (formError) setFormError(null);
  };

  const handleOverrideChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOverrideDeadline(e.target.value);
    if (deadlineError) setDeadlineError(null);
    if (formError) setFormError(null);
  };

  const handleSubmit = () => {
    const title = parsed.title.trim();
    let ok = true;
    if (title === "") {
      setTitleError("タスク名を入力してください");
      ok = false;
    }
    if (!effectiveDeadline) {
      setDeadlineError("締切を指定してください");
      ok = false;
    }
    if (!ok || !effectiveDeadline) return;

    const payload = {
      subject: parsed.subject ?? null,
      title,
      description: description.trim() === "" ? null : description.trim(),
      deadlineAt: effectiveDeadline.toISOString(),
    };

    startTransition(async () => {
      try {
        const result =
          scope.kind === "personal"
            ? await createPersonalTaskAction(payload)
            : await createGroupTaskAction({
                ...payload,
                groupId: scope.groupId,
              });

        if (result.ok) {
          show({ variant: "success", title: "追加しました" });
          close();
          // Reset form so next open is clean (handled also on open effect).
          setInputText("");
          setDescription("");
          setOverrideDeadline("");
          setShowDescription(false);
        } else {
          setFormError(result.error);
          show({
            variant: "error",
            title: "追加に失敗しました",
            description: result.error,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setFormError(msg);
        show({
          variant: "error",
          title: "追加に失敗しました",
          description: msg,
        });
      }
    });
  };

  const parsedSubjectColor = subjectColor(parsed.subject);

  return (
    <BottomSheet
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      snapPoints={[0.9]}
      title="新規タスク"
    >
      <div className="flex h-full flex-col">
        {/* Scrollable content area */}
        <div className="flex-1">
          {/* 1. Large iOS-style input */}
          <div className="pt-2">
            <input
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              placeholder="例: 明日 17時 数学ワーク p.42"
              enterKeyHint="done"
              aria-label="タスク内容"
              aria-invalid={titleError ? true : undefined}
              className={cn(
                "w-full bg-transparent border-0 border-b px-0 py-3",
                "text-ios-title3 text-[color:var(--color-text-primary)]",
                "placeholder:text-[color:var(--color-text-tertiary)]",
                "outline-none focus:outline-none focus:ring-0",
                titleError
                  ? "border-[color:var(--color-danger)]"
                  : "border-[color:var(--color-separator)] focus:border-[color:var(--color-accent)]",
              )}
            />
            {titleError ? (
              <p
                role="alert"
                className="mt-1 text-ios-footnote text-[color:var(--color-danger)]"
              >
                {titleError}
              </p>
            ) : null}
          </div>

          {/* 2. NLP preview row */}
          <div className="mt-3 flex flex-wrap items-center gap-2 min-h-[28px]">
            {parsed.deadlineAt || parsed.subject ? (
              <>
                {parsed.deadlineAt ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-surface)] px-3 py-1 text-ios-footnote text-[color:var(--color-text-primary)]">
                    <span aria-hidden="true">📅</span>
                    <span>{formatDeadlinePill(parsed.deadlineAt)}</span>
                  </span>
                ) : null}
                {parsed.subject ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-ios-footnote",
                      parsedSubjectColor.bg,
                      parsedSubjectColor.text,
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        parsedSubjectColor.dot,
                      )}
                    />
                    <span>{parsed.subject}</span>
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-ios-footnote text-[color:var(--color-text-tertiary)]">
                日付・科目を自動認識します
              </span>
            )}
          </div>

          {/* 3. Scope selector */}
          {adminGroups.length > 0 ? (
            <div className="mt-5">
              <div className="text-ios-caption1 text-[color:var(--color-text-secondary)] mb-2">
                追加先
              </div>
              <div
                role="tablist"
                aria-label="タスク追加先"
                className="flex flex-wrap gap-2"
              >
                <ScopeChip
                  active={scope.kind === "personal"}
                  onClick={() => setScope({ kind: "personal" })}
                >
                  個人
                </ScopeChip>
                {adminGroups.map((g) => {
                  const active =
                    scope.kind === "group" && scope.groupId === g.id;
                  return (
                    <ScopeChip
                      key={g.id}
                      active={active}
                      onClick={() =>
                        setScope({ kind: "group", groupId: g.id })
                      }
                    >
                      {g.name}
                    </ScopeChip>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* 4. Override date picker row */}
          <div className="mt-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-ios-caption1 text-[color:var(--color-text-secondary)]">
                締切を上書き
              </span>
              <input
                type="datetime-local"
                value={
                  overrideDeadline ||
                  (parsed.deadlineAt
                    ? toLocalDatetimeInputValue(parsed.deadlineAt)
                    : "")
                }
                onChange={handleOverrideChange}
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
            </label>
            {deadlineError ? (
              <p
                role="alert"
                className="mt-1 text-ios-footnote text-[color:var(--color-danger)]"
              >
                {deadlineError}
              </p>
            ) : null}
          </div>

          {/* 5. Description expandable */}
          <div className="mt-5">
            {!showDescription ? (
              <button
                type="button"
                onClick={() => setShowDescription(true)}
                className="text-ios-callout text-[color:var(--color-accent)]"
              >
                詳細を追加
              </button>
            ) : (
              <Textarea
                label="詳細"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="任意のメモ・手順など"
              />
            )}
          </div>

          {formError ? (
            <p
              role="alert"
              className="mt-4 text-ios-footnote text-[color:var(--color-danger)]"
            >
              {formError}
            </p>
          ) : null}
        </div>

        {/* 6. Bottom action row */}
        <div
          className="sticky bottom-0 -mx-4 mt-4 flex items-center justify-end gap-2 border-t border-[color:var(--color-separator)] bg-[color:var(--color-surface-2)] px-4 pt-3"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <Button variant="ghost" onClick={close} disabled={pending}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={pending}
            disabled={pending}
          >
            追加
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function ScopeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-3 h-9 text-ios-subhead transition-colors",
        active
          ? "bg-[color:var(--color-accent)] text-white"
          : "bg-[color:var(--color-surface)] text-[color:var(--color-text-primary)]",
      )}
    >
      {children}
    </button>
  );
}
