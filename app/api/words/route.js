// このAPI Routeは必ずサーバー側だけで動かします。
// service role key は強い権限を持つため、ブラウザ側のファイルでは絶対に使いません。
// app/api 配下の route.js は Next.js のサーバー機能なので、クライアントへキーは送られません。

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

// Supabaseのservice role keyを使うため、Node.js Runtimeで実行します。
export const runtime = 'nodejs';

// preview_token はアクセスごとに確認したいので、静的キャッシュしないようにします。
export const dynamic = 'force-dynamic';

export async function GET(request) {
  // 商品化前提のため、wordsテーブルは未ログインユーザーへ公開しません。
  // LINE Login実装前の一時対応として、管理者だけが知っている preview_token を確認します。
  const previewToken = request.nextUrl.searchParams.get('preview_token');
  const adminPreviewToken = process.env.ADMIN_PREVIEW_TOKEN;

  // Vercelの環境変数 ADMIN_PREVIEW_TOKEN が未設定だと、管理者確認モードを安全に使えません。
  if (!adminPreviewToken) {
    return NextResponse.json(
      { error: 'ADMIN_PREVIEW_TOKEN が未設定です。Vercel または .env.local に設定してください。' },
      { status: 500 }
    );
  }

  // URLの ?preview_token=xxxx が環境変数と一致したときだけ、単語データを返します。
  if (previewToken !== adminPreviewToken) {
    return NextResponse.json(
      { error: 'preview_token が正しくないため、単語データを表示できません。' },
      { status: 401 }
    );
  }

  // service_roleキーを使う supabaseAdmin はサーバー専用です。
  // ブラウザへ service_roleキーを渡さず、API Routeの中だけで words を読みます。
  const { data, error } = await supabaseAdmin
    .from('words')
    .select('*')
    .order('id', { ascending: true })
    .limit(200);

  if (error) {
    // 「permission denied for table words」が出る場合は、RLSポリシーではなく
    // service_role ロールへのGRANT不足か、環境変数に anon key を入れている可能性があります。
    return NextResponse.json(
      {
        error: '単語データの取得に失敗しました。サーバー側のSupabase権限設定を確認してください。',
        detail: error.message
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ words: data });
}
