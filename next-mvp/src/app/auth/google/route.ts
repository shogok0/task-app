import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/google-calendar/sync-utils";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const next = sanitizeNextPath(searchParams.get("next"), "/app/today");
  const wantsCalendar = searchParams.get("calendar") === "1";
  const callbackParams = new URLSearchParams({ next });
  if (wantsCalendar) {
    callbackParams.set("calendar", "1");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?${callbackParams.toString()}`,
      scopes: wantsCalendar
        ? "openid email profile https://www.googleapis.com/auth/calendar.events"
        : "openid email profile",
      queryParams: wantsCalendar
        ? {
            access_type: "offline",
            prompt: "consent",
            include_granted_scopes: "true",
          }
        : undefined,
    },
  });

  if (error || !data.url) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "google_oauth_failed");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(data.url);
}

