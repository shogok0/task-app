// Domain types mirroring the Supabase schema (see supabase/migrations/*.sql).
// Row shapes are normalized to camelCase here; DB mapping lives in ./mappers.ts.

export type TaskScopeType = "PERSONAL" | "GROUP";
export type TaskStatus = "OPEN" | "ARCHIVED";
export type SubmissionStatus = "PENDING" | "SUBMITTED";
export type MembershipRole = "MEMBER" | "ADMIN";
export type GroupStatus = "ACTIVE" | "ARCHIVED";
export type NotificationChannel = "EMAIL" | "PUSH";
export type DeliveryStatus = "QUEUED" | "SENT" | "FAILED" | "SKIPPED";

export type Profile = {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type Group = {
  id: string;
  name: string;
  inviteCode: string;
  status: GroupStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type GroupMembership = {
  id: string;
  groupId: string;
  userId: string;
  role: MembershipRole;
  joinedAt: string;
  leftAt: string | null;
};

export type Task = {
  id: string;
  groupId: string | null;
  createdBy: string;
  ownerUserId: string | null;
  scopeType: TaskScopeType;
  subject: string | null;
  title: string;
  description: string | null;
  deadlineAt: string; // ISO
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type TaskWithMySubmission = Task & {
  mySubmission: { status: SubmissionStatus; submittedAt: string | null } | null;
  groupName?: string | null;
};

export type TaskSubmissionRow = {
  id: string;
  taskId: string;
  userId: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  updatedAt: string;
};

export type NotificationSetting = {
  id: string;
  userId: string;
  emailEnabled: boolean;
  emailAddress: string | null;
  remindBeforeDays: number;
  pushEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GoogleCalendarConnection = {
  userId: string;
  provider: "google";
  googleEmail: string | null;
  calendarId: string;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
