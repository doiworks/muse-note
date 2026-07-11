import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../../lib/auth/previewSession';

const OPTION_COLUMNS = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3'];
const PAGE_SIZE = 1000;

function emptyOptions() {
  return Object.fromEntries(OPTION_COLUMNS.map((key) => [key, []]));
}

export async function GET(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);
  if (!isLoggedIn) return NextResponse.json({ error: '仮ログインが必要です。' }, { status: 401 });

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const sets = Object.fromEntries(OPTION_COLUMNS.map((key) => [key, new Set()]));
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('words')
        .select(OPTION_COLUMNS.join(','))
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('Failed to fetch word picker options:', error);
        return NextResponse.json({ error: '単語選択V2の候補取得に失敗しました。' }, { status: 500 });
      }

      const rows = data ?? [];
      rows.forEach((row) => {
        OPTION_COLUMNS.forEach((key) => {
          if (row[key]) sets[key].add(row[key]);
        });
      });
      hasMore = rows.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    const options = emptyOptions();
    OPTION_COLUMNS.forEach((key) => {
      options[key] = [...sets[key]].sort((a, b) => String(a).localeCompare(String(b), 'ja'));
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error('Failed to initialize word picker options:', error);
    return NextResponse.json({ error: '単語選択V2の候補取得に失敗しました。' }, { status: 500 });
  }
}
