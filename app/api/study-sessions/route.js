import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { getAppSessionFromRequest } from '../../../lib/auth/appSession';

export async function POST(request) {
  const user = await getAppSessionFromRequest(request);
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const totalQuestions = Number(body.total_questions);
  if (!Number.isInteger(totalQuestions) || totalQuestions < 1) {
    return NextResponse.json({ error: '総予定問題数が不正です。' }, { status: 400 });
  }
  const { data, error } = await getSupabaseAdmin().from('study_sessions').insert({
    app_user_id: user.appUserId,
    total_questions: totalQuestions
  }).select('id,status,total_questions,completed_questions').single();
  if (error) {
    console.error('Failed to start study session:', error);
    return NextResponse.json({ error: '学習セッションを開始できませんでした。' }, { status: 500 });
  }
  return NextResponse.json({ session: data });
}
