const DAY_MS = 24 * 60 * 60 * 1000;

export type Urgency = "overdue" | "high" | "medium" | "low";

export function calculateUrgency(deadlineAt: Date, now = new Date()): Urgency {
  const diffMs = deadlineAt.getTime() - now.getTime();
  if (diffMs < 0) {
    return "overdue";
  }

  const diffDays = Math.ceil(diffMs / DAY_MS);

  if (diffDays <= 1) {
    return "high";
  }

  if (diffDays <= 3) {
    return "medium";
  }

  return "low";
}

export function toDateOnly(value: Date) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}
