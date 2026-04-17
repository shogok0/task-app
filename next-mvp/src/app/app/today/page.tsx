import { getCurrentUserId, createSupabaseServerClient } from "@/lib/supabase/server";
import { listTodayTasks, listOverdueTasks } from "@/lib/db/repositories/tasks";
import { TodayClient } from "./today-client";

// Page depends on time-of-day (today vs overdue boundary), so force SSR per request.
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null; // layout already redirects; defensive guard.

  const supabase = await createSupabaseServerClient();
  const now = new Date();

  const [todayTasks, overdueTasks] = await Promise.all([
    listTodayTasks(supabase, userId, now),
    listOverdueTasks(supabase, userId, now),
  ]);

  const pending = todayTasks.filter(
    (t) => t.mySubmission?.status !== "SUBMITTED",
  );
  const doneToday = todayTasks.filter(
    (t) => t.mySubmission?.status === "SUBMITTED",
  );

  return (
    <TodayClient
      pending={pending}
      overdue={overdueTasks}
      doneToday={doneToday}
      nowIso={now.toISOString()}
    />
  );
}
