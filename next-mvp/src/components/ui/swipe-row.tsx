"use client";

/**
 * SwipeRow — iOS Mail-style swipe-to-reveal / full-swipe primitive.
 *
 * Accessibility note for MVP:
 *   This primitive is pointer/touch-first. Keyboard / assistive-tech users
 *   cannot reliably perform a swipe gesture, so the parent list should also
 *   expose the same actions via a context menu (long-press / right-click / "…" button).
 *   That menu is NOT implemented here — it belongs to the list component that
 *   renders SwipeRow children.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export type SwipeActionColor = "green" | "red" | "blue" | "orange" | "gray";

export type SwipeAction = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  color: SwipeActionColor;
  onAction: () => void | Promise<void>;
};

export type SwipeRowProps = {
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  children: React.ReactNode;
  /** fraction of row width (0-1). default 0.6 */
  fullSwipeThreshold?: number;
  /** Optional: if omitted, first action on the swiped side fires on full swipe. */
  onFullSwipe?: (side: "left" | "right") => void;
  className?: string;
  disabled?: boolean;
};

const ACTION_WIDTH = 80;
const SNAP_DURATION_MS = 250;
const FULL_SWIPE_RESET_MS = 200;
const VELOCITY_FULL_SWIPE = 0.7; // px/ms
const HORIZONTAL_LOCK_PX = 8;

const COLOR: Record<SwipeActionColor, string> = {
  green: "bg-[color:var(--color-success)] text-white",
  red: "bg-[color:var(--color-danger)] text-white",
  blue: "bg-[color:var(--color-accent)] text-white",
  orange: "bg-[color:var(--color-warning)] text-white",
  gray: "bg-[color:var(--color-text-secondary)] text-white",
};

const SNAP_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function rubberBand(dx: number, limit: number): number {
  // iOS-style rubber band past the limit.
  if (Math.abs(dx) <= limit) return dx;
  const sign = Math.sign(dx);
  const over = Math.abs(dx) - limit;
  // asymptotic, capped at ~1.1x the limit as requested
  const extra = Math.min(limit * 0.1, over / 3);
  return sign * (limit + extra);
}

