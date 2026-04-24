"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  Plus,
  User as UserIcon,
  Mail,
  LogOut,
  BellRing,
  BellDot,
  Calendar,
  Copy,
  Link2,
  RefreshCw,
  Unplug,
  Users,
  Info,
  FileText,
  Shield,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type {
  Profile,
  NotificationSetting,
  MembershipRole,
  Group,
  GoogleCalendarConnection,
} from "@/lib/db/types";
import {
  updateProfileAction,
  updateNotificationSettingsAction,
  syncGoogleCalendarNowAction,
  disconnectGoogleCalendarAction,
  ensureIcalFeedUrlAction,
  regenerateIcalFeedUrlAction,
} from "@/app/app/_actions/settings";
import {
  createGroupAction,
  joinGroupByCodeAction,
} from "@/app/app/_actions/groups";

type GroupWithMeta = Group & { memberCount: number; myRole: MembershipRole };

type Props = {
  profile: Profile | null;
  groups: GroupWithMeta[];
  notif: NotificationSetting | null;
  googleCalendarConnection: GoogleCalendarConnection | null;
  icalFeedUrl: string | null;
  authEmail: string | null;
};

const REMIND_OPTIONS = [0, 1, 2, 3, 7] as const;

const APP_VERSION = "0.2.0";

