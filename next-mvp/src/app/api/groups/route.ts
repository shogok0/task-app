import { NextRequest, NextResponse } from "next/server";

import { fail } from "@/lib/api";
import { createGroup, listMyGroups } from "@/lib/services/group-service";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const groups = await listMyGroups(user.id);
    return NextResponse.json({ groups });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const group = await createGroup(user.id, payload);
    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
