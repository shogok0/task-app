"use client";

import { useActionState } from "react";
import Link from "next/link";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "./_actions";

const initial: ForgotPasswordState = { error: null, info: null };

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);

  if (state?.info) {
    return (
      <div className="space-y-6">
        <div className="rounded-[var(--radius-lg)] bg-[color:var(--color-surface)] p-6 space-y-3">
          <h1 className="text-ios-title2">送信しました</h1>
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
        <h1 className="text-ios-title1">パスワード再設定</h1>
        <p className="text-ios-callout text-[color:var(--color-text-secondary)] mt-1">
          ご登録のメールアドレスに再設定リンクを送ります
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
        {state?.error && (
          <p
            role="alert"
            className="text-ios-footnote text-[color:var(--color-danger)]"
          >
            {state.error}
          </p>
        )}
        <Button type="submit" fullWidth size="lg" loading={pending}>
          再設定リンクを送信
        </Button>
      </form>
      <div className="text-center">
        <Link
          href="/login"
          className="text-ios-footnote text-[color:var(--color-text-secondary)]"
        >
          ログイン画面へ戻る
        </Link>
      </div>
    </div>
  );
}
