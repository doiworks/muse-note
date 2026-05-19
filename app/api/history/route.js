import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../lib/auth/previewSession';

const DEV_PREVIEW_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEV_PREVIEW_LINE_USER_ID = 'dev_preview_user';
const HISTORY_SAVE_ERROR_MESSAGE = '回答履歴の保存に失敗しました。時間をおいて再度お試しください。';

function createErrorResponse(message, status) {
  return NextResponse.json({ error: message }, { status });
}

function parseWordId(value) {
  const wordId = Number(value);
  return Number.isInteger(wordId) && wordId > 0 ? wordId : null;
}

async function ensurePreviewUser(supabaseAdmin) {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin.from('app_users').upsert(
    {
      id: DEV_PREVIEW_USER_ID,
      line_user_id: DEV_PREVIEW_LINE_USER_ID,
      display_name: '開発確認ユーザー',
      role: 'user',
      status: 'active',
      last_login_at: now,
      updated_at: now
    },
    { onConflict: 'line_user_id' }
  );

  if (error) {
    throw error;
  }
}

export async function POST(request) {
  // middleware だけに頼らず、履歴保存API側でも仮ログイン cookie を確認します。
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);

  if (!isLoggedIn) {
    return createErrorResponse('仮ログインが必要です。', 401);
  }

  const body = await request.json().catch(() => null);
  const wordId = parseWordId(body?.word_id ?? body?.wordId);
  const answer = typeof body?.answer === 'string' ? body.answer : '';
  const correct = body?.correct;

  if (!wordId || typeof correct !== 'boolean') {
    return createErrorResponse('word_id と correct は必須です。', 400);
  }

  try {
    // service_role key はこのサーバー側 API Route の中だけで使用します。
    const supabaseAdmin = getSupabaseAdmin();
    await ensurePreviewUser(supabaseAdmin);

    const { error } = await supabaseAdmin.from('history').insert({
      app_user_id: DEV_PREVIEW_USER_ID,
      word_id: wordId,
      answer: answer,
      correct: correct,
      answered_at: new Date().toISOString()
    });

    if (error) {
      // 詳細なSupabaseエラーはサーバーログだけに残し、ブラウザには安全な文言だけ返します。
      console.error('Failed to save answer history with service role client:', error);
      return createErrorResponse(HISTORY_SAVE_ERROR_MESSAGE, 500);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // 環境変数不足などの設定エラーも、service role key や内部詳細をブラウザへ漏らしません。
    console.error('Failed to initialize or use Supabase service role client for history:', error);
    return createErrorResponse(HISTORY_SAVE_ERROR_MESSAGE, 500);
  }
}
