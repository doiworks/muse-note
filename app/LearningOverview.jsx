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

function AnalysisGlyph() {
  return (
    <span className="analysisGlyph" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
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

function getPreferredEnglishVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferredNames = ['Samantha', 'Karen', 'Victoria', 'Google UK English Female', 'Google US English Female', 'Zira', 'female'];
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith('en') && preferredNames.some((name) => voice.name.includes(name))) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith('en') && voice.name.toLowerCase().includes('female')) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ||
    null
  );
}

function speakEnglish(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getPreferredEnglishVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = 'en-US';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn('Speech synthesis failed:', error);
  }
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
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
          <button className="compactError" type="button" onClick={() => void loadOverview()}>学習状況を再読み込み</button>
        ) : !summary ? (
          <span className="compactLoading">学習状況を読み込み中…</span>
        ) : (
          <div className="overviewCard">
            <div className="compactMetric">
              <span>進捗</span>
              <b>{summary.progress_percent}%</b>
            </div>
            <div className="compactMetric">
              <span>正解率</span>
              <b>{summary.accuracy}%</b>
            </div>
            <button className="detailsButton" type="button" onClick={() => setDetailsOpen(true)} aria-label="詳細分析を開く">
              <AnalysisGlyph />
              <span>分析</span>
            </button>
          </div>
        )}
      </section>

      {detailsOpen && summary && createPortal(
        <div className="analyticsOverlay" role="dialog" aria-modal="true" aria-label="詳細分析" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDetailsOpen(false);
        }}>
          <section className="analyticsPanel">
            <header className="analyticsHeader">
              <div>
                <span className="analyticsEyebrow">LEARNING REPORT</span>
                <strong>詳細分析</strong>
              </div>
              <div className="analyticsHeaderActions">
                <button className="refreshButton" type="button" onClick={() => void loadOverview()} disabled={loading}>{loading ? '更新中' : '更新'}</button>
                <button className="closeButton" type="button" onClick={() => setDetailsOpen(false)}>閉じる</button>
              </div>
            </header>

            <div className="summaryGrid">
              <div className="summaryCard"><span>学習済み</span><b>{summary.studied_words} / {summary.total_words}語</b></div>
              <div className="summaryCard"><span>総回答</span><b>{summary.total_answers}回</b></div>
              <div className="summaryCard"><span>正解</span><b>{summary.correct_answers}回</b></div>
              <div className="summaryCard"><span>間違い</span><b>{summary.wrong_answers}回</b></div>
              <div className="summaryCard"><span>苦手</span><b>{summary.weak_words}語</b></div>
              <div className="summaryCard"><span>直近7日</span><b>{summary.active_days_7}日</b></div>
            </div>

            <section className="analysisSection">
              <h3>直近7日</h3>
              <div className="dailyGrid">
                {dailyActivity.map((item) => (
                  <div className="dailyCard" key={item.date}>
                    <span>{formatDate(item.date)}</span>
                    <b>{item.answers}問</b>
                    <small>{item.answers ? `正解率 ${item.accuracy}%` : '学習なし'}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="analysisSection">
              <h3>学年別</h3>
              <div className="gradeList">
                {gradeAnalysis.map((item) => (
                  <div className="gradeRow" key={item.grade}>
                    <div className="gradeLabel">
                      <strong>{item.grade}</strong>
                      <span>{item.studied_words} / {item.total_words}語</span>
                    </div>
                    <div className="gradeTrack"><span style={{ width: `${Math.max(0, Math.min(100, item.progress_percent))}%` }} /></div>
                    <div className="gradeNumbers">
                      <b>進捗 {item.progress_percent}%</b>
                      <span>正解率 {item.accuracy}%</span>
                    </div>
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
                    <div className="weakWordName">
                      <strong>{item.word.english}</strong>
                      <span>{item.word.japanese}</span>
                    </div>
                    <div className="weakWordMeta">
                      <b>{item.mistake_count}回</b>
                      <span>{formatDate(item.last_wrong_at)}</span>
                    </div>
                    <button className="speakButton" type="button" onClick={() => speakEnglish(item.word.english)} aria-label={`${item.word.english}を発音`} title="発音を聞く"><SpeakerIcon /></button>
                  </div>
                )) : <p className="weakWordEmpty">間違えた単語はまだありません。</p>}
              </div>
            </section>
          </section>
        </div>,
        document.body
      )}

      <style jsx>{`
        :global(.learningOverviewHost) {
          width: 100%;
        }

        .learningOverviewCompact {
          width: 100%;
          margin: .3rem 0 .65rem;
          color: #42658d;
        }

        .overviewCard {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
          align-items: stretch;
          gap: 8px;
          width: 100%;
          padding: 8px;
          border-radius: 20px;
          background: linear-gradient(180deg, #f7fbff 0%, #edf6ff 100%);
          box-shadow: 0 7px 18px rgba(72, 113, 158, .13);
        }

        .compactMetric {
          min-width: 0;
          min-height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 15px;
          background: #ffffff;
          box-shadow: 0 3px 10px rgba(72, 113, 158, .10);
        }

        .compactMetric span {
          color: #6f8daf;
          font-size: .78rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .compactMetric b {
          color: #315d91;
          font-size: 1.35rem;
          font-weight: 900;
          line-height: 1;
          white-space: nowrap;
        }

        .detailsButton {
          min-width: 78px;
          min-height: 58px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 0;
          border-radius: 15px;
          background: linear-gradient(180deg, #a9caf0 0%, #8db7e6 100%);
          color: #ffffff;
          font-size: .82rem;
          font-weight: 900;
          box-shadow: 0 4px 11px rgba(74, 125, 181, .24);
          cursor: pointer;
        }

        .detailsButton:active {
          transform: scale(.98);
        }

        .analysisGlyph {
          height: 18px;
          display: inline-flex;
          align-items: flex-end;
          gap: 2px;
        }

        .analysisGlyph i {
          width: 3px;
          display: block;
          border-radius: 999px;
          background: currentColor;
        }

        .analysisGlyph i:nth-child(1) { height: 7px; }
        .analysisGlyph i:nth-child(2) { height: 12px; }
        .analysisGlyph i:nth-child(3) { height: 17px; }

        .compactLoading,
        .compactError {
          width: 100%;
          min-height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 18px;
          background: #edf6ff;
          color: #42658d;
          font-size: .78rem;
          font-weight: 800;
        }

        .compactError {
          cursor: pointer;
        }

        .analyticsOverlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(36, 76, 119, .31);
          backdrop-filter: blur(4px);
        }

        .analyticsPanel {
          width: min(760px, 100%);
          max-height: min(90vh, 840px);
          overflow: auto;
          padding: 20px;
          border-radius: 26px;
          background: linear-gradient(180deg, #ffffff 0%, #f4f9ff 100%);
          box-shadow: 0 24px 70px rgba(37, 82, 132, .26);
        }

        .analyticsHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .analyticsHeader > div:first-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .analyticsEyebrow {
          color: #8aa4c1;
          font-size: .62rem;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .analyticsHeader strong {
          color: #315d91;
          font-size: 1.25rem;
          font-weight: 900;
        }

        .analyticsHeaderActions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .analyticsHeaderActions button {
          min-height: 40px;
          border: 0;
          border-radius: 13px;
          font-size: .78rem;
          font-weight: 900;
          cursor: pointer;
        }

        .refreshButton {
          padding: 0 15px;
          background: #e8f3ff;
          color: #315d91;
        }

        .closeButton {
          padding: 0 15px;
          background: linear-gradient(180deg, #a9caf0 0%, #8db7e6 100%);
          color: #ffffff;
          box-shadow: 0 4px 11px rgba(74, 125, 181, .20);
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .summaryCard,
        .dailyCard,
        .gradeRow,
        .weakWordRow {
          background: #ffffff;
          box-shadow: 0 6px 17px rgba(72, 113, 158, .11);
        }

        .summaryCard {
          min-width: 0;
          padding: 15px 10px;
          border-radius: 18px;
          text-align: center;
        }

        .summaryCard span,
        .summaryCard b {
          display: block;
        }

        .summaryCard span {
          color: #7793b3;
          font-size: .72rem;
          font-weight: 800;
        }

        .summaryCard b {
          margin-top: 5px;
          color: #315d91;
          font-size: 1rem;
          font-weight: 900;
        }

        .analysisSection {
          margin-top: 22px;
        }

        .analysisSection h3 {
          margin: 0 0 11px;
          color: #315d91;
          font-size: .95rem;
          font-weight: 900;
        }

        .dailyGrid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
        }

        .dailyCard {
          min-width: 0;
          padding: 12px 4px;
          border-radius: 16px;
          text-align: center;
        }

        .dailyCard span,
        .dailyCard b,
        .dailyCard small {
          display: block;
        }

        .dailyCard span {
          color: #7895b6;
          font-size: .65rem;
          font-weight: 800;
        }

        .dailyCard b {
          margin-top: 5px;
          color: #315d91;
          font-size: .84rem;
          font-weight: 900;
        }

        .dailyCard small {
          margin-top: 4px;
          color: #6b88aa;
          font-size: .6rem;
          font-weight: 800;
        }

        .gradeList,
        .weakWordPanel {
          display: grid;
          gap: 10px;
        }

        .gradeRow {
          display: grid;
          grid-template-columns: 105px minmax(90px, 1fr) 110px;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 18px;
        }

        .gradeLabel strong,
        .gradeLabel span,
        .gradeNumbers b,
        .gradeNumbers span {
          display: block;
        }

        .gradeLabel strong {
          color: #315d91;
          font-size: .88rem;
          font-weight: 900;
        }

        .gradeLabel span,
        .gradeNumbers span {
          color: #7895b6;
          font-size: .68rem;
          font-weight: 800;
        }

        .gradeTrack {
          height: 9px;
          overflow: hidden;
          border-radius: 999px;
          background: #e2effb;
        }

        .gradeTrack span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #83b4e3 0%, #4f91cd 100%);
        }

        .gradeNumbers {
          text-align: right;
        }

        .gradeNumbers b {
          color: #315d91;
          font-size: .78rem;
          font-weight: 900;
        }

        .weakWordRow {
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr) auto 42px;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 18px;
        }

        .rank {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #e5f1fd;
          color: #315d91;
          font-size: .72rem;
          font-weight: 900;
        }

        .weakWordName,
        .weakWordMeta {
          min-width: 0;
        }

        .weakWordName strong,
        .weakWordName span,
        .weakWordMeta b,
        .weakWordMeta span {
          display: block;
        }

        .weakWordName strong {
          overflow: hidden;
          color: #315d91;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: .9rem;
          font-weight: 900;
        }

        .weakWordName span,
        .weakWordMeta span {
          color: #7895b6;
          font-size: .68rem;
          font-weight: 800;
        }

        .weakWordMeta {
          text-align: right;
        }

        .weakWordMeta b {
          color: #315d91;
          font-size: .76rem;
          font-weight: 900;
        }

        .speakButton {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 14px;
          background: #e8f3ff;
          color: #315d91;
          box-shadow: 0 3px 9px rgba(72, 113, 158, .11);
          cursor: pointer;
        }

        .speakButton svg {
          width: 19px;
          height: 19px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.7;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .weakWordEmpty {
          margin: 0;
          padding: 20px;
          border-radius: 18px;
          background: #ffffff;
          color: #7895b6;
          text-align: center;
          font-weight: 800;
          box-shadow: 0 6px 17px rgba(72, 113, 158, .11);
        }

        @media (max-width: 560px) {
          .overviewCard {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 74px;
            gap: 6px;
            padding: 7px;
            border-radius: 18px;
          }

          .compactMetric {
            min-height: 54px;
            flex-direction: column;
            gap: 2px;
            border-radius: 14px;
          }

          .compactMetric span {
            font-size: .68rem;
          }

          .compactMetric b {
            font-size: 1.15rem;
          }

          .detailsButton {
            min-width: 74px;
            min-height: 54px;
            flex-direction: column;
            gap: 3px;
            border-radius: 14px;
            font-size: .7rem;
          }

          .analysisGlyph {
            height: 15px;
          }

          .analysisGlyph i:nth-child(1) { height: 6px; }
          .analysisGlyph i:nth-child(2) { height: 10px; }
          .analysisGlyph i:nth-child(3) { height: 15px; }

          .analyticsOverlay {
            align-items: flex-end;
            padding: 0;
          }

          .analyticsPanel {
            width: 100%;
            max-height: 92dvh;
            padding: 17px 16px 24px;
            border-radius: 26px 26px 0 0;
          }

          .analyticsHeader {
            align-items: flex-start;
          }

          .analyticsHeaderActions {
            gap: 6px;
          }

          .analyticsHeaderActions button {
            min-height: 38px;
            padding: 0 12px;
          }

          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .summaryCard {
            padding: 13px 8px;
            border-radius: 16px;
          }

          .dailyGrid {
            grid-template-columns: repeat(7, minmax(76px, 1fr));
            overflow-x: auto;
            padding: 2px 1px 8px;
          }

          .gradeRow {
            grid-template-columns: 82px minmax(65px, 1fr) 92px;
            gap: 9px;
            padding: 13px 12px;
            border-radius: 16px;
          }

          .weakWordRow {
            grid-template-columns: 32px minmax(0, 1fr) auto 38px;
            gap: 8px;
            padding: 11px 12px;
            border-radius: 16px;
          }

          .rank {
            width: 28px;
            height: 28px;
          }

          .speakButton {
            width: 38px;
            height: 38px;
          }
        }
      `}</style>
    </>,
    host
  );
}
