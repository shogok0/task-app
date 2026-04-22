import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { mapGoogleCalendarConnection } from "@/lib/db/mappers";
import type { GoogleCalendarConnection } from "@/lib/db/types";

type Row = Record<string, unknown>;

type UpsertConnectionInput = {
  googleEmail: string | null;
  accessToken: string;
  refreshToken: string | null;
  scope: string | null;
  tokenType: string | null;
  expiresAt: string | null;
  calendarId?: string;
};

type GoogleCalendarSecretRow = {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  scope: string | null;
  tokenType: string | null;
  expiresAt: string | null;
  calendarId: string;
};

type TaskSyncMap = {
  taskId: string;
  eventId: string;
};

function fail(
  error: { message?: string; code?: string } | null,
  fallback: string,
): never {
  throw new AppError(error?.message ?? fallback, 400, error?.code ?? "DB_ERROR");
}

function readString(row: Row, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v : "";
}

function readStringOrNull(row: Row, key: string): string | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : String(v);
}

function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01";
}

export async function getMyGoogleCalendarConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<GoogleCalendarConnection | null> {
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("user_id, provider, google_email, calendar_id, last_synced_at, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return null;
    fail(error, "Google連携情報の取得に失敗しました");
  }
  return data ? mapGoogleCalendarConnection(data as Row) : null;
}

export async function getMyGoogleCalendarSecretConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<GoogleCalendarSecretRow | null> {
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("user_id, access_token, refresh_token, scope, token_type, expires_at, calendar_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return null;
    fail(error, "Google連携シークレット情報の取得に失敗しました");
  }
  if (!data) return null;

  const row = data as Row;
  return {
    userId: readString(row, "user_id"),
    accessToken: readString(row, "access_token"),
    refreshToken: readStringOrNull(row, "refresh_token"),
    scope: readStringOrNull(row, "scope"),
    tokenType: readStringOrNull(row, "token_type"),
    expiresAt: readStringOrNull(row, "expires_at"),
    calendarId: readString(row, "calendar_id") || "primary",
  };
}

export async function upsertMyGoogleCalendarConnection(
  supabase: SupabaseClient,
  userId: string,
  input: UpsertConnectionInput,
): Promise<GoogleCalendarConnection> {
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .upsert(
      {
        user_id: userId,
        provider: "google",
        google_email: input.googleEmail,
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
        scope: input.scope,
        token_type: input.tokenType,
        expires_at: input.expiresAt,
        calendar_id: input.calendarId ?? "primary",
      },
      { onConflict: "user_id" },
    )
    .select("user_id, provider, google_email, calendar_id, last_synced_at, created_at, updated_at")
    .single();

  if (error || !data) {
    if (isMissingTable(error)) {
      throw new AppError(
        "Google連携テーブルが未作成です。Supabaseマイグレーションを適用してください",
        500,
        "GOOGLE_SCHEMA_MISSING",
      );
    }
    fail(error, "Google連携情報の保存に失敗しました");
  }
  return mapGoogleCalendarConnection(data as Row);
}

export async function updateMyGoogleCalendarTokens(
  supabase: SupabaseClient,
  userId: string,
  patch: {
    accessToken: string;
    refreshToken?: string | null;
    scope?: string | null;
    tokenType?: string | null;
    expiresAt?: string | null;
  },
): Promise<void> {
  const update: Record<string, unknown> = {
    access_token: patch.accessToken,
  };
  if (patch.refreshToken !== undefined) update["refresh_token"] = patch.refreshToken;
  if (patch.scope !== undefined) update["scope"] = patch.scope;
  if (patch.tokenType !== undefined) update["token_type"] = patch.tokenType;
  if (patch.expiresAt !== undefined) update["expires_at"] = patch.expiresAt;

  const { error } = await supabase
    .from("google_calendar_connections")
    .update(update)
    .eq("user_id", userId);

  if (error) {
    if (isMissingTable(error)) {
      throw new AppError(
        "Google連携テーブルが未作成です。Supabaseマイグレーションを適用してください",
        500,
        "GOOGLE_SCHEMA_MISSING",
      );
    }
    fail(error, "Googleトークンの更新に失敗しました");
  }
}

export async function touchMyGoogleCalendarLastSyncedAt(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("google_calendar_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) {
    if (isMissingTable(error)) return;
    fail(error, "Google同期時刻の更新に失敗しました");
  }
}

export async function deleteMyGoogleCalendarConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error: syncDeleteError } = await supabase
    .from("google_calendar_task_syncs")
    .delete()
    .eq("user_id", userId);
  if (syncDeleteError && !isMissingTable(syncDeleteError)) {
    fail(syncDeleteError, "Google同期マップの削除に失敗しました");
  }

  const { error } = await supabase
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", userId);

  if (error && !isMissingTable(error)) fail(error, "Google連携解除に失敗しました");
}

export async function listMyGoogleCalendarTaskSyncMap(
  supabase: SupabaseClient,
  userId: string,
): Promise<TaskSyncMap[]> {
  const { data, error } = await supabase
    .from("google_calendar_task_syncs")
    .select("task_id, event_id")
    .eq("user_id", userId);

  if (error) {
    if (isMissingTable(error)) return [];
    fail(error, "Google同期マップの取得に失敗しました");
  }
  return (data ?? []).map((row) => ({
    taskId: readString(row as Row, "task_id"),
    eventId: readString(row as Row, "event_id"),
  }));
}

export async function upsertMyGoogleCalendarTaskSyncMap(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  eventId: string,
): Promise<void> {
  const { error } = await supabase
    .from("google_calendar_task_syncs")
    .upsert(
      {
        user_id: userId,
        task_id: taskId,
        event_id: eventId,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,task_id" },
    );

  if (error) {
    if (isMissingTable(error)) {
      throw new AppError(
        "Google連携テーブルが未作成です。Supabaseマイグレーションを適用してください",
        500,
        "GOOGLE_SCHEMA_MISSING",
      );
    }
    fail(error, "Google同期マップの保存に失敗しました");
  }
}

export async function deleteMyGoogleCalendarTaskSyncMapsByTaskIds(
  supabase: SupabaseClient,
  userId: string,
  taskIds: string[],
): Promise<void> {
  if (taskIds.length === 0) return;
  const { error } = await supabase
    .from("google_calendar_task_syncs")
    .delete()
    .eq("user_id", userId)
    .in("task_id", taskIds);

  if (error && !isMissingTable(error)) fail(error, "不要なGoogle同期マップの削除に失敗しました");
}
