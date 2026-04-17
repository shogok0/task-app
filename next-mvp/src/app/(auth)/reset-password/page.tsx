"use client";

import { useActionState } from "react";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import {
  resetPasswordAction,
  type ResetPasswordState,
} from "./_actions";

const initial: ResetPasswordState = { error: null };

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ios-title1">新しいパスワード</h1>
        <p className="text-ios-callout text-[color:var(--color-text-secondary)] mt-1">
          新しいパスワードを入力してください
        </p>
      </div>
      <form action={action} className="space-y-4">
        <TextField
          label="新しいパスワード"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
        <TextField
          label="新しいパスワード（確認）"
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
          パスワードを更新
        </Button>
      </form>
    </div>
  );
}
