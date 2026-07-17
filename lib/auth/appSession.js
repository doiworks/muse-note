export const APP_SESSION_COOKIE_NAME = 'muse_note_session';
export const APP_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const PREVIEW_APP_USER_ID = '00000000-0000-4000-8000-000000000001';

const SESSION_VERSION = 1;

function getSessionSecret() {
  return process.env.APP_SESSION_SECRET || process.env.ADMIN_PREVIEW_TOKEN || '';
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

export function hasAppSessionSecretConfigured() {
  return Boolean(getSessionSecret());
}

export async function createAppSessionCookieValue({ appUserId, authType, displayName = '', role = 'user' }) {
  const secret = getSessionSecret();
  if (!secret) throw new Error('APP_SESSION_SECRET が設定されていません。');
  if (!appUserId) throw new Error('appUserId は必須です。');

  const issuedAt = Date.now();
  const payloadObject = {
    version: SESSION_VERSION,
    appUserId,
    authType: authType || 'line',
    displayName: String(displayName || ''),
    role: String(role || 'user'),
    issuedAt,
    expiresAt: issuedAt + APP_SESSION_MAX_AGE_SECONDS * 1000
  };
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payloadObject)));
  const signature = await createSignature(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifyAppSessionCookieValue(cookieValue) {
  const secret = getSessionSecret();
  if (!secret || !cookieValue) return null;

  const [payload, signature, extra] = cookieValue.split('.');
  if (!payload || !signature || extra) return null;

  const expectedSignature = await createSignature(payload, secret);
  if (!isSafeEqual(signature, expectedSignature)) return null;

  try {
    const decoded = new TextDecoder().decode(decodeBase64Url(payload));
    const session = JSON.parse(decoded);
    const now = Date.now();
    if (session.version !== SESSION_VERSION) return null;
    if (!session.appUserId || !Number.isFinite(session.expiresAt)) return null;
    if (session.expiresAt <= now || session.issuedAt > now) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getAppSessionFromRequest(request) {
  const cookieValue = request.cookies.get(APP_SESSION_COOKIE_NAME)?.value;
  return verifyAppSessionCookieValue(cookieValue);
}

export function getAppSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: APP_SESSION_MAX_AGE_SECONDS
  };
}

export function getExpiredAppSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  };
}
