'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function getSafeRedirect(searchParams) {
  const redirectPath = searchParams.get('redirect');
  return redirectPath?.startsWith('/') && !redirectPath.startsWith('//') ? redirectPath : '/';
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectPath = getSafeRedirect(searchParams);
  const lineError = searchParams.get('error');
  const lineLoginUrl = `/api/auth/line/login?redirect=${encodeURIComponent(redirectPath)}`;

  async function handleSubmit(event) {
    event.preventDefault();
    setPreviewError('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/preview-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '仮ログインに失敗しました。');
      router.replace(redirectPath);
      router.refresh();
    } catch (error) {
      setPreviewError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Muse Note ログイン</h1>
      <p>LINEでログインすると、保存セット・回答履歴・成績が自分専用で保存されます。</p>

      <a
        href={lineLoginUrl}
        style={{
          display: 'block',
          marginTop: 24,
          padding: 14,
          borderRadius: 8,
          background: '#06c755',
          color: '#fff',
          fontWeight: 700,
          textAlign: 'center',
          textDecoration: 'none'
        }}
      >
        LINEでログイン
      </a>
      {lineError && <p style={{ color: 'crimson', marginTop: 16 }}>{lineError}</p>}

      <details style={{ marginTop: 32 }}>
        <summary>開発確認用ログイン</summary>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>ADMIN_PREVIEW_TOKEN</span>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Vercel Environment Variable の値を入力"
              autoComplete="off"
              style={{ padding: 12, fontSize: 16 }}
            />
          </label>
          <button type="submit" disabled={isSubmitting} style={{ padding: 12, fontSize: 16, cursor: 'pointer' }}>
            {isSubmitting ? '確認中...' : '開発確認用でログイン'}
          </button>
        </form>
        {previewError && <p style={{ color: 'crimson', marginTop: 16 }}>{previewError}</p>}
      </details>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 560, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>読み込み中です...</main>}>
      <LoginForm />
    </Suspense>
  );
}
