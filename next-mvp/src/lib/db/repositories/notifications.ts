import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { mapNotificationSetting } from "@/lib/db/mappers";
import type { NotificationSetting } from "@/lib/db/types";

type Row = Record<string, unknown>;

function fail(
  error: { message?: string; code?: string } | null,
  fallback: string,
): never {
  throw new AppError(error?.message ?? fallback, 400, error?.code ?? "DB_ERROR");
}

export async function getMyNotificationSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationSetting | null> {
  const { data, error } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) fail(error, "通知設定の取得に失敗しました");
  return data ? mapNotificationSetting(data as Row) : null;
}

export async function updateMyNotificationSettings(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<{
    emailEnabled: boolean;
    emailAddress: string | null;
    remindBeforeDays: number;
    pushEnabled: boolean;
  }>,
): Promise<NotificationSetting> {
  const update: Record<string, unknown> = {};
  if (patch.emailEnabled !== undefined) update["email_enabled"] = patch.emailEnabled;
  if (patch.emailAddress !== undefined) update["email_address"] = patch.emailAddress;
  if (patch.remindBeforeDays !== undefined)
    update["remind_before_days"] = patch.remindBeforeDays;
  if (patch.pushEnabled !== undefined) update["push_enabled"] = patch.pushEnabled;

  const { data, error } = await supabase
    .from("notification_settings")
    .update(update)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) fail(error, "通知設定の更新に失敗しました");
  return mapNotificationSetting(data as Row);
}
