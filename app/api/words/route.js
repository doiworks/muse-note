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
  'phonetic'
].join(',');
const WORD_ID_COLUMNS = 'id';

const WORD_FETCH_ERROR_MESSAGE = '単語データの取得に失敗しました。時間をおいて再度お試しください。';
const PREVIEW_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEFAULT_FETCH_LIMIT = 50;
const MAX_FETCH_LIMIT = 500;
const WORD_PAGE_SIZE = 500;
const STATS_FILTER_CHUNK_SIZE = 500;
const WORD_MODE = {
  BALANCED: 'balanced',
  WRONG: 'wrong',
  SELECT: 'select'
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

function parseOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function hasIdValue(value) {
  return value !== null && value !== undefined;
}

const FILTER_COLUMNS = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3'];

function normalizeSearchValue(value) {
  return value ? value.normalize('NFKC').trim() : '';
}

function detectSearchColumn(searchText) {
  if (!searchText) return null;
  return /^[\x00-\x7F]+$/.test(searchText) ? 'english' : 'japanese';
}

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function applySelectFilters(query, searchParams) {
  FILTER_COLUMNS.forEach((column) => {
    const value = searchParams.get(column);
    if (hasValue(value)) query = query.eq(column, value);
  });

  if (searchParams.get('importantOnly') === '1') {
    query = query.eq('importance', 1);
  }

  const searchText = normalizeSearchValue(searchParams.get('search'));
  const searchColumn = detectSearchColumn(searchText);
  if (searchColumn) {
    query = query.ilike(searchColumn, `%${escapeLikePattern(searchText)}%`);
  }

  return query;
}

function sortSelectWords(words, searchText) {
  const normalizedSearch = normalizeSearchValue(searchText).toLowerCase();
  const searchColumn = detectSearchColumn(normalizedSearch);
  if (!normalizedSearch || !searchColumn) return words;

  return [...words].sort((a, b) => {
    const valueA = normalizeSearchValue(a?.[searchColumn]).toLowerCase();
    const valueB = normalizeSearchValue(b?.[searchColumn]).toLowerCase();
    const rank = (value) => {
      if (value === normalizedSearch) return 0;
      if (value.startsWith(normalizedSearch)) return 1;
      return 2;
    };
    const rankDiff = rank(valueA) - rank(valueB);
    if (rankDiff !== 0) return rankDiff;
    return Number(a.id) - Number(b.id);
  });
}


function parseIds(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
}

async function fetchSelectWordsByIds(supabaseAdmin, ids) {
  if (!ids.length) return { data: [], error: null };
  const { data, error } = await supabaseAdmin
    .from('words')
    .select(WORD_COLUMNS)
    .in('id', ids);
  if (error) return { data: null, error };
  const order = new Map(ids.map((id, index) => [id, index]));
  return { data: [...(data ?? [])].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)), error: null };
}

async function fetchSelectWords(supabaseAdmin, searchParams, { columns = WORD_COLUMNS, fetchAllIds = false } = {}) {
  const offset = parseOffset(searchParams.get('offset'));
  const limit = parseLimit(searchParams.get('limit'));
  const searchText = normalizeSearchValue(searchParams.get('search'));
  let query = supabaseAdmin
    .from('words')
    .select(columns, { count: 'exact' });

  query = applySelectFilters(query, searchParams);
  query = query.order('id', { ascending: true });
  if (!fetchAllIds) query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return { data: null, error };

  const sorted = sortSelectWords(data ?? [], searchText);
  return {
    data: sorted,
    error: null,
    total: count ?? sorted.length,
    hasMore: !fetchAllIds && offset + sorted.length < (count ?? 0),
    nextCursor: !fetchAllIds && offset + sorted.length < (count ?? 0) ? offset + sorted.length : null
  };
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


function rankWordForWrongOrder(word) {
  const stats = word?.stats || {};
  const lastWrongAt = stats.last_wrong ? Date.parse(stats.last_wrong) : null;
  const lastAnsweredAt = word?.last_answered_at ? Date.parse(word.last_answered_at) : null;

  return {
    mistakeCount: Number(stats.mistake_count ?? 0),
    accuracy: Number(stats.accuracy ?? 100),
    hasLastWrong: Boolean(stats.last_wrong),
    lastWrongScore: Number.isFinite(lastWrongAt) ? lastWrongAt : Number.NEGATIVE_INFINITY,
    isImportant: Number(word?.importance) === 1,
    attemptCount: Number(stats.attempt_count ?? 0),
    recencyScore: Number.isFinite(lastAnsweredAt) ? lastAnsweredAt : Number.NEGATIVE_INFINITY,
    tieBreaker: Math.random()
  };
}

function sortWordsForWrongQuestions(wordsWithStats) {
  return [...wordsWithStats].sort((a, b) => {
    const rankA = rankWordForWrongOrder(a);
    const rankB = rankWordForWrongOrder(b);

    if (rankA.mistakeCount !== rankB.mistakeCount) return rankB.mistakeCount - rankA.mistakeCount;
    if (rankA.accuracy !== rankB.accuracy) return rankA.accuracy - rankB.accuracy;
    if (rankA.hasLastWrong !== rankB.hasLastWrong) return rankA.hasLastWrong ? -1 : 1;
    if (rankA.lastWrongScore !== rankB.lastWrongScore) return rankB.lastWrongScore - rankA.lastWrongScore;
    if (rankA.isImportant !== rankB.isImportant) return rankA.isImportant ? -1 : 1;
    if (rankA.attemptCount !== rankB.attemptCount) return rankA.attemptCount - rankB.attemptCount;
    if (rankA.recencyScore !== rankB.recencyScore) return rankA.recencyScore - rankB.recencyScore;
    return rankA.tieBreaker - rankB.tieBreaker;
  });
}

async function fetchWordPage(supabaseAdmin, offset, limit) {
  return supabaseAdmin
    .from('words')
    .select(WORD_COLUMNS)
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);
}

