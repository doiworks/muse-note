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
const PAGE_SIZE = 50;
const emptyOptions = Object.fromEntries(FILTER_KEYS.map((key) => [key, []]));

function buildQueryParams(query, cursor = '0') {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), cursor });
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
  const [words, setWords] = useState([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState('0');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [listError, setListError] = useState('');
  const [selection, setSelection] = useState({ mode: 'manual', selectedIds: [], excludedIds: [], query: {} });
  const loaderRef = useRef(null);
  const requestIdRef = useRef(0);
  const renderedCountRef = useRef(0);

  const query = useMemo(() => createQueryFromFilters(search, filters), [search, filters]);
  const selectedIdSet = useMemo(() => new Set(selection.selectedIds ?? []), [selection.selectedIds]);
  const excludedIdSet = useMemo(() => new Set(selection.excludedIds ?? []), [selection.excludedIds]);
  const selectedCount = selection.mode === 'allMatching'
    ? Math.max(0, total - (selection.excludedIds?.length ?? 0))
    : (selection.selectedIds?.length ?? 0);

  const loadOptions = useCallback(async () => {
    setOptionsError('');
    try {
      const response = await fetch('/api/word-picker/options', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '候補取得に失敗しました。');
      setOptions({ ...emptyOptions, ...data });
    } catch (error) {
      setOptionsError(error.message || '候補取得に失敗しました。');
    }
  }, []);

  const loadWords = useCallback(async ({ reset = false } = {}) => {
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    const cursor = reset ? '0' : nextCursor;

    setLoading(true);
    setListError('');
    console.time('word-picker-v2 api fetch');
    try {
      const response = await fetch(`/api/word-picker/list?${buildQueryParams(query, cursor)}`, { cache: 'no-store' });
      const data = await response.json();
      console.timeEnd('word-picker-v2 api fetch');
      if (!response.ok) throw new Error(data.error || '一覧取得に失敗しました。');
      if (requestIdRef.current !== currentRequestId) return;

      console.time('word-picker-v2 render update');
      setWords((currentWords) => (reset ? data.words ?? [] : [...currentWords, ...(data.words ?? [])]));
      setTotal(data.total ?? 0);
      setHasMore(Boolean(data.has_more));
      setNextCursor(data.next_cursor ?? '0');
      requestAnimationFrame(() => console.timeEnd('word-picker-v2 render update'));
    } catch (error) {
      console.timeEnd('word-picker-v2 api fetch');
      if (requestIdRef.current === currentRequestId) {
        setListError(error.message || '一覧取得に失敗しました。');
        setHasMore(false);
      }
    } finally {
      if (requestIdRef.current === currentRequestId) setLoading(false);
    }
  }, [nextCursor, query]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    setWords([]);
    setNextCursor('0');
    setHasMore(false);
    setSelection({ mode: 'manual', selectedIds: [], excludedIds: [], query });
    loadWords({ reset: true });
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const target = loaderRef.current;
    if (!target) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore && !loading && !listError) loadWords();
    }, { rootMargin: '240px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, listError, loadWords, loading]);

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
      <p style={{ color: '#555' }}>既存の単語選択画面には接続していません。50件ずつ取得して速度と選択ロジックを確認します。</p>

      <section style={{ display: 'grid', gap: 12, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <label>
          検索（英字は english、日本語を含む場合は japanese のみ）
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="search" style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }} />
        </label>

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

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={Boolean(filters.importantOnly)} onChange={(event) => updateFilter('importantOnly', event.target.checked)} />
          重要単語のみ
        </label>
        {optionsError && <p style={{ color: 'crimson' }}>候補エラー: {optionsError} <button onClick={loadOptions}>再試行</button></p>}
      </section>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', margin: '16px 0' }}>
        <strong>全件数: {total}</strong>
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
      <div ref={loaderRef} style={{ height: 32 }} />
      {!loading && !hasMore && !listError && <p style={{ color: '#666' }}>これ以上の単語はありません。</p>}
    </main>
  );
}
