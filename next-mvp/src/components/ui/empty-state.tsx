"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Variant = "default" | "success";

type Action = {
  label: string;
  onClick?: () => void;
  href?: string;
};

type Props = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: Action;
  variant?: Variant;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "default",
  className,
}: Props): React.JSX.Element {
  const iconBgClass =
    variant === "success"
      ? "bg-[color:var(--color-success)]/15"
      : "bg-[color:var(--color-surface)]";

  const iconColorClass =
    variant === "success"
      ? "text-[color:var(--color-success)]"
      : "text-[color:var(--color-text-secondary)]";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6",
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "flex h-24 w-24 items-center justify-center rounded-2xl",
            iconBgClass,
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              "flex h-12 w-12 items-center justify-center",
              iconColorClass,
              "[&_svg]:h-12 [&_svg]:w-12",
            )}
          >
            {icon}
          </span>
        </div>
      ) : null}

      <h2 className="text-ios-title3 mt-6 text-center text-[color:var(--color-text-primary)]">
        {title}
      </h2>

      {description ? (
        <p className="text-ios-callout mt-2 max-w-[320px] text-center leading-relaxed text-[color:var(--color-text-secondary)]">
          {description}
        </p>
      ) : null}

      {action ? (
        <div className="mt-6">
          {action.href ? (
            <Link href={action.href} className="inline-block">
              <Button variant="primary">{action.label}</Button>
            </Link>
          ) : (
            <Button variant="primary" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
