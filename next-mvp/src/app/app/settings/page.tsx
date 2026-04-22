import {
  createSupabaseServerClient,
  getCurrentUserId,
} from "@/lib/supabase/server";
import { headers } from "next/headers";
import { getMyProfile } from "@/lib/db/repositories/profiles";
import { listMyGroups } from "@/lib/db/repositories/groups";
import { getMyNotificationSettings } from "@/lib/db/repositories/notifications";
import { getMyGoogleCalendarConnection } from "@/lib/db/repositories/google-calendar";
import { getMyIcalFeedToken } from "@/lib/db/repositories/ical-feeds";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null; // layout redirects; defensive guard.

  const supabase = await createSupabaseServerClient();
  const h = await headers();
  const origin = (() => {
    const proto = h.get("x-forwarded-proto");
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (proto && host) return `${proto}://${host}`;
    return process.env.APP_URL ?? "http://localhost:3000";
  })();

  const [profile, groups, notif, googleCalendarConnection, icalFeedToken, claimsRes] = await Promise.all([
    getMyProfile(supabase, userId),
    listMyGroups(supabase, userId),
    getMyNotificationSettings(supabase, userId),
    getMyGoogleCalendarConnection(supabase, userId),
    getMyIcalFeedToken(supabase, userId),
    supabase.auth.getClaims(),
  ]);

  const claims = claimsRes.data?.claims as
    | { email?: string | null }
    | undefined;
  const authEmail = claims?.email ?? null;

  return (
    <SettingsClient
      profile={profile}
      groups={groups}
      notif={notif}
      googleCalendarConnection={googleCalendarConnection}
      icalFeedUrl={icalFeedToken ? `${origin}/api/ical/${icalFeedToken.token}` : null}
      authEmail={authEmail}
    />
  );
}
