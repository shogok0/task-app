import { getCurrentUserId, createSupabaseServerClient } from "@/lib/supabase/server";
import { listUpcomingTasks } from "@/lib/db/repositories/tasks";
import { UpcomingClient } from "./upcoming-client";

// Page depends on "now" for bucket labels, so force SSR per request.
export const dynamic = "force-dynamic";

export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const userId = await getCurrentUserId();
  if (!userId) return null; // layout already redirects; defensive guard.

  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const tasks = await listUpcomingTasks(supabase, userId, now, 60);

  return (
    <UpcomingClient
      tasks={tasks}
      initialView={sp.view === "calendar" ? "calendar" : "list"}
      nowIso={now.toISOString()}
    />
  );
}
