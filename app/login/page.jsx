'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/preview-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '仮ログインに失敗しました。');
      }

      // redirect は middleware が付ける戻り先です。不正な外部URLへ飛ばないよう「/」始まりだけ許可します。
      const redirectPath = searchParams.get('redirect');
      const safeRedirectPath = redirectPath?.startsWith('/') && !redirectPath.startsWith('//') ? redirectPath : '/';

      router.replace(safeRedirectPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Muse Note 仮ログイン</h1>
      <p>
        商品化前の開発確認用ログインです。LINE Login を正式実装するまで、一般公開ユーザーは利用できません。
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16, marginTop: 24 }}>
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
          {isSubmitting ? '確認中...' : '仮ログインする'}
        </button>
      </form>

      {errorMessage && <p style={{ color: 'crimson', marginTop: 16 }}>{errorMessage}</p>}

      <section style={{ marginTop: 32, padding: 16, background: '#f7f7f7', borderRadius: 8 }}>
        <h2>初心者向けメモ</h2>
        <ul>
          <li>入力したトークンはサーバー側だけで照合します。</li>
          <li>Supabase の service role key はブラウザへ送りません。</li>
          <li>ログイン成功後は httpOnly cookie で状態を保持します。</li>
        </ul>
      </section>
    </main>
  );
}


export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 560, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
          読み込み中です...
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
