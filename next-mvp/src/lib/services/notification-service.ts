import { DeliveryStatus, NotificationChannel, NotificationType, SubmissionStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { notificationSettingSchema } from "@/lib/validation";

function rangeForDate(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

export async function getNotificationSetting(userId: string) {
  const existing = await db.notificationSetting.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  return db.notificationSetting.create({
    data: {
      userId,
      emailEnabled: false,
      remindBeforeDays: 1,
      pushEnabled: false,
    },
  });
}

export async function updateNotificationSetting(
  userId: string,
  input: {
    emailEnabled: boolean;
    emailAddress?: string | null;
    remindBeforeDays: number;
    pushEnabled: boolean;
  },
) {
  const parsed = notificationSettingSchema.parse(input);
  return db.notificationSetting.upsert({
    where: { userId },
    update: parsed,
    create: {
      userId,
      ...parsed,
    },
  });
}

export async function runDeadlineReminderJob(runDate = new Date()) {
  const settings = await db.notificationSetting.findMany({
    where: {
      emailEnabled: true,
      emailAddress: { not: null },
    },
    include: {
      user: true,
    },
  });

  let deliveryCount = 0;

  for (const setting of settings) {
    const targetDate = new Date(runDate);
    targetDate.setDate(targetDate.getDate() + setting.remindBeforeDays);
    const { start, end } = rangeForDate(targetDate);
    const scheduledDate = rangeForDate(runDate).start;

    const submissions = await db.taskSubmission.findMany({
      where: {
        userId: setting.userId,
        status: SubmissionStatus.PENDING,
        task: {
          deletedAt: null,
          status: "OPEN",
          deadlineAt: {
            gte: start,
            lt: end,
          },
        },
      },
      include: {
        task: true,
      },
    });

    for (const submission of submissions) {
      const alreadySent = await db.notificationDelivery.findFirst({
        where: {
          userId: setting.userId,
          taskId: submission.taskId,
          channel: NotificationChannel.EMAIL,
          notificationType: NotificationType.DEADLINE_REMINDER,
          scheduledFor: scheduledDate,
        },
      });

      if (alreadySent) {
        continue;
      }

      await db.notificationDelivery.create({
        data: {
          userId: setting.userId,
          taskId: submission.taskId,
          channel: NotificationChannel.EMAIL,
          notificationType: NotificationType.DEADLINE_REMINDER,
          scheduledFor: scheduledDate,
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          providerMessageId: `dev-${submission.taskId}`,
        },
      });

      deliveryCount += 1;
    }
  }

  return {
    processedUsers: settings.length,
    deliveries: deliveryCount,
  };
}
