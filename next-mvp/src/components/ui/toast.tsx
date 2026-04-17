"use client";

import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "error";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: Variant;
  durationMs?: number;
};

type Ctx = {
  show: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
};

export const ToastContext = React.createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

const DEFAULT_DURATION_MS = 3000;

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = React.useCallback(
    (t: Omit<Toast, "id">) => {
      const id = genId();
      const duration = t.durationMs ?? DEFAULT_DURATION_MS;
      const toast: Toast = { id, ...t };
      setToasts((prev) => [...prev, toast]);
      const timer = setTimeout(() => {
        dismiss(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const ctxValue = React.useMemo<Ctx>(
    () => ({ show, dismiss }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={ctxValue}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 flex flex-col items-center gap-2 px-4"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 72px)",
          zIndex: "var(--z-toast)",
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}): React.JSX.Element {
  const variant = toast.variant ?? "default";
  const isError = variant === "error";
  const isSuccess = variant === "success";

  const borderClass = isSuccess
    ? "border-[color:var(--color-success)]"
    : isError
      ? "border-[color:var(--color-danger)]"
      : "border-[color:var(--color-separator)]";

  const ariaLive = isError ? "assertive" : "polite";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={ariaLive}
      aria-atomic="true"
      onClick={onDismiss}
      className={cn(
        "pointer-events-auto mx-auto flex max-w-[90vw] items-start gap-3 rounded-[var(--radius-lg)] border px-4 py-3 shadow-lg bg-[color:var(--color-surface-2)] text-[color:var(--color-text-primary)]",
        "animate-[toast-in_200ms_ease-out] motion-reduce:animate-none",
        borderClass,
      )}
      style={{
        animation: "toast-slide-up 200ms ease-out",
      }}
    >
      {isSuccess ? (
        <CheckCircle2
          className="mt-[2px] h-5 w-5 shrink-0 text-[color:var(--color-success)]"
          aria-hidden="true"
        />
      ) : null}
      {isError ? (
        <XCircle
          className="mt-[2px] h-5 w-5 shrink-0 text-[color:var(--color-danger)]"
          aria-hidden="true"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-ios-headline">{toast.title}</div>
        {toast.description ? (
          <div className="text-ios-footnote mt-0.5 text-[color:var(--color-text-secondary)]">
            {toast.description}
          </div>
        ) : null}
      </div>
      <style>{`
        @keyframes toast-slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
