import { describe, expect, it } from "vitest";

import {
  buildGoogleCalendarEventInput,
  sanitizeNextPath,
} from "@/lib/google-calendar/sync-utils";

describe("sanitizeNextPath", () => {
  it("returns internal app path as-is", () => {
    expect(sanitizeNextPath("/app/settings")).toBe("/app/settings");
  });

  it("falls back when path is external URL", () => {
    expect(sanitizeNextPath("https://evil.example.com/phish")).toBe("/app/today");
  });

  it("falls back when path does not start with slash", () => {
    expect(sanitizeNextPath("app/settings")).toBe("/app/today");
  });
});

describe("buildGoogleCalendarEventInput", () => {
  it("maps task to a 30-minute event ending at deadline", () => {
    const event = buildGoogleCalendarEventInput(
      {
        id: "task-1",
        title: "提出",
        subject: "数学",
        description: "ワーク p.42",
        deadlineAt: "2026-04-25T10:00:00.000Z",
      },
      "https://task-app.example.com",
    );

    expect(event.summary).toBe("【課題】数学 提出");
    expect(event.start?.dateTime).toBe("2026-04-25T09:30:00.000Z");
    expect(event.end?.dateTime).toBe("2026-04-25T10:00:00.000Z");
    expect(event.description).toContain("ワーク p.42");
    expect(event.description).toContain("/app/tasks/task-1");
    expect(event.extendedProperties?.private?.taskId).toBe("task-1");
  });

  it("omits task link when app url is not provided", () => {
    const event = buildGoogleCalendarEventInput({
      id: "task-2",
      title: "英語課題",
      subject: null,
      description: null,
      deadlineAt: "2026-05-01T00:00:00.000Z",
    });

    expect(event.summary).toBe("【課題】英語課題");
    expect(event.description ?? "").not.toContain("/app/tasks/task-2");
  });
});
