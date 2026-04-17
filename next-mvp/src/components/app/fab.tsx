"use client";
import { Plus } from "lucide-react";

type Props = {
  onClick: () => void;
  "aria-label"?: string;
};

export function FAB({ onClick, ...rest }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rest["aria-label"] ?? "新規タスクを追加"}
      className="fixed right-4 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-white shadow-lg shadow-[color:var(--color-accent)]/30 transition-transform active:scale-95 tap-target"
      style={{
        bottom: "calc(var(--sa-bottom) + 49px + 16px)",
        zIndex: "var(--z-fab)",
      }}
    >
      <Plus size={28} strokeWidth={2.5} />
    </button>
  );
}
