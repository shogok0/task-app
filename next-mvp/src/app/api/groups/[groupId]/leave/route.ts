import { NextResponse } from "next/server";

import { fail } from "@/lib/api";
import { leaveGroup } from "@/lib/services/group-service";
import { getCurrentUser } from "@/lib/session";

type Params = Promise<{ groupId: string }>;

export async function POST(_req: Request, context: { params: Params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { groupId } = await context.params;
    await leaveGroup(user.id, groupId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return fail(error);
  }
}
