"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "入力内容を確認してください" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { error: "メールアドレスまたはパスワードが正しくありません" };
    }
    if (error.message.includes("Email not confirmed")) {
      return { error: "メールアドレスの確認が完了していません。受信箱を確認してください" };
    }
    return { error: error.message };
  }

  redirect("/app/today");
}
