import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { ensureSqliteSchema } from "../src/lib/sqlite-init";

const prisma = new PrismaClient();

async function main() {
  ensureSqliteSchema();
  const email = "demo@example.com";
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return;
  }

  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.create({
    data: {
      displayName: "Demo User",
      email,
      passwordHash,
      notificationSetting: {
        create: {
          emailEnabled: true,
          emailAddress: "demo@example.com",
          remindBeforeDays: 1,
          pushEnabled: false,
        },
      },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
