import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(error: unknown) {
  const response = toErrorResponse(error);
  return NextResponse.json(response.body, { status: response.status });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  return user;
}