async function fetchAllWords(supabaseAdmin) {
  const allWords = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await fetchWordPage(supabaseAdmin, offset, WORD_PAGE_SIZE);
    if (error) return { data: null, error };

    const wordRows = data ?? [];
    allWords.push(...wordRows);
    hasMore = wordRows.length === WORD_PAGE_SIZE;
    offset += WORD_PAGE_SIZE;
  }

  return { data: allWords, error: null };
}

async function fetchStatsForWordIds(supabaseAdmin, wordIds) {
  const statsRows = [];

  for (let index = 0; index < wordIds.length; index += STATS_FILTER_CHUNK_SIZE) {
    const wordIdChunk = wordIds.slice(index, index + STATS_FILTER_CHUNK_SIZE);
    if (!wordIdChunk.length) continue;

    const { data, error } = await supabaseAdmin
      .from('stats')
      .select('word_id,accuracy,attempt_count,success_count,mistake_count,last_correct,last_wrong,updated_at')
      .eq('app_user_id', PREVIEW_USER_ID)
      .in('word_id', wordIdChunk);

    if (error) return { data: null, error };
    statsRows.push(...(data ?? []));
  }

  return { data: statsRows, error: null };
}

function attachStatsToWords(wordRows, statsRows) {
  const statsMap = Object.fromEntries(
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

  return wordRows.map((word) => ({
    ...word,
    stats: statsMap[word.id] ?? null,
    last_answered_at: statsMap[word.id]?.updated_at ?? null
  }));
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
    const offset = parseOffset(searchParams.get('offset'));
    const modeParam = String(searchParams.get('mode') || WORD_MODE.BALANCED).toLowerCase();
    const isWrongMode = modeParam === WORD_MODE.WRONG || modeParam === 'review';
    const isSelectMode = modeParam === WORD_MODE.SELECT;

    if (isSelectMode) {
      const requestedIds = parseIds(searchParams.get('ids'));
      if (requestedIds.length) {
        const { data, error } = await fetchSelectWordsByIds(supabaseAdmin, requestedIds);
        if (error) {
          console.error('Failed to fetch selected words with service role client:', error);
          return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
        }
        return NextResponse.json({ words: attachStatsToWords(data ?? [], []), total: data?.length ?? 0, has_more: false, next_cursor: null });
      }

      const idsOnly = searchParams.get('ids_only') === '1';
      const result = await fetchSelectWords(supabaseAdmin, searchParams, {
        columns: idsOnly ? WORD_ID_COLUMNS : WORD_COLUMNS,
        fetchAllIds: idsOnly
      });
      if (result.error) {
        console.error('Failed to fetch words with service role client:', result.error);
        return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
      }

      return NextResponse.json({
        words: idsOnly ? [] : attachStatsToWords(result.data ?? [], []),
        ids: idsOnly ? (result.data ?? []).map((word) => word.id).filter(hasIdValue) : undefined,
        total: result.total,
        has_more: result.hasMore,
        next_cursor: result.nextCursor
      });
    }

    const { data: wordRows, error } = await fetchAllWords(supabaseAdmin);
    if (error) {
      console.error('Failed to fetch all words with service role client:', error);
      return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
    }

    const wordIds = (wordRows ?? []).map((word) => word.id).filter(hasIdValue);
    const { data: statsRows, error: statsError } = await fetchStatsForWordIds(supabaseAdmin, wordIds);
    if (statsError) {
      console.error('Failed to fetch stats with service role client:', statsError);
      return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
    }

    const wordsWithStats = attachStatsToWords(wordRows ?? [], statsRows ?? []);
    const candidateWords = isWrongMode
      ? wordsWithStats.filter((word) => Number(word?.stats?.mistake_count ?? 0) > 0)
      : wordsWithStats;
    const responseWords = isWrongMode
      ? sortWordsForWrongQuestions(candidateWords)
      : sortWordsForBalancedQuestions(candidateWords);

    return NextResponse.json({ words: responseWords.slice(0, limit), has_more: false });
  } catch (error) {
    console.error('Failed to initialize or use Supabase service role client:', error);
    return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
  }
}
