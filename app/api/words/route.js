import { NextResponse } from 'next/server';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../lib/auth/previewSession';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

// cookie とサーバー専用環境変数を毎回確認するため、このAPIは静的キャッシュさせません。
export const dynamic = 'force-dynamic';

// SUPABASE_SERVICE_ROLE_KEY はサーバー側(Node.js)だけで使います。
export const runtime = 'nodejs';

export async function GET(request) {
  // 1. まず仮ログイン cookie を確認します。
  //    未ログインの人には Supabase へ問い合わせる前に 401 を返します。
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);

  if (!isLoggedIn) {
    return NextResponse.json({ error: '仮ログインが必要です。' }, { status: 401 });
  }

  // 2. ログイン済みの場合だけ、サーバー側の service role key で words を読みます。
  //    ブラウザへ service role key は送らず、ブラウザはこのAPIの結果だけを受け取ります。
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('words')
    .select('*')
    .order('id', { ascending: true })
    .limit(200);

  if (error) {
    // "permission denied for table words" が出る場合は、anon key ではなく service_role key を設定し、
    // supabase/schema.sql の service_role 向け GRANT を実行してください。RLSをOFFにする必要はありません。
    console.error('Failed to fetch words with service role client:', error);

    return NextResponse.json(
      { error: '単語データの取得に失敗しました。サーバー側のSupabase権限設定を確認してください。' },
      { status: 500 }
    );
  }

  return NextResponse.json({ words: data });
}
