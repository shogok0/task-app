import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { mapIcalFeedToken } from "@/lib/db/mappers";
import type { IcalFeedToken } from "@/lib/db/types";

type Row = Record<string, unknown>;

function fail(
  error: { message?: string; code?: string } | null,
  fallback: string,
): never {
  throw new AppError(error?.message ?? fallback, 400, error?.code ?? "DB_ERROR");
}

function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01";
}

function newToken(): string {
  return randomBytes(24).toString("hex");
}

export async function getMyIcalFeedToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<IcalFeedToken | null> {
  const { data, error } = await supabase
    .from("ical_feed_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return null;
    fail(error, "iCalフィード情報の取得に失敗しました");
  }
  return data ? mapIcalFeedToken(data as Row) : null;
}

export async function ensureMyIcalFeedToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<IcalFeedToken> {
  const current = await getMyIcalFeedToken(supabase, userId);
  if (current) return current;

  const { data, error } = await supabase
    .from("ical_feed_tokens")
    .insert({
      user_id: userId,
      token: newToken(),
      enabled: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (isMissingTable(error)) {
      throw new AppError(
        "iCalフィードテーブルが未作成です。Supabaseマイグレーションを適用してください",
        500,
        "ICAL_SCHEMA_MISSING",
      );
    }
    fail(error, "iCalフィード情報の作成に失敗しました");
  }
  return mapIcalFeedToken(data as Row);
}

export async function regenerateMyIcalFeedToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<IcalFeedToken> {
  const { data, error } = await supabase
    .from("ical_feed_tokens")
    .upsert(
      {
        user_id: userId,
        token: newToken(),
        enabled: true,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    if (isMissingTable(error)) {
      throw new AppError(
        "iCalフィードテーブルが未作成です。Supabaseマイグレーションを適用してください",
        500,
        "ICAL_SCHEMA_MISSING",
      );
    }
    fail(error, "iCalフィードURLの再生成に失敗しました");
  }
  return mapIcalFeedToken(data as Row);
}

export async function getIcalFeedTokenByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<IcalFeedToken | null> {
  const { data, error } = await supabase
    .from("ical_feed_tokens")
    .select("*")
    .eq("token", token)
    .eq("enabled", true)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return null;
    fail(error, "iCalフィードトークンの取得に失敗しました");
  }
  return data ? mapIcalFeedToken(data as Row) : null;
}

export async function touchIcalFeedTokenAccessedAt(
  supabase: SupabaseClient,
  token: string,
): Promise<void> {
  const { error } = await supabase
    .from("ical_feed_tokens")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("token", token);

  if (error && !isMissingTable(error)) {
    fail(error, "iCalフィードのアクセス時刻更新に失敗しました");
  }
}
