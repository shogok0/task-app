"use client";

import { useActionState } from "react";
import Link from "next/link";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { loginAction, type LoginState } from "./_actions";

const initial: LoginState = { error: null };

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ios-title1">ログイン</h1>
        <p className="text-ios-callout text-[color:var(--color-text-secondary)] mt-1">
          アカウントにサインインします
        </p>
      </div>
      <form action={action} className="space-y-4">
        <TextField
          label="メールアドレス"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <TextField
          label="パスワード"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
        {state?.error && (
          <p
            role="alert"
            className="text-ios-footnote text-[color:var(--color-danger)]"
          >
            {state.error}
          </p>
        )}
        <Button type="submit" fullWidth size="lg" loading={pending}>
          ログイン
        </Button>
      </form>
      <div className="flex flex-col gap-3 text-center">
        <Link
          href="/forgot-password"
          className="text-ios-footnote text-[color:var(--color-accent)]"
        >
          パスワードを忘れた方
        </Link>
        <Link
          href="/register"
          className="text-ios-footnote text-[color:var(--color-text-secondary)]"
        >
          アカウントをお持ちでない方は{" "}
          <span className="text-[color:var(--color-accent)] font-semibold">
            新規登録
          </span>
        </Link>
      </div>
    </div>
  );
}
