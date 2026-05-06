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

ブラウザで `http://localhost:3000?preview_token=your-secret-preview-token` を開くと、単語一覧が表示されます。

`your-secret-preview-token` は `.env.local` の `ADMIN_PREVIEW_TOKEN` と同じ値にしてください。


---

## 2. words テーブルの公開方針

商品化前提のため、`words` テーブルは未ログインユーザーへ直接公開しません。

- Supabase の anon key だけでは `words` を読ませない
- `supabase/schema.sql` では `words` の RLS を有効化する
- anon 向けの SELECT ポリシーは作らない
- 現時点では、Next.js API Route が `SUPABASE_SERVICE_ROLE_KEY` を使ってサーバー側で読み込む
- ただし、LINE Login 未実装の間だけ、`ADMIN_PREVIEW_TOKEN` が一致した場合に `/api/words` を確認できる

### 開発確認用URL

```text
http://localhost:3000?preview_token=your-secret-preview-token
```

Vercel でも Environment Variables に `ADMIN_PREVIEW_TOKEN` を設定し、次のように確認します。

```text
https://your-vercel-domain.vercel.app?preview_token=your-secret-preview-token
```

このトークンは管理者確認用なので、公開ページやSNSには載せないでください。
LINE Login 実装後は、`authenticated` ユーザーだけが読める RLS ポリシーへ切り替える想定です。

---

## 3. ファイル構成（重要なもの）

- `app/layout.jsx`
  - App Router 必須のルートレイアウト（これがないと Vercel build で失敗します）。
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

## 4. LINE Login を後から追加しやすくするポイント

この構成では、`users` テーブルに `line_user_id` を持たせています。  
将来は以下を追加すれば連携できます。

1. `/api/auth/line/login` を作る（LINE認可画面へリダイレクト）
2. `/api/auth/line/callback` を作る（アクセストークン交換）
3. LINE Profile API で `userId` を取得
4. `POST /api/users` で `lineUserId` を保存
5. `users.id` をキーに `history` / `stats` を更新

---

## 5. Vercel デプロイ手順

1. GitHubにこのリポジトリを push
2. Vercel で Import Project
3. Environment Variables に `.env.local` と同じ値を設定
4. Deploy

デプロイ後、`/?preview_token=your-secret-preview-token` で単語一覧が表示されることを確認してください。
`/api/words` をトークンなしで直接開いた場合は、商品化前提のため 401 になります。

---

## 6. main へ安全にマージするためのメモ

今回衝突しやすいファイルは次の2つです。
- `README.md`
- `package.json`

このブランチでは、**Next.js + Supabase 構成を優先**した内容に統一しています。  
`app/layout.jsx` を含む App Router 構成が前提です。

---

## 7. 注意点

- `SUPABASE_SERVICE_ROLE_KEY` は絶対に公開しない
- `words` は RLS を有効にし、anon 向け SELECT ポリシーは作りません
- LINE Login 実装後に、`authenticated` ユーザー向けのRLSポリシーを追加してください
