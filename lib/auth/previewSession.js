// 開発用の仮ログインを扱う小さな認証ライブラリです。
// 将来 LINE Login に置き換えるときは、このファイルと呼び出し元を差し替えます。
//
// 重要:
// - ADMIN_PREVIEW_TOKEN はサーバー側の環境変数だけで読みます。
// - 入力されたトークンそのものを cookie に保存しません。
// - cookie には「ログイン済みであることを確認するための署名済み文字列」だけを保存します。

export const PREVIEW_SESSION_COOKIE_NAME = 'muse_note_preview_session';
export const PREVIEW_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7日間

const SESSION_LABEL = 'admin-preview';

function getPreviewToken() {
  return process.env.ADMIN_PREVIEW_TOKEN || '';
}

function encodeBase64Url(bytes) {
  const binary = String.fromCharCode(...bytes);

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
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
  // 文字数が違う場合でもすぐに return せず、できるだけ比較時間の差を小さくします。
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}

export function hasPreviewTokenConfigured() {
  return Boolean(getPreviewToken());
}

export function isValidPreviewToken(inputToken) {
  const expectedToken = getPreviewToken();

  if (!expectedToken || !inputToken) {
    return false;
  }

  return isSafeEqual(inputToken, expectedToken);
}

export async function createPreviewSessionCookieValue() {
  const secret = getPreviewToken();

  if (!secret) {
    throw new Error('ADMIN_PREVIEW_TOKEN が設定されていません。');
  }

  const issuedAt = Date.now().toString();
  const payload = `${SESSION_LABEL}.${issuedAt}`;
  const signature = await createSignature(payload, secret);

  return `${payload}.${signature}`;
}

export async function verifyPreviewSessionCookieValue(cookieValue) {
  const secret = getPreviewToken();

  if (!secret || !cookieValue) {
    return false;
  }

  const parts = cookieValue.split('.');

  if (parts.length !== 3) {
    return false;
  }

  const [label, issuedAt, signature] = parts;

  if (label !== SESSION_LABEL || !issuedAt || !signature) {
    return false;
  }

  const issuedAtNumber = Number(issuedAt);
  const now = Date.now();

  if (!Number.isFinite(issuedAtNumber) || issuedAtNumber > now) {
    return false;
  }

  const sessionAgeSeconds = (now - issuedAtNumber) / 1000;

  if (sessionAgeSeconds > PREVIEW_SESSION_MAX_AGE_SECONDS) {
    return false;
  }

  const expectedSignature = await createSignature(`${label}.${issuedAt}`, secret);

  return isSafeEqual(signature, expectedSignature);
}

export function getPreviewSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PREVIEW_SESSION_MAX_AGE_SECONDS
  };
}

export function decodePreviewSessionCookieForDebug(cookieValue) {
  // 通常の処理では使いません。手元で cookie 形式を確認したいときだけ利用する補助関数です。
  if (!cookieValue) {
    return null;
  }

  const [, issuedAt] = cookieValue.split('.');

  return issuedAt ? new Date(Number(issuedAt)).toISOString() : null;
}
