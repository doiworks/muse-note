import { NextResponse } from 'next/server';
import {
  APP_SESSION_COOKIE_NAME,
  getExpiredAppSessionCookieOptions
} from '../../../../lib/auth/appSession';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(APP_SESSION_COOKIE_NAME, '', getExpiredAppSessionCookieOptions());
  return response;
}
