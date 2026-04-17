import { SubmissionStatus, TaskScopeType } from "@prisma/client";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { calculateUrgency } from "@/lib/task-utils";
import { createTaskSchema, updateTaskSchema } from "@/lib/validation";
import { assertGroupAdmin, assertGroupMember } from "@/lib/services/group-service";

type TaskCreateInput = {
  subject: string;
  title: string;
  description?: string | null;
  deadlineAt: Date | string;
  groupId?: string | null;
};

type TaskUpdateInput = {
  subject?: string;
  title?: string;
  description?: string | null;
  deadlineAt?: Date | string;
  status?: "OPEN" | "ARCHIVED";
};

export async function createTask(userId: string, input: TaskCreateInput) {
  const parsed = createTaskSchema.parse(input);

  if (parsed.groupId) {
    await assertGroupAdmin(userId, parsed.groupId);
    const members = await db.groupMembership.findMany({
      where: { groupId: parsed.groupId, leftAt: null },
      select: { userId: true },
    });

    return db.task.create({
      data: {
        createdById: userId,
        groupId: parsed.groupId,
        scopeType: TaskScopeType.GROUP,
        subject: parsed.subject,
        title: parsed.title,
        description: parsed.description ?? null,
        deadlineAt: parsed.deadlineAt,
        submissions: {
          createMany: {
            data: members.map((member) => ({
              userId: member.userId,
              status: SubmissionStatus.PENDING,
            })),
          },
        },
      },
    });
  }

  return db.task.create({
    data: {
      createdById: userId,
      ownerUserId: userId,
      scopeType: TaskScopeType.PERSONAL,
      subject: parsed.subject,
      title: parsed.title,
      description: parsed.description ?? null,
      deadlineAt: parsed.deadlineAt,
      submissions: {
        create: {
          userId,
          status: SubmissionStatus.PENDING,
        },
      },
    },
  });
}

export async function listTasksForUser(userId: string, mode: "all" | "pending" | "submitted" = "all") {
  const groupIds = (
    await db.groupMembership.findMany({
      where: { userId, leftAt: null },
      select: { groupId: true },
    })
  ).map((membership) => membership.groupId);

  const tasks = await db.task.findMany({
    where: {
      deletedAt: null,
      status: "OPEN",
      OR: [{ ownerUserId: userId }, { groupId: { in: groupIds } }],
    },
    include: {
      group: true,
      submissions: {
        where: { userId },
      },
    },
    orderBy: { deadlineAt: "asc" },
  });

  return tasks
    .map((task) => {
      const submission = task.submissions[0];
      const submissionStatus = submission?.status ?? SubmissionStatus.PENDING;
      return {
        ...task,
        submissionStatus,
        urgency: calculateUrgency(task.deadlineAt),
      };
    })
    .filter((task) => {
      if (mode === "pending") {
        return task.submissionStatus === SubmissionStatus.PENDING;
      }

      if (mode === "submitted") {
        return task.submissionStatus === SubmissionStatus.SUBMITTED;
      }

      return true;
    });
}

async function assertTaskAccess(userId: string, taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
  });

  if (!task || task.deletedAt) {
    throw new AppError("課題が見つかりません。", 404, "TASK_NOT_FOUND");
  }

  if (task.scopeType === TaskScopeType.PERSONAL) {
    if (task.ownerUserId !== userId) {
      throw new AppError("この課題へのアクセス権限がありません。", 403, "FORBIDDEN");
    }

    return task;
  }

  if (!task.groupId) {
    throw new AppError("不正な課題データです。", 400, "INVALID_TASK");
  }

  await assertGroupMember(userId, task.groupId);
  return task;
}

export async function updateTask(userId: string, taskId: string, input: TaskUpdateInput) {
  const task = await assertTaskAccess(userId, taskId);
  const parsed = updateTaskSchema.parse(input);

  if (task.scopeType === TaskScopeType.GROUP && task.groupId) {
    await assertGroupAdmin(userId, task.groupId);
  }

  return db.task.update({
    where: { id: taskId },
    data: parsed,
  });
}

export async function deleteTask(userId: string, taskId: string) {
  const task = await assertTaskAccess(userId, taskId);
  if (task.scopeType === TaskScopeType.GROUP && task.groupId) {
    await assertGroupAdmin(userId, task.groupId);
  }

  return db.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });
}

export async function toggleSubmission(userId: string, taskId: string, submitted: boolean) {
  await assertTaskAccess(userId, taskId);

  const status = submitted ? SubmissionStatus.SUBMITTED : SubmissionStatus.PENDING;
  return db.taskSubmission.upsert({
    where: {
      taskId_userId: {
        taskId,
        userId,
      },
    },
    update: {
      status,
      submittedAt: submitted ? new Date() : null,
    },
    create: {
      taskId,
      userId,
      status,
      submittedAt: submitted ? new Date() : null,
    },
  });
}
