import { describe, expect, it } from "vitest";
import { buildIcalFeed } from "@/lib/ical/ics";

describe("buildIcalFeed", () => {
  it("creates VEVENT rows from tasks", () => {
    const ics = buildIcalFeed(
      [
        {
          id: "task-1",
          title: "提出",
          subject: "数学",
          description: "ワーク p.42",
          deadlineAt: "2026-04-25T10:00:00.000Z",
          updatedAt: "2026-04-24T10:00:00.000Z",
        },
      ],
      {
        appUrl: "https://task-app.example.com",
        now: new Date("2026-04-24T12:00:00.000Z"),
      },
    );

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:task-task-1@task-app");
    expect(ics).toContain("SUMMARY:【課題】数学 提出");
    expect(ics).toContain("DTSTART:20260425T093000Z");
    expect(ics).toContain("DTEND:20260425T100000Z");
    expect(ics).toContain("DESCRIPTION:ワーク p.42\\n\\nタスク詳細: https://task-app.example.com/app/tasks/task-1");
  });

  it("escapes commas and semicolons in summary", () => {
    const ics = buildIcalFeed(
      [
        {
          id: "task-2",
          title: "A,B;C",
          subject: null,
          description: null,
          deadlineAt: "2026-05-01T00:00:00.000Z",
        },
      ],
      { now: new Date("2026-04-24T12:00:00.000Z") },
    );

    expect(ics).toContain("SUMMARY:【課題】A\\,B\\;C");
  });
});
