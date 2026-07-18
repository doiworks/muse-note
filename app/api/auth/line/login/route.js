import { NextResponse } from 'next/server';
import {
  LINE_OAUTH_COOKIE_NAME,
  createLineAuthorizationUrl,
  createLineOAuthCookieValue,
  createRandomBase64Url,
  getLineOAuthCookieOptions,
  hasLineConfig,
  normalizeInternalRedirect
} from '../../../../../lib/auth/lineOAuth';
import { hasAppSessionSecretConfigured } from '../../../../../lib/auth/appSession';

export async function GET(request) {
  if (!hasLineConfig()) {
    return NextResponse.json({ error: 'LINE Login の環境変数が未設定です。' }, { status: 500 });
  }
  if (!hasAppSessionSecretConfigured()) {
    return NextResponse.json({ error: 'APP_SESSION_SECRET が未設定です。' }, { status: 500 });
  }

  const redirectPath = normalizeInternalRedirect(new URL(request.url).searchParams.get('redirect'));
  const state = createRandomBase64Url();
  const nonce = createRandomBase64Url();
  const authorizationUrl = createLineAuthorizationUrl({ state, nonce });
  const response = NextResponse.redirect(authorizationUrl);
  const oauthCookie = await createLineOAuthCookieValue({ state, nonce, redirectPath });
  response.cookies.set(LINE_OAUTH_COOKIE_NAME, oauthCookie, getLineOAuthCookieOptions());
  return response;
}
