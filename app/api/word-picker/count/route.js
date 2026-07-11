import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../../lib/auth/previewSession';
import { applyWordPickerFilters } from '../list/route';

function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);
  if (!isLoggedIn) return jsonError('仮ログインが必要です。', 401);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = new URL(request.url).searchParams;
    const { count, error } = await applyWordPickerFilters(
      supabaseAdmin.from('words').select('id', { count: 'exact', head: true }),
      searchParams
    );

    if (error) {
      console.error('Failed to fetch word picker count:', error);
      return jsonError('単語選択V2の総件数取得に失敗しました。');
    }

    return NextResponse.json({ total: count ?? 0 });
  } catch (error) {
    console.error('Failed to initialize word picker count:', error);
    return jsonError('単語選択V2の総件数取得に失敗しました。');
  }
}
