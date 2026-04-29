import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request) {
  // 単語ごとの学習統計を更新するAPIです。
  const body = await request.json();
  const { userId, wordId, isCorrect } = body;

  if (!userId || !wordId) {
    return NextResponse.json({ error: 'userId と wordId は必須です。' }, { status: 400 });
  }

  // まず既存データがあるか確認します。
  const { data: existingStats } = await supabaseAdmin
    .from('stats')
    .select('*')
    .eq('user_id', userId)
    .eq('word_id', wordId)
    .maybeSingle();

  const oldCorrectCount = existingStats?.correct_count || 0;
  const oldWrongCount = existingStats?.wrong_count || 0;
  const newCorrectCount = isCorrect ? oldCorrectCount + 1 : oldCorrectCount;
  const newWrongCount = isCorrect ? oldWrongCount : oldWrongCount + 1;
  const newAttemptCount = newCorrectCount + newWrongCount;
  const newAccuracyRate = newAttemptCount === 0 ? 0 : (newCorrectCount / newAttemptCount) * 100;

  const { data, error } = await supabaseAdmin
    .from('stats')
    .upsert(
      {
        user_id: userId,
        word_id: wordId,
        correct_count: newCorrectCount,
        wrong_count: newWrongCount,
        attempt_count: newAttemptCount,
        accuracy_rate: Number(newAccuracyRate.toFixed(2)),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,word_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stats: data });
}
