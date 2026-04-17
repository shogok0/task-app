import bcrypt from "bcryptjs";

import { db } from "@/lib/db";

export async function resetDb() {
  await db.notificationDelivery.deleteMany();
  await db.taskSubmission.deleteMany();
  await db.task.deleteMany();
  await db.groupMembership.deleteMany();
  await db.group.deleteMany();
  await db.notificationSetting.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
}

export async function createUser(seed: { email: string; displayName: string; password?: string }) {
  const passwordHash = await bcrypt.hash(seed.password ?? "password123", 10);

  return db.user.create({
    data: {
      email: seed.email,
      displayName: seed.displayName,
      passwordHash,
      notificationSetting: {
        create: {
          emailEnabled: false,
          remindBeforeDays: 1,
          pushEnabled: false,
        },
      },
    },
  });
}
