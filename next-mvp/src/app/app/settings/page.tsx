import {
  createSupabaseServerClient,
  getCurrentUserId,
} from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/db/repositories/profiles";
import { listMyGroups } from "@/lib/db/repositories/groups";
import { getMyNotificationSettings } from "@/lib/db/repositories/notifications";
import { getMyGoogleCalendarConnection } from "@/lib/db/repositories/google-calendar";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null; // layout redirects; defensive guard.

  const supabase = await createSupabaseServerClient();

  const [profile, groups, notif, googleCalendarConnection, claimsRes] = await Promise.all([
    getMyProfile(supabase, userId),
    listMyGroups(supabase, userId),
    getMyNotificationSettings(supabase, userId),
    getMyGoogleCalendarConnection(supabase, userId),
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
      authEmail={authEmail}
    />
  );
}
