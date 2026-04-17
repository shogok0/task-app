import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement> & { className?: string };

export function Skeleton({ className, ...rest }: Props): React.JSX.Element {
  return (
    <div
      className={cn(
        "rounded-md bg-[color:var(--color-surface)] animate-pulse",
        className,
      )}
      {...rest}
    />
  );
}

export function TaskRowSkeleton(): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[color:var(--color-surface-2)] p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}

export function TaskListSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <TaskRowSkeleton key={i} />
      ))}
    </div>
  );
}
