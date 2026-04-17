import { ok } from "@/lib/api";
import { clearSessionCookie, deleteCurrentSession } from "@/lib/session";

export async function POST() {
  await deleteCurrentSession();
  await clearSessionCookie();
  return ok({ success: true });
}
