import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { mapSubmission, mapTask } from "@/lib/db/mappers";
import type {
  SubmissionStatus,
  Task,
  TaskStatus,
  TaskWithMySubmission,
} from "@/lib/db/types";

// -----------------------------------------------------------------------------
// Query strategy
//
// Reading: we LEFT JOIN task_submissions + groups in a single PostgREST select:
//   `*, task_submissions(user_id, status, submitted_at), groups(name)`
// This means a task never disappears from listings just because its fan-out
// submission row hasn't landed yet. We pick the submission matching the caller
// in-code via `pickMySubmission`.
//
// RLS is the source of truth for access control: if a row is hidden, Supabase
// simply returns fewer rows. We never re-check membership/ownership here.
// -----------------------------------------------------------------------------

type Row = Record<string, unknown>;

type TaskInputBase = {
  subject?: string | null;
  title: string;
  description?: string | null;
  deadlineAt: Date | string;
};

export type CreatePersonalTaskInput = TaskInputBase & {
  userId: string;
};

export type CreateGroupTaskInput = TaskInputBase & {
  userId: string;
  groupId: string;
};

export type UpdateTaskPatch = Partial<{
  subject: string | null;
  title: string;
  description: string | null;
  deadlineAt: Date | string;
  status: TaskStatus;
}>;

const TASK_LIST_SELECT =
  "*, task_submissions(user_id, status, submitted_at), groups(name)";

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function fail(error: { message?: string; code?: string } | null, fallback: string): never {
  throw new AppError(error?.message ?? fallback, 400, error?.code ?? "DB_ERROR");
}

function pickMySubmission(
  row: Row,
  userId: string,
): { status: SubmissionStatus; submittedAt: string | null } | null {
  const subs = row["task_submissions"];
  if (!Array.isArray(subs)) return null;
  const match = (subs as Row[]).find((s) => s["user_id"] === userId);
  if (!match) return null;
  const mapped = mapSubmission(match);
  return { status: mapped.status, submittedAt: mapped.submittedAt };
}

function pickGroupName(row: Row): string | null {
  const g = row["groups"];
  if (!g || typeof g !== "object") return null;
  const name = (g as Row)["name"];
  return typeof name === "string" ? name : null;
}

function mapTaskWithSubmission(row: Row, userId: string): TaskWithMySubmission {
  return {
    ...mapTask(row),
    mySubmission: pickMySubmission(row, userId),
    groupName: pickGroupName(row),
  };
}

// -----------------------------------------------------------------------------
// List queries
// -----------------------------------------------------------------------------

export async function listTasksForUserBetween(
  supabase: SupabaseClient,
  userId: string,
  from: Date,
  to: Date,
): Promise<TaskWithMySubmission[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_LIST_SELECT)
    .is("deleted_at", null)
    .gte("deadline_at", from.toISOString())
    .lt("deadline_at", to.toISOString())
    .order("deadline_at", { ascending: true });

  if (error) fail(error, "タスクの取得に失敗しました");
  return (data ?? []).map((row) => mapTaskWithSubmission(row as Row, userId));
}

export async function listTodayTasks(
  supabase: SupabaseClient,
  userId: string,
  today: Date,
): Promise<TaskWithMySubmission[]> {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return listTasksForUserBetween(supabase, userId, start, end);
}

export async function listOverdueTasks(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
): Promise<TaskWithMySubmission[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_LIST_SELECT)
    .is("deleted_at", null)
    .lt("deadline_at", now.toISOString())
    .order("deadline_at", { ascending: true });

  if (error) fail(error, "期限切れタスクの取得に失敗しました");

  // Keep only tasks where the caller's submission isn't SUBMITTED.
  // (Personal: the row is always the user's own; group: the fanout trigger
  // inserts one row per active member.)
  return (data ?? [])
    .map((row) => mapTaskWithSubmission(row as Row, userId))
    .filter((t) => t.mySubmission?.status !== "SUBMITTED");
}

