import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../../lib/auth/previewSession';

const WORD_PICKER_COLUMNS = 'id,school_level,grade,term,exam_type,category1,category2,category3,importance,japanese,english,phonetic';
const FILTER_KEYS = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3'];
const DEFAULT_LIMIT = 20;
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

export function applyWordPickerFilters(query, params) {
  FILTER_KEYS.forEach((key) => {
    const value = typeof params.get === 'function' ? params.get(key) : params[key];
    if (value) query = query.eq(key, value);
  });

  const importantOnly = typeof params.get === 'function' ? params.get('importantOnly') : params.importantOnly;
  if (importantOnly === true || importantOnly === 'true') query = query.eq('importance', 1);

  const search = normalizeSearch(typeof params.get === 'function' ? params.get('search') : params.search);
  if (search) {
    const column = isJapaneseSearch(search) ? 'japanese' : 'english';
    query = query.ilike(column, `%${escapeLike(search)}%`);
  }

  return query;
}

async function fetchFastPage(supabaseAdmin, searchParams, offset, limit) {
  const { data, error } = await applyWordPickerFilters(
    supabaseAdmin.from('words').select(WORD_PICKER_COLUMNS),
    searchParams
  )
    .order('id', { ascending: true })
    .range(offset, offset + limit);

  if (error) return { error };
  const rows = data ?? [];
  const words = rows.slice(0, limit);
  return {
    words,
    has_more: rows.length > limit,
    next_cursor: String(offset + words.length)
  };
}

export async function GET(request) {
  if (!(await requirePreviewLogin(request))) return jsonError('仮ログインが必要です。', 401);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = new URL(request.url).searchParams;
    const limit = parseLimit(searchParams.get('limit'));
    const offset = parseOffset(searchParams.get('cursor') ?? searchParams.get('offset'));
    const result = await fetchFastPage(supabaseAdmin, searchParams, offset, limit);

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
