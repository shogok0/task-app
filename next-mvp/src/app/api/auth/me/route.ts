import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
    },
  });
}
