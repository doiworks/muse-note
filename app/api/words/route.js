// このAPI Routeは必ずサーバー側だけで動かします。
// service role key は強い権限を持つため、ブラウザ側のファイルでは絶対に使いません。
// app/api 配下の route.js は Next.js のサーバー機能なので、クライアントへキーは送られません。

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

// Supabaseのservice role keyを使うため、Node.js Runtimeで実行します。
export const runtime = 'nodejs';

// 仮ログイン状態はリクエストごとに確認したいので、静的キャッシュしないようにします。
export const dynamic = 'force-dynamic';

export async function GET(request) {
  // 商品化前提のため、wordsテーブルはブラウザやanonユーザーへ直接公開しません。
  // LINE Login実装前の一時対応として、ADMIN_PREVIEW_TOKENを「仮ログイン用トークン」として使います。
  const temporaryLoginToken = request.headers.get('x-admin-preview-token');
  const adminPreviewToken = process.env.ADMIN_PREVIEW_TOKEN;

  // Vercelの環境変数 ADMIN_PREVIEW_TOKEN が未設定だと、仮ログイン確認を安全に使えません。
  if (!adminPreviewToken) {
    return NextResponse.json(
      { error: 'ADMIN_PREVIEW_TOKEN が未設定です。Vercel または .env.local に設定してください。' },
      { status: 500 }
    );
  }

  // 仮ログイン済み（= ブラウザから送られたトークンが一致）でなければ words は返しません。
  if (temporaryLoginToken !== adminPreviewToken) {
    return NextResponse.json(
      { error: '仮ログインが確認できないため、単語データを表示できません。' },
      { status: 401 }
    );
  }

  // service_roleキーを使う supabaseAdmin はサーバー専用です。
  // 返す項目は画面表示に必要な id / english / japanese だけに絞ります。
  const { data, error } = await supabaseAdmin
    .from('words')
    .select('id, english, japanese')
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
