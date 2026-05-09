# Muse Note（Next.js + Supabase + Vercel）

初心者でも保守しやすいように、**最小構成**で作った英単語学習アプリです。  
この README は、`main` へマージするときに衝突しやすい `README.md` / `package.json` を整理した最新版です。

- フロントエンド: Next.js（App Router）
- API: Next.js Route Handler
- DB: Supabase（PostgreSQL）
- デプロイ: Vercel
- 将来追加: LINE Login

---

## 1. セットアップ手順

### 1-1. Node.js を準備
- Node.js 20 以上を推奨

### 1-2. 依存関係をインストール
```bash
npm install
```

### 1-3. 環境変数を設定
```bash
cp .env.example .env.local
```

`.env.local` を開いて以下を設定してください。
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PREVIEW_TOKEN`

### 1-4. Supabase テーブル作成
Supabase の SQL Editor を開いて、次を実行してください。
- `supabase/schema.sql`

### 1-5. 単語データ取り込み
Supabase ダッシュボードの Table Editor で `words` テーブルを開き、CSV を import します。
- `supabase/words_seed.csv`

### 1-6. 開発サーバー起動
```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開くと、未ログインの場合は `/login` に移動します。`ADMIN_PREVIEW_TOKEN` で仮ログインすると、単語一覧が表示されます。

---

## 2. ファイル構成（重要なもの）

- `app/layout.jsx`
  - App Router 必須のルートレイアウト（これがないと Vercel build で失敗します）。
- `app/page.jsx`
  - 画面本体。仮ログイン済みのときだけ単語一覧を表示。
- `app/login/page.jsx`
  - 開発確認用の仮ログイン画面。
- `app/api/auth/preview-login/route.js`
  - `ADMIN_PREVIEW_TOKEN` をサーバー側で照合し、httpOnly cookie を発行するAPI。
- `app/api/auth/preview-logout/route.js`
  - 仮ログイン cookie を削除するAPI。
- `app/api/words/route.js`
  - 仮ログイン済みの場合だけ単語一覧を返すAPI。
- `app/api/users/route.js`
  - 将来LINE Login後のユーザー登録で使うAPI。
- `app/api/history/route.js`
  - 回答履歴保存API。
- `app/api/stats/route.js`
  - 学習統計更新API。
- `lib/supabaseClient.js`
  - 公開キーで使うSupabaseクライアント。
- `lib/supabaseAdmin.js`
  - サーバー専用（service role）クライアント。
- `lib/auth/previewSession.js`
  - 開発用仮ログインの cookie 作成・検証ロジック。
- `middleware.js`
  - 未ログインのトップページアクセスを `/login` に移動させる入口制御。
- `supabase/schema.sql`
  - テーブル作成SQL。
- `supabase/words_seed.csv`
  - `英単語.xlsx` から作った取込用CSV。

---

## 3. LINE Login を後から追加しやすくするポイント

この構成では、`users` テーブルに `line_user_id` を持たせています。  
将来は以下を追加すれば連携できます。

1. `/api/auth/line/login` を作る（LINE認可画面へリダイレクト）
2. `/api/auth/line/callback` を作る（アクセストークン交換）
3. LINE Profile API で `userId` を取得
4. `POST /api/users` で `lineUserId` を保存
5. `users.id` をキーに `history` / `stats` を更新

---

## 4. Vercel デプロイ手順

1. GitHubにこのリポジトリを push
2. Vercel で Import Project
3. Environment Variables に `.env.local` と同じ値を設定
4. Deploy

デプロイ後、`/api/words` が 200 で返ることを確認してください。

---

## 5. main へ安全にマージするためのメモ

今回衝突しやすいファイルは次の2つです。
- `README.md`
- `package.json`

このブランチでは、**Next.js + Supabase 構成を優先**した内容に統一しています。  
`app/layout.jsx` を含む App Router 構成が前提です。

---

## 6. 注意点

- `SUPABASE_SERVICE_ROLE_KEY` は絶対に公開しない
- 開発用仮ログインは商品化前の確認用です。正式公開前に LINE Login へ置き換えてください
- RLS は ON のままにしてください。service role key はサーバー側 API Route だけで使います
- anon 公開ポリシーを作らない場合も、ブラウザから直接 Supabase を読まず API 経由で必要なデータだけ返してください

---

## 7. 開発用の仮ログイン

Muse Note は商品化前提のため、正式な LINE Login を入れるまでは **一般公開ユーザーがトップページや単語APIを使えない状態** にしています。  
現在は、開発確認用として `ADMIN_PREVIEW_TOKEN` を知っている人だけが `/login` から仮ログインできます。

### 7-1. 追加で必要な環境変数

`.env.local` と Vercel の Environment Variables に、次を追加してください。

```bash
ADMIN_PREVIEW_TOKEN=長くて推測されにくいランダム文字列
```

例として `muse-note-dev` のような短い文字列は避け、パスワードマネージャー等で生成した長い値を使ってください。

### 7-2. 仮ログインの流れ

1. 未ログインで `/` にアクセスする
2. `middleware.js` が cookie を確認する
3. cookie が無い、または署名が正しくない場合は `/login` へ移動する
4. `/login` で `ADMIN_PREVIEW_TOKEN` を入力する
5. `/api/auth/preview-login` がサーバー側で環境変数と入力値を比較する
6. 一致した場合だけ、httpOnly cookie にログイン状態を保存する
7. ログイン済み cookie がある場合だけ `/api/words` が Supabase から `words` を取得する

### 7-3. セキュリティ上の考え方

- `ADMIN_PREVIEW_TOKEN` は `NEXT_PUBLIC_` を付けません。ブラウザへ公開しないサーバー専用の値です。
- `SUPABASE_SERVICE_ROLE_KEY` は `lib/supabaseAdmin.js` から API Route だけで使います。ブラウザ側では使いません。
- cookie には `ADMIN_PREVIEW_TOKEN` そのものを保存しません。署名済みのログイン情報だけを保存します。
- cookie は `httpOnly` にしているため、ブラウザの JavaScript から読み取れません。
- RLS は OFF にしません。service role key は RLS を迂回できる強いキーなので、必ずサーバー側だけに閉じ込めます。
- anon key 用の公開ポリシーを作らない方針でも、API Route 経由で必要なデータだけ返せます。

### 7-4. 将来 LINE Login に置き換えるとき

今回の仮ログイン処理は `lib/auth/previewSession.js` と `/api/auth/preview-login` に分離しています。  
将来 LINE Login を正式実装するときは、以下のように差し替える想定です。

- `/api/auth/line/login` で LINE の認可画面へ移動
- `/api/auth/line/callback` で LINE のユーザー情報を確認
- サーバー側で安全なセッション cookie を発行
- `middleware.js` と `/api/words` の認証確認を LINE Login 用の関数へ切り替え

管理者画面は作っていません。これはあくまで、開発確認用の一般ユーザー向け仮ログインです。
