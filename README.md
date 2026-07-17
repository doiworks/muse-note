# Muse Note（Next.js + Supabase + Vercel + LINE Login）

Muse Note は、LINEユーザーごとに保存セット・回答履歴・成績を分ける英単語学習アプリです。

## 構成

- フロントエンド: Next.js App Router
- API: Next.js Route Handler
- DB: Supabase（PostgreSQL）
- ログイン: LINE Login
- 開発確認: ADMIN_PREVIEW_TOKEN
- デプロイ: Vercel

## ユーザー管理

ユーザーテーブルは `public.app_users` だけを使用します。

- LINEのユーザーID: `app_users.line_user_id`
- アプリ内部のユーザーID: `app_users.id`
- 保存セット: `word_sets.app_user_id`
- 回答履歴: `history.app_user_id`
- 成績: `stats.app_user_id`

各データはLINEのユーザーIDを直接保存せず、`app_users.id` で紐づけます。

## 初回セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. 環境変数

`.env.example` を `.env.local` にコピーして設定します。

```bash
cp .env.example .env.local
```

必須項目:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_SESSION_SECRET`
- `LINE_CHANNEL_ID`
- `LINE_CHANNEL_SECRET`
- `LINE_REDIRECT_URI`

開発確認ログインを使う場合だけ `ADMIN_PREVIEW_TOKEN` も設定します。

### 3. Supabase

新規作成の場合は `supabase/schema.sql` をSupabase SQL Editorで実行します。

既存DBを統一する場合は、次を一度だけ実行します。

```text
supabase/migrations/20260718_unify_app_users.sql
```

この移行SQLは既存の履歴・成績・保存セットを残し、古い `users` / `user_id` / 古い成績列を `app_users` / `app_user_id` に統一します。

### 4. LINE Developers

LINE DevelopersでLINE Loginチャネルを作り、Callback URLに次を登録します。

```text
https://あなたのVercelドメイン/api/auth/line/callback
```

ローカル確認時は次です。

```text
http://localhost:3000/api/auth/line/callback
```

登録したURLと `LINE_REDIRECT_URI` は完全に同じ値にします。

### 5. 起動

```bash
npm run dev
```

`/login` の「LINEでログイン」からログインします。

## ログインの流れ

1. `/api/auth/line/login` がLINE認可画面へ移動
2. LINEから `/api/auth/line/callback` に戻る
3. サーバーでIDトークン・state・nonceを確認
4. `app_users.line_user_id` でユーザーを取得または作成
5. `app_users.id` を含む署名済みhttpOnly Cookieを発行
6. APIがCookieから `app_user_id` を取得

## セキュリティ

- `SUPABASE_SERVICE_ROLE_KEY` と `LINE_CHANNEL_SECRET` はサーバー側だけで使用します。
- ブラウザから送られたLINE userIdは信用しません。
- LINEのIDトークンはLINE公式の検証APIで確認します。
- CookieはhttpOnly・SameSite=Lax・本番Secureで発行します。
- SupabaseのテーブルはRLSを有効にし、ブラウザから直接読み書きしません。

## 開発確認ユーザー

`ADMIN_PREVIEW_TOKEN` でログインした場合は、次の固定ユーザーを使用します。

```text
00000000-0000-4000-8000-000000000001
```

LINEユーザーのデータとは混ざりません。
