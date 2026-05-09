import { NextResponse } from 'next/server';
import { PREVIEW_SESSION_COOKIE_NAME } from '../../../../lib/auth/previewSession';

export async function POST() {
  const response = NextResponse.json({ ok: true });

  // cookie を削除して、仮ログイン状態を終了します。
  response.cookies.set(PREVIEW_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  });

  return response;
}
