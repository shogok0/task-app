import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GroupNotFound(): React.JSX.Element {
  return (
    <div className="px-4 py-16 flex flex-col items-center text-center gap-4">
      <h1 className="text-ios-title2">グループが見つかりません</h1>
      <p className="text-ios-callout text-[color:var(--color-text-secondary)]">
        削除されたか、メンバーでなくなった可能性があります。
      </p>
      <Link href="/app/settings" className="mt-2">
        <Button variant="secondary">設定に戻る</Button>
      </Link>
    </div>
  );
}
