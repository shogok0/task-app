import * as React from "react";
import { Check } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function TasksEmptyAllDone(): React.JSX.Element {
  return (
    <EmptyState
      variant="success"
      icon={<Check />}
      title="お疲れさま！"
      description="今日の分は全部終わりました 🎉"
    />
  );
}
