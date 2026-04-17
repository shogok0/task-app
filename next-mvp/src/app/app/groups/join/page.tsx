"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { joinGroupByCodeAction } from "@/app/app/_actions/groups";

export default function JoinGroupPage(): React.JSX.Element {
  const router = useRouter();
  const toast = useToast();

  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (normalized.length < 6 || normalized.length > 16) {
      setError("招待コードは6〜16文字で入力してください");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await joinGroupByCodeAction({ code: normalized });
      if (!res.ok) {
        if (res.code === "INVALID_CODE") {
          setError("招待コードが無効です。コードを確認してください。");
        } else {
          toast.show({
            title: "参加に失敗しました",
            description: res.error,
            variant: "error",
          });
        }
        return;
      }
      toast.show({ title: "参加しました", variant: "success" });
      router.push(`/app/groups/${res.data.id}`);
      router.refresh();
    });
  };

  return (
    <div className="pb-12">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-[color:var(--color-separator)] bg-[color:var(--color-bg)]/80 px-2 py-2 backdrop-blur">
        <Link
          href="/app/settings"
          aria-label="戻る"
          className="tap-target inline-flex items-center justify-center rounded-full text-[color:var(--color-accent)]"
        >
          <ArrowLeft className="h-6 w-6" aria-hidden />
        </Link>
        <h1 className="truncate text-ios-headline">招待コードで参加</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 px-4 pt-6">
        <TextField
          label="招待コード"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
          minLength={6}
          maxLength={16}
          placeholder="例: ABC123"
          error={error ?? undefined}
          helper="先生から共有されたコードを入力してください"
          disabled={isPending}
          autoFocus
          className="font-mono tracking-widest"
        />
        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={isPending}
          disabled={isPending || code.trim().length < 6}
        >
          参加する
        </Button>
        <Link href="/app/settings" className="block">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={isPending}
          >
            キャンセル
          </Button>
        </Link>
      </form>
    </div>
  );
}
