'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const FILTER_KEYS = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3'];
const FILTER_LABELS = {
  school_level: '学校種',
  grade: '学年',
  term: '学期',
  exam_type: 'テスト',
  category1: 'カテゴリ1',
  category2: 'カテゴリ2',
  category3: 'カテゴリ3'
};
const INITIAL_LIMIT = 20;
const PREFETCH_LIMIT = 30;
const emptyOptions = Object.fromEntries(FILTER_KEYS.map((key) => [key, []]));

function buildQueryParams(query, cursor = '0', limit = INITIAL_LIMIT) {
  const params = new URLSearchParams({ limit: String(limit), cursor });
  if (query.search) params.set('search', query.search);
  FILTER_KEYS.forEach((key) => {
    if (query[key]) params.set(key, query[key]);
  });
  if (query.importantOnly) params.set('importantOnly', 'true');
  return params;
}

function createQueryFromFilters(search, filters) {
  return {
    search: search.trim(),
    ...filters
  };
}

export default function WordPickerV2Page() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ importantOnly: false });
  const [options, setOptions] = useState(emptyOptions);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [words, setWords] = useState([]);
  const [total, setTotal] = useState(null);
  const [countLoading, setCountLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState('0');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [countError, setCountError] = useState('');
  const [listError, setListError] = useState('');
  const [selection, setSelection] = useState({ mode: 'manual', selectedIds: [], excludedIds: [], query: {} });
  const loaderRef = useRef(null);
  const requestIdRef = useRef(0);
  const renderedCountRef = useRef(0);
  const prefetchCursorRef = useRef(null);

  const query = useMemo(() => createQueryFromFilters(search, filters), [search, filters]);
  const selectedIdSet = useMemo(() => new Set(selection.selectedIds ?? []), [selection.selectedIds]);
  const excludedIdSet = useMemo(() => new Set(selection.excludedIds ?? []), [selection.excludedIds]);
  const selectedCount = selection.mode === 'allMatching'
    ? (total === null ? `全対象 - ${selection.excludedIds?.length ?? 0}` : Math.max(0, total - (selection.excludedIds?.length ?? 0)))
    : (selection.selectedIds?.length ?? 0);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    setOptionsError('');
    try {
      const response = await fetch('/api/word-picker/options', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '候補取得に失敗しました。');
      setOptions({ ...emptyOptions, ...data });
      setOptionsLoaded(true);
    } catch (error) {
      setOptionsError(error.message || '候補取得に失敗しました。');
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const loadCount = useCallback(async (requestId) => {
    setCountLoading(true);
    setCountError('');
    try {
      const response = await fetch(`/api/word-picker/count?${buildQueryParams(query, '0', 1)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '総件数取得に失敗しました。');
      if (requestIdRef.current === requestId) setTotal(data.total ?? 0);
    } catch (error) {
      if (requestIdRef.current === requestId) setCountError(error.message || '総件数取得に失敗しました。');
    } finally {
      if (requestIdRef.current === requestId) setCountLoading(false);
    }
  }, [query]);

  const fetchWords = useCallback(async ({ cursor = '0', limit = INITIAL_LIMIT, append = false, background = false, requestId = requestIdRef.current } = {}) => {
    if (background) setPrefetching(true);
    else setLoading(true);
    setListError('');

    try {
      const response = await fetch(`/api/word-picker/list?${buildQueryParams(query, cursor, limit)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '一覧取得に失敗しました。');
      if (requestIdRef.current !== requestId) return null;

      setWords((currentWords) => (append ? [...currentWords, ...(data.words ?? [])] : data.words ?? []));
      setHasMore(Boolean(data.has_more));
      setNextCursor(data.next_cursor ?? '0');
      return data;
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setListError(error.message || '一覧取得に失敗しました。');
        setHasMore(false);
      }
      return null;
    } finally {
      if (requestIdRef.current === requestId) {
        if (background) setPrefetching(false);
        else setLoading(false);
      }
    }
  }, [query]);

  const loadWords = useCallback(async ({ reset = false } = {}) => {
    const requestId = reset ? requestIdRef.current + 1 : requestIdRef.current;
    if (reset) requestIdRef.current = requestId;
    const cursor = reset ? '0' : nextCursor;
    const data = await fetchWords({ cursor, limit: INITIAL_LIMIT, append: !reset, requestId });
    if (reset && data && requestIdRef.current === requestId) loadCount(requestId);
    if (reset && data?.has_more && requestIdRef.current === requestId) {
      prefetchCursorRef.current = data.next_cursor;
      setTimeout(() => {
        if (requestIdRef.current === requestId && prefetchCursorRef.current === data.next_cursor) {
          fetchWords({ cursor: data.next_cursor, limit: PREFETCH_LIMIT, append: true, background: true, requestId });
        }
      }, 0);
    }
  }, [fetchWords, loadCount, nextCursor]);

  useEffect(() => {
    setWords([]);
    setTotal(null);
    setNextCursor('0');
    setHasMore(false);
    setSelection({ mode: 'manual', selectedIds: [], excludedIds: [], query });
    loadWords({ reset: true });
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const target = loaderRef.current;
    if (!target) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore && !loading && !prefetching && !listError) loadWords();
    }, { rootMargin: '240px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, listError, loadWords, loading, prefetching]);

  useEffect(() => {
    if (renderedCountRef.current !== words.length) {
      console.time('word-picker-v2 visible rows render');
      requestAnimationFrame(() => console.timeEnd('word-picker-v2 visible rows render'));
      renderedCountRef.current = words.length;
    }
  }, [words.length]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function selectAllMatching() {
    setSelection({ mode: 'allMatching', query, excludedIds: [], selectedIds: [] });
  }

  function clearSelection() {
    setSelection({ mode: 'manual', selectedIds: [], excludedIds: [], query });
  }

  function toggleWord(wordId) {
    setSelection((current) => {
      if (current.mode === 'allMatching') {
        const excluded = new Set(current.excludedIds ?? []);
        if (excluded.has(wordId)) excluded.delete(wordId);
        else excluded.add(wordId);
        return { ...current, excludedIds: [...excluded] };
      }

      const selected = new Set(current.selectedIds ?? []);
      if (selected.has(wordId)) selected.delete(wordId);
      else selected.add(wordId);
      return { ...current, selectedIds: [...selected] };
    });
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 1120, margin: '0 auto' }}>
      <h1>単語選択V2（検証用）</h1>
      <p style={{ color: '#555' }}>既存の単語選択画面には接続していません。全単語を対象にしつつ、初期表示は20件だけ取得します。</p>

      <section style={{ display: 'grid', gap: 12, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <label>
          検索（英字は english、日本語を含む場合は japanese のみ）
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="search" style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }} />
        </label>

        <div>
          <button type="button" onClick={loadOptions} disabled={optionsLoading}>{optionsLoaded ? 'カテゴリ候補を再読み込み' : 'カテゴリ候補を読み込む'}</button>
          {optionsLoading && <span style={{ marginLeft: 8 }}>候補読み込み中...</span>}
        </div>

        {optionsLoaded && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {FILTER_KEYS.map((key) => (
              <label key={key}>
                {FILTER_LABELS[key]}
                <select value={filters[key] ?? ''} onChange={(event) => updateFilter(key, event.target.value)} style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}>
                  <option value="">すべて</option>
                  {(options[key] ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={Boolean(filters.importantOnly)} onChange={(event) => updateFilter('importantOnly', event.target.checked)} />
          重要単語のみ
        </label>
        {optionsError && <p style={{ color: 'crimson' }}>候補エラー: {optionsError} <button onClick={loadOptions}>再試行</button></p>}
      </section>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', margin: '16px 0' }}>
        <strong>{total === null ? '対象：全単語' : `対象：全${total}語`}</strong>
        {countLoading && <span>総件数を確認中...</span>}
        {countError && <span style={{ color: 'crimson' }}>総件数エラー: {countError}</span>}
        <strong>表示中: {words.length}</strong>
        <strong>選択中: {selectedCount}</strong>
        <button onClick={selectAllMatching}>すべて選択</button>
        <button onClick={clearSelection}>選択解除</button>
        {selection.mode === 'allMatching' && <span>allMatching中（除外: {selection.excludedIds.length}件）</span>}
      </section>

      {listError && (
        <div style={{ padding: 16, border: '1px solid crimson', color: 'crimson', borderRadius: 8, marginBottom: 16 }}>
          {listError} <button onClick={() => loadWords({ reset: words.length === 0 })}>再試行</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 8 }}>
        {words.map((word) => {
          const checked = selection.mode === 'allMatching' ? !excludedIdSet.has(word.id) : selectedIdSet.has(word.id);
          return (
            <label key={word.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, padding: 12, border: '1px solid #e5e5e5', borderRadius: 8, background: checked ? '#f0f7ff' : '#fff' }}>
              <input type="checkbox" checked={checked} onChange={() => toggleWord(word.id)} />
              <span>
                <strong>{word.english}</strong> / {word.japanese} {word.phonetic ? <small>({word.phonetic})</small> : null}<br />
                <small>{[word.school_level, word.grade, word.term, word.exam_type, word.category1, word.category2, word.category3].filter(Boolean).join(' / ')} {Number(word.importance) === 1 ? '★' : ''}</small>
              </span>
            </label>
          );
        })}
      </div>

      {loading && <p>読み込み中...</p>}
      {prefetching && <p style={{ color: '#666' }}>次の30件を先読み中...</p>}
      <div ref={loaderRef} style={{ height: 32 }} />
      {!loading && !prefetching && !hasMore && !listError && words.length > 0 && <p style={{ color: '#666' }}>これ以上の単語はありません。</p>}
    </main>
  );
}
