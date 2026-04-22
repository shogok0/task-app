"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { registerAction, type RegisterState } from "./_actions";

const initial: RegisterState = { error: null, info: null };

const PASSWORD_HELPER =
  "8文字以上128文字以下で入力してください。英字・数字・記号を組み合わせると安全です。";

function PasswordField({
  label,
  name,
  autoComplete,
  helper,
}: {
  label: string;
  name: "password" | "passwordConfirm";
  autoComplete: "new-password";
  helper: string;
}) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  const descriptionId = `${inputId}-description`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-ios-subhead text-[color:var(--color-text-secondary)]"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={8}
          maxLength={128}
          aria-describedby={descriptionId}
          className="h-12 w-full rounded-[var(--radius-md)] border border-[color:var(--color-separator)] bg-[color:var(--color-surface-2)] pl-4 pr-16 text-ios-body text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-tertiary)] outline-none transition-colors focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/20 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="tap-target absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 text-ios-footnote text-[color:var(--color-accent)]"
          aria-label={visible ? "パスワードを非表示にする" : "パスワードを表示する"}
          aria-pressed={visible}
        >
          {visible ? "非表示" : "表示"}
        </button>
      </div>
      <p
        id={descriptionId}
        className="text-ios-footnote text-[color:var(--color-text-secondary)]"
      >
        {helper}
      </p>
    </div>
  );
}

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
        <PasswordField
          label="パスワード"
          name="password"
          autoComplete="new-password"
          helper={PASSWORD_HELPER}
        />
        <PasswordField
          label="パスワード（確認）"
          name="passwordConfirm"
          autoComplete="new-password"
          helper="確認のため、同じパスワードをもう一度入力してください。"
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
