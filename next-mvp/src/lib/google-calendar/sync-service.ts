import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import {
  getMyGoogleCalendarSecretConnection,
  listMyGoogleCalendarTaskSyncMap,
  touchMyGoogleCalendarLastSyncedAt,
  updateMyGoogleCalendarTokens,
  upsertMyGoogleCalendarTaskSyncMap,
  deleteMyGoogleCalendarTaskSyncMapsByTaskIds,
} from "@/lib/db/repositories/google-calendar";
import { listOpenTasksForCalendarSync } from "@/lib/db/repositories/tasks";
import { buildGoogleCalendarEventInput } from "@/lib/google-calendar/sync-utils";

type GoogleTokenRefreshResponse = {
  access_token: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  refresh_token?: string;
};

type GoogleCalendarEventResponse = {
  id: string;
};

export type GoogleCalendarSyncResult = {
  created: number;
  updated: number;
  deleted: number;
};

const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function withTimeoutMs(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t <= Date.now() + 60_000;
}

function requireOAuthClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new AppError(
      "Googleトークン更新に必要な環境変数が未設定です（GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET）",
      500,
      "GOOGLE_OAUTH_ENV_MISSING",
    );
  }
  return { clientId, clientSecret };
}

async function refreshGoogleAccessToken(params: {
  refreshToken: string;
}): Promise<GoogleTokenRefreshResponse> {
  const { clientId, clientSecret } = requireOAuthClientCredentials();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: params.refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: withTimeoutMs(20_000),
  });

  const json = (await res.json().catch(() => null)) as
    | (GoogleTokenRefreshResponse & { error?: string; error_description?: string })
    | null;

  if (!res.ok || !json?.access_token) {
    const detail =
      json?.error_description ?? json?.error ?? `HTTP_${res.status.toString()}`;
    throw new AppError(
      `Googleアクセストークンの更新に失敗しました: ${detail}`,
      400,
      "GOOGLE_REFRESH_FAILED",
    );
  }

  return json;
}

async function googleCalendarRequest(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${GOOGLE_CALENDAR_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: withTimeoutMs(20_000),
  });

  if (res.status === 401) {
    throw new AppError("Googleアクセストークンの有効期限が切れています", 401, "GOOGLE_TOKEN_EXPIRED");
  }
  return res;
}

async function createGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventInput: Record<string, unknown>,
): Promise<GoogleCalendarEventResponse> {
  const res = await googleCalendarRequest(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      body: JSON.stringify(eventInput),
    },
  );
  const json = (await res.json().catch(() => null)) as GoogleCalendarEventResponse | null;
  if (!res.ok || !json?.id) {
    throw new AppError("Googleカレンダーへのイベント作成に失敗しました", 400, "GOOGLE_EVENT_CREATE_FAILED");
  }
  return json;
}

async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  eventInput: Record<string, unknown>,
): Promise<GoogleCalendarEventResponse | null> {
  const res = await googleCalendarRequest(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(eventInput),
    },
  );

  if (res.status === 404) return null;

  const json = (await res.json().catch(() => null)) as GoogleCalendarEventResponse | null;
  if (!res.ok || !json?.id) {
    throw new AppError("Googleカレンダーイベントの更新に失敗しました", 400, "GOOGLE_EVENT_UPDATE_FAILED");
  }
  return json;
}

async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<boolean> {
  const res = await googleCalendarRequest(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
    },
  );

  if (res.status === 404 || res.status === 410) return false;
  if (!res.ok) {
    throw new AppError("Googleカレンダーイベントの削除に失敗しました", 400, "GOOGLE_EVENT_DELETE_FAILED");
  }
  return true;
}

