import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request) {
  // 将来的にLINEログイン後、line_user_id を受け取って users に登録する想定です。
  const body = await request.json();
  const { lineUserId, userName } = body;

  if (!lineUserId) {
    return NextResponse.json({ error: 'lineUserId は必須です。' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert(
      {
        line_user_id: lineUserId,
        user_name: userName || 'new user'
      },
      { onConflict: 'line_user_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
