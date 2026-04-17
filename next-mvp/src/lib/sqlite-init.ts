import path from "node:path";

import BetterSqlite3 from "better-sqlite3";

function resolveDatabaseFile(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`Unsupported DATABASE_URL for SQLite: ${databaseUrl}`);
  }

  const filePart = databaseUrl.slice("file:".length);
  if (path.isAbsolute(filePart)) {
    return filePart;
  }

  const withoutDot = filePart.startsWith("./") ? filePart.slice(2) : filePart;
  return path.resolve(process.cwd(), "prisma", withoutDot);
}

export function ensureSqliteSchema() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const dbPath = resolveDatabaseFile(url);
  const sqlite = new BetterSqlite3(dbPath);

  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT PRIMARY KEY,
      "displayName" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "Session" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL UNIQUE,
      "expiresAt" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

    CREATE TABLE IF NOT EXISTS "Group" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "code" TEXT NOT NULL UNIQUE,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "createdById" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "GroupMembership" (
      "id" TEXT PRIMARY KEY,
      "groupId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'MEMBER',
      "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "leftAt" DATETIME,
      FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      UNIQUE("groupId", "userId")
    );
    CREATE INDEX IF NOT EXISTS "GroupMembership_user_group_idx" ON "GroupMembership"("userId", "groupId");

    CREATE TABLE IF NOT EXISTS "Task" (
      "id" TEXT PRIMARY KEY,
      "groupId" TEXT,
      "createdById" TEXT NOT NULL,
      "ownerUserId" TEXT,
      "scopeType" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "deadlineAt" DATETIME NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deletedAt" DATETIME,
      FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "Task_owner_deadline_idx" ON "Task"("ownerUserId", "deadlineAt");
    CREATE INDEX IF NOT EXISTS "Task_group_deadline_idx" ON "Task"("groupId", "deadlineAt");

    CREATE TABLE IF NOT EXISTS "TaskSubmission" (
      "id" TEXT PRIMARY KEY,
      "taskId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "submittedAt" DATETIME,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      UNIQUE("taskId", "userId")
    );
    CREATE INDEX IF NOT EXISTS "TaskSubmission_user_status_idx" ON "TaskSubmission"("userId", "status");

    CREATE TABLE IF NOT EXISTS "NotificationSetting" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL UNIQUE,
      "emailEnabled" BOOLEAN NOT NULL DEFAULT 0,
      "emailAddress" TEXT,
      "remindBeforeDays" INTEGER NOT NULL DEFAULT 1,
      "pushEnabled" BOOLEAN NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "taskId" TEXT,
      "channel" TEXT NOT NULL,
      "notificationType" TEXT NOT NULL,
      "scheduledFor" DATETIME NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'QUEUED',
      "providerMessageId" TEXT,
      "errorMessage" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "sentAt" DATETIME,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      UNIQUE("userId", "taskId", "channel", "notificationType", "scheduledFor")
    );
    CREATE INDEX IF NOT EXISTS "NotificationDelivery_user_scheduled_idx" ON "NotificationDelivery"("userId", "scheduledFor");
  `);

  sqlite.close();
}
