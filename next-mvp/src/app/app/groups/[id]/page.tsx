import { notFound } from "next/navigation";
import { createSupabaseServerClient, getCurrentUserId } from "@/lib/supabase/server";
import {
  getGroupById,
  listActiveMembers,
} from "@/lib/db/repositories/groups";
import { listTasksByGroup } from "@/lib/db/repositories/tasks";
import { GroupDetailClient } from "./group-detail-client";

// Group detail depends on the caller's membership + deadlines vs now.
export const dynamic = "force-dynamic";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return null; // layout redirects; defensive.

  const supabase = await createSupabaseServerClient();
  const [group, members, tasks] = await Promise.all([
    getGroupById(supabase, id),
    listActiveMembers(supabase, id),
    listTasksByGroup(supabase, id, userId),
  ]);

  if (!group) notFound();

  const me = members.find((m) => m.id === userId);

  return (
    <GroupDetailClient
      group={group}
      members={members}
      tasks={tasks}
      myRole={me?.role ?? null}
      nowIso={new Date().toISOString()}
    />
  );
}
