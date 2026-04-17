import * as React from "react";
import { Coffee } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function TasksEmptyToday(): React.JSX.Element {
  return (
    <EmptyState
      icon={<Coffee />}
      title="今日やることはありません"
      description="新しい課題はまだないようです。ゆっくり休んでね。"
    />
  );
}
