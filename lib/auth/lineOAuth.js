export const LINE_OAUTH_COOKIE_NAME = 'muse_note_line_oauth';
export const LINE_OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

function getSessionSecret() {
  return process.env.APP_SESSION_SECRET || process.env.ADMIN_PREVIEW_TOKEN || '';
}

export function getLineConfig() {
  return {
    channelId: process.env.LINE_CHANNEL_ID || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
    redirectUri: process.env.LINE_REDIRECT_URI || ''
  };
}

export function hasLineConfig() {
  const config = getLineConfig();
  return Boolean(config.channelId && config.channelSecret && config.redirectUri);
}

function encodeBase64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function createSignature(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return encodeBase64Url(new Uint8Array(signature));
}

function isSafeEqual(left, right) {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function createRandomBase64Url(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

export function normalizeInternalRedirect(value) {
  const redirectPath = String(value || '/');
  return redirectPath.startsWith('/') && !redirectPath.startsWith('//') ? redirectPath : '/';
}

export async function createLineOAuthCookieValue({ state, nonce, redirectPath }) {
  const secret = getSessionSecret();
  if (!secret) throw new Error('APP_SESSION_SECRET が設定されていません。');
  const payloadObject = {
    state,
    nonce,
    redirectPath: normalizeInternalRedirect(redirectPath),
    expiresAt: Date.now() + LINE_OAUTH_COOKIE_MAX_AGE_SECONDS * 1000
  };
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payloadObject)));
  const signature = await createSignature(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifyLineOAuthCookieValue(cookieValue) {
  const secret = getSessionSecret();
  if (!secret || !cookieValue) return null;
  const [payload, signature, extra] = cookieValue.split('.');
  if (!payload || !signature || extra) return null;
  const expectedSignature = await createSignature(payload, secret);
  if (!isSafeEqual(signature, expectedSignature)) return null;
  try {
    const decoded = new TextDecoder().decode(decodeBase64Url(payload));
    const data = JSON.parse(decoded);
    if (!data.state || !data.nonce || data.expiresAt <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function getLineOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/line',
    maxAge: LINE_OAUTH_COOKIE_MAX_AGE_SECONDS
  };
}

export function getExpiredLineOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/line',
    maxAge: 0
  };
}

export function createLineAuthorizationUrl({ state, nonce }) {
  const config = getLineConfig();
  const url = new URL('https://access.line.me/oauth2/v2.1/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.channelId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'openid profile');
  url.searchParams.set('nonce', nonce);
  return url;
}

export async function exchangeLineAuthorizationCode(code) {
  const config = getLineConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.channelId,
    client_secret: config.channelSecret
  });
  const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id_token) {
    throw new Error(data.error_description || 'LINEアクセストークンの取得に失敗しました。');
  }
  return data;
}

export async function verifyLineIdToken({ idToken, nonce }) {
  const config = getLineConfig();
  const body = new URLSearchParams({
    id_token: idToken,
    client_id: config.channelId,
    nonce
  });
  const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.sub) {
    throw new Error(data.error_description || 'LINEユーザー情報の確認に失敗しました。');
  }
  return data;
}
