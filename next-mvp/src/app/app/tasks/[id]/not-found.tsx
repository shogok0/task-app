import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TaskNotFound(): React.JSX.Element {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--sa-bottom))] max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-ios-title2 text-[color:var(--color-text-primary)]">
        タスクが見つかりません
      </h1>
      <p className="text-ios-callout text-[color:var(--color-text-secondary)]">
        削除されたか、アクセス権がない可能性があります。
      </p>
      <Link href="/app/today" className="mt-2">
        <Button variant="primary" size="md">
          今日のタスクに戻る
        </Button>
      </Link>
    </div>
  );
}
