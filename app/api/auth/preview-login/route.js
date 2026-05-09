import { NextResponse } from 'next/server';
import {
  PREVIEW_SESSION_COOKIE_NAME,
  createPreviewSessionCookieValue,
  getPreviewSessionCookieOptions,
  hasPreviewTokenConfigured,
  isValidPreviewToken
} from '../../../../lib/auth/previewSession';

export async function POST(request) {
  // 開発確認用の仮ログインAPIです。
  // ブラウザから受け取った token と、Vercel / .env.local の ADMIN_PREVIEW_TOKEN をサーバー側で比較します。
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

  const response = NextResponse.json({ ok: true });
  const cookieValue = await createPreviewSessionCookieValue();

  // httpOnly cookie にすることで、JavaScript から cookie の中身を読めないようにします。
  response.cookies.set(PREVIEW_SESSION_COOKIE_NAME, cookieValue, getPreviewSessionCookieOptions());

  return response;
}