export async function listUpcomingTasks(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
  days = 30,
): Promise<TaskWithMySubmission[]> {
  const tomorrow = new Date(now);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const end = new Date(now);
  end.setDate(end.getDate() + days);

  return listTasksForUserBetween(supabase, userId, tomorrow, end);
}

export async function listTasksByGroup(
  supabase: SupabaseClient,
  groupId: string,
  userId: string,
  options?: { includeCompleted?: boolean },
): Promise<TaskWithMySubmission[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_LIST_SELECT)
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .order("deadline_at", { ascending: true });

  if (error) fail(error, "グループ課題の取得に失敗しました");

  const mapped = (data ?? []).map((row) => mapTaskWithSubmission(row as Row, userId));
  if (options?.includeCompleted) return mapped;
  return mapped.filter((t) => t.mySubmission?.status !== "SUBMITTED");
}

export async function getTaskById(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
): Promise<TaskWithMySubmission | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_LIST_SELECT)
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) fail(error, "タスクの取得に失敗しました");
  if (!data) return null;
  return mapTaskWithSubmission(data as Row, userId);
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

export async function createPersonalTask(
  supabase: SupabaseClient,
  input: CreatePersonalTaskInput,
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      scope_type: "PERSONAL",
      owner_user_id: input.userId,
      created_by: input.userId,
      group_id: null,
      subject: input.subject ?? null,
      title: input.title,
      description: input.description ?? null,
      deadline_at: asIso(input.deadlineAt),
    })
    .select("*")
    .single();

  if (error || !data) fail(error, "タスクの作成に失敗しました");

  // Personal tasks don't get the fan-out trigger — insert the single
  // PENDING submission row ourselves. Safe to ignore duplicates.
  const { error: subError } = await supabase
    .from("task_submissions")
    .insert({
      task_id: (data as Row)["id"],
      user_id: input.userId,
      status: "PENDING",
    });

  if (subError && subError.code !== "23505") {
    fail(subError, "提出レコードの作成に失敗しました");
  }

  return mapTask(data as Row);
}

export async function createGroupTask(
  supabase: SupabaseClient,
  input: CreateGroupTaskInput,
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      scope_type: "GROUP",
      group_id: input.groupId,
      created_by: input.userId,
      owner_user_id: null,
      subject: input.subject ?? null,
      title: input.title,
      description: input.description ?? null,
      deadline_at: asIso(input.deadlineAt),
    })
    .select("*")
    .single();

  if (error || !data) fail(error, "グループ課題の作成に失敗しました");
  // Fan-out to task_submissions is handled by the DB trigger.
  return mapTask(data as Row);
}

export async function updateTask(
  supabase: SupabaseClient,
  taskId: string,
  patch: UpdateTaskPatch,
): Promise<Task> {
  const update: Record<string, unknown> = {};
  if (patch.subject !== undefined) update["subject"] = patch.subject;
  if (patch.title !== undefined) update["title"] = patch.title;
  if (patch.description !== undefined) update["description"] = patch.description;
  if (patch.deadlineAt !== undefined) update["deadline_at"] = asIso(patch.deadlineAt);
  if (patch.status !== undefined) update["status"] = patch.status;

  const { data, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error || !data) fail(error, "タスクの更新に失敗しました");
  return mapTask(data as Row);
}

export async function softDeleteTask(
  supabase: SupabaseClient,
  taskId: string,
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) fail(error, "タスクの削除に失敗しました");
}

export async function toggleSubmission(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  status: SubmissionStatus,
): Promise<void> {
  const submittedAt = status === "SUBMITTED" ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("task_submissions")
    .upsert(
      {
        task_id: taskId,
        user_id: userId,
        status,
        submitted_at: submittedAt,
      },
      { onConflict: "task_id,user_id" },
    );

  if (error) fail(error, "提出状態の更新に失敗しました");
}
