import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../lib/auth/previewSession';

export async function GET(request) {
  // middleware だけに頼らず、API側でも cookie を確認します。
  // これにより、ログイン済みの開発確認ユーザーだけが words を取得できます。
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);

  if (!isLoggedIn) {
    return NextResponse.json({ error: '仮ログインが必要です。' }, { status: 401 });
  }

  // wordsテーブルから単語を取得します。
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
