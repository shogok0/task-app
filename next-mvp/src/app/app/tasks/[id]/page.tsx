import { notFound } from "next/navigation";
import { getCurrentUserId, createSupabaseServerClient } from "@/lib/supabase/server";
import { getTaskById } from "@/lib/db/repositories/tasks";
import { TaskDetailClient } from "./task-detail-client";

export const dynamic = "force-dynamic";

type CreatorProfile = { displayName: string | null };

async function fetchCreatorDisplayName(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<CreatorProfile> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const row = data as { display_name?: string | null } | null;
  return { displayName: row?.display_name ?? null };
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const supabase = await createSupabaseServerClient();
  const task = await getTaskById(supabase, id, userId);
  if (!task) notFound();

  // Name lookup is best-effort; missing display names render as "…" on the client.
  const creator = await fetchCreatorDisplayName(supabase, task.createdBy);

  return (
    <TaskDetailClient
      task={task}
      creatorDisplayName={creator.displayName}
      currentUserId={userId}
    />
  );
}
