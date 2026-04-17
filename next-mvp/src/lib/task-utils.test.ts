import { describe, expect, it } from "vitest";

import { calculateUrgency } from "@/lib/task-utils";

describe("calculateUrgency", () => {
  const now = new Date("2026-04-17T00:00:00.000Z");

  it("returns overdue for past deadline", () => {
    expect(calculateUrgency(new Date("2026-04-16T23:59:59.000Z"), now)).toBe("overdue");
  });

  it("returns high for deadline in 1 day", () => {
    expect(calculateUrgency(new Date("2026-04-18T00:00:00.000Z"), now)).toBe("high");
  });

  it("returns medium for deadline in 2 days", () => {
    expect(calculateUrgency(new Date("2026-04-19T00:00:00.000Z"), now)).toBe("medium");
  });

  it("returns low for distant deadline", () => {
    expect(calculateUrgency(new Date("2026-05-01T00:00:00.000Z"), now)).toBe("low");
  });
});
