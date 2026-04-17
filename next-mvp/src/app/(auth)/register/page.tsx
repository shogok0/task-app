"use client";

import { useActionState } from "react";
import Link from "next/link";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { registerAction, type RegisterState } from "./_actions";

const initial: RegisterState = { error: null, info: null };

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerAction, initial);

  if (state?.info) {
    return (
      <div className="space-y-6">
        <div className="rounded-[var(--radius-lg)] bg-[color:var(--color-surface)] p-6 space-y-3">
          <h1 className="text-ios-title2">登録を受け付けました</h1>
          <p className="text-ios-callout text-[color:var(--color-text-secondary)]">
            {state.info}
          </p>
        </div>
        <Link href="/login" className="block">
          <Button type="button" fullWidth size="lg" variant="secondary">
            ログイン画面へ戻る
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ios-title1">新規登録</h1>
        <p className="text-ios-callout text-[color:var(--color-text-secondary)] mt-1">
          アカウントを作成します
        </p>
      </div>
      <form action={action} className="space-y-4">
        <TextField
          label="表示名"
          name="displayName"
          type="text"
          autoComplete="name"
          required
          maxLength={80}
        />
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
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
        <TextField
          label="パスワード（確認）"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
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
          登録する
        </Button>
      </form>
      <div className="text-center">
        <Link
          href="/login"
          className="text-ios-footnote text-[color:var(--color-text-secondary)]"
        >
          すでにアカウントをお持ちの方は{" "}
          <span className="text-[color:var(--color-accent)] font-semibold">
            ログイン
          </span>
        </Link>
      </div>
    </div>
  );
}
