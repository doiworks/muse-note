import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../lib/auth/previewSession';

const QUIZ_WORD_COLUMNS = 'id,school_level,grade,term,exam_type,category1,category2,category3,importance,japanese,english,phonetic';
const SELECT_WORD_COLUMNS = 'id,school_level,grade,term,exam_type,category1,category2,category3,importance,japanese,english,phonetic';
const CATEGORY_COLUMNS = 'school_level,grade,term,exam_type,category1,category2,category3';
const WORD_FETCH_ERROR_MESSAGE = '単語データの取得に失敗しました。時間をおいて再度お試しください。';
const PREVIEW_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEFAULT_FETCH_LIMIT = 50;
const MAX_FETCH_LIMIT = 500;
const WORD_PAGE_SIZE = 500;
const STATS_FILTER_CHUNK_SIZE = 500;
const FILTER_KEYS = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3'];
const FULL_TEXT_FIELDS = ['english', 'japanese', 'phonetic', 'example', 'pos_j', 'category1', 'category2', 'category3', 'exam_type'];
const WORD_MODE = { BALANCED: 'balanced', WRONG: 'wrong', SELECT: 'select' };

function createErrorResponse(message, status) { return NextResponse.json({ error: message }, { status }); }
function parseLimit(value) { const parsed = Number(value); return !Number.isFinite(parsed) || parsed <= 0 ? DEFAULT_FETCH_LIMIT : Math.min(Math.floor(parsed), MAX_FETCH_LIMIT); }
function parseOffset(value) { const parsed = Number(value); return !Number.isFinite(parsed) || parsed < 0 ? 0 : Math.floor(parsed); }
function hasIdValue(value) { return value !== null && value !== undefined; }
function escapeLike(value) { return String(value).replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_'); }
function isAlphabetSearch(value) { return /^[\p{Script=Latin}\d\s'’-]+$/u.test(value); }
function normalizeSearch(value) { return String(value || '').normalize('NFKC').trim(); }
function parseIds(value) { return String(value || '').split(',').map((id) => Number(id)).filter((id) => Number.isInteger(id) && id >= 0); }

function rankWordForBalancedOrder(word) {
  const attemptCount = Number(word?.stats?.attempt_count ?? 0);
  const lastAnsweredAt = word?.last_answered_at ? Date.parse(word.last_answered_at) : null;
  return { isUnseen: word.stats == null, attemptCount, recencyScore: Number.isFinite(lastAnsweredAt) ? lastAnsweredAt : Number.NEGATIVE_INFINITY, tieBreaker: Math.random() };
}
function sortWordsForBalancedQuestions(wordsWithStats) {
  return [...wordsWithStats].sort((a, b) => {
    const rankA = rankWordForBalancedOrder(a); const rankB = rankWordForBalancedOrder(b);
    if (rankA.isUnseen !== rankB.isUnseen) return rankA.isUnseen ? -1 : 1;
    if (rankA.attemptCount !== rankB.attemptCount) return rankA.attemptCount - rankB.attemptCount;
    if (rankA.recencyScore !== rankB.recencyScore) return rankA.recencyScore - rankB.recencyScore;
    return rankA.tieBreaker - rankB.tieBreaker;
  });
}
function rankWordForWrongOrder(word) {
  const stats = word?.stats || {}; const lastWrongAt = stats.last_wrong ? Date.parse(stats.last_wrong) : null; const lastAnsweredAt = word?.last_answered_at ? Date.parse(word.last_answered_at) : null;
  return { mistakeCount: Number(stats.mistake_count ?? 0), accuracy: Number(stats.accuracy ?? 100), hasLastWrong: Boolean(stats.last_wrong), lastWrongScore: Number.isFinite(lastWrongAt) ? lastWrongAt : Number.NEGATIVE_INFINITY, isImportant: Number(word?.importance) === 1, attemptCount: Number(stats.attempt_count ?? 0), recencyScore: Number.isFinite(lastAnsweredAt) ? lastAnsweredAt : Number.NEGATIVE_INFINITY, tieBreaker: Math.random() };
}
function sortWordsForWrongQuestions(wordsWithStats) {
  return [...wordsWithStats].sort((a, b) => {
    const rankA = rankWordForWrongOrder(a); const rankB = rankWordForWrongOrder(b);
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

function applyFilters(query, searchParams) {
  FILTER_KEYS.forEach((key) => { const value = searchParams.get(key); if (value) query = query.eq(key, value); });
  if (searchParams.get('importantOnly') === 'true') query = query.eq('importance', 1);
  return query;
}
function applySearch(query, searchParams) {
  const search = normalizeSearch(searchParams.get('search'));
  if (!search) return query;
  const escaped = escapeLike(search);
  if (searchParams.get('searchMode') === 'full') return query.or(FULL_TEXT_FIELDS.map((field) => `${field}.ilike.%${escaped}%`).join(','));
  return isAlphabetSearch(search) ? query.ilike('english', `%${escaped}%`) : query.ilike('japanese', `%${escaped}%`);
}
async function fetchStatsForWordIds(supabaseAdmin, wordIds) {
  const statsRows = [];
  for (let index = 0; index < wordIds.length; index += STATS_FILTER_CHUNK_SIZE) {
    const wordIdChunk = wordIds.slice(index, index + STATS_FILTER_CHUNK_SIZE); if (!wordIdChunk.length) continue;
    const { data, error } = await supabaseAdmin.from('stats').select('word_id,attempt_count,mistake_count,updated_at,last_wrong,accuracy').eq('app_user_id', PREVIEW_USER_ID).in('word_id', wordIdChunk);
    if (error) return { data: null, error }; statsRows.push(...(data ?? []));
  }
  return { data: statsRows, error: null };
}
function attachStatsToWords(wordRows, statsRows) {
  const statsMap = Object.fromEntries((statsRows ?? []).map((row) => [row.word_id, { attempt_count: row.attempt_count, mistake_count: row.mistake_count, updated_at: row.updated_at, last_wrong: row.last_wrong, accuracy: row.accuracy }]));
  return wordRows.map((word) => ({ ...word, stats: statsMap[word.id] ?? null, last_answered_at: statsMap[word.id]?.updated_at ?? null }));
}
async function fetchAllQuizWords(supabaseAdmin) {
  const allWords = []; let offset = 0; let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabaseAdmin.from('words').select(QUIZ_WORD_COLUMNS).order('id', { ascending: true }).range(offset, offset + WORD_PAGE_SIZE - 1);
    if (error) return { data: null, error }; const rows = data ?? []; allWords.push(...rows); hasMore = rows.length === WORD_PAGE_SIZE; offset += WORD_PAGE_SIZE;
  }
  return { data: allWords, error: null };
}
function buildSelectQuery(supabaseAdmin, searchParams, columns = SELECT_WORD_COLUMNS, count = undefined) {
  let query = supabaseAdmin.from('words').select(columns, count ? { count } : undefined);
  query = applyFilters(query, searchParams); query = applySearch(query, searchParams);
  return query;
}

async function fetchAllMatchingSelectIds(supabaseAdmin, searchParams) {
  const ids = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await buildSelectQuery(supabaseAdmin, searchParams, 'id').order('id', { ascending: true }).range(offset, offset + WORD_PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const rows = data ?? [];
    ids.push(...rows.map((row) => row.id).filter(hasIdValue));
    hasMore = rows.length === WORD_PAGE_SIZE;
    offset += WORD_PAGE_SIZE;
  }
  return { data: ids, error: null };
}

async function fetchRankedEnglishSelectPage(supabaseAdmin, searchParams, offset, limit) {
  const search = normalizeSearch(searchParams.get('search'));
  const escaped = escapeLike(search);
  const tiers = [
    (query) => query.ilike('english', escaped),
    (query) => query.ilike('english', `${escaped}%`).not('english', 'ilike', escaped),
    (query) => query.ilike('english', `%${escaped}%`).not('english', 'ilike', `${escaped}%`)
  ];
  let remainingOffset = offset;
  let remainingLimit = limit;
  let total = 0;
  const words = [];

  for (const applyTier of tiers) {
    let countQuery = supabaseAdmin.from('words').select('id', { count: 'exact', head: true });
    countQuery = applyFilters(countQuery, searchParams);
    countQuery = applyTier(countQuery);
    const { count, error: countError } = await countQuery;
    if (countError) return { data: null, count: 0, error: countError };
    const tierCount = count ?? 0;
    total += tierCount;

    if (remainingOffset >= tierCount) {
      remainingOffset -= tierCount;
      continue;
    }
    if (remainingLimit <= 0) continue;

    let pageQuery = supabaseAdmin.from('words').select(SELECT_WORD_COLUMNS);
    pageQuery = applyFilters(pageQuery, searchParams);
    pageQuery = applyTier(pageQuery).order('english', { ascending: true }).order('id', { ascending: true }).range(remainingOffset, remainingOffset + remainingLimit - 1);
    const { data, error } = await pageQuery;
    if (error) return { data: null, count: 0, error };
    const rows = data ?? [];
    words.push(...rows);
    remainingLimit -= rows.length;
    remainingOffset = 0;
  }

  return { data: words, count: total, error: null };
}

export async function GET(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);
  if (!isLoggedIn) return createErrorResponse('仮ログインが必要です。', 401);

  try {
    const supabaseAdmin = getSupabaseAdmin(); const searchParams = new URL(request.url).searchParams;
    const action = String(searchParams.get('action') || ''); const limit = parseLimit(searchParams.get('limit')); const offset = parseOffset(searchParams.get('offset'));
    const modeParam = String(searchParams.get('mode') || WORD_MODE.BALANCED).toLowerCase(); const isWrongMode = modeParam === WORD_MODE.WRONG || modeParam === 'review'; const isSelectMode = modeParam === WORD_MODE.SELECT;

    if (action === 'categories') {
      const { data, error } = await supabaseAdmin.from('words').select(CATEGORY_COLUMNS).order('id', { ascending: true });
      if (error) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
      const categories = Object.fromEntries(FILTER_KEYS.map((key) => [key, [...new Set((data ?? []).map((row) => row[key]).filter(hasIdValue).map(String).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'))]));
      return NextResponse.json({ categories });
    }

    if (isSelectMode) {
      const ids = parseIds(searchParams.get('ids'));
      if (ids.length) {
        const { data, error } = await supabaseAdmin.from('words').select(SELECT_WORD_COLUMNS).in('id', ids);
        if (error) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
        return NextResponse.json({ words: attachStatsToWords(data ?? [], []), total: data?.length ?? 0, has_more: false });
      }
      if (action === 'ids') {
        const { data, error } = await fetchAllMatchingSelectIds(supabaseAdmin, searchParams);
        if (error) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
        return NextResponse.json({ ids: data ?? [], total: data?.length ?? 0 });
      }
      const hasRankedSearch = normalizeSearch(searchParams.get('search')) && searchParams.get('searchMode') !== 'full' && isAlphabetSearch(normalizeSearch(searchParams.get('search')));
      if (hasRankedSearch) {
        const { data, error, count } = await fetchRankedEnglishSelectPage(supabaseAdmin, searchParams, offset, limit);
        if (error) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
        return NextResponse.json({ words: attachStatsToWords(data ?? [], []), total: count ?? 0, has_more: offset + limit < (count ?? 0) });
      }
      const { data, error, count } = await buildSelectQuery(supabaseAdmin, searchParams, SELECT_WORD_COLUMNS, 'exact').order('id', { ascending: true }).range(offset, offset + limit - 1);
      if (error) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
      return NextResponse.json({ words: attachStatsToWords(data ?? [], []), total: count ?? data?.length ?? 0, has_more: offset + limit < (count ?? 0) });
    }

    const { data: wordRows, error } = await fetchAllQuizWords(supabaseAdmin);
    if (error) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
    const wordIds = (wordRows ?? []).map((word) => word.id).filter(hasIdValue);
    const { data: statsRows, error: statsError } = await fetchStatsForWordIds(supabaseAdmin, wordIds);
    if (statsError) return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
    const wordsWithStats = attachStatsToWords(wordRows ?? [], statsRows ?? []);
    const candidateWords = isWrongMode ? wordsWithStats.filter((word) => Number(word?.stats?.mistake_count ?? 0) > 0) : wordsWithStats;
    const responseWords = isWrongMode ? sortWordsForWrongQuestions(candidateWords) : sortWordsForBalancedQuestions(candidateWords);
    return NextResponse.json({ words: responseWords.slice(0, limit), has_more: false });
  } catch (error) {
    console.error('Failed to initialize or use Supabase service role client:', error);
    return createErrorResponse(WORD_FETCH_ERROR_MESSAGE, 500);
  }
}
