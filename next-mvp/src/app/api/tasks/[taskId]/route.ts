import { NextRequest, NextResponse } from "next/server";

import { fail } from "@/lib/api";
import { deleteTask, updateTask } from "@/lib/services/task-service";
import { getCurrentUser } from "@/lib/session";

type Params = Promise<{ taskId: string }>;

export async function PATCH(req: NextRequest, context: { params: Params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const { taskId } = await context.params;
    const task = await updateTask(user.id, taskId, payload);
    return NextResponse.json({ task });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: NextRequest, context: { params: Params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { taskId } = await context.params;
    await deleteTask(user.id, taskId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return fail(error);
  }
}
