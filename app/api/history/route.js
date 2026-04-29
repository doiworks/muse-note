import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request) {
  // 学習の回答履歴を保存するAPIです。
  const body = await request.json();
  const { userId, wordId, answerText, isCorrect } = body;

  if (!userId || !wordId) {
    return NextResponse.json({ error: 'userId と wordId は必須です。' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('history')
    .insert({
      user_id: userId,
      word_id: wordId,
      answer_text: answerText || null,
      is_correct: Boolean(isCorrect)
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data });
}
