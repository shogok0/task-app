import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { mapProfile } from "@/lib/db/mappers";
import type { Profile } from "@/lib/db/types";

type Row = Record<string, unknown>;

function fail(
  error: { message?: string; code?: string } | null,
  fallback: string,
): never {
  throw new AppError(error?.message ?? fallback, 400, error?.code ?? "DB_ERROR");
}

export async function getMyProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) fail(error, "プロフィールの取得に失敗しました");
  return data ? mapProfile(data as Row) : null;
}

export async function updateMyProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<{ displayName: string }>,
): Promise<Profile> {
  const update: Record<string, unknown> = {};
  if (patch.displayName !== undefined) update["display_name"] = patch.displayName;

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", userId)
    .select("*")
    .single();

  if (error || !data) fail(error, "プロフィールの更新に失敗しました");
  return mapProfile(data as Row);
}
