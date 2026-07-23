import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getAppSessionFromRequest } from '../../../../lib/auth/appSession';

const WORD_PICKER_COLUMNS = 'id,school_level,grade,term,exam_type,category1,category2,category3,importance,japanese,english,phonetic';
const FILTER_KEYS = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3'];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const PAGE_SIZE = 1000;

function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function parseOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function normalizeSearch(value) {
  return String(value || '').trim();
}

function isJapaneseSearch(search) {
  return /[^\x00-\x7F]/.test(search);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function isTrue(value) {
  return value === true || value === 'true';
}

export function applyWordPickerFilters(query, params) {
  FILTER_KEYS.forEach((key) => {
    const rawValue = typeof params.get === 'function' ? params.get(key) : params[key];
    const values = Array.isArray(rawValue) ? rawValue : String(rawValue || '').split(',');
    const normalizedValues = values.map((value) => String(value).trim()).filter(Boolean);
    if (normalizedValues.length === 1) query = query.eq(key, normalizedValues[0]);
    if (normalizedValues.length > 1) query = query.in(key, normalizedValues);
  });

  const importantOnly = typeof params.get === 'function' ? params.get('importantOnly') : params.importantOnly;
  if (isTrue(importantOnly)) query = query.eq('importance', 1);

  const search = normalizeSearch(typeof params.get === 'function' ? params.get('search') : params.search);
  if (search) {
    const column = isJapaneseSearch(search) ? 'japanese' : 'english';
    query = query.ilike(column, `%${escapeLike(search)}%`);
  }

  return query;
}

async function fetchAllRows(queryFactory) {
  const rows = [];
  for (let from = 0;; from += PAGE_SIZE) {
    const { data, error } = await queryFactory().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function buildWordStats(historyRows) {
  const stats = new Map();
  for (const row of historyRows || []) {
    const wordId = Number(row.word_id);
    if (!Number.isFinite(wordId)) continue;
    const current = stats.get(wordId) || {
      attempt_count: 0,
      mistake_count: 0,
      last_answered_at: null,
      last_wrong_at: null
    };
    current.attempt_count += 1;
    if (!current.last_answered_at || Date.parse(row.answered_at || 0) > Date.parse(current.last_answered_at || 0)) {
      current.last_answered_at = row.answered_at || null;
    }
    if (row.correct === false) {
      current.mistake_count += 1;
      if (!current.last_wrong_at || Date.parse(row.answered_at || 0) > Date.parse(current.last_wrong_at || 0)) {
        current.last_wrong_at = row.answered_at || null;
      }
    }
    stats.set(wordId, current);
  }
  return stats;
}

async function fetchHistoryStatsForWordIds(supabaseAdmin, appUserId, wordIds) {
  const normalizedIds = [...new Set((wordIds || []).map(Number).filter(Number.isFinite))];
  if (!normalizedIds.length) return new Map();
  const rows = await fetchAllRows(() => supabaseAdmin
    .from('history')
    .select('word_id,correct,answered_at')
    .eq('app_user_id', appUserId)
    .in('word_id', normalizedIds)
    .order('answered_at', { ascending: false }));
  return buildWordStats(rows);
}

export async function fetchWrongStatsMap(supabaseAdmin, appUserId) {
  const rows = await fetchAllRows(() => supabaseAdmin
    .from('history')
    .select('word_id,correct,answered_at')
    .eq('app_user_id', appUserId)
    .eq('correct', false)
    .order('answered_at', { ascending: false }));
  return buildWordStats(rows);
}

export async function fetchAllFilteredWords(supabaseAdmin, searchParams, columns = WORD_PICKER_COLUMNS) {
  return fetchAllRows(() => applyWordPickerFilters(
    supabaseAdmin.from('words').select(columns),
    searchParams
  ).order('id', { ascending: true }));
}

function attachStats(words, statsMap) {
  return (words || []).map((word) => {
    const stats = statsMap.get(Number(word.id)) || {
      attempt_count: 0,
      mistake_count: 0,
      last_answered_at: null,
      last_wrong_at: null
    };
    return {
      ...word,
      stats,
      mistake_count: stats.mistake_count,
      last_answered_at: stats.last_answered_at
    };
  });
}

async function fetchFastPage(supabaseAdmin, searchParams, offset, limit, appUserId) {
  const { data, error } = await applyWordPickerFilters(
    supabaseAdmin.from('words').select(WORD_PICKER_COLUMNS),
    searchParams
  )
    .order('id', { ascending: true })
    .range(offset, offset + limit);

  if (error) return { error };
  const rows = data ?? [];
  const words = rows.slice(0, limit);
  const statsMap = await fetchHistoryStatsForWordIds(supabaseAdmin, appUserId, words.map((word) => word.id));
  return {
    words: attachStats(words, statsMap),
    has_more: rows.length > limit,
    next_cursor: String(offset + words.length)
  };
}

async function fetchWeakPage(supabaseAdmin, searchParams, offset, limit, appUserId) {
  const wrongStats = await fetchWrongStatsMap(supabaseAdmin, appUserId);
  if (!wrongStats.size) {
    return { words: [], has_more: false, next_cursor: String(offset), total: 0 };
  }

  const filteredWords = await fetchAllFilteredWords(supabaseAdmin, searchParams);
  const weakWords = attachStats(
    filteredWords.filter((word) => wrongStats.has(Number(word.id))),
    wrongStats
  ).sort((left, right) => {
    const mistakeDifference = Number(right.stats?.mistake_count || 0) - Number(left.stats?.mistake_count || 0);
    if (mistakeDifference) return mistakeDifference;
    const dateDifference = Date.parse(right.stats?.last_wrong_at || 0) - Date.parse(left.stats?.last_wrong_at || 0);
    if (dateDifference) return dateDifference;
    return Number(left.id) - Number(right.id);
  });

  const words = weakWords.slice(offset, offset + limit);
  return {
    words,
    has_more: offset + words.length < weakWords.length,
    next_cursor: String(offset + words.length),
    total: weakWords.length
  };
}

export async function GET(request) {
  const session = await getAppSessionFromRequest(request);
  if (!session) return jsonError('ログインが必要です。', 401);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = new URL(request.url).searchParams;
    const limit = parseLimit(searchParams.get('limit'));
    const offset = parseOffset(searchParams.get('cursor') ?? searchParams.get('offset'));
    const weakOnly = isTrue(searchParams.get('weakOnly'));
    const result = weakOnly
      ? await fetchWeakPage(supabaseAdmin, searchParams, offset, limit, session.appUserId)
      : await fetchFastPage(supabaseAdmin, searchParams, offset, limit, session.appUserId);

    if (result.error) {
      console.error('Failed to fetch word picker list:', result.error);
      return jsonError('単語選択V2の一覧取得に失敗しました。時間をおいて再度お試しください。');
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to initialize word picker list:', error);
    return jsonError('単語選択V2の一覧取得に失敗しました。時間をおいて再度お試しください。');
  }
}
