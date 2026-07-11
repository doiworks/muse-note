import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../../lib/auth/previewSession';

const FILTER_KEYS = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3'];
const PAGE_SIZE = 1000;

function isJapaneseSearch(search) {
  return /[^\x00-\x7F]/.test(search);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function applyFilters(query, params = {}) {
  FILTER_KEYS.forEach((key) => {
    if (params[key]) query = query.eq(key, params[key]);
  });
  if (params.importantOnly === true || params.importantOnly === 'true') query = query.eq('importance', 1);

  const search = String(params.search || '').trim();
  if (search) {
    const column = isJapaneseSearch(search) ? 'japanese' : 'english';
    query = query.ilike(column, `%${escapeLike(search)}%`);
  }
  return query;
}

export async function POST(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);
  if (!isLoggedIn) return NextResponse.json({ error: '仮ログインが必要です。' }, { status: 401 });

  try {
    const selection = await request.json();
    if (selection?.mode === 'manual') {
      const ids = [...new Set((selection.selectedIds ?? []).map(Number).filter(Number.isFinite))];
      return NextResponse.json({ ids, count: ids.length });
    }

    if (selection?.mode !== 'allMatching') {
      return NextResponse.json({ error: 'selection.mode は manual または allMatching を指定してください。' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const excludedIds = new Set((selection.excludedIds ?? []).map(Number).filter(Number.isFinite));
    const ids = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await applyFilters(
        supabaseAdmin.from('words').select('id'),
        selection.query ?? {}
      )
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('Failed to resolve word picker selection:', error);
        return NextResponse.json({ error: '単語選択V2の選択確定に失敗しました。' }, { status: 500 });
      }

      const rows = data ?? [];
      rows.forEach((row) => {
        if (!excludedIds.has(row.id)) ids.push(row.id);
      });
      hasMore = rows.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    return NextResponse.json({ ids, count: ids.length });
  } catch (error) {
    console.error('Failed to initialize word picker selection resolver:', error);
    return NextResponse.json({ error: '単語選択V2の選択確定に失敗しました。' }, { status: 500 });
  }
}
