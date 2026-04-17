"use client";
import * as React from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "notify-prompt-dismissed-v1";

export function NotificationSoftPrompt() {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return; // already decided
    // Require PWA-installed context on iOS (otherwise Notification API won't work)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window as any).navigator?.standalone === true;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    if (isIOS && !isStandalone) return; // on iOS, user must install first
    setShow(true);
  }, []);

  async function enable() {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      try { new Notification("通知が有効になりました 🔔", { body: "締切前にお知らせします" }); } catch {}
    }
    dismiss();
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="通知の有効化"
      className="mx-4 my-3 rounded-[var(--radius-xl)] border border-[color:var(--color-separator)] bg-[color:var(--color-surface-2)] p-4"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]">
          <Bell size={20} aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="text-ios-headline">通知を有効にしますか？</h3>
          <p className="mt-1 text-ios-footnote text-[color:var(--color-text-secondary)]">
            締切前にお知らせします。授業前やテスト前のリマインダーに便利です。
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={enable}>有効にする</Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>あとで</Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="閉じる"
          className="shrink-0 rounded-full p-1 text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-secondary)]"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
