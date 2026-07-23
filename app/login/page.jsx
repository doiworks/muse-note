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
  const [privateAccessOpen, setPrivateAccessOpen] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectPath = getSafeRedirect(searchParams);
  const lineError = searchParams.get('error');
  const lineLoginUrl = `/api/auth/line/login?redirect=${encodeURIComponent(redirectPath)}`;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!token.trim()) {
      setPreviewError('パスワードを入力してください。');
      return;
    }

    setPreviewError('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/preview-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      await response.json().catch(() => ({}));
      if (!response.ok) throw new Error('入力内容を確認してください。');
      router.replace(redirectPath);
      router.refresh();
    } catch {
      setPreviewError('入力内容を確認してください。');
    } finally {
      setIsSubmitting(false);
    }
  }

  function togglePrivateAccess() {
    setPrivateAccessOpen((current) => !current);
    setToken('');
    setPreviewError('');
  }

  return (
    <main className="loginPage">
      <div className="backgroundGlow glowOne" aria-hidden="true" />
      <div className="backgroundGlow glowTwo" aria-hidden="true" />

      <section className="loginCard" aria-labelledby="login-title">
        <div className="brandArea">
          <div className="brandMark" aria-hidden="true">
            <span className="brandPaper" />
            <span className="brandPencil" />
            <strong>M</strong>
          </div>
          <p className="brandName">MUSE NOTE</p>
          <h1 id="login-title">ことばを、毎日の力に。</h1>
          <p className="loginLead">
            LINEでつなぐと、学習履歴や保存した単語セットを自分専用で残せます。
          </p>
        </div>

        <a className="lineLoginButton" href={lineLoginUrl}>
          <span className="lineBubble" aria-hidden="true">LINE</span>
          <span>LINEでつづける</span>
        </a>

        {lineError && (
          <p className="loginError" role="alert">
            LINEログインを完了できませんでした。もう一度お試しください。
          </p>
        )}

        <p className="privacyNote">ログイン後も、LINEへ勝手に投稿されることはありません。</p>

        <div className={`privateAccess ${privateAccessOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="privateAccessTrigger"
            onClick={togglePrivateAccess}
            aria-expanded={privateAccessOpen}
            aria-label="追加メニュー"
          >
            {privateAccessOpen ? '×' : '•••'}
          </button>

          {privateAccessOpen && (
            <form className="privateAccessForm" onSubmit={handleSubmit}>
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="パスワード"
                aria-label="パスワード"
                autoComplete="current-password"
                autoFocus
              />
              <button type="submit" disabled={isSubmitting || !token.trim()}>
                {isSubmitting ? '確認中…' : '続ける'}
              </button>
              {previewError && <p className="privateAccessError" role="alert">{previewError}</p>}
            </form>
          )}
        </div>
      </section>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(html),
        :global(body) {
          min-height: 100%;
          margin: 0;
          background: #eef6ff;
        }

        :global(body) {
          color: #315d91;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic", sans-serif;
        }

        .loginPage {
          position: relative;
          isolation: isolate;
          min-height: 100dvh;
          display: grid;
          place-items: center;
          overflow: hidden;
          padding: 28px 18px;
          background:
            radial-gradient(circle at 50% 0%, rgba(255, 255, 255, .96), rgba(255, 255, 255, 0) 42%),
            linear-gradient(180deg, #f8fbff 0%, #e9f4ff 100%);
        }

        .backgroundGlow {
          position: absolute;
          z-index: -1;
          border-radius: 999px;
          filter: blur(2px);
          opacity: .72;
        }

        .glowOne {
          top: -110px;
          right: -90px;
          width: 300px;
          height: 300px;
          background: #cfe5fb;
        }

        .glowTwo {
          bottom: -130px;
          left: -100px;
          width: 340px;
          height: 340px;
          background: #dcecff;
        }

        .loginCard {
          width: min(100%, 430px);
          padding: 38px 30px 22px;
          border: 0;
          border-radius: 28px;
          background: rgba(255, 255, 255, .94);
          box-shadow: 0 18px 45px rgba(72, 113, 158, .16);
          text-align: center;
        }

        .brandArea {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .brandMark {
          position: relative;
          width: 82px;
          height: 82px;
          display: grid;
          place-items: center;
          margin-bottom: 13px;
          border-radius: 25px;
          background: linear-gradient(150deg, #a8c9f0 0%, #7fb1e8 100%);
          box-shadow: 0 10px 24px rgba(91, 146, 202, .25);
        }

        .brandMark strong {
          position: relative;
          z-index: 3;
          color: #ffffff;
          font-size: 2.2rem;
          font-weight: 900;
          letter-spacing: -.08em;
          transform: translateX(-1px);
        }

        .brandPaper {
          position: absolute;
          inset: 16px 18px 16px 17px;
          border-radius: 13px;
          background: rgba(255, 255, 255, .18);
          transform: rotate(-5deg);
        }

        .brandPencil {
          position: absolute;
          z-index: 4;
          right: 14px;
          bottom: 13px;
          width: 11px;
          height: 42px;
          border-radius: 8px 8px 3px 3px;
          background: #ffffff;
          box-shadow: 0 2px 5px rgba(49, 93, 145, .15);
          transform: rotate(38deg);
          transform-origin: center bottom;
        }

        .brandPencil::after {
          content: '';
          position: absolute;
          left: 2px;
          bottom: -7px;
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 8px solid #d8e8fa;
        }

        .brandName {
          margin: 0;
          color: #5b83b4;
          font-size: .82rem;
          font-weight: 900;
          letter-spacing: .22em;
        }

        h1 {
          margin: 13px 0 9px;
          color: #315d91;
          font-size: clamp(1.45rem, 6vw, 1.85rem);
          line-height: 1.35;
          letter-spacing: .02em;
        }

        .loginLead {
          max-width: 330px;
          margin: 0;
          color: #6f8daf;
          font-size: .91rem;
          font-weight: 650;
          line-height: 1.75;
        }

        .lineLoginButton {
          width: 100%;
          min-height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 28px;
          border-radius: 17px;
          background: #06c755;
          color: #ffffff;
          font-size: 1rem;
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 8px 18px rgba(6, 199, 85, .22);
          transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
        }

        .lineLoginButton:hover {
          background: #05b94e;
          box-shadow: 0 10px 22px rgba(6, 199, 85, .28);
          transform: translateY(-1px);
        }

        .lineLoginButton:active {
          transform: scale(.99);
        }

        .lineLoginButton:focus-visible,
        .privateAccessTrigger:focus-visible,
        .privateAccessForm input:focus-visible,
        .privateAccessForm button:focus-visible {
          outline: 3px solid rgba(127, 177, 232, .42);
          outline-offset: 3px;
        }

        .lineBubble {
          min-width: 40px;
          height: 27px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: #ffffff;
          color: #06b84e;
          font-size: .62rem;
          font-weight: 950;
          letter-spacing: -.02em;
        }

        .loginError,
        .privateAccessError {
          margin: 14px 0 0;
          color: #b34d60;
          font-size: .82rem;
          font-weight: 800;
          line-height: 1.5;
        }

        .privacyNote {
          margin: 16px 0 0;
          color: #8ca1bb;
          font-size: .72rem;
          line-height: 1.55;
        }

        .privateAccess {
          min-height: 34px;
          margin-top: 13px;
          padding-top: 2px;
        }

        .privateAccessTrigger {
          min-width: 42px;
          height: 30px;
          padding: 0 10px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: #b4c3d5;
          font-size: .78rem;
          font-weight: 900;
          letter-spacing: .1em;
          cursor: pointer;
        }

        .privateAccessTrigger:hover {
          background: #f1f6fc;
          color: #8da3bd;
        }

        .privateAccessForm {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 88px;
          gap: 9px;
          margin-top: 8px;
          padding: 12px;
          border-radius: 16px;
          background: #f3f8fd;
        }

        .privateAccessForm input,
        .privateAccessForm button {
          min-height: 44px;
          border: 0;
          border-radius: 12px;
          font: inherit;
        }

        .privateAccessForm input {
          min-width: 0;
          padding: 0 13px;
          background: #ffffff;
          color: #315d91;
          box-shadow: inset 0 0 0 1px #dce8f5;
        }

        .privateAccessForm input::placeholder {
          color: #9bacc0;
        }

        .privateAccessForm button {
          padding: 0 12px;
          background: #a8c9f0;
          color: #ffffff;
          font-weight: 900;
          cursor: pointer;
        }

        .privateAccessForm button:disabled {
          cursor: default;
          opacity: .55;
        }

        .privateAccessError {
          grid-column: 1 / -1;
          margin-top: 0;
        }

        @media (max-width: 520px) {
          .loginPage {
            align-items: center;
            padding: 18px 14px;
          }

          .loginCard {
            padding: 31px 20px 18px;
            border-radius: 24px;
          }

          .brandMark {
            width: 74px;
            height: 74px;
            border-radius: 22px;
          }

          .privateAccessForm {
            grid-template-columns: minmax(0, 1fr) 80px;
            padding: 10px;
          }
        }
      `}</style>
    </main>
  );
}

function LoginLoading() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#eef6ff', color: '#6f8daf', fontFamily: 'sans-serif' }}>
      読み込み中…
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}
