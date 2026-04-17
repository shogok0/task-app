"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Props = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          password,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "認証に失敗しました。");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "認証に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>{mode === "login" ? "ログイン" : "アカウント作成"}</h1>
        <p>課題の登録、共有、締切通知をここから始めましょう。</p>

        <form onSubmit={onSubmit} className="auth-form">
          {mode === "register" ? (
            <label>
              表示名
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={80}
              />
            </label>
          ) : null}

          <label>
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={200}
            />
          </label>

          <label>
            パスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? "処理中..." : mode === "login" ? "ログイン" : "登録して開始"}
          </button>
        </form>

        <div className="auth-footnote">
          {mode === "login" ? (
            <>
              アカウントがない場合は <Link href="/register">新規登録</Link>
            </>
          ) : (
            <>
              すでにアカウントがある場合は <Link href="/login">ログイン</Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
