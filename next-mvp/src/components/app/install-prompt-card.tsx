"use client";
import * as React from "react";
import { Share as ShareIcon, PlusSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "install-card-dismissed-v1";
const FIRST_VISIT_KEY = "first-visit-at";

type Props = { taskCount: number };

export function InstallPromptCard({ taskCount }: Props) {
  const [show, setShow] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [platform, setPlatform] = React.useState<"ios" | "android" | "other">("other");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    // Record first visit
    const firstVisit = localStorage.getItem(FIRST_VISIT_KEY);
    if (!firstVisit) {
      localStorage.setItem(FIRST_VISIT_KEY, String(Date.now()));
      return; // don't show on first visit
    }
    const daysSinceFirst = (Date.now() - Number(firstVisit)) / (1000 * 60 * 60 * 24);
    if (daysSinceFirst < 2) return;
    if (taskCount < 3) return;

    // Already installed?
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window as any).navigator?.standalone === true;
    if (isStandalone) return;

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !/MSStream/.test(ua);
    const isAndroid = /Android/.test(ua);
    setPlatform(isIOS ? "ios" : isAndroid ? "android" : "other");

    // Listen for beforeinstallprompt (Android/Chrome)
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // On iOS no event fires — show the card if iOS
    if (isIOS) setShow(true);

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [taskCount]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") dismiss();
  }

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="ホーム画面に追加"
      className="mx-4 my-3 rounded-[var(--radius-xl)] border border-[color:var(--color-separator)] bg-[color:var(--color-surface-2)] p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]">
          <PlusSquare size={20} aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="text-ios-headline">ホーム画面に追加</h3>
          <p className="mt-1 text-ios-footnote text-[color:var(--color-text-secondary)]">
            アプリのように素早く起動できます。
          </p>
          {platform === "ios" && (
            <ol className="mt-2 space-y-1 text-ios-footnote text-[color:var(--color-text-secondary)] list-decimal list-inside">
              <li>Safari 下部の <ShareIcon className="inline" size={14} aria-hidden="true" /> をタップ</li>
              <li>「ホーム画面に追加」を選択</li>
              <li>右上の「追加」をタップ</li>
            </ol>
          )}
          {platform === "android" && deferredPrompt && (
            <Button size="sm" onClick={install} className="mt-3">インストール</Button>
          )}
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