export function SettingsClient({
  profile,
  groups,
  notif,
  googleCalendarConnection,
  icalFeedUrl,
  authEmail,
}: Props): React.JSX.Element {
  const { show } = useToast();

  // Optimistic local state that mirrors server.
  const [displayName, setDisplayName] = React.useState<string>(
    profile?.displayName ?? "",
  );
  const [notifState, setNotifState] = React.useState<NotificationSetting | null>(
    notif,
  );
  const [googleCalendarState, setGoogleCalendarState] =
    React.useState<GoogleCalendarConnection | null>(googleCalendarConnection);
  const [icalFeedUrlState, setIcalFeedUrlState] = React.useState<string | null>(
    icalFeedUrl,
  );

  const [profileSheetOpen, setProfileSheetOpen] = React.useState(false);
  const [emailSheetOpen, setEmailSheetOpen] = React.useState(false);
  const [createGroupSheetOpen, setCreateGroupSheetOpen] = React.useState(false);
  const [joinGroupSheetOpen, setJoinGroupSheetOpen] = React.useState(false);

  // --- Actions ------------------------------------------------------------

  const [, startTransition] = React.useTransition();

  const handleSaveDisplayName = (next: string) => {
    const trimmed = next.trim();
    if (trimmed === "") {
      show({ variant: "error", title: "表示名を入力してください" });
      return;
    }
    startTransition(async () => {
      const res = await updateProfileAction({ displayName: trimmed });
      if (res.ok) {
        setDisplayName(res.data.displayName);
        setProfileSheetOpen(false);
        show({ variant: "success", title: "表示名を更新しました" });
      } else {
        show({ variant: "error", title: "更新に失敗しました", description: res.error });
      }
    });
  };

  const handleNotifPatch = (
    patch: Parameters<typeof updateNotificationSettingsAction>[0],
  ) => {
    startTransition(async () => {
      const res = await updateNotificationSettingsAction(patch);
      if (res.ok) {
        setNotifState(res.data);
      } else {
        show({
          variant: "error",
          title: "通知設定の更新に失敗しました",
          description: res.error,
        });
      }
    });
  };

  const handleSyncGoogleCalendar = () => {
    startTransition(async () => {
      const res = await syncGoogleCalendarNowAction();
      if (res.ok) {
        setGoogleCalendarState((prev) =>
          prev ? { ...prev, lastSyncedAt: new Date().toISOString() } : prev,
        );
        show({
          variant: "success",
          title: "Googleカレンダーを同期しました",
          description: `作成 ${res.data.created}件 / 更新 ${res.data.updated}件 / 削除 ${res.data.deleted}件`,
        });
      } else {
        if (res.code === "GOOGLE_RECONNECT_REQUIRED") {
          setGoogleCalendarState(null);
          show({
            variant: "error",
            title: "Google再連携が必要です",
            description: "設定の「Googleカレンダーを連携」から再連携してください",
          });
          return;
        }
        if (res.code === "GOOGLE_OAUTH_CLIENT_INVALID") {
          show({
            variant: "error",
            title: "Google連携設定エラー",
            description:
              "サーバー側のGoogle OAuth設定が無効です。しばらくしてから再試行してください",
          });
          return;
        }
        show({
          variant: "error",
          title: "Googleカレンダー同期に失敗しました",
          description: res.error,
        });
      }
    });
  };

  const handleDisconnectGoogleCalendar = () => {
    startTransition(async () => {
      const res = await disconnectGoogleCalendarAction();
      if (res.ok) {
        setGoogleCalendarState(null);
        show({ variant: "success", title: "Google連携を解除しました" });
      } else {
        show({
          variant: "error",
          title: "Google連携の解除に失敗しました",
          description: res.error,
        });
      }
    });
  };

  const handleEnsureIcalFeedUrl = () => {
    startTransition(async () => {
      const res = await ensureIcalFeedUrlAction();
      if (res.ok) {
        setIcalFeedUrlState(res.data.url);
        show({ variant: "success", title: "iCalフィードURLを作成しました" });
      } else {
        show({
          variant: "error",
          title: "iCalフィードURLの作成に失敗しました",
          description: res.error,
        });
      }
    });
  };

  const handleRegenerateIcalFeedUrl = () => {
    startTransition(async () => {
      const res = await regenerateIcalFeedUrlAction();
      if (res.ok) {
        setIcalFeedUrlState(res.data.url);
        show({
          variant: "success",
          title: "iCalフィードURLを再生成しました",
          description: "以前のURLは無効になります",
        });
      } else {
        show({
          variant: "error",
          title: "iCalフィードURLの再生成に失敗しました",
          description: res.error,
        });
      }
    });
  };

  const handleCopyIcalFeedUrl = async () => {
    if (!icalFeedUrlState) return;
    try {
      await navigator.clipboard.writeText(icalFeedUrlState);
      show({ variant: "success", title: "iCalフィードURLをコピーしました" });
    } catch {
      show({
        variant: "error",
        title: "コピーに失敗しました",
        description: "ブラウザのクリップボード権限を確認してください",
      });
    }
  };

  const handleTogglePush = async (next: boolean) => {
    if (next && typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          show({
            variant: "error",
            title: "通知の許可が必要です",
            description: "ブラウザの設定で通知を許可してください",
          });
          return;
        }
      } catch {
        // ignore — fall through
      }
    }
    handleNotifPatch({ pushEnabled: next });
  };

  const emailEnabled = notifState?.emailEnabled ?? false;
  const pushEnabled = notifState?.pushEnabled ?? false;
  const remindBeforeDays = notifState?.remindBeforeDays ?? 1;
  const notifEmail = notifState?.emailAddress ?? null;
  const googleConnected = !!googleCalendarState;
  const googleLastSyncedLabel = googleCalendarState?.lastSyncedAt
    ? new Date(googleCalendarState.lastSyncedAt).toLocaleString("ja-JP")
    : "未同期";

  return (
    <div className="min-h-dvh bg-[color:var(--color-surface)] pt-safe">
      <header className="px-4 pt-4 pb-3">
        <h1 className="text-ios-title1 text-[color:var(--color-text-primary)]">
          設定
        </h1>
      </header>

      <div className="flex flex-col gap-6 px-4 pb-10">
        {/* Section 1: アカウント */}
        <section>
          <SectionHeader>アカウント</SectionHeader>
          <GroupedList>
            <Row
              leftIcon={<UserIcon size={18} aria-hidden="true" />}
              label="表示名"
              onClick={() => setProfileSheetOpen(true)}
              right={
                <>
                  <span className="text-ios-body text-[color:var(--color-text-secondary)] truncate max-w-[160px]">
                    {displayName || "(未設定)"}
                  </span>
                  <ChevronRight
                    size={18}
                    className="text-[color:var(--color-text-tertiary)] shrink-0"
                    aria-hidden="true"
                  />
                </>
              }
            />
            <Row
              leftIcon={<Mail size={18} aria-hidden="true" />}
              label="メールアドレス"
              right={
                <span className="text-ios-body text-[color:var(--color-text-secondary)] truncate max-w-[200px]">
                  {authEmail ?? "(未登録)"}
                </span>
              }
            />
            <form
              action="/auth/signout"
              method="post"
              className="flex w-full"
            >
              <button
                type="submit"
                className="flex-1 flex items-center justify-between px-4 py-3 min-h-[48px] tap-target text-left active:bg-[color:var(--color-separator)]/30"
              >
                <span className="flex items-center gap-3">
                  <LogOut
                    size={18}
                    className="text-[color:var(--color-danger)]"
                    aria-hidden="true"
                  />
                  <span className="text-ios-body text-[color:var(--color-danger)]">
                    ログアウト
                  </span>
                </span>
              </button>
            </form>
          </GroupedList>
        </section>

        {/* Section 2: Google連携 */}
        <section>
          <SectionHeader>Google連携</SectionHeader>
          <GroupedList>
            <Row
              leftIcon={<Link2 size={18} aria-hidden="true" />}
              label="Googleアカウント"
              right={
                <span className="text-ios-body text-[color:var(--color-text-secondary)] truncate max-w-[180px]">
                  {googleCalendarState?.googleEmail ?? "(未連携)"}
                </span>
              }
            />
            <Row
              leftIcon={<Calendar size={18} aria-hidden="true" />}
              label="最終同期"
              right={
                <span className="text-ios-body text-[color:var(--color-text-secondary)] truncate max-w-[180px]">
                  {googleLastSyncedLabel}
                </span>
              }
            />
            {!googleConnected ? (
              <Link
                href="/auth/google?next=%2Fapp%2Fsettings&calendar=1"
                className="flex items-center justify-between px-4 py-3 min-h-[48px] tap-target active:bg-[color:var(--color-separator)]/30"
              >
                <span className="flex items-center gap-3">
                  <Link2 size={18} aria-hidden="true" />
                  <span className="text-ios-body text-[color:var(--color-text-primary)]">
                    Googleカレンダーを連携
                  </span>
                </span>
                <ChevronRight
                  size={18}
                  className="text-[color:var(--color-text-tertiary)]"
                  aria-hidden="true"
                />
              </Link>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSyncGoogleCalendar}
                  leftIcon={<RefreshCw size={14} aria-hidden="true" />}
                >
                  今すぐ同期
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnectGoogleCalendar}
                  leftIcon={<Unplug size={14} aria-hidden="true" />}
                >
                  連携解除
                </Button>
              </div>
            )}
          </GroupedList>
        </section>

        {/* Section 3: TimeTree (iCal) */}
        <section>
          <SectionHeader>TimeTree連携（iCal）</SectionHeader>
          <GroupedList>
            <div className="flex flex-col gap-2 px-4 py-3">
              <p className="text-ios-subhead text-[color:var(--color-text-secondary)]">
                TimeTreeでは外部カレンダーとしてこのURLを購読してください。
              </p>
              <p className="break-all rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-3 text-ios-caption1 text-[color:var(--color-text-secondary)]">
                {icalFeedUrlState ?? "未作成"}
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-3">
              {!icalFeedUrlState ? (
                <Button variant="secondary" size="sm" onClick={handleEnsureIcalFeedUrl}>
                  URLを作成
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyIcalFeedUrl}
                    leftIcon={<Copy size={14} aria-hidden="true" />}
                  >
                    URLをコピー
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerateIcalFeedUrl}
                  >
                    URLを再生成
                  </Button>
                </>
              )}
            </div>
          </GroupedList>
        </section>

        {/* Section 4: 通知 */}
        <section>
          <SectionHeader>通知</SectionHeader>
          <GroupedList>
            <Row
              leftIcon={<BellRing size={18} aria-hidden="true" />}
              label="メール通知"
              right={
                <Toggle
                  checked={emailEnabled}
                  onCheckedChange={(v) =>
                    handleNotifPatch({ emailEnabled: v })
                  }
                  aria-label="メール通知"
                />
              }
            />
            {emailEnabled ? (
              <Row
                leftIcon={<Mail size={18} aria-hidden="true" />}
                label="メール通知先"
                onClick={() => setEmailSheetOpen(true)}
                right={
                  <>
                    <span className="text-ios-body text-[color:var(--color-text-secondary)] truncate max-w-[180px]">
                      {notifEmail ?? "(アカウントのメール)"}
                    </span>
                    <ChevronRight
                      size={18}
                      className="text-[color:var(--color-text-tertiary)] shrink-0"
                      aria-hidden="true"
                    />
                  </>
                }
              />
            ) : null}
            <Row
              leftIcon={<BellDot size={18} aria-hidden="true" />}
              label="プッシュ通知"
              right={
                <Toggle
                  checked={pushEnabled}
                  onCheckedChange={handleTogglePush}
                  aria-label="プッシュ通知"
                />
              }
            />
            <div className="flex flex-col gap-2 px-4 py-3 min-h-[48px]">
              <div className="flex items-center gap-3">
                <Calendar size={18} aria-hidden="true" />
                <span className="text-ios-body text-[color:var(--color-text-primary)]">
                  何日前に通知
                </span>
              </div>
              <div
                role="radiogroup"
                aria-label="何日前に通知するか"
                className="flex gap-2 flex-wrap"
              >
                {REMIND_OPTIONS.map((d) => {
                  const active = remindBeforeDays === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        handleNotifPatch({ remindBeforeDays: d })
                      }
                      className={cn(
                        "inline-flex items-center justify-center rounded-full h-9 px-4 text-ios-subhead transition-colors",
                        active
                          ? "bg-[color:var(--color-accent)] text-white"
                          : "bg-[color:var(--color-surface)] text-[color:var(--color-text-primary)]",
                      )}
                    >
                      {d === 0 ? "当日" : `${d}日前`}
                    </button>
                  );
                })}
              </div>
            </div>
          </GroupedList>
        </section>

        {/* Section 5: グループ */}
        <section>
          <div className="flex items-center justify-between mb-2 px-4">
            <h2 className="text-ios-footnote text-[color:var(--color-text-secondary)] uppercase tracking-wider">
              グループ
            </h2>
            <button
              type="button"
              onClick={() => setCreateGroupSheetOpen(true)}
              className="inline-flex items-center gap-1 text-ios-subhead text-[color:var(--color-accent)] tap-target px-2 -mr-2"
            >
              <Plus size={16} aria-hidden="true" />
              <span>新規</span>
            </button>
          </div>

          {groups.length === 0 ? (
            <GroupedList>
              <div className="flex flex-col items-center gap-3 px-4 py-6">
                <Users
                  size={28}
                  className="text-[color:var(--color-text-tertiary)]"
                  aria-hidden="true"
                />
                <p className="text-ios-subhead text-[color:var(--color-text-secondary)] text-center">
                  参加しているグループはありません
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setJoinGroupSheetOpen(true)}
                >
                  招待コードで参加
                </Button>
              </div>
            </GroupedList>
          ) : (
            <>
              <GroupedList>
                {groups.map((g) => (
                  <Link
                    key={g.id}
                    href={`/app/groups/${g.id}`}
                    className="flex items-center justify-between px-4 py-3 min-h-[48px] tap-target active:bg-[color:var(--color-separator)]/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Users size={18} aria-hidden="true" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-ios-body text-[color:var(--color-text-primary)] truncate">
                          {g.name}
                        </span>
                        <span className="text-ios-footnote text-[color:var(--color-text-secondary)]">
                          メンバー {g.memberCount}名
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {g.myRole === "ADMIN" ? (
                        <span className="inline-flex items-center rounded-full bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)] px-2 py-0.5 text-ios-caption1">
                          管理者
                        </span>
                      ) : null}
                      <ChevronRight
                        size={18}
                        className="text-[color:var(--color-text-tertiary)]"
                        aria-hidden="true"
                      />
                    </div>
                  </Link>
                ))}
              </GroupedList>
              <div className="mt-3 px-1">
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => setJoinGroupSheetOpen(true)}
                >
                  招待コードで参加
                </Button>
              </div>
            </>
          )}
        </section>

        {/* Section 6: アプリ情報 */}
        <section>
          <SectionHeader>アプリ情報</SectionHeader>
          <GroupedList>
            <Row
              leftIcon={<Info size={18} aria-hidden="true" />}
              label="バージョン"
              right={
                <span className="text-ios-body text-[color:var(--color-text-secondary)]">
                  {APP_VERSION}
                </span>
              }
            />
            <LinkRow
              href="/terms"
              leftIcon={<FileText size={18} aria-hidden="true" />}
              label="利用規約"
            />
            <LinkRow
              href="/privacy"
              leftIcon={<Shield size={18} aria-hidden="true" />}
              label="プライバシーポリシー"
            />
          </GroupedList>
        </section>
      </div>

      {/* -------------- Bottom Sheets -------------- */}
      <DisplayNameSheet
        key={`display-name-${profileSheetOpen ? displayName : "closed"}`}
        open={profileSheetOpen}
        onOpenChange={setProfileSheetOpen}
        initial={displayName}
        onSave={handleSaveDisplayName}
      />
      <EmailAddressSheet
        key={`email-address-${emailSheetOpen ? notifEmail ?? "" : "closed"}`}
        open={emailSheetOpen}
        onOpenChange={setEmailSheetOpen}
        initial={notifEmail ?? ""}
        onSave={(next) => {
          handleNotifPatch({ emailAddress: next === "" ? null : next });
          setEmailSheetOpen(false);
        }}
      />
      <CreateGroupSheet
        key={`create-group-${createGroupSheetOpen ? "open" : "closed"}`}
        open={createGroupSheetOpen}
        onOpenChange={setCreateGroupSheetOpen}
      />
      <JoinGroupSheet
        key={`join-group-${joinGroupSheetOpen ? "open" : "closed"}`}
        open={joinGroupSheetOpen}
        onOpenChange={setJoinGroupSheetOpen}
      />
    </div>
  );
}

