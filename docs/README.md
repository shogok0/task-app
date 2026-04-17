# 課題管理アプリ ドキュメント一覧

このディレクトリには、課題管理アプリをゼロから設計・開発する前提の主要ドキュメントを格納する。

## ドキュメント一覧

- [技術スタック方針](C:/Users/shomi/task_app/docs/tech-stack-best-practices.md)
- [要件定義書](C:/Users/shomi/task_app/docs/requirements-definition.md)
- [機能設計書](C:/Users/shomi/task_app/docs/functional-design.md)
- [データベース設計書](C:/Users/shomi/task_app/docs/database-design.md)
- [MVP機能一覧](C:/Users/shomi/task_app/docs/mvp-features.md)

## 前提

- 本ドキュメント群は、既存実装を一旦無視して新規に課題管理アプリを構築する前提で作成している。
- 対象ユーザーは主に学生、個人学習者、学習チーム運営者を想定する。
- 提供形態は Web ファーストの PWA を基本とし、将来的なモバイル展開にも耐えられる構成を前提とする。

## 読む順番

1. 技術スタック方針
2. 要件定義書
3. MVP機能一覧
4. 機能設計書
5. データベース設計書

## 実装状況（2026-04-18 JST 更新）

Python を使わずに新技術スタックで再実装した MVP は、`C:\Users\shomi\task_app\next-mvp` に配置している。

### 採用スタック（今回実装）

- フロントエンド兼BFF: Next.js 16 (App Router) + React 19 + TypeScript
- データ: SQLite（ローカルMVP向け）+ Prisma Client
- テスト: Vitest（サービス層TDD）
- UI: Tailwindベース + カスタムCSS
- PWA: `manifest.webmanifest` / `service worker`

### アジャイル実装ステップ（完了済み）

1. Sprint 0: プロジェクト初期化、テスト環境、DB初期化スクリプトを整備
2. Sprint 1: 認証（登録/ログイン/ログアウト/セッション）
3. Sprint 2: 個人課題管理（作成、一覧、提出状態切替、締切順・緊急度）
4. Sprint 3: 共有機能（グループ作成、参加コード参加、退出、共有課題）
5. Sprint 4: 通知設定と締切通知ジョブ、PWA基礎、モバイルUI整備
6. Release Prep: lint/test/build を通過させ、起動手順を確定

### TDD運用

- サービス層に対して先にテストケースを作成し、実装で通す形を採用
- 実行結果（2026-04-18 JST）:
  - `pnpm test` ✅ 15 tests passed
  - `pnpm lint` ✅ passed
  - `pnpm build` ✅ passed

### MVP起動手順

1. `cd C:\Users\shomi\task_app\next-mvp`
2. `.env.example` を `.env` にコピーし、必要値を設定
3. `pnpm install`
4. `pnpm prisma:generate`
5. `pnpm db:push`
6. `pnpm db:seed`（任意）
7. `pnpm dev`

本番リリース相当チェックは `pnpm test && pnpm lint && pnpm build` を実行する。
