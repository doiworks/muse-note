import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '../../../../lib/auth/appSession';

export async function GET(request) {
  const session = await getAppSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: session.appUserId,
      display_name: session.displayName,
      picture_url: session.pictureUrl || null,
      role: session.role,
      auth_type: session.authType
    }
  });
}
