import { NextRequest, NextResponse } from "next/server";

import { fail } from "@/lib/api";
import { joinGroupByCode } from "@/lib/services/group-service";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const membership = await joinGroupByCode(user.id, payload);
    return NextResponse.json({ membership });
  } catch (error) {
    return fail(error);
  }
}
