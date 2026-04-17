"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type MonthCalendarProps = {
  year: number;
  /** 0-11 */
  month: number;
  /** key: "YYYY-MM-DD" (local) */
  eventsByDay: Record<string, { personal: number; group: number }>;
  onDayTap: (dateIso: string) => void;
  onMonthChange: (year: number, month: number) => void;
  /** "YYYY-MM-DD" local key for today */
  todayIso: string;
};

const WEEKDAYS_JA = ["月", "火", "水", "木", "金", "土", "日"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toLocalKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/** Monday=0 ... Sunday=6 */
function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

function buildGrid(year: number, month: number): {
  year: number;
  month: number;
  day: number;
  inMonth: boolean;
}[] {
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = mondayIndex(firstOfMonth.getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDate = new Date(year, month, 0); // last day of previous month
  const daysInPrev = prevMonthDate.getDate();
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth();
  const nextDate = new Date(year, month + 1, 1);
  const nextYear = nextDate.getFullYear();
  const nextMonth = nextDate.getMonth();

  const cells: {
    year: number;
    month: number;
    day: number;
    inMonth: boolean;
  }[] = [];

  // Leading days from previous month.
  for (let i = 0; i < firstWeekday; i++) {
    const day = daysInPrev - (firstWeekday - 1 - i);
    cells.push({ year: prevYear, month: prevMonth, day, inMonth: false });
  }
  // Current month.
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ year, month, day: d, inMonth: true });
  }
  // Trailing days to complete 6x7 = 42.
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ year: nextYear, month: nextMonth, day: nextDay++, inMonth: false });
  }

  return cells;
}

export function MonthCalendar({
  year,
  month,
  eventsByDay,
  onDayTap,
  onMonthChange,
  todayIso,
}: MonthCalendarProps): React.JSX.Element {
  const cells = React.useMemo(() => buildGrid(year, month), [year, month]);
  const monthLabel = `${year}年${month + 1}月`;

  const goPrev = () => {
    const d = new Date(year, month - 1, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };
  const goNext = () => {
    const d = new Date(year, month + 1, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };

  return (
    <div className="w-full">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-1 pb-3">
        <button
          type="button"
          aria-label="前の月"
          onClick={goPrev}
          className="tap-target inline-flex items-center justify-center rounded-full text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <h2
          aria-live="polite"
          className="text-ios-headline text-[color:var(--color-text-primary)]"
        >
          {monthLabel}
        </h2>
        <button
          type="button"
          aria-label="次の月"
          onClick={goNext}
          className="tap-target inline-flex items-center justify-center rounded-full text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
        >
          <ChevronRight size={24} aria-hidden="true" />
        </button>
      </div>

      {/* Weekday row */}
      <div
        role="row"
        className="grid grid-cols-7 gap-1 px-1 pb-1"
      >
        {WEEKDAYS_JA.map((w, i) => (
          <div
            key={w}
            role="columnheader"
            aria-label={w}
            className={cn(
              "text-ios-caption1 flex items-center justify-center py-1",
              i === 5
                ? "text-[color:var(--color-accent)]"
                : i === 6
                  ? "text-[color:var(--color-danger)]"
                  : "text-[color:var(--color-text-secondary)]",
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 6x7 grid */}
      <div role="grid" aria-label={`${monthLabel}のカレンダー`} className="px-1">
        {Array.from({ length: 6 }).map((_, rowIdx) => (
          <div key={rowIdx} role="row" className="grid grid-cols-7 gap-1 mb-1">
            {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => {
              const key = toLocalKey(cell.year, cell.month, cell.day);
              const isToday = cell.inMonth && key === todayIso;
              const events = cell.inMonth ? eventsByDay[key] : undefined;
              const personal = events?.personal ?? 0;
              const group = events?.group ?? 0;
              const total = personal + group;
              const dotsShown = Math.min(total, 3);
              const overflow = Math.max(0, total - 3);

              const weekdayIdx = colIdx; // 0..6, Mon..Sun
              const dayColor = !cell.inMonth
                ? "text-[color:var(--color-text-tertiary)]"
                : weekdayIdx === 5
                  ? "text-[color:var(--color-accent)]"
                  : weekdayIdx === 6
                    ? "text-[color:var(--color-danger)]"
                    : "text-[color:var(--color-text-primary)]";

              const baseClasses = cn(
                "relative flex min-h-[40px] flex-col items-center justify-start rounded-[var(--radius-md,12px)] py-1.5 px-1 transition-colors",
                cell.inMonth
                  ? "bg-[color:var(--color-surface)] active:bg-[color:var(--color-surface-2)]"
                  : "bg-transparent",
                isToday && "ring-2 ring-[color:var(--color-accent)]",
              );

              const content = (
                <>
                  <span
                    className={cn("text-ios-subhead leading-none", dayColor, isToday && "font-semibold")}
                  >
                    {cell.day}
                  </span>
                  <div className="mt-1 flex min-h-[8px] items-center gap-0.5">
                    {dotsShown > 0 &&
                      // Render group dots first, then personal — order doesn't
                      // really matter visually; keeps dot ordering stable.
                      Array.from({ length: dotsShown }).map((_, i) => {
                        const isGroup = i < Math.min(group, dotsShown);
                        return (
                          <span
                            key={i}
                            aria-hidden="true"
                            className={cn(
                              "inline-block h-1.5 w-1.5 rounded-full",
                              isGroup
                                ? "bg-[color:var(--color-warning)]"
                                : "bg-[color:var(--color-accent)]",
                            )}
                          />
                        );
                      })}
                    {overflow > 0 && (
                      <span
                        aria-hidden="true"
                        className="text-[10px] leading-none text-[color:var(--color-text-secondary)]"
                      >
                        +{overflow}
                      </span>
                    )}
                  </div>
                  {total > 0 && (
                    <span className="sr-only">
                      {`${total}件のタスク`}
                      {personal > 0 ? ` (個人${personal}件)` : ""}
                      {group > 0 ? ` (グループ${group}件)` : ""}
                    </span>
                  )}
                </>
              );

              if (!cell.inMonth) {
                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    role="gridcell"
                    aria-disabled="true"
                    className={baseClasses}
                  >
                    {content}
                  </div>
                );
              }

              return (
                <button
                  key={`${rowIdx}-${colIdx}`}
                  type="button"
                  role="gridcell"
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${cell.year}年${cell.month + 1}月${cell.day}日${total > 0 ? `、${total}件のタスク` : ""}`}
                  onClick={() => onDayTap(key)}
                  className={cn(baseClasses, "cursor-pointer")}
                >
                  {content}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MonthCalendar;