// ---------- Presentational helpers -----------------------------------------

function SectionHeader({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <h2 className="text-ios-footnote text-[color:var(--color-text-secondary)] uppercase tracking-wider mb-2 px-4">
      {children}
    </h2>
  );
}

function GroupedList({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-[var(--radius-xl)] bg-[color:var(--color-surface-2)] divide-y divide-[color:var(--color-separator)] overflow-hidden">
      {children}
    </div>
  );
}

type RowProps = {
  leftIcon?: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  onClick?: () => void;
};

function Row({ leftIcon, label, right, onClick }: RowProps): React.JSX.Element {
  const content = (
    <>
      <span className="flex items-center gap-3 min-w-0">
        {leftIcon}
        <span className="text-ios-body text-[color:var(--color-text-primary)] truncate">
          {label}
        </span>
      </span>
      <span className="flex items-center gap-2 shrink-0">{right}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-between px-4 py-3 min-h-[48px] tap-target text-left active:bg-[color:var(--color-separator)]/30"
      >
        {content}
      </button>
    );
  }
  return (
    <div className="flex items-center justify-between px-4 py-3 min-h-[48px] tap-target">
      {content}
    </div>
  );
}

function LinkRow({
  href,
  leftIcon,
  label,
}: {
  href: string;
  leftIcon?: React.ReactNode;
  label: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-4 py-3 min-h-[48px] tap-target active:bg-[color:var(--color-separator)]/30"
    >
      <span className="flex items-center gap-3">
        {leftIcon}
        <span className="text-ios-body text-[color:var(--color-text-primary)]">
          {label}
        </span>
      </span>
      <ChevronRight
        size={18}
        className="text-[color:var(--color-text-tertiary)]"
        aria-hidden="true"
      />
    </Link>
  );
}

