"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/ui/toast";
import { createGroupAction } from "@/app/app/_actions/groups";

export default function NewGroupPage(): React.JSX.Element {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const [created, setCreated] = React.useState<{
    id: string;
    inviteCode: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("グループ名を入力してください");
      return;
    }
    if (trimmed.length > 80) {
      setError("グループ名は80文字以内で入力してください");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await createGroupAction({ name: trimmed });
      if (!res.ok) {
        toast.show({
          title: "グループの作成に失敗しました",
          description: res.error,
          variant: "error",
        });
        return;
      }
      setCreated(res.data);
    });
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.inviteCode);
      toast.show({ title: "コピーしました", variant: "success" });
    } catch {
      toast.show({
        title: "コピーに失敗しました",
        variant: "error",
      });
    }
  };

  const goToGroup = () => {
    if (!created) return;
    const id = created.id;
    setCreated(null);
    router.push(`/app/groups/${id}`);
    router.refresh();
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
        <h1 className="truncate text-ios-headline">グループを作成</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 px-4 pt-6">
        <TextField
          label="グループ名"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          placeholder="例: 3年A組 数学"
          error={error ?? undefined}
          disabled={isPending}
          autoFocus
        />
        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={isPending}
          disabled={isPending || name.trim().length === 0}
        >
          作成する
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

      <BottomSheet
        open={created !== null}
        onOpenChange={(open) => {
          if (!open) {
            goToGroup();
          }
        }}
        title="招待コードを共有"
        snapPoints={[0.5]}
        dismissible
      >
        <div className="space-y-4 pt-2">
          <p className="text-ios-callout text-[color:var(--color-text-secondary)]">
            このコードを生徒に伝えると、グループに参加できます。
          </p>
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[color:var(--color-surface)] p-4">
            <code className="text-ios-title2 font-mono tracking-widest text-[color:var(--color-text-primary)]">
              {created?.inviteCode ?? ""}
            </code>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Copy className="h-4 w-4" aria-hidden />}
              onClick={handleCopy}
            >
              コピー
            </Button>
          </div>
          <Button fullWidth onClick={goToGroup}>
            グループを開く
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
