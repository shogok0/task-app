"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md";

type Props = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "onChange"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: Size;
  label?: string;
};

const BOX_SIZE: Record<Size, string> = {
  sm: "w-5 h-5",
  md: "w-7 h-7",
};

const ICON_SIZE: Record<Size, string> = {
  sm: "w-3 h-3",
  md: "w-4 h-4",
};

export function Checkbox({
  checked,
  onCheckedChange,
  size = "md",
  label,
  disabled,
  className,
  onClick,
  onKeyDown,
  ...rest
}: Props) {
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    onCheckedChange(!checked);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onCheckedChange(!checked);
    }
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "tap-target inline-flex items-center gap-3 bg-transparent p-0 select-none disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex items-center justify-center rounded-full border-2 transition-colors",
          BOX_SIZE[size],
          checked
            ? "bg-[color:var(--color-success)] border-[color:var(--color-success)] text-white"
            : "border-[color:var(--color-separator)] bg-transparent text-transparent",
        )}
      >
        <Check className={cn(ICON_SIZE[size], "stroke-[3]")} />
      </span>
      {label ? (
        <span className="text-ios-body text-[color:var(--color-text-primary)]">
          {label}
        </span>
      ) : null}
    </button>
  );
}