export function SwipeRow({
  leftActions = [],
  rightActions = [],
  children,
  fullSwipeThreshold = 0.6,
  onFullSwipe,
  className,
  disabled = false,
}: SwipeRowProps): React.JSX.Element {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  // Current render translation (px).
  const [translate, setTranslate] = React.useState(0);
  // Whether we're mid-snap (apply CSS transition).
  const [snapping, setSnapping] = React.useState(false);
  // Whether the row is currently in a revealed (open) state.
  const [revealed, setRevealed] = React.useState<"left" | "right" | null>(null);
  // Action key that just committed, used to trigger a CSS pulse.
  const [pulseKey, setPulseKey] = React.useState<string | null>(null);

  // Mutable drag state — refs so we don't re-render every frame.
  const drag = React.useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    startT: number;
    lastX: number;
    lastT: number;
    axisLocked: "x" | "y" | null;
    baseTranslate: number; // translate at pointerdown (to support dragging from revealed)
    rowWidth: number;
    // Side caps based on actions. Positive values; apply sign as needed.
    leftCap: number; // max positive translate (revealing left actions)
    rightCap: number; // max negative magnitude (revealing right actions)
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startT: 0,
    lastX: 0,
    lastT: 0,
    axisLocked: null,
    baseTranslate: 0,
    rowWidth: 0,
    leftCap: 0,
    rightCap: 0,
  });

  const leftCap = leftActions.length * ACTION_WIDTH;
  const rightCap = rightActions.length * ACTION_WIDTH;

  const animateTo = React.useCallback(
    (target: number, opts?: { instant?: boolean }) => {
      if (opts?.instant || prefersReducedMotion()) {
        setSnapping(false);
        setTranslate(target);
        return;
      }
      setSnapping(true);
      setTranslate(target);
    },
    [],
  );

  const close = React.useCallback(() => {
    setRevealed(null);
    animateTo(0);
  }, [animateTo]);

  const fireAction = React.useCallback(
    async (action: SwipeAction) => {
      setPulseKey(action.key);
      // Clear pulse class after animation.
      window.setTimeout(() => setPulseKey((k) => (k === action.key ? null : k)), 220);
      try {
        await action.onAction();
      } finally {
        close();
      }
    },
    [close],
  );

  const commitFullSwipe = React.useCallback(
    (side: "left" | "right") => {
      if (navigator.vibrate) {
        try {
          navigator.vibrate(10);
        } catch {
          /* ignore */
        }
      }
      const rowWidth = rootRef.current?.offsetWidth ?? drag.current.rowWidth;
      // Snap to ±rowWidth.
      animateTo(side === "left" ? rowWidth : -rowWidth);
      window.setTimeout(() => {
        if (onFullSwipe) {
          onFullSwipe(side);
        } else {
          const actions = side === "left" ? leftActions : rightActions;
          const first = actions[0];
          if (first) void fireAction(first);
          else close();
          return;
        }
        // Reset to 0 after the configured delay.
        window.setTimeout(() => {
          setRevealed(null);
          animateTo(0);
        }, FULL_SWIPE_RESET_MS);
      }, 0);
    },
    [animateTo, close, fireAction, leftActions, onFullSwipe, rightActions],
  );

  // --- Pointer handlers ---------------------------------------------------

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Ignore secondary buttons on mouse.
    if (e.pointerType === "mouse" && e.button !== 0) return;

    // If this pointerdown targets an action button, let its own click fire; don't capture.
    const target = e.target as HTMLElement;
    if (target.closest("[data-swipe-action-button]")) return;

    const now = performance.now();
    const rowWidth = rootRef.current?.offsetWidth ?? 0;
    drag.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startT: now,
      lastX: e.clientX,
      lastT: now,
      axisLocked: null,
      baseTranslate: translate,
      rowWidth,
      leftCap,
      rightCap,
    };
    setSnapping(false);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active || d.pointerId !== e.pointerId) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const now = performance.now();

    // Axis lock: let vertical scrolling win if clearly vertical.
    if (d.axisLocked == null) {
      if (Math.abs(dx) < HORIZONTAL_LOCK_PX && Math.abs(dy) < HORIZONTAL_LOCK_PX) {
        // Not enough movement to decide yet.
        d.lastX = e.clientX;
        d.lastT = now;
        return;
      }
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical win — release capture so parent scrolls.
        d.axisLocked = "y";
        d.active = false;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      d.axisLocked = "x";
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }

    if (d.axisLocked !== "x") return;

    // Proposed translate = baseTranslate + dx, then clamp with rubber band per side.
    let next = d.baseTranslate + dx;

    if (next > 0) {
      // Pulling right — revealing left actions.
      if (d.leftCap === 0) {
        next = next / 3; // rubber-band when no actions on that side
      } else {
        next = rubberBand(next, d.leftCap);
      }
    } else if (next < 0) {
      if (d.rightCap === 0) {
        next = next / 3;
      } else {
        next = -rubberBand(-next, d.rightCap);
      }
    }

    d.lastX = e.clientX;
    d.lastT = now;
    setTranslate(next);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active || d.pointerId !== e.pointerId) return;
    d.active = false;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const dx = e.clientX - d.startX;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    const velocityX = (e.clientX - d.lastX) / dt; // px/ms, signed
    const rowWidth = d.rowWidth || rootRef.current?.offsetWidth || 1;

    const side: "left" | "right" = translate >= 0 ? "left" : "right";
    const actionsWidth = side === "left" ? d.leftCap : d.rightCap;
    const absTranslate = Math.abs(translate);

    // Full-swipe conditions:
    // 1. |dx| / rowWidth > threshold
    // 2. velocity beyond threshold in swipe direction AND some reveal happened
    const fullByDistance = absTranslate / rowWidth > fullSwipeThreshold;
    const fullByVelocity =
      Math.abs(velocityX) > VELOCITY_FULL_SWIPE &&
      // must be moving in the reveal direction
      ((side === "left" && velocityX > 0) || (side === "right" && velocityX < 0)) &&
      absTranslate > ACTION_WIDTH / 2;

    const hasActionsOnSide =
      (side === "left" && leftActions.length > 0) ||
      (side === "right" && rightActions.length > 0);

    if (hasActionsOnSide && (fullByDistance || fullByVelocity)) {
      commitFullSwipe(side);
      return;
    }

    if (hasActionsOnSide && absTranslate > actionsWidth / 2) {
      // Snap open to exactly ±actionsWidth.
      setRevealed(side);
      animateTo(side === "left" ? actionsWidth : -actionsWidth);
      return;
    }

    // Else: was it effectively a tap on the content while revealed? Close.
    if (revealed && Math.abs(dx) < HORIZONTAL_LOCK_PX) {
      close();
      return;
    }

    // Snap back to 0.
    setRevealed(null);
    animateTo(0);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d.pointerId !== e.pointerId) return;
    d.active = false;
    // Reset to last stable state.
    if (revealed === "left") animateTo(leftCap);
    else if (revealed === "right") animateTo(-rightCap);
    else animateTo(0);
  };

  // Close when clicking main content while revealed (mouse users).
  const onContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!revealed) return;
    // Don't treat clicks on action buttons as "close content".
    const target = e.target as HTMLElement;
    if (target.closest("[data-swipe-action-button]")) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  };

  // Clean up snapping flag after transition ends so subsequent drags are immediate.
  const onTransitionEnd = () => {
    setSnapping(false);
  };

  const transformStyle: React.CSSProperties = {
    transform: `translate3d(${translate}px, 0, 0)`,
    transition: snapping
      ? `transform ${SNAP_DURATION_MS}ms ${SNAP_EASING}`
      : "none",
    willChange: "transform",
    // Inherit row background so panels behind aren't visible through content.
    backgroundColor: "var(--color-bg)",
  };

  return (
    <div
      ref={rootRef}
      role="listitem"
      aria-label="Swipeable row"
      className={cn(
        "relative overflow-hidden bg-[color:var(--color-bg)] touch-pan-y select-none",
        className,
      )}
    >
      {/* Left action panel — revealed by swiping RIGHT */}
      {leftActions.length > 0 && (
        <div
          aria-hidden={translate <= 0}
          className="absolute inset-y-0 left-0 flex flex-row"
          style={{ width: leftCap }}
        >
          {leftActions.map((action, i) => (
            <ActionButton
              key={action.key}
              action={action}
              isFirst={i === 0}
              pulseActive={pulseKey === action.key}
              disabled={disabled}
              onFire={() => void fireAction(action)}
            />
          ))}
        </div>
      )}

      {/* Right action panel — revealed by swiping LEFT (flex-row-reverse so first action sits flush to the edge) */}
      {rightActions.length > 0 && (
        <div
          aria-hidden={translate >= 0}
          className="absolute inset-y-0 right-0 flex flex-row-reverse"
          style={{ width: rightCap }}
        >
          {rightActions.map((action, i) => (
            <ActionButton
              key={action.key}
              action={action}
              isFirst={i === 0}
              pulseActive={pulseKey === action.key}
              disabled={disabled}
              onFire={() => void fireAction(action)}
            />
          ))}
        </div>
      )}

      {/* Main content */}
      <div
        ref={contentRef}
        className="relative z-10"
        style={transformStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onContentClick}
        onTransitionEnd={onTransitionEnd}
      >
        {children}
      </div>

      {/* Pulse keyframe (scoped via data-attr to avoid a global style file edit) */}
      <style>{`
        @keyframes swipe-row-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        [data-swipe-action-button][data-pulse="true"] > span {
          animation: swipe-row-pulse 200ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-swipe-action-button][data-pulse="true"] > span {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ActionButton({
  action,
  isFirst: _isFirst,
  pulseActive,
  disabled,
  onFire,
}: {
  action: SwipeAction;
  isFirst: boolean;
  pulseActive: boolean;
  disabled: boolean;
  onFire: () => void;
}) {
  return (
    <button
      type="button"
      data-swipe-action-button
      data-pulse={pulseActive ? "true" : "false"}
      disabled={disabled}
      aria-label={action.label}
      onClick={(e) => {
        // Prevent the content click-to-close from swallowing us.
        e.stopPropagation();
        onFire();
      }}
      // Also stop pointerdown from starting a drag on the row.
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "flex h-full items-center justify-center",
        "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70",
        COLOR[action.color],
      )}
      style={{ width: ACTION_WIDTH }}
    >
      <span className="flex flex-col items-center justify-center gap-1 px-1">
        {action.icon ? <span aria-hidden>{action.icon}</span> : null}
        <span className="text-ios-caption1 leading-tight">{action.label}</span>
      </span>
    </button>
  );
}

export default SwipeRow;
