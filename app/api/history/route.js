import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { getAppSessionFromRequest } from '../../../lib/auth/appSession';

const HISTORY_SAVE_ERROR_MESSAGE = '回答履歴の保存に失敗しました。時間をおいて再度お試しください。';

function createErrorResponse(message, status) {
  return NextResponse.json({ error: message }, { status });
}

function parseWordId(value) {
  const wordId = Number(value);
  return Number.isInteger(wordId) && wordId >= 0 ? wordId : null;
}

async function updateStatsAfterHistorySave({ supabaseAdmin, appUserId, wordId, correct, answeredAt }) {
  const { data: existingStats, error: existingStatsError } = await supabaseAdmin
    .from('stats')
    .select('app_user_id,word_id,last_correct,last_wrong,success_count,mistake_count,accuracy,attempt_count,priority,updated_at')
    .eq('app_user_id', appUserId)
    .eq('word_id', wordId)
    .maybeSingle();

  if (existingStatsError) throw existingStatsError;

  const oldSuccessCount = Number(existingStats?.success_count ?? 0);
  const oldMistakeCount = Number(existingStats?.mistake_count ?? 0);
  const oldAttemptCount = Number(existingStats?.attempt_count ?? oldSuccessCount + oldMistakeCount);
  const newSuccessCount = correct ? oldSuccessCount + 1 : oldSuccessCount;
  const newMistakeCount = correct ? oldMistakeCount : oldMistakeCount + 1;
  const newAttemptCount = oldAttemptCount + 1;
  const newAccuracy = Number(((newSuccessCount / newAttemptCount) * 100).toFixed(2));
  const nextStats = {
    app_user_id: appUserId,
    word_id: wordId,
    success_count: newSuccessCount,
    mistake_count: newMistakeCount,
    attempt_count: newAttemptCount,
    accuracy: newAccuracy,
    priority: Number(existingStats?.priority ?? 0),
    updated_at: answeredAt,
    ...(correct ? { last_correct: answeredAt } : { last_wrong: answeredAt })
  };

  if (existingStats) {
    const { error } = await supabaseAdmin
      .from('stats')
      .update(nextStats)
      .eq('app_user_id', appUserId)
      .eq('word_id', wordId);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from('stats').insert(nextStats);
  if (error) throw error;
}

export async function POST(request) {
  const session = await getAppSessionFromRequest(request);
  if (!session) return createErrorResponse('ログインが必要です。', 401);

  const body = await request.json().catch(() => null);
  const wordId = parseWordId(body?.word_id ?? body?.wordId);
  const answer = typeof body?.answer === 'string' ? body.answer : '';
  const correct = body?.correct;
  const studySessionId = typeof body?.study_session_id === 'string' ? body.study_session_id : null;
  if (wordId === null || typeof correct !== 'boolean') {
    return createErrorResponse('word_id と correct は必須です。', 400);
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const answeredAt = new Date().toISOString();
    if (studySessionId) {
      const { data: studySession, error: studySessionError } = await supabaseAdmin
        .from('study_sessions').select('id,status').eq('id', studySessionId)
        .eq('app_user_id', session.appUserId).eq('status', 'in_progress').maybeSingle();
      if (studySessionError || !studySession) {
        return createErrorResponse('有効な学習セッションが見つかりません。', 400);
      }
    }
    const { error } = await supabaseAdmin.from('history').insert({
      app_user_id: session.appUserId,
      word_id: wordId,
      answer,
      correct,
      study_session_id: studySessionId,
      answered_at: answeredAt
    });

    if (error) {
      console.error('Failed to save answer history:', error);
      return createErrorResponse(HISTORY_SAVE_ERROR_MESSAGE, 500);
    }

    try {
      await updateStatsAfterHistorySave({
        supabaseAdmin,
        appUserId: session.appUserId,
        wordId,
        correct,
        answeredAt
      });
    } catch (statsError) {
      console.error('History save succeeded but stats update failed:', {
        appUserId: session.appUserId,
        wordId,
        statsError
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to use history API:', error);
    return createErrorResponse(HISTORY_SAVE_ERROR_MESSAGE, 500);
  }
}
