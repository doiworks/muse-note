import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { getAppSessionFromRequest } from '../../../lib/auth/appSession';

const SAVE_ERROR = '回答履歴と集計の保存に失敗しました。回答は登録されていないため、再試行してください。';
const errorResponse = (message, status) => NextResponse.json({ error: message }, { status });

export async function POST(request) {
  const session = await getAppSessionFromRequest(request);
  if (!session) return errorResponse('ログインが必要です。', 401);
  const body = await request.json().catch(() => null);
  const wordId = Number(body?.word_id ?? body?.wordId);
  if (!Number.isInteger(wordId) || wordId < 0 || typeof body?.correct !== 'boolean') {
    return errorResponse('word_id と correct は必須です。', 400);
  }
  const studySessionId = typeof body.study_session_id === 'string' ? body.study_session_id : null;
  try {
    const supabase = getSupabaseAdmin();
    if (studySessionId) {
      const { data, error } = await supabase.from('study_sessions').select('id').eq('id', studySessionId)
        .eq('app_user_id', session.appUserId).eq('status', 'in_progress').maybeSingle();
      if (error || !data) return errorResponse('有効な学習セッションが見つかりません。', 400);
    }
    // One database transaction inserts the source-of-truth event and atomically
    // increments its cache. If stats fails PostgreSQL rolls the history insert back,
    // so a client retry can never duplicate an already-committed history row.
    const { data, error } = await supabase.rpc('record_answer_and_update_stats', {
      p_app_user_id: session.appUserId,
      p_word_id: wordId,
      p_answer: typeof body.answer === 'string' ? body.answer : '',
      p_correct: body.correct,
      p_study_session_id: studySessionId,
      p_answered_at: new Date().toISOString()
    });
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result?.history_id || !result?.stats_updated) {
      console.error('Atomic history/stats save failed:', { appUserId: session.appUserId, wordId, error, result });
      return errorResponse(SAVE_ERROR, 500);
    }
    return NextResponse.json({ ok: true, history_saved: true, stats_updated: true, history_id: result.history_id });
  } catch (error) {
    console.error('Failed to use history API:', error);
    return errorResponse(SAVE_ERROR, 500);
  }
}
