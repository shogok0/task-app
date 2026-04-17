import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, Calendar, ListTodo, Users2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCurrentUserId } from "@/lib/supabase/server";

type Feature = {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    icon: ListTodo,
    title: "タスク管理",
    description: "個人とクラスの課題を一か所で管理",
  },
  {
    icon: Bell,
    title: "締切通知",
    description: "忘れる前にメールでお知らせ",
  },
  {
    icon: Calendar,
    title: "カレンダー表示",
    description: "月全体の課題量が一目でわかる",
  },
  {
    icon: Users2,
    title: "クラス共有",
    description: "招待コードでクラスと共有",
  },
];

const INSTALL_STEPS = [
  "Safari / Chrome で共有メニューを開く",
  "「ホーム画面に追加」をタップ",
  "追加されたアイコンから起動",
];

export default async function LandingPage() {
  const userId = await getCurrentUserId();
  if (userId) {
    redirect("/app/today");
  }

  return (
    <main className="pt-safe pb-safe min-h-dvh bg-[color:var(--color-bg)]">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-12 px-5 py-10">
        <section className="flex flex-col items-start gap-6 pt-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-ios-title1 text-[color:var(--color-text-primary)]">
              締切を逃さない課題管理
            </h1>
            <p className="text-ios-body text-[color:var(--color-text-secondary)]">
              個人課題もクラス課題も、スマホひとつで。
            </p>
          </div>

          <div className="flex w-full flex-col gap-3">
            <Link href="/register" prefetch className="block">
              <Button variant="primary" size="lg" fullWidth>
                無料で始める
              </Button>
            </Link>
            <Link href="/login" prefetch className="block">
              <Button variant="secondary" size="lg" fullWidth>
                ログイン
              </Button>
            </Link>
          </div>
        </section>

        <section aria-label="機能" className="grid grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col gap-3 rounded-[var(--radius-xl)] bg-[color:var(--color-surface)] p-4"
            >
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/10"
                aria-hidden
              >
                <Icon
                  className="h-5 w-5 text-[color:var(--color-accent)]"
                  aria-hidden
                />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-ios-headline text-[color:var(--color-text-primary)]">
                  {title}
                </h2>
                <p className="text-ios-footnote text-[color:var(--color-text-secondary)]">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </section>

        <section
          aria-label="ホーム画面に追加"
          className="flex flex-col gap-3 rounded-[var(--radius-xl)] bg-[color:var(--color-surface)] p-5"
        >
          <h2 className="text-ios-headline text-[color:var(--color-text-primary)]">
            ホーム画面に追加
          </h2>
          <p className="text-ios-body text-[color:var(--color-text-secondary)]">
            iOS / Android のブラウザで「ホーム画面に追加」するとアプリのように使えます。
          </p>
          <ol className="text-ios-footnote flex list-decimal flex-col gap-1 pl-5 text-[color:var(--color-text-secondary)]">
            {INSTALL_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <footer className="text-ios-footnote mt-4 flex items-center justify-center gap-4 text-[color:var(--color-text-secondary)]">
          <Link
            href="/terms"
            className="underline-offset-2 hover:underline"
          >
            利用規約
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/privacy"
            className="underline-offset-2 hover:underline"
          >
            プライバシー
          </Link>
        </footer>
      </div>
    </main>
  );
}
