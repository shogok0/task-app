import { PrismaClient } from "@prisma/client";
import { ensureSqliteSchema } from "@/lib/sqlite-init";

declare global {
  var prisma: PrismaClient | undefined;
}

export const db =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

ensureSqliteSchema();

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
