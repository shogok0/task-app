"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient, getCurrentUserId } from "@/lib/supabase/server";
import {
  createPersonalTask,
  createGroupTask,
  updateTask,
  softDeleteTask,
  toggleSubmission,
} from "@/lib/db/repositories/tasks";
import { AppError } from "@/lib/errors";

const baseTaskShape = {
  subject: z.string().trim().max(80).optional().nullable().transform((v) => (v === "" ? null : v ?? null)),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable().transform((v) => (v === "" ? null : v ?? null)),
  deadlineAt: z.coerce.date(),
};

const createPersonalSchema = z.object(baseTaskShape);
const createGroupSchema = z.object({ ...baseTaskShape, groupId: z.string().uuid() });
const updateTaskSchema = z.object({
  taskId: z.string().uuid(),
  patch: z.object({ ...baseTaskShape }).partial(),
});
const toggleSubmissionSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(["PENDING", "SUBMITTED"]),
});

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

function requireUserIdOrThrow(userId: string | null): asserts userId is string {
  if (!userId) throw new AppError("ログインが必要です", 401, "UNAUTHORIZED");
}

function handle<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  return fn().then(
    (data) => ({ ok: true as const, data }),
    (err: unknown) => {
      if (err instanceof AppError) return { ok: false as const, error: err.message, code: err.code };
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg, code: "UNKNOWN" };
    }
  );
}

function revalidateListPages() {
  revalidatePath("/app/today");
  revalidatePath("/app/upcoming");
  revalidatePath("/app/settings");
}

export async function createPersonalTaskAction(input: z.input<typeof createPersonalSchema>): Promise<ActionResult<{ id: string }>> {
  return handle(async () => {
    const parsed = createPersonalSchema.parse(input);
    const userId = await getCurrentUserId();
    requireUserIdOrThrow(userId);
    const supabase = await createSupabaseServerClient();
    const task = await createPersonalTask(supabase, { ...parsed, userId });
    revalidateListPages();
    return { id: task.id };
  });
}

export async function createGroupTaskAction(input: z.input<typeof createGroupSchema>): Promise<ActionResult<{ id: string }>> {
  return handle(async () => {
    const parsed = createGroupSchema.parse(input);
    const userId = await getCurrentUserId();
    requireUserIdOrThrow(userId);
    const supabase = await createSupabaseServerClient();
    const task = await createGroupTask(supabase, { ...parsed, userId });
    revalidateListPages();
    revalidatePath(`/app/groups/${parsed.groupId}`);
    return { id: task.id };
  });
}

export async function updateTaskAction(input: z.input<typeof updateTaskSchema>): Promise<ActionResult<{ id: string }>> {
  return handle(async () => {
    const parsed = updateTaskSchema.parse(input);
    const userId = await getCurrentUserId();
    requireUserIdOrThrow(userId);
    const supabase = await createSupabaseServerClient();
    const task = await updateTask(supabase, parsed.taskId, parsed.patch);
    revalidateListPages();
    revalidatePath(`/app/tasks/${parsed.taskId}`);
    return { id: task.id };
  });
}

export async function deleteTaskAction(input: { taskId: string }): Promise<ActionResult> {
  return handle(async () => {
    const taskId = z.string().uuid().parse(input.taskId);
    const userId = await getCurrentUserId();
    requireUserIdOrThrow(userId);
    const supabase = await createSupabaseServerClient();
    await softDeleteTask(supabase, taskId);
    revalidateListPages();
    return undefined;
  });
}

export async function toggleSubmissionAction(input: z.input<typeof toggleSubmissionSchema>): Promise<ActionResult> {
  return handle(async () => {
    const parsed = toggleSubmissionSchema.parse(input);
    const userId = await getCurrentUserId();
    requireUserIdOrThrow(userId);
    const supabase = await createSupabaseServerClient();
    await toggleSubmission(supabase, parsed.taskId, userId, parsed.status);
    revalidateListPages();
    revalidatePath(`/app/tasks/${parsed.taskId}`);
    return undefined;
  });
}
