'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
}

function AnalyticsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 19V11M12 19V5M19 19v-8" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 10v4h3l4 3V7L8 10H5Z" />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 7a7 7 0 0 1 0 10" />
    </svg>
  );
}

function speakEnglish(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.85;
  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find((voice) => voice.lang === 'en-US')
    || voices.find((voice) => voice.lang?.toLowerCase().startsWith('en'));
  if (englishVoice) utterance.voice = englishVoice;
  window.speechSynthesis.speak(utterance);
}

export default function LearningOverview() {
  const [host, setHost] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  async function loadOverview() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/learning-overview', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '学習状況を取得できませんでした。');
      setData(result);
    } catch (caught) {
      setError(caught.message || '学習状況を取得できませんでした。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let portalHost = null;
    const attach = () => {
      const intro = document.querySelector('.intro');
      if (!intro) {
        if (portalHost?.isConnected) portalHost.remove();
        portalHost = null;
        setHost(null);
        return;
      }
      if (portalHost?.isConnected) return;
      portalHost = document.createElement('div');
      portalHost.className = 'learningOverviewHost';
      const greeting = intro.querySelector('.userGreeting');
      if (greeting?.nextSibling) intro.insertBefore(portalHost, greeting.nextSibling);
      else intro.appendChild(portalHost);
      setHost(portalHost);
      void loadOverview();
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    const handleFocus = () => {
      if (document.querySelector('.intro')) void loadOverview();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      observer.disconnect();
      window.removeEventListener('focus', handleFocus);
      portalHost?.remove();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!detailsOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDetailsOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
      window.speechSynthesis?.cancel();
    };
  }, [detailsOpen]);

  const summary = data?.summary;
  const weakWords = useMemo(() => data?.weak_words || [], [data]);
  const dailyActivity = useMemo(() => data?.daily_activity || [], [data]);
  const gradeAnalysis = useMemo(() => data?.grade_analysis || [], [data]);
  if (!host) return null;

  return createPortal(
    <>
      <section className="learningOverviewCompact" aria-label="学習状況">
        {error ? (
          <button className="compactError" type="button" onClick={() => void loadOverview()}>再読み込み</button>
        ) : !summary ? (
          <span className="compactLoading">読み込み中</span>
        ) : (
          <>
            <div className="compactMetric"><span>進捗</span><b>{summary.progress_percent}%</b></div>
            <span className="compactSeparator" aria-hidden="true" />
            <div className="compactMetric"><span>正解率</span><b>{summary.accuracy}%</b></div>
            <button className="detailsButton" type="button" onClick={() => setDetailsOpen(true)} aria-label="詳細分析を開く">
              <AnalyticsIcon />
              <span>分析</span>
            </button>
          </>
        )}
      </section>

      {detailsOpen && summary && createPortal(
        <div className="analyticsOverlay" role="dialog" aria-modal="true" aria-label="詳細分析" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDetailsOpen(false);
        }}>
          <section className="analyticsPanel">
            <header className="analyticsHeader">
              <strong>詳細分析</strong>
              <div className="analyticsHeaderActions">
                <button className="refreshButton" type="button" onClick={() => void loadOverview()} disabled={loading}>
                  {loading ? '更新中' : '更新'}
                </button>
                <button className="closeButton" type="button" onClick={() => setDetailsOpen(false)} aria-label="閉じる">×</button>
              </div>
            </header>

            <div className="summaryGrid">
              <div><span>学習済み</span><b>{summary.studied_words} / {summary.total_words}語</b></div>
              <div><span>総回答</span><b>{summary.total_answers}回</b></div>
              <div><span>正解</span><b>{summary.correct_answers}回</b></div>
              <div><span>間違い</span><b>{summary.wrong_answers}回</b></div>
              <div><span>苦手</span><b>{summary.weak_words}語</b></div>
              <div><span>直近7日</span><b>{summary.active_days_7}日</b></div>
            </div>

            <section className="analysisSection">
              <h3>直近7日</h3>
              <div className="dailyGrid">
                {dailyActivity.map((item) => (
                  <div key={item.date}>
                    <span>{formatDate(item.date)}</span>
                    <b>{item.answers}問</b>
                    <small>{item.answers ? `${item.accuracy}%` : '—'}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="analysisSection">
              <h3>学年別</h3>
              <div className="gradeList">
                {gradeAnalysis.map((item) => (
                  <div className="gradeRow" key={item.grade}>
                    <div className="gradeLabel"><strong>{item.grade}</strong><span>{item.studied_words} / {item.total_words}語</span></div>
                    <div className="gradeTrack"><span style={{ width: `${Math.max(0, Math.min(100, item.progress_percent))}%` }} /></div>
                    <div className="gradeNumbers"><b>{item.progress_percent}%</b><span>正解率 {item.accuracy}%</span></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="analysisSection">
              <h3>苦手単語ランキング</h3>
              <div className="weakWordPanel">
                {weakWords.length ? weakWords.map((item, index) => (
                  <div className="weakWordRow" key={item.word_id}>
                    <span className="rank">{index + 1}</span>
                    <div className="weakWordName"><strong>{item.word.english}</strong><span>{item.word.japanese}</span></div>
                    <button className="speakButton" type="button" onClick={() => speakEnglish(item.word.english)} aria-label={`${item.word.english}を発音`} title="発音を聞く">
                      <SpeakerIcon />
                    </button>
                    <div className="weakWordMeta"><b>{item.mistake_count}回</b><span>{formatDate(item.last_wrong_at)}</span></div>
                  </div>
                )) : <p className="weakWordEmpty">間違えた単語はまだありません。</p>}
              </div>
            </section>
          </section>
        </div>,
        document.body
      )}

      <style jsx>{`
        .learningOverviewCompact {
          min-height: 34px;
          margin: 0 0 .35rem;
          padding: 2px 0 6px;
          display: flex;
          align-items: center;
          gap: 9px;
          border-bottom: 1px solid #e7ebf0;
          background: transparent;
        }
        .compactMetric { display: flex; align-items: baseline; gap: 4px; white-space: nowrap; }
        .compactMetric span { color: #7b8490; font-size: .7rem; letter-spacing: .02em; }
        .compactMetric b { color: #26384b; font-size: .92rem; font-weight: 700; }
        .compactSeparator { width: 1px; height: 14px; background: #dfe4ea; }
        .detailsButton {
          min-height: 28px;
          margin-left: auto;
          padding: 0 8px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: 1px solid #d7dde5;
          border-radius: 8px;
          background: #fff;
          color: #536779;
          font-size: .7rem;
          font-weight: 700;
          letter-spacing: .02em;
        }
        .detailsButton:hover { border-color: #9fb3c8; color: #315b82; }
        .detailsButton svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
        .compactLoading,.compactError { color: #7b8490; font-size: .74rem; }
        .compactError { border: 0; background: transparent; color: #536779; text-decoration: underline; }

        .analyticsOverlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(24, 31, 40, .42);
          backdrop-filter: blur(3px);
        }
        .analyticsPanel {
          width: min(720px, 100%);
          max-height: min(88vh, 820px);
          overflow: auto;
          padding: 0 20px 22px;
          border: 1px solid rgba(255, 255, 255, .75);
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 18px 50px rgba(20, 29, 39, .22);
        }
        .analyticsHeader {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 0 -20px 18px;
          padding: 15px 20px;
          border-bottom: 1px solid #e8ebef;
          background: rgba(255, 255, 255, .96);
          backdrop-filter: blur(8px);
        }
        .analyticsHeader strong { color: #202b36; font-size: 1rem; letter-spacing: .02em; }
        .analyticsHeaderActions { display: flex; align-items: center; gap: 5px; }
        .analyticsHeaderActions button {
          min-height: 32px;
          border: 1px solid #dce1e7;
          border-radius: 8px;
          background: #fff;
          color: #526273;
          font-weight: 700;
        }
        .refreshButton { padding: 0 10px; font-size: .72rem; }
        .closeButton { width: 32px; padding: 0; font-size: 1.15rem; line-height: 1; }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          border-top: 1px solid #e7ebef;
          border-left: 1px solid #e7ebef;
        }
        .summaryGrid div {
          min-width: 0;
          padding: 11px 8px;
          border-right: 1px solid #e7ebef;
          border-bottom: 1px solid #e7ebef;
          background: #fff;
          text-align: center;
        }
        .summaryGrid span,.summaryGrid b { display: block; }
        .summaryGrid span { color: #7b8490; font-size: .68rem; }
        .summaryGrid b { margin-top: 3px; color: #26384b; font-size: .9rem; }

        .analysisSection { margin-top: 22px; }
        .analysisSection h3 {
          margin: 0 0 9px;
          color: #344454;
          font-size: .82rem;
          font-weight: 700;
          letter-spacing: .04em;
        }
        .dailyGrid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          border-top: 1px solid #e7ebef;
          border-left: 1px solid #e7ebef;
        }
        .dailyGrid div {
          min-width: 0;
          padding: 8px 3px;
          border-right: 1px solid #e7ebef;
          border-bottom: 1px solid #e7ebef;
          text-align: center;
        }
        .dailyGrid span,.dailyGrid b,.dailyGrid small { display: block; }
        .dailyGrid span { color: #858e98; font-size: .62rem; }
        .dailyGrid b { margin-top: 3px; color: #31465a; font-size: .78rem; }
        .dailyGrid small { margin-top: 2px; color: #6e7f90; font-size: .62rem; }

        .gradeList,.weakWordPanel { border-top: 1px solid #e7ebef; }
        .gradeRow {
          display: grid;
          grid-template-columns: 100px minmax(80px, 1fr) 90px;
          align-items: center;
          gap: 12px;
          padding: 11px 2px;
          border-bottom: 1px solid #e7ebef;
        }
        .gradeLabel strong,.gradeLabel span,.gradeNumbers b,.gradeNumbers span { display: block; }
        .gradeLabel strong { color: #314253; font-size: .8rem; }
        .gradeLabel span,.gradeNumbers span { color: #84909c; font-size: .66rem; }
        .gradeTrack { height: 5px; overflow: hidden; border-radius: 999px; background: #e9edf1; }
        .gradeTrack span { display: block; height: 100%; border-radius: inherit; background: #547da3; }
        .gradeNumbers { text-align: right; }
        .gradeNumbers b { color: #31465a; font-size: .78rem; }

        .weakWordRow {
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) 34px auto;
          align-items: center;
          gap: 9px;
          padding: 10px 2px;
          border-bottom: 1px solid #e7ebef;
        }
        .rank { color: #7c8792; font-size: .7rem; font-weight: 700; text-align: center; }
        .weakWordName,.weakWordMeta { min-width: 0; }
        .weakWordName strong,.weakWordName span,.weakWordMeta b,.weakWordMeta span { display: block; }
        .weakWordName strong { overflow: hidden; color: #26384b; text-overflow: ellipsis; white-space: nowrap; }
        .weakWordName span,.weakWordMeta span { color: #7f8a95; font-size: .68rem; }
        .weakWordMeta { text-align: right; }
        .weakWordMeta b { color: #405b74; font-size: .74rem; }
        .speakButton {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border: 1px solid #dce2e8;
          border-radius: 50%;
          background: #fff;
          color: #516a80;
        }
        .speakButton:hover { border-color: #9fb2c4; color: #315b82; }
        .speakButton svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
        .weakWordEmpty { margin: 0; padding: 18px; color: #7b8490; text-align: center; }

        @media (max-width: 560px) {
          .analyticsOverlay { align-items: flex-end; padding: 0; }
          .analyticsPanel { width: 100%; max-height: 92dvh; padding: 0 16px 20px; border-radius: 16px 16px 0 0; }
          .analyticsHeader { margin: 0 -16px 16px; padding: 13px 16px; }
          .summaryGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .dailyGrid { grid-template-columns: repeat(7, minmax(42px, 1fr)); overflow-x: auto; }
          .gradeRow { grid-template-columns: 78px minmax(70px, 1fr) 78px; gap: 8px; }
          .weakWordRow { grid-template-columns: 20px minmax(0, 1fr) 32px auto; gap: 7px; }
        }
      `}</style>
    </>,
    host
  );
}
