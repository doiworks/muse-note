import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../../lib/auth/previewSession';

const CATEGORY_COLUMNS = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3', 'importance'];
const CATEGORY_SELECT = CATEGORY_COLUMNS.join(',');
const PAGE_SIZE = 1000;

function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function createRowKey(row) {
  return CATEGORY_COLUMNS.map((key) => normalizeValue(row[key])).join('\u001f');
}

export async function GET(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  if (!(await verifyPreviewSessionCookieValue(sessionCookie))) return jsonError('仮ログインが必要です。', 401);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const grouped = new Map();
    let total = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('words')
        .select(CATEGORY_SELECT)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('Failed to fetch word picker category index:', error);
        return jsonError('カテゴリ用インデックスの取得に失敗しました。');
      }

      const rows = data ?? [];
      rows.forEach((row) => {
        total += 1;
        const key = createRowKey(row);
        const current = grouped.get(key);
        if (current) {
          current.count += 1;
          return;
        }
        grouped.set(key, {
          school_level: normalizeValue(row.school_level),
          grade: normalizeValue(row.grade),
          term: normalizeValue(row.term),
          exam_type: normalizeValue(row.exam_type),
          category1: normalizeValue(row.category1),
          category2: normalizeValue(row.category2),
          category3: normalizeValue(row.category3),
          importance: Number(row.importance) === 1 ? 1 : 0,
          count: 1
        });
      });
      hasMore = rows.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    return NextResponse.json({
      categoryRows: [...grouped.values()],
      total,
      generatedAt: new Date().toISOString(),
      version: `${total}:${grouped.size}`
    });
  } catch (error) {
    console.error('Failed to initialize word picker category index:', error);
    return jsonError('カテゴリ用インデックスの取得に失敗しました。');
  }
}
