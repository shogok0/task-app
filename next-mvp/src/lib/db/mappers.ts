// Snake_case DB rows (from Supabase) -> camelCase domain objects.
// Keep these purposefully loose at the input boundary (Record<string, unknown>);
// rely on the schema constraints + RLS to keep the shapes honest.

import type {
  Group,
  GroupMembership,
  GroupStatus,
  MembershipRole,
  NotificationSetting,
  Profile,
  SubmissionStatus,
  Task,
  TaskScopeType,
  TaskStatus,
  TaskSubmissionRow,
} from "./types";

type Row = Record<string, unknown>;

function str(row: Row, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v : "";
}

function strOrNull(row: Row, key: string): string | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : String(v);
}

function bool(row: Row, key: string): boolean {
  return row[key] === true;
}

function num(row: Row, key: string): number {
  const v = row[key];
  return typeof v === "number" ? v : Number(v ?? 0);
}

export function mapProfile(row: Row): Profile {
  return {
    id: str(row, "id"),
    displayName: str(row, "display_name"),
    createdAt: str(row, "created_at"),
    updatedAt: str(row, "updated_at"),
  };
}

export function mapGroup(row: Row): Group {
  return {
    id: str(row, "id"),
    name: str(row, "name"),
    inviteCode: str(row, "invite_code"),
    status: (str(row, "status") as GroupStatus) || "ACTIVE",
    createdBy: str(row, "created_by"),
    createdAt: str(row, "created_at"),
    updatedAt: str(row, "updated_at"),
  };
}

export function mapMembership(row: Row): GroupMembership {
  return {
    id: str(row, "id"),
    groupId: str(row, "group_id"),
    userId: str(row, "user_id"),
    role: (str(row, "role") as MembershipRole) || "MEMBER",
    joinedAt: str(row, "joined_at"),
    leftAt: strOrNull(row, "left_at"),
  };
}

export function mapTask(row: Row): Task {
  return {
    id: str(row, "id"),
    groupId: strOrNull(row, "group_id"),
    createdBy: str(row, "created_by"),
    ownerUserId: strOrNull(row, "owner_user_id"),
    scopeType: (str(row, "scope_type") as TaskScopeType) || "PERSONAL",
    subject: strOrNull(row, "subject"),
    title: str(row, "title"),
    description: strOrNull(row, "description"),
    deadlineAt: str(row, "deadline_at"),
    status: (str(row, "status") as TaskStatus) || "OPEN",
    createdAt: str(row, "created_at"),
    updatedAt: str(row, "updated_at"),
    deletedAt: strOrNull(row, "deleted_at"),
  };
}

export function mapSubmission(row: Row): TaskSubmissionRow {
  return {
    id: str(row, "id"),
    taskId: str(row, "task_id"),
    userId: str(row, "user_id"),
    status: (str(row, "status") as SubmissionStatus) || "PENDING",
    submittedAt: strOrNull(row, "submitted_at"),
    updatedAt: str(row, "updated_at"),
  };
}

export function mapNotificationSetting(row: Row): NotificationSetting {
  return {
    id: str(row, "id"),
    userId: str(row, "user_id"),
    emailEnabled: bool(row, "email_enabled"),
    emailAddress: strOrNull(row, "email_address"),
    remindBeforeDays: num(row, "remind_before_days"),
    pushEnabled: bool(row, "push_enabled"),
    createdAt: str(row, "created_at"),
    updatedAt: str(row, "updated_at"),
  };
}
