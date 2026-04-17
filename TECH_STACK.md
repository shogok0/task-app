# 技術スタック定義

## 概要

このアプリは、Flask で構築された小規模なサーバーサイドレンダリング型の課題管理アプリです。フロントエンドはテンプレート HTML、インライン CSS、素の JavaScript を中心に構成され、課題データやユーザー情報は PostgreSQL に保存します。

## アプリケーション構成

| 領域 | 採用技術 | 用途 |
| --- | --- | --- |
| バックエンド | Python + Flask | ルーティング、画面表示、フォーム処理、セッション管理、JSON API |
| テンプレート | Jinja2 | `templates/*.html` のサーバーサイドレンダリング |
| データベース | PostgreSQL | ユーザー、課題、チーム、通知履歴の永続化 |
| DB 接続 | psycopg2 | Flask アプリから PostgreSQL へ接続 |
| 認証 | Flask session + Werkzeug password hashing | ログイン状態管理、パスワードハッシュ化・検証 |
| フロントエンド | HTML + CSS + JavaScript | 画面 UI、フォーム送信、タブ切り替え、カレンダー操作 |
| カレンダー UI | FullCalendar CDN | 締切カレンダー表示、日付クリックによる課題追加、予定クリックによる編集 |
| PWA 関連 | Web App Manifest + Service Worker | ホーム画面追加やスタンドアロン表示の基礎設定 |
| メール送信 | Python 標準ライブラリ `smtplib` | 締切通知メールの送信 |
| 本番実行 | gunicorn | WSGI サーバー |
| 定期実行 | GitHub Actions schedule | 締切通知エンドポイントの定期呼び出し |

## バックエンド

- エントリポイントは `app.py` です。
- Web フレームワークは Flask です。
- 主な機能は以下です。
  - ユーザー登録、ログイン、ログアウト
  - 課題の追加、編集、削除、提出状態切り替え
  - チーム作成、参加、退出、削除
  - 締切通知設定
  - 締切通知メール送信
  - ヘルスチェック
- ルーティングは Flask の `@app.route` で定義されています。
- ORM は使っておらず、SQL は `psycopg2` の cursor で直接実行しています。
- DB スキーマはマイグレーションツールではなく、起動時の `CREATE TABLE IF NOT EXISTS` と `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` で初期化しています。

## フロントエンド

- `templates/index.html` と `templates/login.html` が主要画面です。
- React、Vue、Next.js、Vite などのフロントエンドフレームワークは使っていません。
- CSS は各 HTML ファイル内の `<style>` に直接記述されています。
- JavaScript は `templates/index.html` 内に直接記述されています。
- カレンダー機能は CDN 経由の FullCalendar を利用しています。

## データベース

PostgreSQL を前提にしています。接続先は環境変数 `DATABASE_URL` で指定します。

主なテーブル:

- `users`
- `schools`
- `classes`
- `class_members`
- `tasks`
- `task_notifications`

## 認証・セキュリティ

- セッション管理は Flask の cookie session を利用しています。
- `SECRET_KEY` は環境変数から読み込みます。未設定時は開発用のデフォルト値が使われます。
- パスワードは Werkzeug の `generate_password_hash` / `check_password_hash` で扱います。
- 締切通知用の cron エンドポイントは `CRON_SECRET` と `X-Cron-Token` ヘッダーで保護します。

## メール通知

締切通知は `/cron/send-reminders` から実行されます。

メール送信には Python 標準ライブラリの `smtplib` を使います。SMTP 設定は以下の環境変数で制御します。

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_USE_TLS`
- `SMTP_USE_SSL`

## 運用・ジョブ

- `.github/workflows/send-reminders.yml` で GitHub Actions の定期実行が定義されています。
- スケジュールは毎時実行です。
- GitHub Actions から `REMINDER_ENDPOINT` に POST し、`CRON_SECRET` を `X-Cron-Token` として送ります。
- アプリ側には `/healthz` のヘルスチェックエンドポイントがあります。

## 実行環境

Python 依存関係は `requirements.txt` で管理されています。

```txt
Flask
psycopg2-binary
Werkzeug
gunicorn
```

ローカル実行時は `app.py` の `__main__` ブロックで Flask 開発サーバーが起動します。ポートは環境変数 `PORT` があればそれを使い、未設定時は `10000` です。

## 必要な環境変数

| 環境変数 | 必須度 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 必須 | PostgreSQL 接続 URL |
| `SECRET_KEY` | 本番必須 | Flask セッション署名キー |
| `PORT` | 任意 | 起動ポート |
| `DB_SSLMODE` | 任意 | PostgreSQL SSL mode。未指定時は `require` |
| `CRON_SECRET` | 推奨 | 通知エンドポイント保護 |
| `SMTP_HOST` | 通知利用時必須 | SMTP ホスト |
| `SMTP_PORT` | 任意 | SMTP ポート。未指定時は `587` |
| `SMTP_USER` | SMTP 認証時 | SMTP ユーザー |
| `SMTP_PASS` | SMTP 認証時 | SMTP パスワード |
| `SMTP_FROM` | 任意 | 送信元メールアドレス |
| `SMTP_USE_TLS` | 任意 | STARTTLS 利用フラグ。未指定時は有効 |
| `SMTP_USE_SSL` | 任意 | SMTP SSL 利用フラグ |

## 現時点で使っていないもの

- Node.js / npm / package.json
- TypeScript
- React / Vue / Next.js / Vite
- Tailwind CSS
- ORM
- Alembic などの DB マイグレーションツール
- Docker / docker-compose
- 自動テストフレームワーク

## 推奨するスタック表記

短く表現する場合は、以下のように定義できます。

> Python Flask + PostgreSQL のサーバーサイドレンダリングアプリ。フロントエンドは Jinja2 テンプレート、素の JavaScript、FullCalendar CDN で構成し、gunicorn で本番起動する。締切通知は GitHub Actions の定期実行から Flask の cron エンドポイントを呼び出して SMTP で送信する。
