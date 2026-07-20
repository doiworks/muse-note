import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getAppSessionFromRequest } from '../../../../lib/auth/appSession';
export async function POST(request) {
  const session = await getAppSessionFromRequest(request);
  if (!session) return NextResponse.json({ error:'ログインが必要です。' }, { status:401 });
  const body = await request.json().catch(() => ({}));
  const wordId = Number(body.word_id);
  if (!body.reservation_id || !Number.isInteger(wordId) || wordId < 0) return NextResponse.json({ error:'予約情報が不正です。' }, { status:400 });
  const { data, error } = await getSupabaseAdmin().rpc('confirm_quiz_word_presented', { p_app_user_id:session.appUserId, p_reservation_id:body.reservation_id, p_word_id:wordId });
  if (error || !data) return NextResponse.json({ error:'出題状態を保存できませんでした。再試行してください。' }, { status:500 });
  return NextResponse.json({ ok:true });
}
