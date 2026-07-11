import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../../lib/auth/previewSession';

const WORD_PICKER_COLUMNS = 'id,school_level,grade,term,exam_type,category1,category2,category3,importance,japanese,english,phonetic';
const FILTER_KEYS = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3'];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

async function requirePreviewLogin(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  return verifyPreviewSessionCookieValue(sessionCookie);
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

function applyFilters(query, searchParams) {
  FILTER_KEYS.forEach((key) => {
    const value = searchParams.get(key);
    if (value) query = query.eq(key, value);
  });

  if (searchParams.get('importantOnly') === 'true') {
    query = query.eq('importance', 1);
  }

  return query;
}

function createBaseQuery(supabaseAdmin, searchParams, { count = 'exact' } = {}) {
  return applyFilters(
    supabaseAdmin.from('words').select(WORD_PICKER_COLUMNS, { count }),
    searchParams
  );
}

function applySearchRank(query, column, search, escapedSearch, rank) {
  if (rank === 'exact') return query.eq(column, search);
  if (rank === 'prefix') return query.ilike(column, `${escapedSearch}%`).neq(column, search);
  return query.ilike(column, `%${escapedSearch}%`).not(column, 'ilike', `${escapedSearch}%`);
}

async function fetchNoSearchPage(supabaseAdmin, searchParams, offset, limit) {
  const { data, error, count } = await createBaseQuery(supabaseAdmin, searchParams)
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return { error };
  const total = count ?? 0;
  const words = data ?? [];
  return { words, total, has_more: offset + words.length < total, next_cursor: String(offset + words.length) };
}

async function fetchSearchPage(supabaseAdmin, searchParams, offset, limit, search) {
  const column = isJapaneseSearch(search) ? 'japanese' : 'english';
  const escapedSearch = escapeLike(search);
  const ranks = ['exact', 'prefix', 'contains'];
  const counts = [];

  for (const rank of ranks) {
    const { count, error } = await applySearchRank(createBaseQuery(supabaseAdmin, searchParams), column, search, escapedSearch, rank).limit(0);
    if (error) return { error };
    counts.push(count ?? 0);
  }

  const total = counts.reduce((sum, count) => sum + count, 0);
  const words = [];
  let skipped = 0;

  for (let index = 0; index < ranks.length && words.length < limit; index += 1) {
    const rankCount = counts[index];
    if (offset >= skipped + rankCount) {
      skipped += rankCount;
      continue;
    }

    const rankOffset = Math.max(0, offset - skipped);
    const take = limit - words.length;
    const { data, error } = await applySearchRank(createBaseQuery(supabaseAdmin, searchParams, { count: null }), column, search, escapedSearch, ranks[index])
      .order('id', { ascending: true })
      .range(rankOffset, rankOffset + take - 1);

    if (error) return { error };
    words.push(...(data ?? []));
    skipped += rankCount;
  }

  return { words, total, has_more: offset + words.length < total, next_cursor: String(offset + words.length) };
}

export async function GET(request) {
  if (!(await requirePreviewLogin(request))) return jsonError('仮ログインが必要です。', 401);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = new URL(request.url).searchParams;
    const limit = parseLimit(searchParams.get('limit'));
    const offset = parseOffset(searchParams.get('cursor') ?? searchParams.get('offset'));
    const search = normalizeSearch(searchParams.get('search'));
    const result = search
      ? await fetchSearchPage(supabaseAdmin, searchParams, offset, limit, search)
      : await fetchNoSearchPage(supabaseAdmin, searchParams, offset, limit);

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
