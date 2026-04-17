"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient, getCurrentUserId } from "@/lib/supabase/server";
import { createGroup, joinGroupByCode, leaveGroup } from "@/lib/db/repositories/groups";
import { AppError } from "@/lib/errors";

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
const joinSchema = z.object({
  code: z.string().trim().min(6).max(16).toUpperCase(),
});
const leaveSchema = z.object({
  groupId: z.string().uuid(),
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

export async function createGroupAction(input: z.input<typeof createGroupSchema>): Promise<ActionResult<{ id: string; inviteCode: string }>> {
  return handle(async () => {
    const parsed = createGroupSchema.parse(input);
    const userId = await getCurrentUserId();
    requireUserIdOrThrow(userId);
    const supabase = await createSupabaseServerClient();
    const group = await createGroup(supabase, parsed.name);
    revalidatePath("/app/settings");
    revalidatePath("/app/groups");
    return { id: group.id, inviteCode: group.inviteCode };
  });
}

export async function joinGroupByCodeAction(input: z.input<typeof joinSchema>): Promise<ActionResult<{ id: string }>> {
  return handle(async () => {
    const parsed = joinSchema.parse(input);
    const userId = await getCurrentUserId();
    requireUserIdOrThrow(userId);
    const supabase = await createSupabaseServerClient();
    const group = await joinGroupByCode(supabase, parsed.code);
    revalidatePath("/app/settings");
    revalidatePath("/app/upcoming");
    revalidatePath("/app/today");
    return { id: group.id };
  });
}

export async function leaveGroupAction(input: z.input<typeof leaveSchema>): Promise<ActionResult> {
  return handle(async () => {
    const parsed = leaveSchema.parse(input);
    const userId = await getCurrentUserId();
    requireUserIdOrThrow(userId);
    const supabase = await createSupabaseServerClient();
    await leaveGroup(supabase, parsed.groupId);
    revalidatePath("/app/settings");
    revalidatePath(`/app/groups/${parsed.groupId}`);
    return undefined;
  });
}
