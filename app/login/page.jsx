'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { MUSE_LOGO_DATA_URI } from './museLogoData';

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
      if (!response.ok) throw new Error();
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
      <span className="shape shapeOne" aria-hidden="true" />
      <span className="shape shapeTwo" aria-hidden="true" />
      <span className="shape shapeThree" aria-hidden="true" />
      <span className="dots dotsOne" aria-hidden="true" />
      <span className="dots dotsTwo" aria-hidden="true" />

      <section className="loginShell" aria-labelledby="login-title">
        <div className="logoFrame">
          <img className="museLogo" src={MUSE_LOGO_DATA_URI} alt="muse NOTE" />
        </div>

        <div className="loginCard">
          <h1 id="login-title">LINEでログインしますか</h1>
          <span className="titleLine" aria-hidden="true" />
          <p>単語練習アプリ</p>

          <a className="lineButton" href={lineLoginUrl}>
            <span className="lineMark" aria-hidden="true">LINE</span>
            <span className="buttonLine" aria-hidden="true" />
            <strong>LINEでログイン</strong>
          </a>

          {lineError && (
            <p className="loginError" role="alert">LINEログインを完了できませんでした。もう一度お試しください。</p>
          )}
        </div>

        <div className="privateArea">
          <button
            type="button"
            className="privateTrigger"
            onClick={togglePrivateAccess}
            aria-expanded={privateAccessOpen}
            aria-label="追加メニュー"
          >
            {privateAccessOpen ? '×' : '•••'}
          </button>

          {privateAccessOpen && (
            <form className="privateForm" onSubmit={handleSubmit}>
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
              {previewError && <p className="privateError" role="alert">{previewError}</p>}
            </form>
          )}
        </div>
      </section>

      <style jsx>{`
        :global(*) { box-sizing: border-box; }
        :global(html), :global(body) { min-height: 100%; margin: 0; background: #f3f8fe; }
        :global(body) {
          color: #274f7d;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic", sans-serif;
        }

        .loginPage {
          position: relative;
          isolation: isolate;
          min-height: 100dvh;
          display: grid;
          place-items: center;
          overflow: hidden;
          padding: 30px 16px 18px;
          background:
            radial-gradient(circle at 50% 0%, rgba(255,255,255,.98) 0, rgba(255,255,255,.72) 34%, transparent 62%),
            linear-gradient(180deg, #edf5fd 0%, #fbfdff 48%, #edf5fd 100%);
        }

        .shape {
          position: absolute;
          z-index: -2;
          display: block;
          border-radius: 999px;
          background: rgba(211, 228, 247, .46);
          pointer-events: none;
        }
        .shapeOne { width: 390px; height: 390px; top: -190px; left: -150px; }
        .shapeTwo { width: 520px; height: 420px; top: -100px; right: -260px; transform: rotate(28deg); opacity: .65; }
        .shapeThree { width: 620px; height: 470px; bottom: -300px; left: -120px; transform: rotate(20deg); opacity: .58; }

        .dots {
          position: absolute;
          z-index: -1;
          width: 150px;
          height: 150px;
          opacity: .48;
          background-image: radial-gradient(circle, #bfd3e9 0 5px, transparent 5.5px);
          background-size: 42px 42px;
        }
        .dotsOne { top: 18px; left: 18px; }
        .dotsTwo { right: -8px; bottom: 0; }

        .loginShell {
          width: min(100%, 510px);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(30px, 5vh, 50px);
        }

        .logoFrame {
          width: clamp(188px, 50vw, 248px);
          aspect-ratio: 1;
          padding: 0;
          border-radius: 28%;
          background: rgba(255,255,255,.5);
          box-shadow: 0 20px 48px rgba(75,112,153,.14);
        }

        .museLogo {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          border-radius: 24%;
        }

        .loginCard {
          width: 100%;
          padding: clamp(34px, 6vw, 48px) clamp(22px, 6vw, 38px) clamp(28px, 5vw, 38px);
          border-radius: 36px;
          background: rgba(255,255,255,.92);
          box-shadow: 0 18px 50px rgba(75,112,153,.13);
          text-align: center;
          backdrop-filter: blur(10px);
        }

        h1 {
          margin: 0;
          color: #244b78;
          font-size: clamp(1.42rem, 5.5vw, 1.88rem);
          font-weight: 800;
          line-height: 1.4;
          letter-spacing: .015em;
        }

        .titleLine {
          width: 66px;
          height: 5px;
          display: block;
          margin: 24px auto 21px;
          border-radius: 999px;
          background: #c8dbef;
        }

        .loginCard > p:not(.loginError) {
          margin: 0;
          color: #8496ad;
          font-size: clamp(.98rem, 4vw, 1.18rem);
          font-weight: 650;
          letter-spacing: .06em;
        }

        .lineButton {
          width: 100%;
          min-height: 68px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          margin-top: clamp(34px, 7vw, 48px);
          padding: 0 22px;
          border-radius: 24px;
          background: linear-gradient(135deg, #477daf 0%, #6b9acb 100%);
          color: #fff;
          font-size: clamp(1rem, 4.5vw, 1.2rem);
          text-decoration: none;
          box-shadow: 0 12px 26px rgba(66,113,160,.24);
          transition: transform .15s ease, box-shadow .15s ease, filter .15s ease;
        }
        .lineButton:hover { filter: brightness(1.025); box-shadow: 0 15px 30px rgba(66,113,160,.29); transform: translateY(-1px); }
        .lineButton:active { transform: scale(.99); }
        .lineButton strong { font-weight: 850; letter-spacing: .035em; }

        .lineMark {
          position: relative;
          flex: 0 0 auto;
          min-width: 50px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: #fff;
          color: #4f7fae;
          font-size: .68rem;
          font-weight: 950;
          letter-spacing: -.03em;
        }
        .lineMark::after {
          content: '';
          position: absolute;
          left: 10px;
          bottom: -7px;
          border-top: 9px solid #fff;
          border-right: 9px solid transparent;
          transform: rotate(8deg);
        }

        .buttonLine { width: 1px; height: 34px; background: rgba(255,255,255,.45); }

        .lineButton:focus-visible,
        .privateTrigger:focus-visible,
        .privateForm input:focus-visible,
        .privateForm button:focus-visible {
          outline: 3px solid rgba(127,177,232,.46);
          outline-offset: 3px;
        }

        .loginError, .privateError {
          margin: 15px 0 0 !important;
          color: #b34d60 !important;
          font-size: .82rem !important;
          font-weight: 800 !important;
          line-height: 1.55;
          letter-spacing: 0 !important;
        }

        .privateArea {
          width: min(100%, 430px);
          min-height: 30px;
          margin-top: -38px;
          text-align: center;
        }

        .privateTrigger {
          min-width: 44px;
          height: 30px;
          padding: 0 10px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: #b5c4d5;
          font-size: .76rem;
          font-weight: 900;
          letter-spacing: .12em;
          cursor: pointer;
        }
        .privateTrigger:hover { background: rgba(255,255,255,.66); color: #8da3bd; }

        .privateForm {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 88px;
          gap: 9px;
          margin-top: 8px;
          padding: 12px;
          border-radius: 17px;
          background: rgba(255,255,255,.9);
          box-shadow: 0 10px 28px rgba(75,112,153,.11);
        }
        .privateForm input, .privateForm button {
          min-height: 44px;
          border: 0;
          border-radius: 12px;
          font: inherit;
        }
        .privateForm input {
          min-width: 0;
          padding: 0 13px;
          background: #fff;
          color: #315d91;
          box-shadow: inset 0 0 0 1px #dce8f5;
        }
        .privateForm input::placeholder { color: #9bacc0; }
        .privateForm button {
          padding: 0 12px;
          background: #8fb5dc;
          color: #fff;
          font-weight: 900;
          cursor: pointer;
        }
        .privateForm button:disabled { cursor: default; opacity: .55; }
        .privateError { grid-column: 1 / -1; margin-top: 0 !important; }

        @media (max-width: 520px) {
          .loginPage { padding: 24px 14px 14px; }
          .loginShell { gap: 34px; }
          .logoFrame { width: min(52vw, 206px); }
          .loginCard { padding: 34px 20px 28px; border-radius: 29px; }
          .lineButton { min-height: 64px; gap: 13px; padding: 0 16px; border-radius: 21px; }
          .lineMark { min-width: 45px; height: 33px; }
          .privateArea { margin-top: -24px; }
          .privateForm { grid-template-columns: minmax(0, 1fr) 80px; padding: 10px; }
        }

        @media (max-height: 700px) {
          .loginPage { align-items: start; overflow-y: auto; padding-top: 20px; }
          .loginShell { gap: 24px; }
          .logoFrame { width: 156px; }
          .loginCard { padding-top: 28px; padding-bottom: 24px; }
          .lineButton { margin-top: 28px; }
          .privateArea { margin-top: -14px; }
        }
      `}</style>
    </main>
  );
}

function LoginLoading() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#f3f8fe', color: '#6f8daf', fontFamily: 'sans-serif' }}>
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
