import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh JWT on every request. Do not rely on getSession server-side.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  const pathname = request.nextUrl.pathname;
  const isProtected = pathname.startsWith("/app");
  const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password";

  if (isProtected && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/today";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
