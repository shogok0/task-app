import { MembershipRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createGroup, joinGroupByCode, leaveGroup, listMyGroups } from "@/lib/services/group-service";
import { createUser, resetDb } from "@/test/db-utils";

describe("group service", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates group and admin membership", async () => {
    const owner = await createUser({ email: "owner@example.com", displayName: "Owner" });
    const group = await createGroup(owner.id, { name: "数学クラス" });

    const membership = await db.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId: owner.id,
        },
      },
    });

    expect(membership?.role).toBe(MembershipRole.ADMIN);
  });

  it("joins group by code", async () => {
    const owner = await createUser({ email: "owner@example.com", displayName: "Owner" });
    const member = await createUser({ email: "member@example.com", displayName: "Member" });
    const group = await createGroup(owner.id, { name: "英語クラス" });

    await joinGroupByCode(member.id, { code: group.code });
    const myGroups = await listMyGroups(member.id);
    expect(myGroups).toHaveLength(1);
    expect(myGroups[0]?.group.name).toBe("英語クラス");
  });

  it("can leave group", async () => {
    const owner = await createUser({ email: "owner@example.com", displayName: "Owner" });
    const member = await createUser({ email: "member@example.com", displayName: "Member" });
    const group = await createGroup(owner.id, { name: "理科クラス" });
    await joinGroupByCode(member.id, { code: group.code });

    await leaveGroup(member.id, group.id);
    const myGroups = await listMyGroups(member.id);
    expect(myGroups).toHaveLength(0);
  });
});
