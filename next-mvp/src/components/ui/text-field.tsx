"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helper?: string;
  error?: string;
};

const BASE_INPUT =
  "h-12 w-full rounded-[var(--radius-md)] border border-[color:var(--color-separator)] bg-[color:var(--color-surface-2)] px-4 text-ios-body text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-tertiary)] outline-none transition-colors focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/20 disabled:opacity-50";

const ERROR_INPUT =
  "border-[color:var(--color-danger)] focus:border-[color:var(--color-danger)] focus:ring-[color:var(--color-danger)]/20";

export const TextField = React.forwardRef<HTMLInputElement, Props>(
  function TextField({ label, helper, error, id, className, ...rest }, ref) {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    const descriptionId = error || helper ? `${inputId}-description` : undefined;
    const hasError = Boolean(error);
    const message = error ?? helper;

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-ios-subhead text-[color:var(--color-text-secondary)]"
          >
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError || undefined}
          aria-describedby={descriptionId}
          className={cn(BASE_INPUT, hasError && ERROR_INPUT, className)}
          {...rest}
        />
        {message ? (
          <p
            id={descriptionId}
            className={cn(
              "text-ios-footnote",
              hasError
                ? "text-[color:var(--color-danger)]"
                : "text-[color:var(--color-text-secondary)]",
            )}
          >
            {message}
          </p>
        ) : null}
      </div>
    );
  },
);
