import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ words: data });
}