// ---------- Sheets ---------------------------------------------------------

function DisplayNameSheet({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: string;
  onSave: (next: string) => void;
}): React.JSX.Element {
  const [value, setValue] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[0.5]}
      title="表示名を編集"
    >
      <div className="flex flex-col gap-4 pt-2">
        <TextField
          label="表示名"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={80}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={() => startTransition(() => onSave(value))}
            loading={pending}
            disabled={pending || value.trim() === ""}
          >
            保存
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function EmailAddressSheet({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: string;
  onSave: (next: string) => void;
}): React.JSX.Element {
  const [value, setValue] = React.useState(initial);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[0.55]}
      title="メール通知先"
    >
      <div className="flex flex-col gap-4 pt-2">
        <TextField
          label="通知先メールアドレス"
          helper="空にするとアカウントのメールへ送信されます"
          type="email"
          inputMode="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="you@example.com"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={() => onSave(value.trim())}>
            保存
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function CreateGroupSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}): React.JSX.Element {
  const { show } = useToast();
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const onSubmit = () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    startTransition(async () => {
      const res = await createGroupAction({ name: trimmed });
      if (res.ok) {
        show({
          variant: "success",
          title: "グループを作成しました",
          description: `招待コード: ${res.data.inviteCode}`,
        });
        onOpenChange(false);
      } else {
        show({
          variant: "error",
          title: "作成に失敗しました",
          description: res.error,
        });
      }
    });
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[0.5]}
      title="新規グループ"
    >
      <div className="flex flex-col gap-4 pt-2">
        <TextField
          label="グループ名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="例: 3年A組"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            loading={pending}
            disabled={pending || name.trim() === ""}
          >
            作成
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function JoinGroupSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}): React.JSX.Element {
  const { show } = useToast();
  const [code, setCode] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const normalized = code.trim().toUpperCase();
  const valid = normalized.length >= 6 && normalized.length <= 16;

  const onSubmit = () => {
    if (!valid) return;
    startTransition(async () => {
      const res = await joinGroupByCodeAction({ code: normalized });
      if (res.ok) {
        show({ variant: "success", title: "参加しました" });
        onOpenChange(false);
      } else {
        show({
          variant: "error",
          title: "参加に失敗しました",
          description: res.error,
        });
      }
    });
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[0.5]}
      title="招待コードで参加"
    >
      <div className="flex flex-col gap-4 pt-2">
        <TextField
          label="招待コード"
          helper="6〜16文字の英数字"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={16}
          placeholder="ABC123"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            loading={pending}
            disabled={pending || !valid}
          >
            参加
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
