import * as React from "react";
import { PartyPopper } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function TasksEmptyFirstLogin(): React.JSX.Element {
  return (
    <EmptyState
      icon={<PartyPopper />}
      title="ようこそ 🎉"
      description="最初の宿題を追加してみましょう。下の + ボタンをタップしてください。↓"
    />
  );
}
