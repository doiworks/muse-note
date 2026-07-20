import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getAppSessionFromRequest } from '../../../../lib/auth/appSession';

export async function PATCH(request, { params }) {
  const user = await getAppSessionFromRequest(request);
  if (!user) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!['completed', 'interrupted'].includes(body.status)) {
    return NextResponse.json({ error: '学習状態が不正です。' }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  const { data: session, error: sessionError } = await supabase.from('study_sessions')
    .select('id,total_questions,status').eq('id', params.id).eq('app_user_id', user.appUserId).single();
  if (sessionError || !session) return NextResponse.json({ error: '学習セッションが見つかりません。' }, { status: 404 });

  const { data: answers, error: historyError } = await supabase.from('history')
    .select('correct').eq('study_session_id', session.id).eq('app_user_id', user.appUserId);
  if (historyError) return NextResponse.json({ error: '回答履歴を確認できませんでした。' }, { status: 500 });
  const completedQuestions = answers.length;
  const correctCount = answers.filter((answer) => answer.correct).length;
  const status = body.status === 'completed' && completedQuestions < session.total_questions ? 'interrupted' : body.status;
  const { data, error } = await supabase.from('study_sessions').update({
    status,
    completed_questions: completedQuestions,
    correct_count: correctCount,
    wrong_count: completedQuestions - correctCount,
    ended_at: new Date().toISOString()
  }).eq('id', session.id).eq('app_user_id', user.appUserId)
    .select('id,status,completed_questions,total_questions,correct_count,wrong_count').single();
  if (error) return NextResponse.json({ error: '学習結果を保存できませんでした。' }, { status: 500 });
  return NextResponse.json({ session: data });
}
