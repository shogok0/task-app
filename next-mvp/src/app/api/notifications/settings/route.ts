import { NextRequest, NextResponse } from "next/server";

import { fail } from "@/lib/api";
import { getNotificationSetting, updateNotificationSetting } from "@/lib/services/notification-service";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const setting = await getNotificationSetting(user.id);
    return NextResponse.json({ setting });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const setting = await updateNotificationSetting(user.id, payload);
    return NextResponse.json({ setting });
  } catch (error) {
    return fail(error);
  }
}
