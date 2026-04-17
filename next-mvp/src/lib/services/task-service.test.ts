import { beforeEach, describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { createGroup, joinGroupByCode } from "@/lib/services/group-service";
import { createTask, listTasksForUser, toggleSubmission } from "@/lib/services/task-service";
import { createUser, resetDb } from "@/test/db-utils";

describe("task service", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates and lists personal tasks", async () => {
    const user = await createUser({ email: "user@example.com", displayName: "User" });

    await createTask(user.id, {
      subject: "数学",
      title: "三角関数レポート",
      deadlineAt: "2026-04-20T12:00:00.000Z",
    });

    const pending = await listTasksForUser(user.id, "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0]?.title).toBe("三角関数レポート");
  });

  it("toggles submission status", async () => {
    const user = await createUser({ email: "user@example.com", displayName: "User" });

    const task = await createTask(user.id, {
      subject: "英語",
      title: "読書感想文",
      deadlineAt: "2026-04-20T12:00:00.000Z",
    });

    await toggleSubmission(user.id, task.id, true);
    const submitted = await listTasksForUser(user.id, "submitted");
    expect(submitted).toHaveLength(1);
    expect(submitted[0]?.id).toBe(task.id);
  });

  it("creates group task and members can view it", async () => {
    const admin = await createUser({ email: "admin@example.com", displayName: "Admin" });
    const member = await createUser({ email: "member@example.com", displayName: "Member" });
    const group = await createGroup(admin.id, { name: "歴史クラス" });
    await joinGroupByCode(member.id, { code: group.code });

    await createTask(admin.id, {
      subject: "歴史",
      title: "年表作成",
      deadlineAt: "2026-04-21T12:00:00.000Z",
      groupId: group.id,
    });

    const memberTasks = await listTasksForUser(member.id, "pending");
    expect(memberTasks).toHaveLength(1);
    expect(memberTasks[0]?.scopeType).toBe("GROUP");
  });

  it("prevents non-admin from creating group task", async () => {
    const admin = await createUser({ email: "admin@example.com", displayName: "Admin" });
    const member = await createUser({ email: "member@example.com", displayName: "Member" });
    const group = await createGroup(admin.id, { name: "地理クラス" });
    await joinGroupByCode(member.id, { code: group.code });

    await expect(
      createTask(member.id, {
        subject: "地理",
        title: "地域レポート",
        deadlineAt: "2026-04-22T12:00:00.000Z",
        groupId: group.id,
      }),
    ).rejects.toMatchObject<AppError>({ code: "ADMIN_REQUIRED" });
  });
});
