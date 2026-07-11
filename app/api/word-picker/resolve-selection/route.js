import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../../lib/auth/previewSession';
import { applyWordPickerFilters } from '../list/route';

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
const RESOLVE_PAGE_SIZE = 1000;

function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeExcludedIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => Number(id)).filter(Number.isFinite))];
}

export async function POST(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  if (!(await verifyPreviewSessionCookieValue(sessionCookie))) return jsonError('仮ログインが必要です。', 401);

  try {
    const body = await request.json().catch(() => ({}));
    if (body?.mode !== 'allMatching') return jsonError('選択モードが不正です。', 400);

    const query = body.query && typeof body.query === 'object' ? body.query : {};
    const excludedIds = normalizeExcludedIds(body.excludedIds);
    const excludedSet = new Set(excludedIds);
    const params = {
      get(key) {
        if (key === 'search') return query.search || '';
        if (key === 'importantOnly') return query.importantOnly ? 'true' : '';
        return query[key] || '';
      }
    };

    const supabaseAdmin = getSupabaseAdmin();
    const resolvedWords = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await applyWordPickerFilters(
        supabaseAdmin.from('words').select(WORD_COLUMNS),
        params
      )
        .order('id', { ascending: true })
        .range(offset, offset + RESOLVE_PAGE_SIZE - 1);

      if (error) {
        console.error('Failed to resolve word picker selection:', error);
        return jsonError('条件内の単語確定に失敗しました。時間をおいて再度お試しください。');
      }

      const rows = data ?? [];
      rows.forEach((word) => {
        if (!excludedSet.has(Number(word.id))) resolvedWords.push(word);
      });
      hasMore = rows.length === RESOLVE_PAGE_SIZE;
      offset += RESOLVE_PAGE_SIZE;
    }

    const words = resolvedWords;
    return NextResponse.json({ words, word_ids: words.map((word) => word.id), total: words.length });
  } catch (error) {
    console.error('Failed to initialize word picker selection resolver:', error);
    return jsonError('条件内の単語確定に失敗しました。時間をおいて再度お試しください。');
  }
}
