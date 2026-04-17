import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createTask } from "@/lib/services/task-service";
import {
  runDeadlineReminderJob,
  updateNotificationSetting,
} from "@/lib/services/notification-service";
import { createUser, resetDb } from "@/test/db-utils";

describe("notification service", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates reminder delivery for pending tasks", async () => {
    const user = await createUser({ email: "user@example.com", displayName: "User" });
    await updateNotificationSetting(user.id, {
      emailEnabled: true,
      emailAddress: "notify@example.com",
      remindBeforeDays: 1,
      pushEnabled: false,
    });

    await createTask(user.id, {
      subject: "数学",
      title: "関数課題",
      deadlineAt: "2026-04-18T12:00:00.000Z",
    });

    const result = await runDeadlineReminderJob(new Date("2026-04-17T09:00:00.000Z"));
    expect(result.deliveries).toBe(1);
  });

  it("does not duplicate the same reminder in a day", async () => {
    const user = await createUser({ email: "user@example.com", displayName: "User" });
    await updateNotificationSetting(user.id, {
      emailEnabled: true,
      emailAddress: "notify@example.com",
      remindBeforeDays: 1,
      pushEnabled: false,
    });

    await createTask(user.id, {
      subject: "英語",
      title: "単語テスト",
      deadlineAt: "2026-04-18T10:00:00.000Z",
    });

    const runAt = new Date("2026-04-17T08:00:00.000Z");
    await runDeadlineReminderJob(runAt);
    await runDeadlineReminderJob(runAt);

    const deliveries = await db.notificationDelivery.findMany();
    expect(deliveries).toHaveLength(1);
  });
});
