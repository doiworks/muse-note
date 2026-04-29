// このファイルは「サーバー専用」です。
// service_roleキーは非常に強い権限なので、絶対にクライアント側へ渡さないでください。
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('管理者向けSupabase環境変数が不足しています。.env.local を確認してください。');
}

// API Route（サーバー）からのみ使います。
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
