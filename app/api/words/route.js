import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../lib/auth/previewSession';

const WORD_COLUMNS = [
  'id',
  'school_level',
  'grade',
  'term',
  'exam_type',
  'category1',
  'category2',
  'category3',
  'importance',
  'japanese',
  'english',
  'phonetic',
  'example',
  'pos_code',
  'pos_full',
  'pos_j',
  'antonym',
  'antonym_jp',
  'text'
].join(',');

const WORD_FETCH_ERROR_MESSAGE = '単語データの取得に失敗しました。時間をおいて再度お試しください。';

function createErrorResponse(message, status) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  // middleware だけに頼らず、API側でも cookie を確認します。
  // これにより、ログイン済みの開発確認ユーザーだけが words を取得できます。
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);

  if (!isLoggedIn) {
    return createErrorResponse('仮ログインが必要です。', 401);
  }

  try {
    // service_role key はこのサーバー側 API Route の中だけで使用します。
    // ブラウザは Supabase に直接接続せず、/api/words だけを呼び出します。
    const supabaseAdmin = getSupabaseAdmin();

    // wordsテーブルから、画面・学習機能で利用する列だけをAPIレスポンスとして取得します。
    const { data, error } = await supabaseAdmin
      .from('words')
      .select(WORD_COLUMNS)
      .order('id', { ascending: true })
      .limit(200);

    if (error) {
      // 詳細なSupabaseエラーはサーバーログだけに残し、ブラウザには安全な文言だけ返します。
      console.error('Failed to fetch words with service role client:', error);
      return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
    }

    return NextResponse.json({ words: data ?? [] });
  } catch (error) {
    // 環境変数不足などの設定エラーも、service role key や内部詳細をブラウザへ漏らしません。
    console.error('Failed to initialize or use Supabase service role client:', error);
    return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
  }
}
