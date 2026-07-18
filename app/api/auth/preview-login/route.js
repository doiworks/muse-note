import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { PREVIEW_APP_USER_ID } from '../../../../lib/auth/appSession';
import {
  PREVIEW_SESSION_COOKIE_NAME,
  createPreviewSessionCookieValue,
  getPreviewSessionCookieOptions,
  hasPreviewTokenConfigured,
  isValidPreviewToken
} from '../../../../lib/auth/previewSession';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const inputToken = String(body.token || '');

  if (!hasPreviewTokenConfigured()) {
    return NextResponse.json(
      { error: 'ADMIN_PREVIEW_TOKEN が未設定です。Vercel または .env.local を確認してください。' },
      { status: 500 }
    );
  }
  if (!isValidPreviewToken(inputToken)) {
    return NextResponse.json({ error: '仮ログイントークンが正しくありません。' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from('app_users').upsert(
      {
        id: PREVIEW_APP_USER_ID,
        line_user_id: 'dev_preview_user',
        display_name: '開発確認ユーザー',
        role: 'user',
        status: 'active',
        last_login_at: now,
        updated_at: now
      },
      { onConflict: 'line_user_id' }
    );
    if (error) throw error;

    const response = NextResponse.json({ ok: true });
    const cookieValue = await createPreviewSessionCookieValue();
    response.cookies.set(PREVIEW_SESSION_COOKIE_NAME, cookieValue, getPreviewSessionCookieOptions());
    return response;
  } catch (error) {
    console.error('Preview login failed:', error);
    return NextResponse.json({ error: '仮ログインに失敗しました。' }, { status: 500 });
  }
}
