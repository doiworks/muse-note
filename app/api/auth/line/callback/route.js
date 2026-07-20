import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabaseAdmin';
import {
  APP_SESSION_COOKIE_NAME,
  createAppSessionCookieValue,
  getAppSessionCookieOptions
} from '../../../../../lib/auth/appSession';
import {
  LINE_OAUTH_COOKIE_NAME,
  exchangeLineAuthorizationCode,
  getExpiredLineOAuthCookieOptions,
  normalizeInternalRedirect,
  verifyLineIdToken,
  verifyLineOAuthCookieValue
} from '../../../../../lib/auth/lineOAuth';

function loginErrorRedirect(request, message) {
  const url = new URL('/login', request.url);
  url.searchParams.set('error', message);
  return url;
}

async function findOrCreateLineUser(profile) {
  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: existingUser, error: findError } = await supabaseAdmin
    .from('app_users')
    .select('id,line_user_id,display_name,picture_url,status,role')
    .eq('line_user_id', profile.sub)
    .maybeSingle();

  if (findError) throw findError;
  if (existingUser) {
    if (existingUser.status !== 'active') throw new Error('このユーザーは現在利用できません。');
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('app_users')
      .update({
        display_name: profile.name || existingUser.display_name || 'LINEユーザー',
        picture_url: profile.picture || existingUser.picture_url || null,
        last_login_at: now,
        updated_at: now
      })
      .eq('id', existingUser.id)
      .select('id,display_name,picture_url,status,role')
      .single();
    if (updateError) throw updateError;
    return updatedUser;
  }

  const { data: createdUser, error: insertError } = await supabaseAdmin
    .from('app_users')
    .insert({
      line_user_id: profile.sub,
      display_name: profile.name || 'LINEユーザー',
      picture_url: profile.picture || null,
      status: 'active',
      role: 'user',
      last_login_at: now,
      created_at: now,
      updated_at: now
    })
    .select('id,display_name,picture_url,status,role')
    .single();
  if (insertError) throw insertError;
  return createdUser;
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const oauthCookieValue = request.cookies.get(LINE_OAUTH_COOKIE_NAME)?.value;
  const oauthState = await verifyLineOAuthCookieValue(oauthCookieValue);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const lineError = requestUrl.searchParams.get('error');

  if (lineError) {
    const response = NextResponse.redirect(loginErrorRedirect(request, 'LINEログインがキャンセルされました。'));
    response.cookies.set(LINE_OAUTH_COOKIE_NAME, '', getExpiredLineOAuthCookieOptions());
    return response;
  }

  if (!oauthState || !code || !state || state !== oauthState.state) {
    const response = NextResponse.redirect(loginErrorRedirect(request, 'LINEログインの確認情報が正しくありません。'));
    response.cookies.set(LINE_OAUTH_COOKIE_NAME, '', getExpiredLineOAuthCookieOptions());
    return response;
  }

  try {
    const tokenData = await exchangeLineAuthorizationCode(code);
    const profile = await verifyLineIdToken({ idToken: tokenData.id_token, nonce: oauthState.nonce });
    const appUser = await findOrCreateLineUser(profile);
    const sessionCookie = await createAppSessionCookieValue({
      appUserId: appUser.id,
      authType: 'line',
      displayName: appUser.display_name,
      pictureUrl: appUser.picture_url,
      role: appUser.role
    });
    const redirectPath = normalizeInternalRedirect(oauthState.redirectPath);
    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    response.cookies.set(APP_SESSION_COOKIE_NAME, sessionCookie, getAppSessionCookieOptions());
    response.cookies.set(LINE_OAUTH_COOKIE_NAME, '', getExpiredLineOAuthCookieOptions());
    return response;
  } catch (error) {
    console.error('LINE Login callback failed:', error);
    const response = NextResponse.redirect(loginErrorRedirect(request, 'LINEログインに失敗しました。'));
    response.cookies.set(LINE_OAUTH_COOKIE_NAME, '', getExpiredLineOAuthCookieOptions());
    return response;
  }
}
