import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { mapGroup, mapProfile } from "@/lib/db/mappers";
import type { Group, MembershipRole, Profile } from "@/lib/db/types";

type Row = Record<string, unknown>;

function fail(
  error: { message?: string; code?: string } | null,
  fallback: string,
): never {
  throw new AppError(error?.message ?? fallback, 400, error?.code ?? "DB_ERROR");
}

export type GroupWithMeta = Group & {
  memberCount: number;
  myRole: MembershipRole;
};

/**
 * Lists active groups the given user belongs to, with member count + the
 * caller's role. Relies on RLS: the user can only read groups they belong to.
 */
export async function listMyGroups(
  supabase: SupabaseClient,
  userId: string,
): Promise<GroupWithMeta[]> {
  const { data, error } = await supabase
    .from("group_memberships")
    .select("role, groups(*)")
    .eq("user_id", userId)
    .is("left_at", null);

  if (error) fail(error, "グループの取得に失敗しました");

  const rows = (data ?? []) as Row[];
  const groups: GroupWithMeta[] = [];

  for (const row of rows) {
    const groupRow = row["groups"];
    if (!groupRow || typeof groupRow !== "object") continue;
    const group = mapGroup(groupRow as Row);
    const myRole = ((row["role"] as string) || "MEMBER") as MembershipRole;

    // Cheap per-group head-count. RLS lets active members see other members.
    const { count, error: countErr } = await supabase
      .from("group_memberships")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id)
      .is("left_at", null);

    if (countErr) fail(countErr, "メンバー数の取得に失敗しました");

    groups.push({ ...group, memberCount: count ?? 0, myRole });
  }

  return groups;
}

export async function getGroupById(
  supabase: SupabaseClient,
  id: string,
): Promise<Group | null> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) fail(error, "グループの取得に失敗しました");
  return data ? mapGroup(data as Row) : null;
}

export async function listActiveMembers(
  supabase: SupabaseClient,
  groupId: string,
): Promise<(Profile & { role: MembershipRole })[]> {
  const { data, error } = await supabase
    .from("group_memberships")
    .select("role, profiles:user_id(*)")
    .eq("group_id", groupId)
    .is("left_at", null);

  if (error) fail(error, "メンバー一覧の取得に失敗しました");

  return ((data ?? []) as Row[])
    .map((row) => {
      const profileRow = row["profiles"];
      if (!profileRow || typeof profileRow !== "object") return null;
      const profile = mapProfile(profileRow as Row);
      const role = ((row["role"] as string) || "MEMBER") as MembershipRole;
      return { ...profile, role };
    })
    .filter((v): v is Profile & { role: MembershipRole } => v !== null);
}

export async function createGroup(
  supabase: SupabaseClient,
  name: string,
): Promise<Group> {
  const { data: newId, error } = await supabase.rpc("create_group", {
    p_name: name,
  });
  if (error) fail(error, "グループの作成に失敗しました");

  const group = await getGroupById(supabase, newId as string);
  if (!group) {
    throw new AppError("作成したグループを取得できませんでした", 500, "DB_ERROR");
  }
  return group;
}

export async function joinGroupByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<Group> {
  const { data: gid, error } = await supabase.rpc("join_group_by_code", {
    p_code: code,
  });
  if (error) {
    if (error.message?.includes("INVALID_CODE")) {
      throw new AppError("招待コードが無効です", 400, "INVALID_CODE");
    }
    fail(error, "グループへの参加に失敗しました");
  }

  const group = await getGroupById(supabase, gid as string);
  if (!group) {
    throw new AppError("参加したグループを取得できませんでした", 500, "DB_ERROR");
  }
  return group;
}

export async function leaveGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  const { error } = await supabase.rpc("leave_group", { gid: groupId });
  if (!error) return;

  if (error.message?.includes("LAST_ADMIN")) {
    throw new AppError("最後の管理者は退出できません", 400, "LAST_ADMIN");
  }
  if (error.message?.includes("NOT_A_MEMBER")) {
    throw new AppError("グループのメンバーではありません", 400, "NOT_A_MEMBER");
  }
  fail(error, "グループからの退出に失敗しました");
}
