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
  const [expanded, setExpanded] = useState(false);

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

  const summary = data?.summary;
  const weakWords = useMemo(() => data?.weak_words || [], [data]);
  if (!host) return null;

  return createPortal(
    <section className="learningOverview" aria-label="自分の学習状況">
      <div className="learningOverviewHeader">
        <div>
          <strong>自分の学習状況</strong>
          <span>LINEユーザー別</span>
        </div>
        <button type="button" onClick={() => void loadOverview()} disabled={loading}>
          {loading ? '更新中' : '更新'}
        </button>
      </div>

      {error ? (
        <p className="learningOverviewError">{error}</p>
      ) : !summary ? (
        <p className="learningOverviewLoading">学習状況を読み込んでいます</p>
      ) : (
        <>
          <div className="learningOverviewGrid">
            <div><span>学習済み</span><b>{summary.studied_words} / {summary.total_words}語</b></div>
            <div><span>進捗</span><b>{summary.progress_percent}%</b></div>
            <div><span>正解率</span><b>{summary.accuracy}%</b></div>
            <div><span>苦手</span><b>{summary.weak_words}語</b></div>
          </div>
          <div className="learningProgressTrack" aria-label={`進捗${summary.progress_percent}%`}>
            <span style={{ width: `${Math.max(0, Math.min(100, summary.progress_percent))}%` }} />
          </div>
          <div className="learningOverviewSubline">
            回答 {summary.total_answers}回　正解 {summary.correct_answers}回　間違い {summary.wrong_answers}回
          </div>
          <button className="learningOverviewToggle" type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? '苦手の詳細を閉じる' : '間違えた単語を見る'}
          </button>
          {expanded && (
            <div className="weakWordPanel">
              {weakWords.length ? weakWords.map((item) => (
                <div className="weakWordRow" key={item.word_id}>
                  <div>
                    <strong>{item.word.english}</strong>
                    <span>{item.word.japanese}</span>
                  </div>
                  <div className="weakWordMeta">
                    <b>{item.mistake_count}回間違い</b>
                    <span>最終 {formatDate(item.last_wrong_at)}</span>
                  </div>
                </div>
              )) : <p className="weakWordEmpty">間違えた単語はまだありません。</p>}
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .learningOverview { margin: 0 0 1rem; padding: 14px; border: 1px solid #d9e7f7; border-radius: 16px; background: linear-gradient(180deg,#f9fcff 0%,#fff 100%); box-shadow: 0 8px 20px rgba(73,112,160,.08); }
        .learningOverviewHeader { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .learningOverviewHeader div { display:flex; flex-direction:column; align-items:flex-start; }
        .learningOverviewHeader strong { color:#4f6b94; }
        .learningOverviewHeader span { margin-top:2px; color:#8292a8; font-size:.75rem; }
        .learningOverviewHeader button { border:1px solid #c8dcf3; border-radius:999px; padding:.35rem .7rem; background:#fff; color:#4f6b94; font-weight:700; }
        .learningOverviewGrid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; margin-top:12px; }
        .learningOverviewGrid div { min-width:0; padding:8px 5px; border-radius:11px; background:#fff; text-align:center; box-shadow:0 3px 10px rgba(73,112,160,.06); }
        .learningOverviewGrid span { display:block; color:#7c8ca3; font-size:.72rem; }
        .learningOverviewGrid b { display:block; margin-top:3px; color:#3f5f88; font-size:.95rem; white-space:nowrap; }
        .learningProgressTrack { height:8px; margin-top:10px; overflow:hidden; border-radius:999px; background:#e8f0f9; }
        .learningProgressTrack span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#84b9eb,#69a9df); }
        .learningOverviewSubline { margin-top:8px; color:#6f8199; font-size:.78rem; text-align:center; }
        .learningOverviewToggle { width:100%; min-height:40px; margin-top:10px; border:1px solid #bfd6ef; border-radius:10px; background:#fff; color:#4f6b94; font-weight:700; }
        .weakWordPanel { margin-top:8px; max-height:280px; overflow:auto; border-top:1px solid #e2ebf5; }
        .weakWordRow { display:flex; justify-content:space-between; gap:12px; padding:10px 2px; border-bottom:1px solid #edf2f8; text-align:left; }
        .weakWordRow > div:first-child { min-width:0; }
        .weakWordRow strong,.weakWordRow span { display:block; }
        .weakWordRow strong { color:#334f75; }
        .weakWordRow span { margin-top:2px; color:#7b8ba0; font-size:.78rem; }
        .weakWordMeta { flex:0 0 auto; text-align:right; }
        .weakWordMeta b { color:#c55a5a; font-size:.78rem; }
        .weakWordEmpty,.learningOverviewLoading,.learningOverviewError { margin:12px 0 0; font-size:.84rem; text-align:center; }
        .learningOverviewError { color:#c62828; }
        @media (max-width:480px) { .learningOverviewGrid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      `}</style>
    </section>,
    host
  );
}
