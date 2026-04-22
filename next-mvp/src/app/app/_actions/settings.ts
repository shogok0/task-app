"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getCurrentUserId,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { updateMyProfile } from "@/lib/db/repositories/profiles";
import { updateMyNotificationSettings } from "@/lib/db/repositories/notifications";
import { deleteMyGoogleCalendarConnection } from "@/lib/db/repositories/google-calendar";
import { syncGoogleCalendarForUser, type GoogleCalendarSyncResult } from "@/lib/google-calendar/sync-service";
import { AppError } from "@/lib/errors";
import type { Profile, NotificationSetting } from "@/lib/db/types";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

const notifSchema = z.object({
  emailEnabled: z.boolean().optional(),
  emailAddress: z
    .union([
      z.literal("").transform(() => null),
      z.null(),
      z.string().email(),
    ])
    .optional(),
  remindBeforeDays: z.number().int().min(0).max(30).optional(),
  pushEnabled: z.boolean().optional(),
});

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

function requireUserIdOrThrow(
  userId: string | null,
): asserts userId is string {
  if (!userId) throw new AppError("ログインが必要です", 401, "UNAUTHORIZED");
}

function handle<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  return fn().then(
    (data) => ({ ok: true as const, data }),
    (err: unknown) => {
      if (err instanceof AppError)
        return { ok: false as const, error: err.message, code: err.code };
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg, code: "UNKNOWN" };
    },
  );
}

export async function updateProfileAction(
  input: z.input<typeof profileSchema>,
): Promise<ActionResult<Profile>> {
  return handle(async () => {
    const parsed = profileSchema.parse(input);
    const userId = await getCurrentUserId();
    requireUserIdOrThrow(userId);
    const supabase = await createSupabaseServerClient();
    const profile = await updateMyProfile(supabase, userId, {
      displayName: parsed.displayName,
    });
    revalidatePath("/app/settings");
    return profile;
  });
}

export async function updateNotificationSettingsAction(
  input: z.input<typeof notifSchema>,
): Promise<ActionResult<NotificationSetting>> {
  return handle(async () => {
    const parsed = notifSchema.parse(input);
    const userId = await getCurrentUserId();
    requireUserIdOrThrow(userId);
    const supabase = await createSupabaseServerClient();
    const setting = await updateMyNotificationSettings(supabase, userId, parsed);
    revalidatePath("/app/settings");
    return setting;
  });
}

export async function syncGoogleCalendarNowAction(): Promise<ActionResult<GoogleCalendarSyncResult>> {
  return handle(async () => {
    const userId = await getCurrentUserId();
    requireUserIdOrThrow(userId);
    const supabase = await createSupabaseServerClient();

    const result = await syncGoogleCalendarForUser({
      supabase,
      userId,
      appUrl: process.env.APP_URL ?? null,
    });

    revalidatePath("/app/settings");
    revalidatePath("/app/today");
    revalidatePath("/app/upcoming");
    return result;
  });
}

export async function disconnectGoogleCalendarAction(): Promise<ActionResult<void>> {
  return handle(async () => {
    const userId = await getCurrentUserId();
    requireUserIdOrThrow(userId);
    const supabase = await createSupabaseServerClient();
    await deleteMyGoogleCalendarConnection(supabase, userId);

    revalidatePath("/app/settings");
  });
}
