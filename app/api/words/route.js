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
const PREVIEW_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEFAULT_FETCH_LIMIT = 200;
const MAX_FETCH_LIMIT = 500;
const WORD_MODE = {
  BALANCED: 'balanced',
  WRONG: 'wrong'
};

function createErrorResponse(message, status) {
  return NextResponse.json({ error: message }, { status });
}

function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_FETCH_LIMIT;
  }
  return Math.min(Math.floor(parsed), MAX_FETCH_LIMIT);
}

function rankWordForBalancedOrder(word) {
  const attemptCount = Number(word?.stats?.attempt_count ?? 0);
  const lastAnsweredAtText = word?.last_answered_at;
  const lastAnsweredAt = lastAnsweredAtText ? Date.parse(lastAnsweredAtText) : null;
  const recencyScore = Number.isFinite(lastAnsweredAt) ? lastAnsweredAt : Number.NEGATIVE_INFINITY;

  return {
    isUnseen: word.stats == null,
    attemptCount,
    recencyScore,
    tieBreaker: Math.random()
  };
}

function sortWordsForBalancedQuestions(wordsWithStats) {
  return [...wordsWithStats].sort((a, b) => {
    const rankA = rankWordForBalancedOrder(a);
    const rankB = rankWordForBalancedOrder(b);

    if (rankA.isUnseen !== rankB.isUnseen) {
      return rankA.isUnseen ? -1 : 1;
    }

    if (rankA.attemptCount !== rankB.attemptCount) {
      return rankA.attemptCount - rankB.attemptCount;
    }

    if (rankA.recencyScore !== rankB.recencyScore) {
      return rankA.recencyScore - rankB.recencyScore;
    }

    return rankA.tieBreaker - rankB.tieBreaker;
  });
}

export async function GET(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);

  if (!isLoggedIn) {
    return createErrorResponse('仮ログインが必要です。', 401);
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = new URL(request.url).searchParams;
    const limit = parseLimit(searchParams.get('limit'));
    const modeParam = String(searchParams.get('mode') || WORD_MODE.BALANCED).toLowerCase();
    const isWrongMode = modeParam === WORD_MODE.WRONG || modeParam === 'review';

    const { data, error } = await supabaseAdmin
      .from('words')
      .select(WORD_COLUMNS)
      .order('id', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch words with service role client:', error);
      return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
    }

    const wordRows = data ?? [];
    const wordIds = wordRows.map((word) => word.id).filter(Boolean);

    let statsMap = {};

    if (wordIds.length) {
      const { data: statsRows, error: statsError } = await supabaseAdmin
        .from('stats')
        .select('word_id,accuracy,attempt_count,success_count,mistake_count,last_correct,last_wrong,updated_at')
        .eq('app_user_id', PREVIEW_USER_ID)
        .in('word_id', wordIds);

      if (statsError) {
        console.error('Failed to fetch stats with service role client:', statsError);
        return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
      }

      statsMap = Object.fromEntries(
        (statsRows ?? []).map((row) => [
          row.word_id,
          {
            accuracy: row.accuracy,
            attempt_count: row.attempt_count,
            success_count: row.success_count,
            mistake_count: row.mistake_count,
            last_correct: row.last_correct,
            last_wrong: row.last_wrong,
            updated_at: row.updated_at
          }
        ])
      );

    }

    const wordsWithStats = wordRows.map((word) => ({
      ...word,
      stats: statsMap[word.id] ?? null,
      last_answered_at: statsMap[word.id]?.updated_at ?? null
    }));

    const candidateWords = isWrongMode
      ? wordsWithStats.filter((word) => Number(word?.stats?.mistake_count ?? 0) > 0)
      : wordsWithStats;
    const balancedWords = sortWordsForBalancedQuestions(candidateWords);

    return NextResponse.json({ words: balancedWords });
  } catch (error) {
    console.error('Failed to initialize or use Supabase service role client:', error);
    return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
  }
}
