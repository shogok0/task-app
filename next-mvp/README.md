# 課題管理MVP（Next.js版）

`C:\Users\shomi\task_app\docs` の要件に基づいて再実装した MVP。

## 技術スタック

- Next.js 16 (App Router) / React 19 / TypeScript
- Prisma Client + SQLite
- Vitest（サービス層テスト）
- PWA（manifest + service worker）

## セットアップ

```bash
cd C:\Users\shomi\task_app\next-mvp
copy .env.example .env
pnpm install
pnpm prisma:generate
pnpm db:push
pnpm db:seed  # 任意
```

## 開発・検証

```bash
pnpm dev
pnpm test
pnpm lint
pnpm build
```

## 主要API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/tasks` / `POST /api/tasks`
- `POST /api/tasks/:taskId/submission`
- `GET /api/groups` / `POST /api/groups`
- `POST /api/groups/join`
- `POST /api/groups/:groupId/leave`
- `GET/PUT /api/notifications/settings`
- `POST /api/jobs/deadline-reminders`（`Authorization: Bearer <CRON_SECRET>`）
