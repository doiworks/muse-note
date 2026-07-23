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
          <button className="compactError" type="button" onClick={() => void loadOverview()}>{error}</button>
        ) : !summary ? (
          <span className="compactLoading">読み込み中</span>
        ) : (
          <>
            <div className="compactMetric"><span>進捗</span><b>{summary.progress_percent}%</b></div>
            <div className="compactDivider" />
            <div className="compactMetric"><span>正解率</span><b>{summary.accuracy}%</b></div>
            <button className="detailsButton" type="button" onClick={() => setDetailsOpen(true)} aria-label="詳細分析を開く">▶</button>
          </>
        )}
      </section>

      {detailsOpen && summary && createPortal(
        <div className="analyticsOverlay" role="dialog" aria-modal="true" aria-label="詳細分析" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDetailsOpen(false);
        }}>
          <section className="analyticsPanel">
            <header className="analyticsHeader">
              <div><strong>詳細分析</strong><span>LINEユーザー別</span></div>
              <div className="analyticsHeaderActions">
                <button type="button" onClick={() => void loadOverview()} disabled={loading}>{loading ? '更新中' : '更新'}</button>
                <button className="closeButton" type="button" onClick={() => setDetailsOpen(false)} aria-label="閉じる">×</button>
              </div>
            </header>

            <div className="summaryGrid">
              <div><span>学習済み</span><b>{summary.studied_words} / {summary.total_words}語</b></div>
              <div><span>総回答</span><b>{summary.total_answers}回</b></div>
              <div><span>正解</span><b>{summary.correct_answers}回</b></div>
              <div><span>間違い</span><b>{summary.wrong_answers}回</b></div>
              <div><span>苦手</span><b>{summary.weak_words}語</b></div>
              <div><span>直近7日</span><b>{summary.active_days_7}日学習</b></div>
            </div>

            <section className="analysisSection">
              <h3>直近7日</h3>
              <div className="dailyGrid">
                {dailyActivity.map((item) => (
                  <div key={item.date}>
                    <span>{formatDate(item.date)}</span>
                    <b>{item.answers}問</b>
                    <small>{item.answers ? `正解率 ${item.accuracy}%` : '学習なし'}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="analysisSection">
              <h3>学年別の進み具合</h3>
              <div className="gradeList">
                {gradeAnalysis.map((item) => (
                  <div className="gradeRow" key={item.grade}>
                    <div><strong>{item.grade}</strong><span>{item.studied_words} / {item.total_words}語</span></div>
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
                    <div className="weakWordMeta"><b>{item.mistake_count}回</b><span>最終 {formatDate(item.last_wrong_at)}</span></div>
                  </div>
                )) : <p className="weakWordEmpty">間違えた単語はまだありません。</p>}
              </div>
            </section>
          </section>
        </div>,
        document.body
      )}

      <style jsx>{`
        .learningOverviewCompact { min-height:42px; margin:0 0 .45rem; padding:5px 7px 5px 12px; display:flex; align-items:center; justify-content:center; gap:12px; border:1px solid #d9e7f7; border-radius:12px; background:#fff; box-shadow:0 4px 12px rgba(73,112,160,.06); }
        .compactMetric { display:flex; align-items:baseline; gap:5px; white-space:nowrap; }
        .compactMetric span { color:#7b8ba0; font-size:.74rem; }
        .compactMetric b { color:#3f5f88; font-size:1rem; }
        .compactDivider { width:1px; height:22px; background:#e3ebf4; }
        .detailsButton { width:32px; height:32px; margin-left:auto; border:1px solid #c8dcf3; border-radius:50%; background:#f7fbff; color:#4f6b94; font-weight:800; }
        .compactLoading,.compactError { color:#7b8ba0; font-size:.78rem; }
        .compactError { border:0; background:transparent; color:#c62828; }
        .analyticsOverlay { position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; padding:14px; background:rgba(20,34,52,.45); backdrop-filter:blur(4px); }
        .analyticsPanel { width:min(760px,100%); max-height:min(88vh,820px); overflow:auto; padding:16px; border-radius:18px; background:#f8fbff; box-shadow:0 24px 70px rgba(16,31,49,.3); }
        .analyticsHeader { position:sticky; top:-16px; z-index:2; display:flex; align-items:center; justify-content:space-between; gap:12px; margin:-16px -16px 14px; padding:14px 16px; border-bottom:1px solid #e2ebf5; background:rgba(248,251,255,.96); }
        .analyticsHeader > div:first-child { display:flex; flex-direction:column; }
        .analyticsHeader strong { color:#334f75; font-size:1.1rem; }
        .analyticsHeader span { color:#8292a8; font-size:.72rem; }
        .analyticsHeaderActions { display:flex; gap:7px; }
        .analyticsHeaderActions button { min-height:34px; border:1px solid #c8dcf3; border-radius:999px; padding:0 12px; background:#fff; color:#4f6b94; font-weight:700; }
        .analyticsHeaderActions .closeButton { width:34px; padding:0; font-size:1.25rem; }
        .summaryGrid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
        .summaryGrid div { padding:10px 6px; border-radius:12px; background:#fff; text-align:center; box-shadow:0 3px 10px rgba(73,112,160,.06); }
        .summaryGrid span,.summaryGrid b { display:block; }
        .summaryGrid span { color:#7c8ca3; font-size:.72rem; }
        .summaryGrid b { margin-top:3px; color:#3f5f88; font-size:.95rem; }
        .analysisSection { margin-top:16px; }
        .analysisSection h3 { margin:0 0 8px; color:#465f81; font-size:.9rem; }
        .dailyGrid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:5px; }
        .dailyGrid div { min-width:0; padding:8px 3px; border-radius:10px; background:#fff; text-align:center; }
        .dailyGrid span,.dailyGrid b,.dailyGrid small { display:block; }
        .dailyGrid span { color:#7f8fa5; font-size:.66rem; }
        .dailyGrid b { margin-top:3px; color:#3f5f88; font-size:.82rem; }
        .dailyGrid small { margin-top:2px; color:#8b98a9; font-size:.61rem; }
        .gradeList { overflow:hidden; border-radius:12px; background:#fff; }
        .gradeRow { display:grid; grid-template-columns:105px minmax(80px,1fr) 95px; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #edf2f8; }
        .gradeRow:last-child { border-bottom:0; }
        .gradeRow strong,.gradeRow span { display:block; }
        .gradeRow strong { color:#3e587c; font-size:.84rem; }
        .gradeRow span { color:#8492a5; font-size:.68rem; }
        .gradeTrack { height:8px; overflow:hidden; border-radius:999px; background:#e8f0f9; }
        .gradeTrack span { height:100%; border-radius:inherit; background:linear-gradient(90deg,#84b9eb,#69a9df); }
        .gradeNumbers { text-align:right; }
        .gradeNumbers b { color:#3f5f88; font-size:.82rem; }
        .weakWordPanel { overflow:hidden; border-radius:12px; background:#fff; }
        .weakWordRow { display:grid; grid-template-columns:28px minmax(0,1fr) auto; align-items:center; gap:8px; padding:10px; border-bottom:1px solid #edf2f8; }
        .weakWordRow:last-child { border-bottom:0; }
        .rank { display:grid; place-items:center; width:24px; height:24px; border-radius:50%; background:#eef5fc; color:#55769c; font-size:.72rem; font-weight:800; }
        .weakWordName,.weakWordMeta { min-width:0; }
        .weakWordName strong,.weakWordName span,.weakWordMeta b,.weakWordMeta span { display:block; }
        .weakWordName strong { overflow:hidden; color:#334f75; text-overflow:ellipsis; white-space:nowrap; }
        .weakWordName span,.weakWordMeta span { color:#7b8ba0; font-size:.72rem; }
        .weakWordMeta { text-align:right; }
        .weakWordMeta b { color:#c55a5a; font-size:.78rem; }
        .weakWordEmpty { margin:0; padding:18px; color:#7b8ba0; text-align:center; }
        @media (max-width:560px) {
          .analyticsOverlay { align-items:flex-end; padding:0; }
          .analyticsPanel { width:100%; max-height:92dvh; border-radius:18px 18px 0 0; }
          .summaryGrid { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .dailyGrid { grid-template-columns:repeat(7,minmax(42px,1fr)); overflow-x:auto; }
          .gradeRow { grid-template-columns:82px minmax(72px,1fr) 82px; gap:7px; }
        }
      `}</style>
    </>,
    host
  );
}
