import { NextRequest, NextResponse } from "next/server";

import { fail } from "@/lib/api";
import { createTask, listTasksForUser } from "@/lib/services/task-service";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const mode = req.nextUrl.searchParams.get("mode");
    const tasks = await listTasksForUser(
      user.id,
      mode === "pending" || mode === "submitted" ? mode : "all",
    );
    return NextResponse.json({ tasks });
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
    const task = await createTask(user.id, payload);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
