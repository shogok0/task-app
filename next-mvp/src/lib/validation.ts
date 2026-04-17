import { z } from "zod";

export const registerSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const createTaskSchema = z.object({
  subject: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  deadlineAt: z.coerce.date(),
  groupId: z.string().optional().nullable(),
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({
    status: z.enum(["OPEN", "ARCHIVED"]).optional(),
  });

export const groupCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const groupJoinSchema = z.object({
  code: z.string().trim().min(6).max(16).toUpperCase(),
});

export const notificationSettingSchema = z.object({
  emailEnabled: z.boolean(),
  emailAddress: z.string().email().optional().nullable(),
  remindBeforeDays: z.number().int().min(0).max(30),
  pushEnabled: z.boolean(),
});
