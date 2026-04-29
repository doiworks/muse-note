# Muse Note（Next.js + Supabase + Vercel）

初心者でも保守しやすいように、**最小構成**で作った英単語学習アプリです。

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

### 1-4. Supabase テーブル作成
Supabase の SQL Editor を開いて、次を実行してください。
- `supabase/schema.sql`

### 1-5. 単語データ取り込み
Supabase ダッシュボードの Table Editor で `words` テーブルを開き、CSVを import します。
- `supabase/words_seed.csv`

### 1-6. 開発サーバー起動
```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開くと、単語一覧が表示されます。

---

## 2. ファイル構成（重要なもの）

- `app/layout.jsx`
  - App Router必須のルートレイアウト。
- `app/page.jsx`
  - 画面本体。まずは単語一覧表示のみ。
- `app/api/words/route.js`
  - 単語一覧を返すAPI。
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

## 5. 注意点

- `SUPABASE_SERVICE_ROLE_KEY` は絶対に公開しない
- 今回は「最初に動かすこと」を優先しているため、認証やRLSは最小です
- 本番公開前に、SupabaseのRLSポリシーは必ず設定してください
