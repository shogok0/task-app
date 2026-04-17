"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "destructive" | "ghost";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-lg)] font-semibold tracking-tight transition-[transform,opacity,background-color] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none tap-target select-none";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-3 text-ios-subhead",
  md: "h-11 px-4 text-ios-callout",
  lg: "h-14 px-5 text-ios-headline",
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-[color:var(--color-accent)] text-white active:bg-[color:var(--color-accent)]/80",
  secondary:
    "bg-[color:var(--color-surface)] text-[color:var(--color-text-primary)] active:bg-[color:var(--color-surface-2)]",
  destructive:
    "bg-[color:var(--color-danger)] text-white active:bg-[color:var(--color-danger)]/80",
  ghost:
    "bg-transparent text-[color:var(--color-accent)] active:bg-[color:var(--color-surface)]",
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    children,
    className,
    disabled,
    type,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const renderedLeftIcon = loading ? (
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
  ) : (
    leftIcon
  );

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        BASE_CLASSES,
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {renderedLeftIcon}
      {children}
      {rightIcon}
    </button>
  );
});
