import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/google-calendar/sync-utils";
import { upsertMyGoogleCalendarConnection } from "@/lib/db/repositories/google-calendar";
import { syncGoogleCalendarForUser } from "@/lib/google-calendar/sync-service";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"), "/app/today");
  const wantsCalendar = searchParams.get("calendar") === "1";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)
    );
  }

  if (wantsCalendar) {
    const session = data.session;
    const userId = session?.user?.id ?? null;
    const providerToken = session?.provider_token ?? null;
    const providerRefreshToken = session?.provider_refresh_token ?? null;
    const expiresAt =
      typeof session?.expires_at === "number"
        ? new Date(session.expires_at * 1000).toISOString()
        : null;

    if (userId && providerToken) {
      try {
        await upsertMyGoogleCalendarConnection(supabase, userId, {
          googleEmail: session?.user?.email ?? null,
          accessToken: providerToken,
          refreshToken: providerRefreshToken,
          scope: null,
          tokenType: null,
          expiresAt,
        });
        await syncGoogleCalendarForUser({
          supabase,
          userId,
          appUrl: process.env.APP_URL ?? origin,
        });
      } catch {
        const url = new URL(next, origin);
        url.searchParams.set("google_sync", "failed");
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
