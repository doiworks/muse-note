import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from './lib/auth/appSession';

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  const session = await getAppSessionFromRequest(request);
  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/', '/api/:path*']
};
