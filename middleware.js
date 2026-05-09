import { NextResponse } from 'next/server';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from './lib/auth/previewSession';

export async function middleware(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyPreviewSessionCookieValue(sessionCookie);

  if (isLoggedIn) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '仮ログインが必要です。' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  // トップページと words API を仮ログイン必須にします。
  // /login と /api/auth/* は対象外なので、未ログインでも表示・実行できます。
  matcher: ['/', '/api/words/:path*']
};
