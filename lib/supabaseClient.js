// このファイルは「公開しても安全なキー」を使って
// ブラウザ側・サーバー側の両方からSupabaseに接続するための設定です。
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// URLやキーがないときに、原因がわかりやすいように明示的にエラーにしています。
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabaseの環境変数が不足しています。.env.local を確認してください。');
}

// anon key は「公開用キー」です。
// RLS（Row Level Security）を有効にする前提で利用します。
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
