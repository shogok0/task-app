import { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api";
import { loginUser } from "@/lib/services/auth-service";
import { createSession, setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const user = await loginUser(payload);
    const session = await createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);

    return ok({
      user: { id: user.id, displayName: user.displayName, email: user.email },
    });
  } catch (error) {
    return fail(error);
  }
}
