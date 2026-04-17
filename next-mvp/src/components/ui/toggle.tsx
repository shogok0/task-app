"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
};

export function Toggle({
  checked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
}: Props) {
  function toggle() {
    if (disabled) return;
    onCheckedChange(!checked);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === " ") {
      event.preventDefault();
      toggle();
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-on={checked ? "" : undefined}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative w-[52px] h-[32px] rounded-full bg-[color:var(--color-separator)] transition-colors data-[on]:bg-[color:var(--color-success)] disabled:opacity-50 disabled:pointer-events-none",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[2px] left-[2px] w-7 h-7 rounded-full bg-white shadow-md transition-transform",
          checked && "translate-x-[20px]",
        )}
      />
    </button>
  );
}
