import { MembershipRole } from "@prisma/client";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { groupCreateSchema, groupJoinSchema } from "@/lib/validation";

function generateCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export async function createGroup(userId: string, input: { name: string }) {
  const parsed = groupCreateSchema.parse(input);

  let code = generateCode();
  for (let i = 0; i < 5; i += 1) {
    const taken = await db.group.findUnique({ where: { code }, select: { id: true } });
    if (!taken) {
      break;
    }

    code = generateCode();
  }

  const group = await db.group.create({
    data: {
      name: parsed.name,
      code,
      createdById: userId,
      memberships: {
        create: {
          userId,
          role: MembershipRole.ADMIN,
        },
      },
    },
  });

  return group;
}

export async function listMyGroups(userId: string) {
  return db.groupMembership.findMany({
    where: {
      userId,
      leftAt: null,
      group: { status: "ACTIVE" },
    },
    include: { group: true },
    orderBy: { joinedAt: "desc" },
  });
}

export async function joinGroupByCode(userId: string, input: { code: string }) {
  const parsed = groupJoinSchema.parse(input);
  const group = await db.group.findUnique({
    where: { code: parsed.code },
  });

  if (!group || group.status !== "ACTIVE") {
    throw new AppError("参加コードが無効です。", 404, "INVALID_CODE");
  }

  const existing = await db.groupMembership.findUnique({
    where: {
      groupId_userId: { groupId: group.id, userId },
    },
  });

  if (existing && !existing.leftAt) {
    return existing;
  }

  if (existing) {
    return db.groupMembership.update({
      where: { id: existing.id },
      data: {
        leftAt: null,
        joinedAt: new Date(),
      },
    });
  }

  return db.groupMembership.create({
    data: {
      groupId: group.id,
      userId,
    },
  });
}

export async function leaveGroup(userId: string, groupId: string) {
  const membership = await db.groupMembership.findUnique({
    where: {
      groupId_userId: { groupId, userId },
    },
  });

  if (!membership || membership.leftAt) {
    throw new AppError("グループに所属していません。", 404, "MEMBERSHIP_NOT_FOUND");
  }

  const activeAdmins = await db.groupMembership.count({
    where: {
      groupId,
      leftAt: null,
      role: MembershipRole.ADMIN,
    },
  });

  if (membership.role === MembershipRole.ADMIN && activeAdmins <= 1) {
    throw new AppError(
      "最後の管理者は退出できません。別の管理者を作成してください。",
      400,
      "LAST_ADMIN_CANNOT_LEAVE",
    );
  }

  return db.groupMembership.update({
    where: { id: membership.id },
    data: {
      leftAt: new Date(),
    },
  });
}

export async function assertGroupMember(userId: string, groupId: string) {
  const membership = await db.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });

  if (!membership || membership.leftAt) {
    throw new AppError("グループにアクセスできません。", 403, "FORBIDDEN");
  }

  return membership;
}

export async function assertGroupAdmin(userId: string, groupId: string) {
  const membership = await assertGroupMember(userId, groupId);
  if (membership.role !== MembershipRole.ADMIN) {
    throw new AppError("管理者権限が必要です。", 403, "ADMIN_REQUIRED");
  }

  return membership;
}
