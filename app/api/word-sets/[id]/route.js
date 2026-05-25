import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../../lib/auth/previewSession';

const APP_USER_ID = '00000000-0000-4000-8000-000000000001';
const WORD_COLUMNS = 'id,school_level,grade,term,exam_type,category1,category2,category3,importance,japanese,english,phonetic,example,pos_code,pos_full,pos_j,antonym,antonym_jp,text';

function errorResponse(message, status) {
  return NextResponse.json({ error: message }, { status });
}

async function verifySession(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  return verifyPreviewSessionCookieValue(sessionCookie);
}

export async function GET(request, { params }) {
  if (!(await verifySession(request))) return errorResponse('仮ログインが必要です。', 401);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const setId = params?.id;
    const { data: wordSet, error: wordSetError } = await supabaseAdmin
      .from('word_sets')
      .select('id,name')
      .eq('id', setId)
      .eq('app_user_id', APP_USER_ID)
      .single();

    if (wordSetError || !wordSet) return errorResponse('保存セットが見つかりません。', 404);

    const { data: itemRows, error: itemError } = await supabaseAdmin
      .from('word_set_items')
      .select('word_id')
      .eq('word_set_id', setId);
    if (itemError) return errorResponse('セット内容の取得に失敗しました。', 500);

    const wordIds = (itemRows || []).map((row) => row.word_id).filter(Boolean);
    if (!wordIds.length) return NextResponse.json({ id: setId, name: wordSet.name, words: [] });

    const { data: words, error: wordsError } = await supabaseAdmin
      .from('words')
      .select(WORD_COLUMNS)
      .in('id', wordIds)
      .order('id', { ascending: true });
    if (wordsError) return errorResponse('セット内容の取得に失敗しました。', 500);

    return NextResponse.json({ id: setId, name: wordSet.name, words: words || [] });
  } catch (error) {
    console.error('Failed to use word set detail GET API:', error);
    return errorResponse('セット内容の取得に失敗しました。', 500);
  }
}

export async function DELETE(request, { params }) {
  if (!(await verifySession(request))) return errorResponse('仮ログインが必要です。', 401);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const setId = params?.id;
    const { error } = await supabaseAdmin
      .from('word_sets')
      .delete()
      .eq('id', setId)
      .eq('app_user_id', APP_USER_ID);

    if (error) return errorResponse('保存セットの削除に失敗しました。', 500);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to use word set DELETE API:', error);
    return errorResponse('保存セットの削除に失敗しました。', 500);
  }
}
