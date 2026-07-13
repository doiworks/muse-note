import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../../lib/auth/previewSession';

const OPTION_COLUMNS = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3'];
const OPTION_PAGE_SIZE = 1000;

function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function emptyOptions() {
  return Object.fromEntries(OPTION_COLUMNS.map((key) => [key, []]));
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFKC').trim();
}

function isJapaneseSearch(search) {
  return /[^\x00-\x7F]/.test(search);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function applyOptionFilters(query, params) {
  OPTION_COLUMNS.forEach((key) => {
    const value = typeof params.get === 'function' ? params.get(key) : params[key];
    if (hasValue(value)) query = query.eq(key, value);
  });

  const importantOnly = typeof params.get === 'function' ? params.get('importantOnly') : params.importantOnly;
  if (importantOnly === true || importantOnly === 'true' || importantOnly === '1') {
    query = query.eq('importance', 1);
  }

  const search = normalizeSearch(typeof params.get === 'function' ? params.get('search') : params.search);
  if (search) {
    const column = isJapaneseSearch(search) ? 'japanese' : 'english';
    query = query.ilike(column, `%${escapeLike(search)}%`);
  }

  return query;
}

function createScopedParams(searchParams, targetColumn) {
  const params = new URLSearchParams();
  const targetIndex = OPTION_COLUMNS.indexOf(targetColumn);

  OPTION_COLUMNS.slice(0, targetIndex).forEach((key) => {
    const value = searchParams.get(key);
    if (hasValue(value)) params.set(key, value);
  });

  ['importantOnly', 'search'].forEach((key) => {
    const value = searchParams.get(key);
    if (hasValue(value)) params.set(key, value);
  });

  return params;
}

async function fetchOptionsForColumn(supabaseAdmin, searchParams, column) {
  const scopedParams = createScopedParams(searchParams, column);
  const values = new Set();
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await applyOptionFilters(
      supabaseAdmin.from('words').select(column),
      scopedParams
    )
      .not(column, 'is', null)
      .order(column, { ascending: true })
      .range(offset, offset + OPTION_PAGE_SIZE - 1);

    if (error) return { error };

    const rows = data ?? [];
    rows.forEach((row) => {
      const value = row[column];
      if (hasValue(value)) values.add(String(value));
    });
    hasMore = rows.length === OPTION_PAGE_SIZE;
    offset += OPTION_PAGE_SIZE;
  }

  return {
    options: [...values].sort((a, b) => String(a).localeCompare(String(b), 'ja'))
  };
}

async function fetchTotal(supabaseAdmin, searchParams) {
  const { count, error } = await applyOptionFilters(
    supabaseAdmin.from('words').select('id', { count: 'exact', head: true }),
    searchParams
  );

  if (error) return { error };
  return { total: count ?? 0 };
}

export async function GET(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);
  if (!isLoggedIn) return jsonError('仮ログインが必要です。', 401);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = new URL(request.url).searchParams;
    const options = emptyOptions();

    const optionResults = await Promise.all(
      OPTION_COLUMNS.map((column) => fetchOptionsForColumn(supabaseAdmin, searchParams, column))
    );
    const totalResult = await fetchTotal(supabaseAdmin, searchParams);

    const failedResult = [...optionResults, totalResult].find((result) => result.error);
    if (failedResult) {
      console.error('Failed to fetch word picker options:', failedResult.error);
      return jsonError('単語選択V2の候補取得に失敗しました。');
    }

    OPTION_COLUMNS.forEach((column, index) => {
      options[column] = optionResults[index].options ?? [];
    });

    return NextResponse.json({ ...options, total: totalResult.total ?? 0 });
  } catch (error) {
    console.error('Failed to initialize word picker options:', error);
    return jsonError('単語選択V2の候補取得に失敗しました。');
  }
}
