import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET() {
  // wordsテーブルから単語を取得します。
  const { data, error } = await supabaseAdmin
    .from('words')
    .select('*')
    .order('id', { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ words: data });
}
