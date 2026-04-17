"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RegisterState = { error: string | null; info: string | null };

const schema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    email: z
      .string()
      .email()
      .transform((v) => v.toLowerCase()),
    password: z.string().min(8).max(128),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "パスワードが一致しません",
    path: ["passwordConfirm"],
  });

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = schema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      info: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const origin = process.env.APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${origin}/auth/confirm?next=/app/today`,
    },
  });
  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return {
        error: "このメールアドレスは既に登録されています",
        info: null,
      };
    }
    return { error: error.message, info: null };
  }

  return {
    error: null,
    info: "確認メールを送信しました。受信箱を確認してください。",
  };
}
