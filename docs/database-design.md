# データベース設計書

## 1. 目的

課題管理アプリの主要業務を支えるデータ構造を定義する。対象は MVP を中心としつつ、将来の拡張も見据える。

## 2. 設計方針

- DB は `PostgreSQL` を前提とする
- 認証主体は外部認証基盤を使うが、業務データ側ではアプリ用ユーザー情報を保持する
- 共有単位として組織、クラス / チーム、メンバーシップを明示する
- 個人課題と共有課題は同じ `tasks` テーブルで扱い、スコープ列で区別する
- 通知は履歴を残し、重複送信を防止する

## 3. ER の考え方

- `users` がアプリ利用者の基本情報を持つ
- `organizations` が学習組織や運営単位の最上位単位を表す
- `groups` がクラス / チームを表す
- `group_memberships` が所属とロールを表す
- `tasks` が課題本体を表す
- `task_assignees` が将来の個別割当拡張を支える
- `notification_settings` がユーザー通知設定を表す
- `notification_deliveries` が配信履歴を表す

## 4. テーブル一覧

### 4.1 users

アプリ利用者情報。

| カラム名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| id | uuid | yes | 主キー |
| auth_provider_user_id | text | yes | 認証基盤上のユーザーID |
| display_name | text | yes | 表示名 |
| email | text | yes | メールアドレス |
| status | text | yes | `active`, `invited`, `suspended` など |
| created_at | timestamptz | yes | 作成日時 |
| updated_at | timestamptz | yes | 更新日時 |

#### 制約

- `auth_provider_user_id` は一意
- `email` は正規化して一意管理を検討

### 4.2 organizations

学習組織や運営単位。

| カラム名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| id | uuid | yes | 主キー |
| name | text | yes | 組織名 |
| slug | text | yes | URL 用識別子 |
| type | text | yes | `academy`, `study_group`, `private_group` など |
| created_by | uuid | yes | 作成者 |
| created_at | timestamptz | yes | 作成日時 |
| updated_at | timestamptz | yes | 更新日時 |

### 4.3 groups

クラス、チーム、講座などの共有単位。

| カラム名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| id | uuid | yes | 主キー |
| organization_id | uuid | yes | 所属組織ID |
| name | text | yes | グループ名 |
| code | text | yes | 参加コード |
| status | text | yes | `active`, `archived` |
| created_by | uuid | yes | 作成者 |
| created_at | timestamptz | yes | 作成日時 |
| updated_at | timestamptz | yes | 更新日時 |

#### 制約

- `code` は一意

### 4.4 group_memberships

ユーザー所属情報。

| カラム名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| id | uuid | yes | 主キー |
| group_id | uuid | yes | グループID |
| user_id | uuid | yes | ユーザーID |
| role | text | yes | `member`, `admin` |
| joined_at | timestamptz | yes | 参加日時 |
| left_at | timestamptz | no | 退出日時 |

#### 制約

- `group_id + user_id` は一意

### 4.5 tasks

課題本体。

| カラム名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| id | uuid | yes | 主キー |
| organization_id | uuid | no | 組織スコープ |
| group_id | uuid | no | 共有課題の場合の対象グループ |
| created_by | uuid | yes | 作成者 |
| owner_user_id | uuid | no | 個人課題の場合の所有ユーザー |
| scope_type | text | yes | `personal`, `group` |
| subject | text | yes | 科目 |
| title | text | yes | 課題タイトル |
| description | text | no | 詳細 |
| deadline_at | timestamptz | yes | 締切日時 |
| status | text | yes | `open`, `archived` |
| created_at | timestamptz | yes | 作成日時 |
| updated_at | timestamptz | yes | 更新日時 |
| deleted_at | timestamptz | no | 論理削除日時 |

#### ルール

- `scope_type = personal` の場合は `owner_user_id` 必須
- `scope_type = group` の場合は `group_id` 必須

### 4.6 task_submissions

課題ごとの提出状態。

| カラム名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| id | uuid | yes | 主キー |
| task_id | uuid | yes | 課題ID |
| user_id | uuid | yes | ユーザーID |
| status | text | yes | `pending`, `submitted` |
| submitted_at | timestamptz | no | 提出日時 |
| updated_at | timestamptz | yes | 更新日時 |

#### 制約

- `task_id + user_id` は一意

### 4.7 notification_settings

ユーザーごとの通知設定。

| カラム名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| id | uuid | yes | 主キー |
| user_id | uuid | yes | ユーザーID |
| email_enabled | boolean | yes | メール通知有効 |
| email_address | text | no | 通知先メール |
| remind_before_days | integer | yes | 何日前に通知するか |
| push_enabled | boolean | yes | Push通知有効 |
| created_at | timestamptz | yes | 作成日時 |
| updated_at | timestamptz | yes | 更新日時 |

#### 制約

- `user_id` は一意

### 4.8 push_subscriptions

将来の Web Push 用購読情報。

| カラム名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| id | uuid | yes | 主キー |
| user_id | uuid | yes | ユーザーID |
| endpoint | text | yes | push endpoint |
| p256dh | text | yes | 公開鍵 |
| auth | text | yes | auth secret |
| user_agent | text | no | 端末情報 |
| created_at | timestamptz | yes | 作成日時 |
| updated_at | timestamptz | yes | 更新日時 |
| revoked_at | timestamptz | no | 無効化日時 |

### 4.9 notification_deliveries

通知配信履歴。

| カラム名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| id | uuid | yes | 主キー |
| user_id | uuid | yes | 宛先ユーザー |
| task_id | uuid | no | 関連課題 |
| channel | text | yes | `email`, `push` |
| notification_type | text | yes | `deadline_reminder` など |
| scheduled_for | date | yes | 通知対象日 |
| status | text | yes | `queued`, `sent`, `failed`, `skipped` |
| provider_message_id | text | no | 外部配信ID |
| error_message | text | no | エラー詳細 |
| created_at | timestamptz | yes | 作成日時 |
| sent_at | timestamptz | no | 送信日時 |

#### 制約

- `user_id + task_id + channel + notification_type + scheduled_for` の一意制約を推奨

## 5. インデックス方針

- `tasks(owner_user_id, deadline_at)`
- `tasks(group_id, deadline_at)`
- `tasks(created_by)`
- `task_submissions(user_id, status)`
- `group_memberships(user_id, group_id)`
- `notification_deliveries(user_id, scheduled_for)`
- `groups(code)`

## 6. RLS / アクセス制御方針

### users

- 本人のみ更新可能
- 管理用途以外では他人の詳細情報は最小限のみ参照可

### groups / group_memberships

- 所属メンバーのみグループ情報を参照可能
- 管理者のみグループ運用系更新を許可

### tasks

- 個人課題は所有者のみ参照・更新可
- 共有課題は所属メンバーのみ参照可
- 共有課題の作成・更新・削除は `admin`

### task_submissions

- 原則本人のみ更新可
- 管理者による監査参照は将来要件に応じて調整

## 7. 監査 / ログ方針

将来、以下の監査系テーブル追加を推奨する。

- `audit_logs`
- `group_invites`
- `task_activity_logs`

## 8. 将来拡張項目

- 添付ファイルテーブル
- コメントテーブル
- 課題テンプレートテーブル
- 組織単位の設定テーブル
- 課金 / プランテーブル
