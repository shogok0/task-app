"use client";

import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heights as a fraction of the viewport (0..1). Defaults to `[0.9]`. */
  snapPoints?: number[];
  /** Index into `snapPoints` used on open. Defaults to `0`. */
  initialSnap?: number;
  /** Whether the sheet can be dismissed by backdrop/drag/Escape. Defaults to `true`. */
  dismissible?: boolean;
  /** Optional heading. Also used as accessible label. */
  title?: string;
  children: React.ReactNode;
  className?: string;
};

const TRANSITION =
  "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)";
const REDUCED_TRANSITION = "none";
const RUBBER_BAND_PX = 40;
const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BottomSheet({
  open,
  onOpenChange,
  snapPoints,
  initialSnap = 0,
  dismissible = true,
  title,
  children,
  className,
}: BottomSheetProps) {
  const snaps = useMemo(() => {
    const s = snapPoints && snapPoints.length > 0 ? snapPoints : [0.9];
    return s.map((v) => Math.min(Math.max(v, 0.05), 1));
  }, [snapPoints]);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false); // controls backdrop opacity + translate
  const [currentSnap, setCurrentSnap] = useState(
    Math.min(Math.max(initialSnap, 0), snaps.length - 1),
  );
  const [translateY, setTranslateY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startY: number;
    startTranslateY: number;
    startTime: number;
  } | null>(null);

  const reducedMotion = typeof window !== "undefined" && prefersReducedMotion();
  const titleId = useId();
  const headingId = title ? `${titleId}-title` : undefined;

  // SSR guard — only render after mount.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Snap height in pixels for the currently active snap.
  const getSnapHeightPx = useCallback(
    (idx: number): number => {
      if (typeof window === "undefined") return 0;
      const safe = Math.min(Math.max(idx, 0), snaps.length - 1);
      return snaps[safe] * window.innerHeight;
    },
    [snaps],
  );

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Opening/closing animation + snap reset.
  useLayoutEffect(() => {
    if (!mounted) return;
    if (open) {
      // Reset to initial snap when opening.
      const startIdx = Math.min(Math.max(initialSnap, 0), snaps.length - 1);
      setCurrentSnap(startIdx);
      setTranslateY(0);
      // Trigger transition next frame.
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
    }
  }, [open, mounted, initialSnap, snaps.length]);

  // Focus management.
  useEffect(() => {
    if (!open || !mounted) return;
    previousFocusRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    // Defer focus to allow portal children to mount.
    const id = requestAnimationFrame(() => {
      const root = sheetRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const first = focusable[0];
      if (first) {
        first.focus();
      } else {
        root.focus();
      }
    });
    return () => {
      cancelAnimationFrame(id);
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === "function") {
        prev.focus();
      }
    };
  }, [open, mounted]);

  // Escape key.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissible, onOpenChange]);

  const onBackdropClick = useCallback(() => {
    if (dismissible) onOpenChange(false);
  }, [dismissible, onOpenChange]);

  // --- Drag handling -------------------------------------------------------

  const onDragPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Only primary button / touch / pen.
      if (e.button !== undefined && e.button > 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStateRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startTranslateY: translateY,
        startTime: performance.now(),
      };
      setDragging(true);
    },
    [translateY],
  );

  const onDragPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== e.pointerId) return;
      const dy = e.clientY - state.startY;
      let next = state.startTranslateY + dy;
      // Rubber-band when pulled up beyond the top of the current snap.
      if (next < 0) {
        const over = -next;
        const damped = RUBBER_BAND_PX * (1 - Math.exp(-over / RUBBER_BAND_PX));
        next = -damped;
      }
      setTranslateY(next);
    },
    [],
  );

  const onDragPointerEnd = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== e.pointerId) return;
      const now = performance.now();
      const dt = Math.max(now - state.startTime, 1);
      const dy = e.clientY - state.startY;
      const velocity = dy / dt; // px per ms, positive=down
      const snapHeightPx = getSnapHeightPx(currentSnap);
      const finalTranslate = state.startTranslateY + dy;

      dragStateRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      setDragging(false);

      const goingDown =
        velocity > 0.8 || finalTranslate > 0.3 * snapHeightPx;
      const goingUp =
        velocity < -0.5 || finalTranslate < -0.3 * snapHeightPx;

      if (goingDown) {
        if (currentSnap === 0) {
          if (dismissible) {
            onOpenChange(false);
            return;
          }
          // Rubber back to snap 0.
          setTranslateY(0);
          return;
        }
        setCurrentSnap(currentSnap - 1);
        setTranslateY(0);
        return;
      }

      if (goingUp) {
        if (currentSnap < snaps.length - 1) {
          setCurrentSnap(currentSnap + 1);
          setTranslateY(0);
          return;
        }
        setTranslateY(0);
        return;
      }

      // Bounce back.
      setTranslateY(0);
    },
    [currentSnap, snaps.length, dismissible, getSnapHeightPx, onOpenChange],
  );

  // --- Focus trap ----------------------------------------------------------

  const onSheetKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Tab") return;
      const root = sheetRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true",
      );
      if (focusable.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [],
  );

  // --- Render --------------------------------------------------------------

  if (!mounted || typeof document === "undefined") return null;
  if (!open) return null;

  const snapFraction = snaps[currentSnap] ?? snaps[0];
  const transition = reducedMotion
    ? REDUCED_TRANSITION
    : dragging
      ? "none"
      : TRANSITION;

  const sheetStyle: CSSProperties = {
    zIndex: "var(--z-sheet)" as unknown as number,
    height: `${snapFraction * 100}dvh`,
    maxHeight: "100dvh",
    paddingBottom: "calc(var(--sa-bottom) + 16px)",
    transform: visible
      ? `translate3d(0, ${translateY}px, 0)`
      : "translate3d(0, 100%, 0)",
    transition,
    touchAction: "none",
  };

  const backdropStyle: CSSProperties = {
    zIndex: "var(--z-backdrop)" as unknown as number,
    opacity: visible ? 1 : 0,
    transition: reducedMotion
      ? "none"
      : "opacity 300ms cubic-bezier(0.32, 0.72, 0, 1)",
  };

  return createPortal(
    <>
      <div
        aria-hidden="true"
        onClick={onBackdropClick}
        style={backdropStyle}
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-label={!title ? "ボトムシート" : undefined}
        tabIndex={-1}
        onKeyDown={onSheetKeyDown}
        style={sheetStyle}
        className={cn(
          "fixed bottom-0 inset-x-0 rounded-t-3xl bg-[color:var(--color-surface-2)] shadow-[0_-4px_24px_rgba(0,0,0,0.2)] flex flex-col outline-none",
          className,
        )}
      >
        {/* Drag handle */}
        <div
          role="button"
          aria-label="シートをドラッグ"
          tabIndex={-1}
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerEnd}
          onPointerCancel={onDragPointerEnd}
          className="flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 5,
              borderRadius: 9999,
              backgroundColor: "var(--color-text-tertiary)",
              opacity: 0.4,
            }}
          />
        </div>

        {/* Header */}
        {title ? (
          <div
            onPointerDown={onDragPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerEnd}
            onPointerCancel={onDragPointerEnd}
            className="flex items-center justify-between px-4 pb-2 touch-none select-none"
          >
            <h2
              id={headingId}
              className="text-ios-headline text-[color:var(--color-text-primary)]"
            >
              {title}
            </h2>
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => onOpenChange(false)}
              onPointerDown={(e) => e.stopPropagation()}
              className="tap-target inline-flex items-center justify-center rounded-full -mr-2 text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {/* Scrollable content */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
