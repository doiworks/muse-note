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

async function getStatsColumns(supabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'stats');

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.column_name));
}

function firstExistingColumn(columns, candidates) {
  return candidates.find((name) => columns.has(name)) ?? null;
}

async function updateStatsAfterHistorySave({ supabaseAdmin, appUserId, wordId, correct, answeredAt }) {
  const columns = await getStatsColumns(supabaseAdmin);

  const appUserIdColumn = firstExistingColumn(columns, ['app_user_id', 'user_id']);
  const correctCountColumn = firstExistingColumn(columns, ['correct_count']);
  const wrongCountColumn = firstExistingColumn(columns, ['wrong_count']);
  const attemptCountColumn = firstExistingColumn(columns, ['attempt_count']);
  const accuracyColumn = firstExistingColumn(columns, ['accuracy', 'accuracy_rate']);
  const lastAnsweredAtColumn = firstExistingColumn(columns, ['last_answered_at', 'updated_at']);

  if (!appUserIdColumn || !correctCountColumn || !wrongCountColumn || !attemptCountColumn || !accuracyColumn || !lastAnsweredAtColumn) {
    throw new Error(
      `stats table columns are missing required fields: ${JSON.stringify({
        appUserIdColumn,
        correctCountColumn,
        wrongCountColumn,
        attemptCountColumn,
        accuracyColumn,
        lastAnsweredAtColumn
      })}`
    );
  }

  const { data: existingStats, error: existingStatsError } = await supabaseAdmin
    .from('stats')
    .select(`id, ${correctCountColumn}, ${wrongCountColumn}, ${attemptCountColumn}`)
    .eq(appUserIdColumn, appUserId)
    .eq('word_id', wordId)
    .maybeSingle();

  if (existingStatsError) {
    throw existingStatsError;
  }

  const oldCorrectCount = Number(existingStats?.[correctCountColumn] ?? 0);
  const oldWrongCount = Number(existingStats?.[wrongCountColumn] ?? 0);
  const oldAttemptCount = Number(existingStats?.[attemptCountColumn] ?? oldCorrectCount + oldWrongCount);

  const newCorrectCount = correct ? oldCorrectCount + 1 : oldCorrectCount;
  const newWrongCount = correct ? oldWrongCount : oldWrongCount + 1;
  const newAttemptCount = oldAttemptCount + 1;
  const newAccuracy = newAttemptCount > 0 ? Number((newCorrectCount / newAttemptCount).toFixed(4)) : 0;

  const nextStats = {
    [appUserIdColumn]: appUserId,
    word_id: wordId,
    [correctCountColumn]: newCorrectCount,
    [wrongCountColumn]: newWrongCount,
    [attemptCountColumn]: newAttemptCount,
    [accuracyColumn]: newAccuracy,
    [lastAnsweredAtColumn]: answeredAt
  };

  const onConflictColumns = `${appUserIdColumn},word_id`;
  const { error: upsertError } = await supabaseAdmin.from('stats').upsert(nextStats, { onConflict: onConflictColumns });

  if (upsertError) {
    throw upsertError;
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

    const answeredAt = new Date().toISOString();
    const { error } = await supabaseAdmin.from('history').insert({
      app_user_id: DEV_PREVIEW_USER_ID,
      word_id: wordId,
      answer: answer,
      correct: correct,
      answered_at: answeredAt
    });

    if (error) {
      // 詳細なSupabaseエラーはサーバーログだけに残し、ブラウザには安全な文言だけ返します。
      console.error('Failed to save answer history with service role client:', error);
      return createErrorResponse(HISTORY_SAVE_ERROR_MESSAGE, 500);
    }

    try {
      await updateStatsAfterHistorySave({
        supabaseAdmin,
        appUserId: DEV_PREVIEW_USER_ID,
        wordId,
        correct,
        answeredAt
      });
    } catch (statsError) {
      console.error('History save succeeded but stats update failed:', {
        appUserId: DEV_PREVIEW_USER_ID,
        wordId,
        correct,
        answeredAt,
        statsError
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // 環境変数不足などの設定エラーも、service role key や内部詳細をブラウザへ漏らしません。
    console.error('Failed to initialize or use Supabase service role client for history:', error);
    return createErrorResponse(HISTORY_SAVE_ERROR_MESSAGE, 500);
  }
}