async function withAutoRefresh<T>(params: {
  supabase: SupabaseClient;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  run: (accessToken: string) => Promise<T>;
}): Promise<{ data: T; accessToken: string }> {
  let currentAccessToken = params.accessToken;
  let currentExpiresAt = params.expiresAt;

  const tryRefresh = async () => {
    if (!params.refreshToken) {
      throw new AppError("Google再連携が必要です。設定から連携し直してください", 401, "GOOGLE_RECONNECT_REQUIRED");
    }
    const refreshed = await refreshGoogleAccessToken({ refreshToken: params.refreshToken });
    currentAccessToken = refreshed.access_token;
    currentExpiresAt =
      typeof refreshed.expires_in === "number"
        ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        : null;
    await updateMyGoogleCalendarTokens(params.supabase, params.userId, {
      accessToken: currentAccessToken,
      refreshToken: refreshed.refresh_token ?? params.refreshToken,
      expiresAt: currentExpiresAt,
      scope: refreshed.scope ?? null,
      tokenType: refreshed.token_type ?? null,
    });
  };

  if (isExpired(currentExpiresAt)) {
    await tryRefresh();
  }

  try {
    const data = await params.run(currentAccessToken);
    return { data, accessToken: currentAccessToken };
  } catch (error) {
    if (error instanceof AppError && error.code === "GOOGLE_TOKEN_EXPIRED") {
      await tryRefresh();
      const data = await params.run(currentAccessToken);
      return { data, accessToken: currentAccessToken };
    }
    throw error;
  }
}

export async function syncGoogleCalendarForUser(params: {
  supabase: SupabaseClient;
  userId: string;
  appUrl?: string | null;
}): Promise<GoogleCalendarSyncResult> {
  const connection = await getMyGoogleCalendarSecretConnection(params.supabase, params.userId);
  if (!connection) {
    throw new AppError("Googleカレンダーが未連携です", 400, "GOOGLE_NOT_CONNECTED");
  }

  const { data } = await withAutoRefresh({
    supabase: params.supabase,
    userId: params.userId,
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt,
    run: async (accessToken) => {
      const [tasks, syncMap] = await Promise.all([
        listOpenTasksForCalendarSync(params.supabase, params.userId),
        listMyGoogleCalendarTaskSyncMap(params.supabase, params.userId),
      ]);

      const mapByTaskId = new Map(syncMap.map((m) => [m.taskId, m.eventId]));
      const activeTaskIdSet = new Set(tasks.map((task) => task.id));

      let created = 0;
      let updated = 0;

      for (const task of tasks) {
        const eventInput = buildGoogleCalendarEventInput(task, params.appUrl);
        const mappedEventId = mapByTaskId.get(task.id);

        if (!mappedEventId) {
          const createdEvent = await createGoogleEvent(accessToken, connection.calendarId, eventInput);
          await upsertMyGoogleCalendarTaskSyncMap(
            params.supabase,
            params.userId,
            task.id,
            createdEvent.id,
          );
          created += 1;
          continue;
        }

        const updatedEvent = await updateGoogleEvent(
          accessToken,
          connection.calendarId,
          mappedEventId,
          eventInput,
        );

        if (!updatedEvent) {
          const recreated = await createGoogleEvent(accessToken, connection.calendarId, eventInput);
          await upsertMyGoogleCalendarTaskSyncMap(
            params.supabase,
            params.userId,
            task.id,
            recreated.id,
          );
          created += 1;
          continue;
        }

        if (updatedEvent.id !== mappedEventId) {
          await upsertMyGoogleCalendarTaskSyncMap(
            params.supabase,
            params.userId,
            task.id,
            updatedEvent.id,
          );
        }
        updated += 1;
      }

      const staleMappings = syncMap.filter((m) => !activeTaskIdSet.has(m.taskId));
      for (const stale of staleMappings) {
        await deleteGoogleEvent(accessToken, connection.calendarId, stale.eventId);
      }
      await deleteMyGoogleCalendarTaskSyncMapsByTaskIds(
        params.supabase,
        params.userId,
        staleMappings.map((m) => m.taskId),
      );

      return {
        created,
        updated,
        deleted: staleMappings.length,
      };
    },
  });

  await touchMyGoogleCalendarLastSyncedAt(params.supabase, params.userId);
  return data;
}

