import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getAppSessionFromRequest } from '../../../../lib/auth/appSession';
import { applyWordPickerFilters, fetchAllFilteredWords, fetchWrongStatsMap } from '../list/route';

function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function isTrue(value) {
  return value === true || value === 'true';
}

export async function GET(request) {
  const session = await getAppSessionFromRequest(request);
  if (!session) return jsonError('ログインが必要です。', 401);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = new URL(request.url).searchParams;

    if (isTrue(searchParams.get('weakOnly'))) {
      const [wrongStats, filteredWords] = await Promise.all([
        fetchWrongStatsMap(supabaseAdmin, session.appUserId),
        fetchAllFilteredWords(supabaseAdmin, searchParams, 'id')
      ]);
      const total = filteredWords.filter((word) => wrongStats.has(Number(word.id))).length;
      return NextResponse.json({ total });
    }

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
