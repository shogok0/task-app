import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fail } from "@/lib/api";
import { toggleSubmission } from "@/lib/services/task-service";
import { getCurrentUser } from "@/lib/session";

type Params = Promise<{ taskId: string }>;

const schema = z.object({
  submitted: z.boolean(),
});

export async function POST(req: NextRequest, context: { params: Params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = schema.parse(await req.json());
    const { taskId } = await context.params;
    const submission = await toggleSubmission(user.id, taskId, payload.submitted);
    return NextResponse.json({ submission });
  } catch (error) {
    return fail(error);
  }
}
