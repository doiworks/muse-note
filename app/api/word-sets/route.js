import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../lib/auth/previewSession';

const APP_USER_ID = '00000000-0000-4000-8000-000000000001';

function errorResponse(message, status) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);
  if (!isLoggedIn) return errorResponse('仮ログインが必要です。', 401);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('word_sets')
      .select('id,name,created_at,updated_at,word_set_items(count)')
      .eq('app_user_id', APP_USER_ID)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch word sets:', error);
      return errorResponse('保存セットの取得に失敗しました。', 500);
    }

    const wordSets = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      word_count: row.word_set_items?.[0]?.count ?? 0
    }));

    return NextResponse.json({ word_sets: wordSets });
  } catch (error) {
    console.error('Failed to use word sets GET API:', error);
    return errorResponse('保存セットの取得に失敗しました。', 500);
  }
}

export async function POST(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);
  if (!isLoggedIn) return errorResponse('仮ログインが必要です。', 401);

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : null;
  const wordIds = Array.isArray(body?.word_ids)
    ? [...new Set(body.word_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id >= 0))]
    : [];

  if (!name) return errorResponse('name は必須です。', 400);
  if (!wordIds.length) return errorResponse('word_ids は1件以上必要です。', 400);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { data: createdSet, error: insertSetError } = await supabaseAdmin
      .from('word_sets')
      .insert({ app_user_id: APP_USER_ID, name, description, created_at: now, updated_at: now })
      .select('id,name,created_at,updated_at')
      .single();

    if (insertSetError || !createdSet) {
      console.error('Failed to create word set:', insertSetError);
      return errorResponse('保存セットの作成に失敗しました。', 500);
    }

    const items = wordIds.map((wordId) => ({ word_set_id: createdSet.id, word_id: wordId, created_at: now }));
    const { error: insertItemError } = await supabaseAdmin.from('word_set_items').insert(items);
    if (insertItemError) {
      console.error('Failed to create word set items:', insertItemError);
      await supabaseAdmin.from('word_sets').delete().eq('id', createdSet.id);
      return errorResponse('保存セットの作成に失敗しました。', 500);
    }

    return NextResponse.json({ ok: true, word_set: createdSet });
  } catch (error) {
    console.error('Failed to use word sets POST API:', error);
    return errorResponse('保存セットの作成に失敗しました。', 500);
  }
}
