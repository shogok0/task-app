import { NextRequest, NextResponse } from "next/server";

import { fail } from "@/lib/api";
import { runDeadlineReminderJob } from "@/lib/services/notification-service";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDeadlineReminderJob(new Date());
    return NextResponse.json(result);
  } catch (error) {
    return fail(error);
  }
}
