# 課題管理 — セットアップガイド

モバイルファースト PWA の課題管理アプリ (Next.js 16 + Supabase)。
ローカル Supabase で最短起動、クラウドへのデプロイは後工程。

## 1. 前提ソフトウェア

- Node.js 20+
- pnpm 9+
- Docker (Supabase ローカルに必要)
- Supabase CLI (`brew install supabase/tap/supabase` or https://supabase.com/docs/guides/local-development)

## 2. 初回セットアップ

```bash
cd next-mvp
pnpm install
cp .env.example .env.local
```

### 2-1. Supabase をローカルで起動

```bash
supabase init      # 初回のみ (既に supabase/ がある場合は不要)
supabase start     # Docker に Postgres + Auth + Studio が立つ
```

起動すると CLI が以下を出力します。**2つの値を .env.local にコピー**してください。

```
API URL: http://127.0.0.1:54321      → NEXT_PUBLIC_SUPABASE_URL
anon key (publishable): eyJ...       → NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
service_role key: eyJ...             → SUPABASE_SERVICE_ROLE_KEY
```

Supabase Studio はブラウザで http://127.0.0.1:54323 で開けます。

### 2-2. マイグレーションを適用

```bash
supabase db reset   # supabase/migrations/*.sql を順に実行
```

- `001_init_schema.sql` — テーブル定義 + RLS 有効化
- `002_rls_and_functions.sql` — ポリシー、関数、トリガー

### 2-3. 型定義を生成 (推奨)

```bash
pnpm supabase:types
```

src/lib/supabase/database.types.ts を Supabase スキーマから生成します。
未実行の場合は placeholder が使われ、型チェックが緩くなります。

### 2-4. 開発サーバー起動

```bash
pnpm dev
```

http://localhost:3000 を開く。

## 3. 初回ユーザー作成

ブラウザで `/register` に行き、表示名・メール・パスワードで登録。
ローカル Supabase はデフォルトで**メール確認を自動バイパス**します (設定で変更可)。

メールテンプレートを本番に合わせて確認するには `supabase/config.toml` の
`[auth.email.template]` セクションを編集。詳細:
https://supabase.com/docs/guides/local-development/customizing-email-templates

## 4. Cron (ローカルで手動実行)

```bash
curl -X POST http://localhost:3000/api/cron/deadline-reminders \
  -H "x-cron-secret: $(grep CRON_SECRET .env.local | cut -d= -f2)"
```

## 5. よくあるトラブル

### `permission denied for table X`
RLS ポリシーが適用されていない。`supabase db reset` で再適用。

### メールが届かない
`.env.local` の `RESEND_API_KEY` が未設定なら、コンソールにメール本文が
ログ出力されるだけ (開発用スタブ)。実送信するには Resend アカウントを作成:
https://resend.com/

### Notification API がブラウザで動かない
iOS Safari では PWA を**ホーム画面に追加後**でないと通知 API は動作しません。
開発中はデスクトップ Chrome で検証するのが確実。

## 6. 本番デプロイ (将来)

Vercel を想定:

1. Supabase クラウドでプロジェクト作成
2. Dashboard → Settings → API から URL / publishable key / service_role key を取得
3. Dashboard → Auth → URL Configuration で `APP_URL` と `/auth/confirm` を Redirect URLs に登録
4. マイグレーションをクラウドに push: `supabase link --project-ref <ref>` → `supabase db push`
5. Vercel に Next.js プロジェクトを Import、環境変数を設定
6. `vercel.json` により `/api/cron/deadline-reminders` が毎時 Vercel Cron から POST される

## 7. 主要ディレクトリ

```
next-mvp/
├── src/
│   ├── app/                  # App Router (Next.js 16)
│   │   ├── (auth)/           # 未認証ページ (login/register/forgot/reset)
│   │   ├── app/              # 認証後 (today/upcoming/settings/tasks/groups)
│   │   ├── api/cron/         # サーバーサイド cron
│   │   ├── auth/             # callback/confirm/signout route handlers
│   │   ├── layout.tsx        # root layout (PWA meta)
│   │   ├── manifest.ts       # PWA manifest
│   │   └── page.tsx          # ランディング
│   ├── components/
│   │   ├── ui/               # プリミティブ (BottomSheet, SwipeRow, Button 他)
│   │   ├── app/              # 認証後向け (TabBar, FAB, QuickAddSheet 他)
│   │   └── states/           # 空状態
│   └── lib/
│       ├── supabase/         # SSR clients (client / server / service / middleware)
│       ├── db/               # リポジトリ層
│       ├── nlp/              # 日本語自然言語日付パーサ
│       ├── email/            # Resend ラッパー
│       ├── validation.ts     # zod schemas
│       ├── task-utils.ts     # 締切 urgency 判定
│       └── utils.ts          # cn (twMerge + clsx)
├── supabase/
│   └── migrations/           # スキーマ + RLS + 関数
├── public/
│   ├── sw.js                 # Service Worker
│   └── offline.html          # オフラインフォールバック
├── middleware.ts             # 認証セッション refresh + 保護ルート
└── vercel.json               # Cron schedule
```
