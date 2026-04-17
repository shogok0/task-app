"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ForgotPasswordState = { error: string | null; info: string | null };

const schema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
});

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: "メールアドレスを確認してください", info: null };
  }

  const supabase = await createSupabaseServerClient();
  const origin = process.env.APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  if (error) {
    return { error: error.message, info: null };
  }

  return {
    error: null,
    info: "送信しました。受信箱を確認してください。",
  };
}
