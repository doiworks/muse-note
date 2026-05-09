// このファイルは「サーバー専用」です。
// service_roleキーは非常に強い権限なので、絶対にクライアント側へ渡さないでください。
import { createClient } from '@supabase/supabase-js';

let cachedSupabaseAdmin = null;

export function getSupabaseAdmin() {
  // Next.js の build 時に API Route が読み込まれることがあるため、import 直後には環境変数を検証しません。
  // 実際に API から Supabase へ接続するタイミングで、サーバー側の環境変数を確認します。
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('管理者向けSupabase環境変数が不足しています。.env.local を確認してください。');
  }

  if (!cachedSupabaseAdmin) {
    // API Route（サーバー）からのみ使います。
    cachedSupabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return cachedSupabaseAdmin;
}

export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, propertyName) {
      const client = getSupabaseAdmin();
      const value = client[propertyName];

      return typeof value === 'function' ? value.bind(client) : value;
    }
  }
);
