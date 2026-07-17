// 既存APIとの互換用です。ログイン状態そのものは appSession に一本化しています。
import {
  APP_SESSION_COOKIE_NAME,
  APP_SESSION_MAX_AGE_SECONDS,
  PREVIEW_APP_USER_ID,
  createAppSessionCookieValue,
  getAppSessionCookieOptions,
  verifyAppSessionCookieValue
} from './appSession';

export const PREVIEW_SESSION_COOKIE_NAME = APP_SESSION_COOKIE_NAME;
export const PREVIEW_SESSION_MAX_AGE_SECONDS = APP_SESSION_MAX_AGE_SECONDS;

function getPreviewToken() {
  return process.env.ADMIN_PREVIEW_TOKEN || '';
}

function isSafeEqual(left, right) {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function hasPreviewTokenConfigured() {
  return Boolean(getPreviewToken());
}

export function isValidPreviewToken(inputToken) {
  const expectedToken = getPreviewToken();
  return Boolean(expectedToken && inputToken && isSafeEqual(inputToken, expectedToken));
}

export function createPreviewSessionCookieValue() {
  return createAppSessionCookieValue({
    appUserId: PREVIEW_APP_USER_ID,
    authType: 'preview',
    displayName: '開発確認ユーザー',
    role: 'user'
  });
}

export async function verifyPreviewSessionCookieValue(cookieValue) {
  return Boolean(await verifyAppSessionCookieValue(cookieValue));
}

export function getPreviewSessionCookieOptions() {
  return getAppSessionCookieOptions();
}

export async function decodePreviewSessionCookieForDebug(cookieValue) {
  return verifyAppSessionCookieValue(cookieValue);
}
