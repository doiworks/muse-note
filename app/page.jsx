'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const MODE_TIMING = {
  fast: {
    label: 'A.早い',
    nextFast: 1.5,
    nextSlow: 3,
    noInputHint1: 4,
    hintPlus3: 3,
    judgePlus4: 4
  },
  normal: {
    label: 'B.通常',
    nextFast: 1.5,
    nextSlow: 5,
    noInputHint1: 6,
    hintPlus3: 3,
    judgePlus4: 4
  },
  slow: {
    label: 'C.ゆっくり',
    nextFast: 3,
    nextSlow: 15,
    noInputHint1: 10,
    hintPlus3: 10,
    judgePlus4: 13
  }
};

const QUESTION_MODE_OPTIONS = [
  { key: 'balanced', label: '通常' },
  { key: 'wrong', label: '苦手' },
  { key: 'select', label: '選択' }
];
const MIN_CANDIDATE_FETCH = 50;
const MAX_FETCH_LIMIT = 500;
const WORD_PICKER_PAGE_SIZE = 20;
const WORD_PICKER_PREFETCH_SIZE = 30;
const WORD_PICKER_CACHE_KEY = 'muse-note:word-picker-v2:first-page';
const WORD_PICKER_CATEGORY_INDEX_CACHE_KEY = 'muse-note:word-picker-v2:category-index';

const INITIAL_GAME = {
  screen: 'intro',
  state: 'idle',
  userName: '',
  countInput: '',
  mode: 'normal',
  questionMode: 'balanced',
  words: [],
  selectableWords: [],
  selectableWordsFullyLoaded: false,
  selectedWordIds: [],
  selectionMode: 'manual',
  selectionQuery: {},
  excludedWordIds: [],
  wordSets: [],
  selectedWordSetId: '',
  selectedWordSetName: '',
  newWordSetName: '',
  wordSetMessage: '',
  wordSetMessageType: '',
  wordSetFetchError: '',
  isWordPickerOpen: false,
  pickerPanel: '',
  draftFilters: {
    school_level: [],
    grade: [],
    term: [],
    exam_type: [],
    category1: [],
    category2: [],
    category3: [],
    importantOnly: false,
    selectedOnly: false
  },
  wordSetSearch: '',
  pendingWordSetIds: [],
  wordSearchDraft: '',
  wordSearch: '',
  v2Words: [],
  v2Search: '',
  v2SearchDraft: '',
  v2NextCursor: '0',
  v2HasMore: false,
  v2Loading: false,
  v2LoadingMore: false,
  v2Error: '',
  v2Source: '',
  v2CacheNotice: '',
  v2Metrics: { source: '-', cacheMs: null, apiMs: null, renderMs: null, slow: '' },
  v2Total: null,
  categoryIndexRows: [],
  categoryIndexVersion: '',
  categoryIndexLoaded: false,
  categoryIndexLoading: false,
  categoryIndexRefreshing: false,
  categoryIndexError: '',
  categoryIndexCacheNotice: '',
  filters: {
    school_level: [],
    grade: [],
    term: [],
    exam_type: [],
    category1: [],
    category2: [],
    category3: [],
    importantOnly: false,
    selectedOnly: false
  },
  quizWords: [],
  currentIndex: 0,
  answeredCount: 0,
  correctCount: 0,
  wrongCount: 0,
  answer: '',
  result: null,
  reviewData: [],
  targetCount: 0,
  totalStart: null,
  questionStart: null,
  now: null,
  errorMessage: '',
  isLoading: false,
  showCircle: false,
  showPhonetic: false,
  wrongModeFallbackAvailable: false
};

function normalizeText(value) {
  return value ? value.normalize('NFKC').toLowerCase().trim() : '';
}
function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}
function isImportantWord(word) {
  return Number(word.importance) === 1;
}

function matchesWordFilters(word, filters, selectedWordIdSet) {
  return (
    (!filterHasValues(filters.school_level) || normalizeFilterValues(filters.school_level).includes(String(word.school_level))) &&
    (!filterHasValues(filters.grade) || normalizeFilterValues(filters.grade).includes(String(word.grade))) &&
    (!filterHasValues(filters.term) || normalizeFilterValues(filters.term).includes(String(word.term))) &&
    (!filterHasValues(filters.exam_type) || normalizeFilterValues(filters.exam_type).includes(String(word.exam_type))) &&
    (!filterHasValues(filters.category1) || normalizeFilterValues(filters.category1).includes(String(word.category1))) &&
    (!filterHasValues(filters.category2) || normalizeFilterValues(filters.category2).includes(String(word.category2))) &&
    (!filterHasValues(filters.category3) || normalizeFilterValues(filters.category3).includes(String(word.category3))) &&
    (!filters.importantOnly || isImportantWord(word)) &&
    (!filters.selectedOnly || selectedWordIdSet.has(word.id))
  );
}


function getActiveFilterEntries(filters = {}) {
  return FILTER_KEYS
    .filter((key) => filterHasValues(filters[key]))
    .flatMap((key) => normalizeFilterValues(filters[key]).map((value) => ({ key, label: FILTER_LABELS[key] || key, value })))
    .concat(filters.importantOnly ? [{ key: 'importantOnly', label: '重要', value: '重要のみ' }] : []);
}

function createSelectionQuery(search = '', filters = {}) {
  const query = { search: String(search || '').trim() };
  FILTER_KEYS.forEach((key) => {
    if (filterHasValues(filters[key])) query[key] = normalizeFilterValues(filters[key]);
  });
  query.importantOnly = Boolean(filters.importantOnly);
  return query;
}

function shuffleLocal(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatElapsed(ms, withPaddedMinutes = true) {
  if (!ms || ms < 0) return withPaddedMinutes ? '00:00' : '0:00';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const minuteText = withPaddedMinutes ? String(minutes).padStart(2, '0') : String(minutes);
  return `${minuteText}:${String(seconds).padStart(2, '0')}`;
}

function DiffText({ answer, correct }) {
  const answerChars = [...(answer || '')];
  const correctChars = [...(correct || '')];

  if (!answerChars.length) {
    return null;
  }

  return answerChars.map((userChar, index) => {
    const correctChar = correctChars[index];
    const isMatch =
      typeof correctChar === 'string' && userChar.toLowerCase() === correctChar.toLowerCase();

    return (
      <span className={isMatch ? 'matchChar' : 'missChar'} key={`${userChar}-${index}`}>
        {userChar}
      </span>
    );
  });
}

const FILTER_KEYS = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3'];
const CATEGORY_INITIAL_VISIBLE_COUNT = 12;
const CATEGORY_NEXT_KEY = {
  grade: 'category1',
  category1: 'category2',
  category2: 'category3'
};
const FILTER_LABELS = {
  school_level: '学校区分',
  grade: '学年',
  term: '学期',
  exam_type: 'テスト種別',
  category1: 'カテゴリ1',
  category2: 'カテゴリ2',
  category3: 'カテゴリ3'
};

function normalizeFilterValues(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

function filterHasValues(value) {
  return normalizeFilterValues(value).length > 0;
}

function appendMultiValueParam(params, key, value) {
  const values = normalizeFilterValues(value);
  if (values.length) params.set(key, values.join(','));
}

function rowMatchesCategoryFilters(row, filters = {}, omitKey = '') {
  if (filters.importantOnly && Number(row.importance) !== 1) return false;
  return FILTER_KEYS.every((key) => {
    if (key === omitKey) return true;
    const values = normalizeFilterValues(filters[key]);
    return values.length === 0 || values.includes(String(row[key] || ''));
  });
}

function calculateCategoryState(rows = [], filters = {}) {
  const optionsMap = Object.fromEntries(FILTER_KEYS.map((key) => [key, new Map()]));
  let total = 0;

  rows.forEach((row) => {
    const count = Number(row.count) || 0;
    if (rowMatchesCategoryFilters(row, filters)) total += count;
    FILTER_KEYS.forEach((key) => {
      if (!rowMatchesCategoryFilters(row, filters, key)) return;
      const value = String(row[key] || '').trim();
      if (!value) return;
      optionsMap[key].set(value, (optionsMap[key].get(value) || 0) + count);
    });
  });

  const options = Object.fromEntries(FILTER_KEYS.map((key) => [
    key,
    [...optionsMap[key].entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ja', { numeric: true }))
      .map(([value, count]) => ({ value, count }))
  ]));
  return { options, total };
}

function hasAnyCategoryOptions(options = {}) {
  return FILTER_KEYS.some((key) => Array.isArray(options[key]) && options[key].length > 0);
}

const WordRow = memo(function WordRow({ word, selected, isImportant, onToggle, onSpeak }) {
  const stats = word.stats;
  const attemptCount = stats?.attempt_count ?? 0;
  const statusLabel = attemptCount > 0 ? `回答${attemptCount}回` : '未出題';
  const topTags = [
    word.grade ? `G${word.grade}` : '',
    word.term ? `T${word.term}` : '',
    word.exam_type,
    word.category1,
    word.category2,
    word.category3
  ].filter(hasValue);
  const bottomTags = [isImportant ? '重要' : '', statusLabel].filter(hasValue);

  function handleSpeakerClick(event) {
    event.stopPropagation();
    onSpeak(word.english);
  }

  function handleSpeakerKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.stopPropagation();
  }

  function handleRowKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onToggle(word.id);
  }

  return (
    <div
      className={`wordRowItem ${selected ? 'selected' : ''}`}
      onClick={() => onToggle(word.id)}
      onKeyDown={handleRowKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
    >
      <span className="wordSelectionRail" aria-hidden="true" />
      <span className="wordPrimaryInfo">
        <strong className="wordEnglish">{word.english}</strong>
        <span className="wordJapanese">{word.japanese}</span>
        {word.phonetic ? <span className="wordPhonetic">{word.phonetic}</span> : null}
        <span className="srOnly">{selected ? '選択中' : '未選択'}</span>
      </span>
      <span className="wordMetaInfo" aria-label="カテゴリと状態">
        <span className="wordTagLine">
          {topTags.map((tag, index) => (
            <span className="wordTag" key={`${word.id}-top-${tag}-${index}`}>
              {tag}
            </span>
          ))}
        </span>
        <span className="wordTagLine">
          {bottomTags.map((tag, index) => (
            <span className={`wordTag ${tag === '重要' ? 'important' : ''} ${tag === '未出題' ? 'unseen' : ''}`} key={`${word.id}-bottom-${tag}-${index}`}>
              {tag}
            </span>
          ))}
        </span>
      </span>
      <span className="wordCheck" aria-hidden="true">{selected ? '✓' : ''}</span>
      <button
        className="wordSpeaker"
        onClick={handleSpeakerClick}
        onKeyDown={handleSpeakerKeyDown}
        type="button"
        aria-label={`${word.english}を発音`}
        title="発音を聞く"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          className="wordSpeakerIcon"
          aria-hidden="true"
          focusable="false"
          style={{
            width: 18,
            height: 18,
            minWidth: 18,
            minHeight: 18,
            maxWidth: 18,
            maxHeight: 18
          }}
        >
          <path d="M5 10.1v3.8h2.6l4.2 3.2V6.9l-4.2 3.2H5z" fill="#2f7fca" />
          <path
            d="M15 9.2c0.8 0.7 1.3 1.7 1.3 2.8s-0.5 2.1-1.3 2.8"
            fill="none"
            stroke="#2f7fca"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17.2 7.1c1.4 1.2 2.3 2.9 2.3 4.9s-0.9 3.7-2.3 4.9"
            fill="none"
            stroke="#2f7fca"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}, (prev, next) => prev.word === next.word && prev.selected === next.selected && prev.isImportant === next.isImportant);


export default function HomePage() {
  const router = useRouter();
  const [game, setGame] = useState(INITIAL_GAME);
  const [openCategoryKey, setOpenCategoryKey] = useState('');
  const [categorySearch, setCategorySearch] = useState({});
  const [draggingCategoryKey, setDraggingCategoryKey] = useState('');
  const [categoryVisibleCounts, setCategoryVisibleCounts] = useState({});
  const answerRef = useRef(null);
  const timersRef = useRef([]);
  const intervalRef = useRef(null);
  const voicesRef = useRef([]);
  const gameRef = useRef(INITIAL_GAME);
  const audioContextRef = useRef(null);
  const v2PrefetchRef = useRef({ key: '', promise: null, data: null });
  const v2OpenStartedAtRef = useRef(0);
  const categoryOptionsRequestIdRef = useRef(0);
  const categoryDragRef = useRef({ active: false, pending: false, key: '', value: '', mode: 'add', startX: 0, startY: 0, pointerId: null, processed: new Set() });
  const currentWord = game.quizWords[game.currentIndex] || null;
  const totalElapsed = game.now && game.totalStart ? game.now - game.totalStart : 0;
  const questionElapsed = game.now && game.questionStart ? game.now - game.questionStart : 0;
  const accuracy = game.answeredCount ? Math.round((game.correctCount / game.answeredCount) * 100) : 0;
  const selectedWordIdSet = useMemo(() => new Set(game.selectedWordIds), [game.selectedWordIds]);
  const excludedWordIdSet = useMemo(() => new Set(game.excludedWordIds), [game.excludedWordIds]);
  const normalizedWordSearch = useMemo(() => normalizeText(game.wordSearch), [game.wordSearch]);
  const keywordMatchedWords = useMemo(() => game.selectableWords.filter((word) => (
    !normalizedWordSearch ||
    ['english', 'japanese', 'phonetic', 'example', 'pos_j', 'category1', 'category2', 'category3', 'exam_type'].some((field) =>
      normalizeText(word[field]).includes(normalizedWordSearch)
    )
  )), [game.selectableWords, normalizedWordSearch]);

  const filteredWords = useMemo(() => keywordMatchedWords.filter((word) => (
    matchesWordFilters(word, game.filters, selectedWordIdSet)
  )), [keywordMatchedWords, game.filters, selectedWordIdSet]);

  const activeFilterCount = useMemo(() => getActiveFilterEntries(game.filters).length, [game.filters]);
  const categoryState = useMemo(() => calculateCategoryState(game.categoryIndexRows, game.draftFilters), [game.categoryIndexRows, game.draftFilters]);
  const draftFilterEntries = useMemo(() => getActiveFilterEntries(game.draftFilters), [game.draftFilters]);
  const selectedCount = game.selectionMode === 'allMatching'
    ? (game.v2Total === null ? 0 : Math.max(0, game.v2Total - game.excludedWordIds.length))
    : game.selectedWordIds.length;
  const selectedOnlyDisabled = selectedCount === 0;
  const shouldShowWordListEmptyState = filteredWords.length === 0;

  const normalizedWordSetSearch = useMemo(() => normalizeText(game.wordSetSearch), [game.wordSetSearch]);
  const filteredWordSets = useMemo(() => {
    if (!normalizedWordSetSearch) return game.wordSets;
    return game.wordSets.filter((setItem) => normalizeText(setItem.name).includes(normalizedWordSetSearch));
  }, [game.wordSets, normalizedWordSetSearch]);
  const pendingWordSetIdSet = useMemo(() => new Set(game.pendingWordSetIds), [game.pendingWordSetIds]);


  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    function updateVoices() {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      voicesRef.current = window.speechSynthesis.getVoices();
    }

    updateVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    if (game.screen !== 'game' || game.state === 'finished') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return undefined;
    }

    intervalRef.current = setInterval(() => {
      setGame((prev) => ({ ...prev, now: Date.now() }));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [game.screen, game.state]);

  useEffect(() => {
    if (game.screen === 'game' && game.state === 'asking') {
      answerRef.current?.focus({ preventScroll: true });
    }
  }, [game.screen, game.state, game.currentIndex]);

  useEffect(() => () => clearAllTimers(), []);

  function clearAllTimers() {
    timersRef.current.forEach((timerId) => clearTimeout(timerId));
    timersRef.current = [];
  }

  function addTimer(fn, ms) {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }

  function getEnglishVoice() {
    const voices = voicesRef.current;
    const preferredNames = ['Samantha', 'Karen', 'Victoria', 'Google UK English Female', 'Google US English Female', 'Zira', 'female'];
    return (
      voices.find((voice) => voice.lang.toLowerCase().startsWith('en') && preferredNames.some((name) => voice.name.includes(name))) ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith('en') && voice.name.toLowerCase().includes('female')) ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ||
      null
    );
  }

  function speak(word) {
    if (typeof window === 'undefined' || !window.speechSynthesis || !word) return;

    try {
      const utterance = new SpeechSynthesisUtterance(word);
      const voice = getEnglishVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('Speech synthesis failed:', error);
    }
  }


  function playCorrectSound() {
    if (typeof window === 'undefined') return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;
      if (context.state === 'suspended') context.resume().catch(() => {});

      const startAt = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28);
      gain.connect(context.destination);

      [523.25, 783.99].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startAt + index * 0.08);
        oscillator.connect(gain);
        oscillator.start(startAt + index * 0.08);
        oscillator.stop(startAt + 0.3);
      });
    } catch (error) {
      console.warn('Correct sound failed:', error);
    }
  }

  function playWrongSound() {
    if (typeof window === 'undefined') return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;
      if (context.state === 'suspended') context.resume().catch(() => {});

      const startAt = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.32);
      gain.connect(context.destination);

      [392.0, 329.63].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, startAt + index * 0.1);
        oscillator.connect(gain);
        oscillator.start(startAt + index * 0.1);
        oscillator.stop(startAt + 0.34);
      });
    } catch (error) {
      console.warn('Wrong sound failed:', error);
    }
  }

  function warmupTTS() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      const utterance = new SpeechSynthesisUtterance('ready');
      const voice = getEnglishVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = 'en-US';
      utterance.volume = 0;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('Speech synthesis warmup failed:', error);
    }
  }

  async function handleLogout() {
    clearAllTimers();
    await fetch('/api/auth/preview-logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  function prepareWords(words, requestedCount, questionMode = 'balanced') {
    const availableWords = words
      .filter((word) => word?.id !== null && word?.id !== undefined && word?.japanese && word?.english)
      .map((word) => ({
        id: word.id,
        japanese: word.japanese,
        english: word.english,
        phonetic: word.phonetic || '',
        importance: word.importance,
        stats: word.stats || null,
        last_answered_at: word.last_answered_at || null
      }));

    const sourceWords = questionMode === 'wrong'
      ? availableWords.filter((word) => Number(word.stats?.mistake_count ?? 0) > 0)
      : availableWords;

    const rankedWords = [...sourceWords].sort((a, b) => {
      const randomTie = Math.random() - 0.5;
      const isUnseenA = !a.stats;
      const isUnseenB = !b.stats;
      const attemptCountA = Number(a.stats?.attempt_count ?? 0);
      const attemptCountB = Number(b.stats?.attempt_count ?? 0);
      const recencyA = Date.parse(a.last_answered_at || a.stats?.updated_at || '') || 0;
      const recencyB = Date.parse(b.last_answered_at || b.stats?.updated_at || '') || 0;

      if (questionMode === 'wrong') {
        const mistakeA = Number(a.stats?.mistake_count ?? 0);
        const mistakeB = Number(b.stats?.mistake_count ?? 0);
        const accuracyA = Number(a.stats?.accuracy ?? 100);
        const accuracyB = Number(b.stats?.accuracy ?? 100);
        const hasLastWrongA = Boolean(a.stats?.last_wrong);
        const hasLastWrongB = Boolean(b.stats?.last_wrong);
        const lastWrongA = Date.parse(a.stats?.last_wrong || '') || 0;
        const lastWrongB = Date.parse(b.stats?.last_wrong || '') || 0;
        const importantWrongA = Number(a.importance) === 1 && mistakeA > 0;
        const importantWrongB = Number(b.importance) === 1 && mistakeB > 0;

        if (mistakeA !== mistakeB) return mistakeB - mistakeA;
        if (accuracyA !== accuracyB) return accuracyA - accuracyB;
        if (hasLastWrongA !== hasLastWrongB) return hasLastWrongA ? -1 : 1;
        if (lastWrongA !== lastWrongB) return lastWrongB - lastWrongA;
        if (importantWrongA !== importantWrongB) return importantWrongA ? -1 : 1;
        if (attemptCountA !== attemptCountB) return attemptCountA - attemptCountB;
        if (recencyA !== recencyB) return recencyA - recencyB;
        return randomTie;
      }

      // balanced / select fallback: prioritize unseen, then low attempts, then older recency.
      if (isUnseenA !== isUnseenB) return isUnseenA ? -1 : 1;
      if (attemptCountA !== attemptCountB) return attemptCountA - attemptCountB;
      if (recencyA !== recencyB) return recencyA - recencyB;
      return randomTie;
    });

    const target = requestedCount > 0 ? Math.min(requestedCount, rankedWords.length) : rankedWords.length;
    return { quizWords: rankedWords.slice(0, target), targetCount: target };
  }

  function startQuestion(nextState) {
    clearAllTimers();
    const word = nextState.quizWords[nextState.currentIndex];
    const now = Date.now();

    const askingGame = {
      ...nextState,
      screen: 'game',
      state: 'asking',
      answer: '',
      result: null,
      questionStart: now,
      now,
      errorMessage: '',
      showCircle: false,
      showPhonetic: false
    };
    gameRef.current = askingGame;
    setGame(askingGame);

    const timing = MODE_TIMING[nextState.mode] || MODE_TIMING.normal;
    const firstHintAt = timing.noInputHint1;
    const secondHintAt = firstHintAt + timing.hintPlus3;
    const autoJudgeAt = secondHintAt + timing.judgePlus4;

    addTimer(() => speak(word?.english), firstHintAt * 1000);
    addTimer(() => {
      const current = gameRef.current;
      if (current.state !== 'asking') return;
      const nextGame = { ...current, showPhonetic: true };
      gameRef.current = nextGame;
      setGame(nextGame);
      speak(word?.english);
    }, secondHintAt * 1000);
    addTimer(() => {
      judgeCurrentAnswer(gameRef.current.answer, true);
    }, autoJudgeAt * 1000);
  }

  async function fetchWords(requestedCount = null, questionMode = 'balanced') {
    console.time?.('fetchWords');
    try {
      const requested =
        Number.isFinite(requestedCount) && requestedCount > 0 ? Math.floor(requestedCount) : MIN_CANDIDATE_FETCH;
      const candidateLimit = Math.max(MIN_CANDIDATE_FETCH, requested);
      const safeLimit = Math.min(candidateLimit, MAX_FETCH_LIMIT);
      const serverMode = questionMode === 'wrong' ? 'wrong' : 'balanced';
      const query = `?limit=${safeLimit}&offset=0&mode=${serverMode}`;
      const response = await fetch(`/api/words${query}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '単語データの取得に失敗しました。時間をおいて再度お試しください。');
      }
      return data.words || [];
    } finally {
      console.timeEnd?.('fetchWords');
    }
  }

  async function handleQuestionModeChange(questionMode) {
    setGame((prev) => {
      const next = {
        ...prev,
        questionMode,
        errorMessage: '',
        wrongModeFallbackAvailable: false,
        isLoading: false
      };
      gameRef.current = next;
      return next;
    });
    if (questionMode !== 'select') return;
    void prefetchV2FirstPage();
  }

  async function fetchWordSets() {
    const response = await fetch('/api/word-sets');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '保存セットの取得に失敗しました。');
    return data.word_sets || [];
  }


  function appendV2FilterParams(params, filters = {}) {
    FILTER_KEYS.forEach((key) => {
      appendMultiValueParam(params, key, filters[key]);
    });
    if (filters.importantOnly) params.set('importantOnly', 'true');
  }

  function hasV2FilterParams(filters = {}) {
    return FILTER_KEYS.some((key) => filterHasValues(filters[key])) || Boolean(filters.importantOnly);
  }

  function buildWordPickerListUrl({ search = '', cursor = '0', limit = WORD_PICKER_PAGE_SIZE, filters = {} } = {}) {
    const params = new URLSearchParams({ limit: String(limit), cursor: String(cursor) });
    const trimmedSearch = search.trim();
    if (trimmedSearch) params.set('search', trimmedSearch);
    appendV2FilterParams(params, filters);
    return `/api/word-picker/list?${params.toString()}`;
  }



  function readV2Cache() {
    if (typeof window === 'undefined') return null;
    try {
      const cached = JSON.parse(window.localStorage.getItem(WORD_PICKER_CACHE_KEY) || 'null');
      return Array.isArray(cached?.words) ? cached : null;
    } catch {
      return null;
    }
  }

  function writeV2Cache(data) {
    if (typeof window === 'undefined' || !Array.isArray(data?.words)) return;
    try {
      window.localStorage.setItem(WORD_PICKER_CACHE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch {
      // Cache is only an acceleration path; ignore quota/private-mode failures.
    }
  }

  async function fetchV2Page({ search = '', cursor = '0', limit = WORD_PICKER_PAGE_SIZE, filters = {} } = {}) {
    const startedAt = performance.now();
    const response = await fetch(buildWordPickerListUrl({ search, cursor, limit, filters }), { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '単語一覧の取得に失敗しました。');
    return { data, elapsed: Math.round(performance.now() - startedAt) };
  }

  function measureV2Render(startedAt) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const renderMs = Math.round(performance.now() - startedAt);
        setGame((prev) => ({ ...prev, v2Metrics: { ...prev.v2Metrics, renderMs } }));
      });
    });
  }

  function updateV2Metrics(patch) {
    setGame((prev) => {
      const metrics = { ...prev.v2Metrics, ...patch };
      const slowParts = [];
      if ((metrics.apiMs ?? 0) >= 3000) slowParts.push(`API ${metrics.apiMs}ms`);
      if ((metrics.cacheMs ?? 0) >= 3000) slowParts.push(`cache ${metrics.cacheMs}ms`);
      if ((metrics.renderMs ?? 0) >= 3000) slowParts.push(`render ${metrics.renderMs}ms`);
      return { ...prev, v2Metrics: { ...metrics, slow: slowParts.join(' / ') } };
    });
  }

  function prefetchV2FirstPage() {
    const key = 'first:';
    if (v2PrefetchRef.current.key === key && (v2PrefetchRef.current.promise || v2PrefetchRef.current.data)) {
      return v2PrefetchRef.current.promise;
    }
    const promise = fetchV2Page({ search: '', cursor: '0', limit: WORD_PICKER_PAGE_SIZE, filters: INITIAL_GAME.filters })
      .then(({ data, elapsed }) => {
        v2PrefetchRef.current = { key, promise: null, data };
        writeV2Cache(data);
        updateV2Metrics({ apiMs: elapsed });
        void prefetchV2NextPage(data.next_cursor ?? String(WORD_PICKER_PAGE_SIZE), INITIAL_GAME.filters);
        return data;
      })
      .catch((error) => {
        v2PrefetchRef.current = { key: '', promise: null, data: null };
        throw error;
      });
    v2PrefetchRef.current = { key, promise, data: null };
    return promise;
  }

  async function prefetchV2NextPage(cursor, filters = gameRef.current.filters, search = gameRef.current.v2Search) {
    if (!cursor) return;
    try {
      await fetchV2Page({ search, cursor, limit: WORD_PICKER_PREFETCH_SIZE, filters });
    } catch (error) {
      console.warn('Word picker next-page prefetch failed:', error);
    }
  }

  async function fetchV2TotalInBackground(search = '', filters = gameRef.current.filters) {
    try {
      const params = new URLSearchParams({ limit: '1', cursor: '0' });
      if (search.trim()) params.set('search', search.trim());
      appendV2FilterParams(params, filters);
      const response = await fetch(`/api/word-picker/count?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.ok) setGame((prev) => ({ ...prev, v2Total: data.total ?? data.count ?? null }));
    } catch (error) {
      console.warn('Word picker count fetch failed:', error);
    }
  }

  const loadV2Words = useCallback(async ({ reset = false, search = gameRef.current.v2Search, filters = gameRef.current.filters, preferCache = false } = {}) => {
    const current = gameRef.current;
    const cursor = reset ? '0' : current.v2NextCursor;
    const hasFilters = hasV2FilterParams(filters);
    const isFirstPage = reset && cursor === '0' && !search.trim() && !hasFilters;
    const renderStartedAt = performance.now();
    let showedInstantData = false;

    if (reset) {
      const cached = preferCache && isFirstPage ? readV2Cache() : null;
      const prefetched = isFirstPage ? v2PrefetchRef.current.data : null;
      const instant = prefetched || cached;
      if (instant?.words?.length) {
        const cacheMs = Math.round(performance.now() - (v2OpenStartedAtRef.current || renderStartedAt));
        showedInstantData = true;
        setGame((prev) => ({
          ...prev,
          v2Words: instant.words || [],
          v2NextCursor: instant.next_cursor ?? String((instant.words || []).length),
          v2HasMore: Boolean(instant.has_more),
          v2Loading: false,
          v2LoadingMore: false,
          v2Search: search,
          v2Error: '',
          v2Source: prefetched ? 'prefetch' : 'cache',
          v2CacheNotice: cached && !prefetched ? '前回データを表示中・更新確認中' : '',
          v2Metrics: { source: prefetched ? 'prefetch' : 'cache', cacheMs, apiMs: null, renderMs: null, slow: '' }
        }));
        measureV2Render(renderStartedAt);
      } else {
        setGame((prev) => ({
          ...prev,
          v2Words: [],
          v2NextCursor: '0',
          v2HasMore: false,
          v2Loading: true,
          v2LoadingMore: false,
          v2Search: search,
          v2Error: '',
          v2Source: '',
          v2CacheNotice: '',
          v2Metrics: { source: 'api', cacheMs: null, apiMs: null, renderMs: null, slow: '' }
        }));
      }
    } else {
      setGame((prev) => ({ ...prev, v2LoadingMore: true, v2Error: '' }));
    }

    try {
      const inFlightFirstPage = isFirstPage && v2PrefetchRef.current.promise;
      const { data, elapsed } = inFlightFirstPage
        ? { data: await v2PrefetchRef.current.promise, elapsed: null }
        : await fetchV2Page({ search, cursor, limit: WORD_PICKER_PAGE_SIZE, filters });
      if (isFirstPage) writeV2Cache(data);
      setGame((prev) => ({
        ...prev,
        v2Words: reset ? (data.words || []) : [...prev.v2Words, ...(data.words || [])],
        v2NextCursor: data.next_cursor ?? '0',
        v2HasMore: Boolean(data.has_more),
        v2Loading: false,
        v2LoadingMore: false,
        v2Search: search,
        v2Error: '',
        v2Source: 'api',
        v2CacheNotice: '',
        v2Metrics: { ...prev.v2Metrics, source: 'api', apiMs: elapsed ?? prev.v2Metrics.apiMs }
      }));
      measureV2Render(renderStartedAt);
      updateV2Metrics(elapsed === null ? { source: 'api' } : { source: 'api', apiMs: elapsed });
      if (reset) {
        void fetchV2TotalInBackground(search, filters);
        void prefetchV2NextPage(data.next_cursor ?? String(WORD_PICKER_PAGE_SIZE), filters, search);
      }
    } catch (error) {
      setGame((prev) => ({
        ...prev,
        v2Loading: false,
        v2LoadingMore: false,
        v2Error: showedInstantData ? '' : (error.message || '単語一覧の取得に失敗しました。'),
        v2CacheNotice: showedInstantData ? '前回データを表示中・更新確認に失敗しました' : prev.v2CacheNotice
      }));
    }
  }, []);

  async function fetchSelectedWordsByIds(wordIds) {
    const ids = [...new Set(wordIds)].filter(hasValue);
    if (!ids.length) return [];
    const response = await fetch(`/api/words?ids=${encodeURIComponent(ids.join(','))}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '選択した単語の取得に失敗しました。');
    return data.words || [];
  }

  async function handleStart(selectedWords = null, forcedQuestionMode = null) {
    const current = gameRef.current;
    const activeQuestionMode = forcedQuestionMode || current.questionMode;
    const mode = current.mode || 'normal';
    const userName = current.userName.trim();
    if (!userName) {
      setGame((prev) => ({ ...prev, errorMessage: 'ユーザー名を入力してください。' }));
      return;
    }

    clearAllTimers();
    warmupTTS();
    const requestedCount = Number(current.countInput);
    const safeRequestedCount = Number.isFinite(requestedCount) && requestedCount > 0 ? Math.floor(requestedCount) : 0;

    setGame((prev) => ({ ...prev, mode, isLoading: true, errorMessage: '' }));

    try {
      const words = selectedWords || (await fetchWords(safeRequestedCount, activeQuestionMode));

      console.time?.('prepareWords');
      const { quizWords, targetCount } = prepareWords(words, safeRequestedCount, activeQuestionMode);
      console.timeEnd?.('prepareWords');
      if (!targetCount) {
        const wrongEmpty = activeQuestionMode === 'wrong';
        setGame((prev) => ({
          ...prev,
          isLoading: false,
          wrongModeFallbackAvailable: wrongEmpty,
          errorMessage: wrongEmpty ? '間違えた単語はまだありません' : '出題できる単語がありません。'
        }));
        return;
      }

      startQuestion({
        ...INITIAL_GAME,
        userName,
        countInput: current.countInput,
        mode,
        questionMode: activeQuestionMode,
        words,
        selectableWords: current.selectableWords,
        selectableWordsFullyLoaded: current.selectableWordsFullyLoaded,
        selectedWordIds: current.selectedWordIds,
        selectionMode: current.selectionMode,
        selectionQuery: current.selectionQuery,
        excludedWordIds: current.excludedWordIds,
        wordSets: current.wordSets,
        selectedWordSetId: current.selectedWordSetId,
        selectedWordSetName: current.selectedWordSetName,
        newWordSetName: current.newWordSetName,
        pickerPanel: current.pickerPanel,
        wordSearchDraft: current.wordSearchDraft,
        wordSearch: current.wordSearch,
        wordSetMessageType: current.wordSetMessageType,
        wordSetFetchError: current.wordSetFetchError,
        filters: current.filters,
        quizWords,
        targetCount,
        totalStart: Date.now(),
        now: Date.now()
      });
    } catch (error) {
      setGame((prev) => ({
        ...prev,
        isLoading: false,
        wrongModeFallbackAvailable: false,
        errorMessage: error.message || '単語データの取得に失敗しました。時間をおいて再度お試しください。'
      }));
    }
  }

  async function saveAnswerHistory({ word, answer, correct }) {
    console.time?.('saveAnswerHistory');
    if (word?.id === null || word?.id === undefined) return;

    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word_id: word.id,
          answer,
          correct
        })
      });

      if (!response.ok) {
        console.warn('Answer history was not saved.');
      }
    } catch {
      console.warn('Answer history was not saved.');
    } finally {
      console.timeEnd?.('saveAnswerHistory');
    }
  }

  function createJudgedGame(prev, value) {
    const word = prev.quizWords[prev.currentIndex];
    if (!word || prev.state !== 'asking') return null;

    const isCorrect = normalizeText(value) === normalizeText(word.english);
    const answeredCount = prev.answeredCount + 1;
    const correctCount = prev.correctCount + (isCorrect ? 1 : 0);
    const wrongCount = prev.wrongCount + (isCorrect ? 0 : 1);
    const nextReviewData = [...prev.reviewData, { ...word, answer: value, correct: isCorrect }];
    const isLast = answeredCount >= prev.targetCount || prev.currentIndex + 1 >= prev.quizWords.length;

    return {
      nextGame: {
        ...prev,
        state: isLast ? 'finished' : 'judged',
        answeredCount,
        correctCount,
        wrongCount,
        answer: value,
        result: { correct: isCorrect, answer: value, word },
        reviewData: nextReviewData,
        showCircle: isCorrect,
        now: Date.now()
      },
      isCorrect,
      isLast,
      word
    };
  }

  function judgeCurrentAnswer(value, shouldSpeak = true) {
    const judged = createJudgedGame(gameRef.current, value);
    if (!judged) return;

    clearAllTimers();
    const { nextGame, isCorrect, isLast, word } = judged;
    const timing = MODE_TIMING[nextGame.mode] || MODE_TIMING.normal;
    gameRef.current = nextGame;
    setGame(nextGame);

    if (shouldSpeak) addTimer(() => speak(word.english), 200);

    void saveAnswerHistory({ word, answer: nextGame.answer, correct: isCorrect });

    if (isCorrect) {
      playCorrectSound();
      addTimer(() => setGame((current) => ({ ...current, showCircle: false })), 400);
    } else {
      playWrongSound();
    }

    if (isLast) {
      addTimer(() => {
        console.time?.('result screen transition');
        setGame((current) => ({ ...current, screen: 'result', state: 'finished', showCircle: false, now: Date.now() }));
        console.timeEnd?.('result screen transition');
      }, (isCorrect ? timing.nextFast : timing.nextSlow) * 1000);
      return;
    }

    addTimer(() => {
      const current = gameRef.current;
      if (current.state !== 'judged') return;
      startQuestion({ ...current, currentIndex: current.currentIndex + 1, showCircle: false });
    }, (isCorrect ? timing.nextFast : timing.nextSlow) * 1000);
  }

  function handleAnswerChange(event) {
    const value = event.target.value;
    const current = gameRef.current;
    const word = current.quizWords[current.currentIndex];

    if (current.state === 'asking' && word && normalizeText(value) === normalizeText(word.english)) {
      judgeCurrentAnswer(value);
      return;
    }

    const nextGame = { ...current, answer: value };
    gameRef.current = nextGame;
    setGame(nextGame);
  }

  function handleAnswerButton() {
    const current = gameRef.current;

    if (current.state === 'asking') {
      judgeCurrentAnswer(current.answer);
      return;
    }

    if (current.state === 'judged') {
      clearAllTimers();
      startQuestion({ ...current, currentIndex: current.currentIndex + 1, showCircle: false });
      return;
    }

    if (current.state === 'finished' && current.screen === 'game') {
      clearAllTimers();
      const nextGame = { ...current, screen: 'result', state: 'finished', showCircle: false, now: Date.now() };
      gameRef.current = nextGame;
      setGame(nextGame);
    }
  }

  function handleAnswerKeyDown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleAnswerButton();
  }

  async function handleRetry() {
    const current = gameRef.current;
    if (current.isLoading) return;
    const requestedCount = Number(current.countInput);
    const safeRequestedCount = Number.isFinite(requestedCount) && requestedCount > 0 ? Math.floor(requestedCount) : 0;
    setGame((prev) => ({ ...prev, isLoading: true, errorMessage: '' }));
    try {
      const words = current.questionMode === 'select'
        ? (current.words.length ? current.words : await fetchSelectedWordsByIds(current.selectedWordIds))
        : await fetchWords(safeRequestedCount, current.questionMode);
      console.time?.('prepareWords');
      const { quizWords, targetCount } = prepareWords(words, safeRequestedCount, current.questionMode);
      console.timeEnd?.('prepareWords');
      if (!targetCount) {
        const wrongEmpty = current.questionMode === 'wrong';
        setGame((prev) => ({
          ...prev,
          isLoading: false,
          wrongModeFallbackAvailable: wrongEmpty,
          errorMessage: wrongEmpty ? '間違えた単語はまだありません' : '出題できる単語がありません。'
        }));
        return;
      }

      startQuestion({
        ...INITIAL_GAME,
        userName: current.userName,
        countInput: String(safeRequestedCount || ''),
        mode: current.mode,
        questionMode: current.questionMode,
        words,
        selectableWords: current.selectableWords,
        selectableWordsFullyLoaded: current.selectableWordsFullyLoaded,
        selectedWordIds: current.selectedWordIds,
        wordSets: current.wordSets,
        selectedWordSetId: current.selectedWordSetId,
        selectedWordSetName: current.selectedWordSetName,
        newWordSetName: current.newWordSetName,
        pickerPanel: current.pickerPanel,
        wordSearchDraft: current.wordSearchDraft,
        wordSearch: current.wordSearch,
        wordSetMessageType: current.wordSetMessageType,
        wordSetFetchError: current.wordSetFetchError,
        filters: current.filters,
        quizWords,
        targetCount,
        isLoading: false,
        totalStart: Date.now(),
        now: Date.now()
      });
    } catch (error) {
      setGame((prev) => ({
        ...prev,
        isLoading: false,
        wrongModeFallbackAvailable: false,
        errorMessage: error.message || '単語データの取得に失敗しました。時間をおいて再度お試しください。'
      }));
    }
  }

  function handleRetrySameWords() {
    const current = gameRef.current;
    if (!current.quizWords.length) return;
    startQuestion({
      ...INITIAL_GAME,
      userName: current.userName,
      countInput: current.countInput,
      mode: current.mode,
      questionMode: current.questionMode,
      words: current.words,
      selectableWords: current.selectableWords,
      selectableWordsFullyLoaded: current.selectableWordsFullyLoaded,
      selectedWordIds: current.selectedWordIds,
      wordSets: current.wordSets,
      selectedWordSetId: current.selectedWordSetId,
      selectedWordSetName: current.selectedWordSetName,
      newWordSetName: current.newWordSetName,
      wordSearch: current.wordSearch,
      filters: current.filters,
      quizWords: current.quizWords,
      targetCount: current.targetCount,
      totalStart: Date.now(),
      now: Date.now()
    });
  }

  function handleStartNormalFallback() {
    if (game.questionMode === 'select') return;
    void handleStart(null, 'balanced');
  }

  function renderQuestionSettings(compact = false) {
    return (
      <>
        <div className={`questionModeArea ${compact ? 'compact' : ''}`}>
          {!compact && <p className="sectionLabel">出題方法</p>}
          <div className="questionModes">
            {QUESTION_MODE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.key}
                className={`quizMethodCard ${game.questionMode === option.key ? 'quizMethodCardActive' : ''}`}
                onClick={() => void handleQuestionModeChange(option.key)}
                aria-pressed={game.questionMode === option.key}
              >
                <span className="quizMethodTitle">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  function toggleSelectedWord(wordId) {
    setGame((prev) => {
      if (prev.selectionMode === 'allMatching') {
        const excluded = new Set(prev.excludedWordIds);
        if (excluded.has(wordId)) excluded.delete(wordId);
        else excluded.add(wordId);
        return { ...prev, excludedWordIds: [...excluded], errorMessage: '' };
      }
      const nextSelected = new Set(prev.selectedWordIds);
      if (nextSelected.has(wordId)) {
        nextSelected.delete(wordId);
      } else {
        nextSelected.add(wordId);
      }
      return {
        ...prev,
        selectedWordIds: [...nextSelected],
        errorMessage: ''
      };
    });
  }

  async function handleStartSelected() {
    if (game.selectionMode !== 'allMatching' && !game.selectedWordIds.length) {
      setGame((prev) => ({ ...prev, errorMessage: '単語を1つ以上選択してください。' }));
      return;
    }
    setGame((prev) => ({ ...prev, isLoading: true, errorMessage: '' }));
    try {
      const selectedWords = game.selectionMode === 'allMatching'
        ? await resolveAllMatchingSelection(game)
        : await fetchSelectedWordsByIds(game.selectedWordIds);
      await handleStart(selectedWords, 'select');
    } catch (error) {
      setGame((prev) => ({ ...prev, isLoading: false, errorMessage: error.message || '選択した単語の取得に失敗しました。' }));
    }
  }

  async function handleSaveWordSet() {
    if (!game.selectedWordIds.length) {
      setGame((prev) => ({ ...prev, wordSetMessage: '保存する単語を1つ以上選択してください。', wordSetMessageType: 'error' }));
      return;
    }
    const name = game.newWordSetName.trim();
    if (!name) {
      setGame((prev) => ({ ...prev, wordSetMessage: 'セット名を入力してください。', wordSetMessageType: 'error' }));
      return;
    }
    const savingCount = game.selectedWordIds.length;
    try {
      const response = await fetch('/api/word-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, word_ids: game.selectedWordIds })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '保存に失敗しました。');
      const sets = await fetchWordSets();
      setGame((prev) => ({ ...prev, wordSets: sets, newWordSetName: '', wordSetMessage: `${savingCount}語を保存しました`, wordSetMessageType: 'success', wordSetFetchError: '' }));
    } catch (error) {
      setGame((prev) => ({ ...prev, wordSetMessage: error.message || '保存に失敗しました。', wordSetMessageType: 'error' }));
    }
  }

  async function handleStartFromWordSet(wordSetId) {
    try {
      const response = await fetch(`/api/word-sets/${wordSetId}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'セットの取得に失敗しました。');
      const words = data.words || [];
      if (!words.length) throw new Error('このセットには出題可能な単語がありません。');
      const selectedWordSet = game.wordSets.find((setItem) => setItem.id === wordSetId);
      setGame((prev) => ({ ...prev, selectedWordSetId: wordSetId, selectedWordSetName: selectedWordSet?.name || '' }));
      void handleStart(words, 'select');
    } catch (error) {
      setGame((prev) => ({ ...prev, errorMessage: error.message || '保存セットの出題開始に失敗しました。' }));
    }
  }

  async function handleDeleteWordSet(wordSetId) {
    try {
      const response = await fetch(`/api/word-sets/${wordSetId}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '削除に失敗しました。');
      const sets = await fetchWordSets();
      setGame((prev) => ({ ...prev, wordSets: sets, pendingWordSetIds: prev.pendingWordSetIds.filter((id) => id !== wordSetId), wordSetMessage: '削除しました', wordSetMessageType: 'success', wordSetFetchError: '' }));
    } catch (error) {
      setGame((prev) => ({ ...prev, wordSetMessage: error.message || '削除に失敗しました。', wordSetMessageType: 'error' }));
    }
  }

  const canSaveWordSet = game.selectionMode === 'manual' && game.selectedWordIds.length > 0 && game.newWordSetName.trim().length > 0;


  async function openWordPicker(initialPanel = '') {
    v2OpenStartedAtRef.current = performance.now();
    const shouldLoadInitialWords = initialPanel !== 'open';
    setGame((prev) => ({
      ...prev,
      isWordPickerOpen: true,
      pickerPanel: initialPanel,
      pendingWordSetIds: initialPanel === 'open' ? [] : prev.pendingWordSetIds,
      wordSetSearch: initialPanel === 'open' ? '' : prev.wordSetSearch,
      wordSetMessage: '',
      wordSetMessageType: ''
    }));
    if (shouldLoadInitialWords) void loadV2Words({ reset: true, search: '', preferCache: true });
    if (initialPanel === 'open') void loadWordSetsForPanel();
  }

  async function loadWordSetsForPanel() {
    try {
      const sets = await fetchWordSets();
      setGame((prev) => ({ ...prev, wordSets: sets, wordSetFetchError: '' }));
    } catch (error) {
      setGame((prev) => ({ ...prev, wordSetFetchError: error.message || '保存済みセットを読み込めませんでした。' }));
    }
  }

  function openPickerPanel(panel) {
    if (panel === 'open' && !gameRef.current.wordSets.length) void loadWordSetsForPanel();
    const nextPanel = gameRef.current.pickerPanel === panel ? '' : panel;
    const nextDraftFilters = panel === 'category' && nextPanel === 'category' ? { ...gameRef.current.filters } : gameRef.current.draftFilters;
    if (nextPanel === 'category') {
      setOpenCategoryKey('');
      void loadCategoryOptions(nextDraftFilters);
    }
    setGame((prev) => ({
      ...prev,
      pickerPanel: prev.pickerPanel === panel ? '' : panel,
      draftFilters: panel === 'category' && prev.pickerPanel !== panel ? { ...prev.filters } : prev.draftFilters,
      pendingWordSetIds: panel === 'open' ? [] : prev.pendingWordSetIds,
      wordSetSearch: panel === 'open' ? '' : prev.wordSetSearch,
      wordSetMessage: '',
      wordSetMessageType: ''
    }));
  }

  function closeWordPickerPanel() {
    setGame((prev) => ({ ...prev, pickerPanel: '', draftFilters: { ...prev.filters }, wordSetMessage: '', wordSetMessageType: '' }));
  }

  function applyWordSearch() {
    setGame((prev) => ({ ...prev, wordSearch: prev.wordSearchDraft }));
  }

  function handleWordSearchKeyDown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyWordSearch();
  }

  function clearFilters() {
    const nextFilters = { ...INITIAL_GAME.filters };
    setGame((prev) => ({
      ...prev,
      filters: nextFilters,
      draftFilters: nextFilters,
      pickerPanel: '',
      v2Words: [],
      v2NextCursor: '0',
      v2HasMore: false,
      v2Total: null,
      selectionMode: 'manual',
      selectedWordIds: [],
      excludedWordIds: [],
      selectionQuery: {}
    }));
    void loadV2Words({ reset: true, search: gameRef.current.v2Search, filters: nextFilters });
  }

  function readCategoryIndexCache() {
    if (typeof window === 'undefined') return null;
    try {
      const cached = JSON.parse(window.localStorage.getItem(WORD_PICKER_CATEGORY_INDEX_CACHE_KEY) || 'null');
      return Array.isArray(cached?.categoryRows) ? cached : null;
    } catch {
      return null;
    }
  }

  function writeCategoryIndexCache(data) {
    if (typeof window === 'undefined' || !Array.isArray(data?.categoryRows)) return;
    try {
      window.localStorage.setItem(WORD_PICKER_CATEGORY_INDEX_CACHE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch {
      // Category index cache is an acceleration path; ignore storage failures.
    }
  }

  async function loadCategoryOptions() {
    if (gameRef.current.categoryIndexLoading || gameRef.current.categoryIndexRefreshing) return;
    if (gameRef.current.categoryIndexLoaded && gameRef.current.categoryIndexRows.length) return;
    const requestId = categoryOptionsRequestIdRef.current + 1;
    categoryOptionsRequestIdRef.current = requestId;
    const cached = readCategoryIndexCache();
    if (cached?.categoryRows?.length) {
      setGame((prev) => ({
        ...prev,
        categoryIndexRows: cached.categoryRows,
        categoryIndexVersion: cached.version || cached.generatedAt || '',
        categoryIndexLoaded: true,
        categoryIndexRefreshing: true,
        categoryIndexLoading: false,
        categoryIndexError: '',
        categoryIndexCacheNotice: '前回候補を表示中・更新確認中'
      }));
    } else {
      setGame((prev) => ({ ...prev, categoryIndexLoading: true, categoryIndexError: '', categoryIndexCacheNotice: '' }));
    }

    try {
      const response = await fetch('/api/word-picker/category-index', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'カテゴリ候補の取得に失敗しました。');
      if (categoryOptionsRequestIdRef.current !== requestId) return;
      writeCategoryIndexCache(data);
      setGame((prev) => {
        const nextVersion = data.version || data.generatedAt || '';
        const sameVersion = prev.categoryIndexVersion && nextVersion && prev.categoryIndexVersion === nextVersion;
        return {
          ...prev,
          categoryIndexRows: sameVersion && prev.categoryIndexRows.length ? prev.categoryIndexRows : (data.categoryRows || []),
          categoryIndexVersion: nextVersion,
          categoryIndexLoaded: true,
          categoryIndexLoading: false,
          categoryIndexRefreshing: false,
          categoryIndexError: '',
          categoryIndexCacheNotice: sameVersion ? '最新の候補です' : ''
        };
      });
    } catch (error) {
      if (categoryOptionsRequestIdRef.current !== requestId) return;
      setGame((prev) => ({
        ...prev,
        categoryIndexLoading: false,
        categoryIndexRefreshing: false,
        categoryIndexError: cached?.categoryRows?.length ? '' : (error.message || 'カテゴリ候補の取得に失敗しました。'),
        categoryIndexCacheNotice: cached?.categoryRows?.length ? '前回候補を表示中（更新確認に失敗しました）' : ''
      }));
    }
  }

  function clearDraftCategoryFilters() {
    const nextFilters = { ...INITIAL_GAME.filters };
    setGame((prev) => ({ ...prev, draftFilters: nextFilters }));
    setOpenCategoryKey('');
    setCategorySearch({});
    setCategoryVisibleCounts({});
  }

  function applyCategoryFilters() {
    const nextFilters = { ...gameRef.current.draftFilters };
    setGame((prev) => ({
      ...prev,
      filters: nextFilters,
      pickerPanel: '',
      v2Words: [],
      v2NextCursor: '0',
      v2HasMore: false,
      v2Total: null,
      selectionMode: 'manual',
      selectedWordIds: [],
      excludedWordIds: [],
      selectionQuery: {}
    }));
    void loadV2Words({ reset: true, search: gameRef.current.v2Search, filters: nextFilters });
  }

  function togglePendingWordSet(wordSetId) {
    setGame((prev) => {
      const next = new Set(prev.pendingWordSetIds);
      if (next.has(wordSetId)) next.delete(wordSetId);
      else next.add(wordSetId);
      return { ...prev, pendingWordSetIds: [...next], wordSetMessage: '', wordSetMessageType: '' };
    });
  }

  async function handleApplyWordSets() {
    if (!game.pendingWordSetIds.length) {
      setGame((prev) => ({ ...prev, wordSetMessage: '追加する保存セットを選択してください。', wordSetMessageType: 'error' }));
      return;
    }
    try {
      const results = await Promise.all(game.pendingWordSetIds.map(async (wordSetId) => {
        const response = await fetch(`/api/word-sets/${wordSetId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'セットの取得に失敗しました。');
        return { wordSetId, words: data.words || [] };
      }));
      const selectedNames = game.wordSets
        .filter((setItem) => game.pendingWordSetIds.includes(setItem.id))
        .map((setItem) => setItem.name);
      const nextSelected = new Set(game.selectedWordIds);
      results.forEach(({ words }) => {
        words.map((word) => word.id).filter(hasValue).forEach((wordId) => nextSelected.add(wordId));
      });
      setGame((prev) => ({
        ...prev,
        selectedWordIds: [...nextSelected],
        selectedWordSetId: game.pendingWordSetIds.join(','),
        selectedWordSetName: selectedNames.join(' / '),
        pendingWordSetIds: [],
        pickerPanel: '',
        wordSetMessage: `${selectedNames.length}セットを選択に追加しました`,
        wordSetMessageType: 'success'
      }));
    } catch (error) {
      setGame((prev) => ({ ...prev, wordSetMessage: error.message || 'セットの読み込みに失敗しました。', wordSetMessageType: 'error' }));
    }
  }

  function setDraftFilterValue(key, value) {
    const current = gameRef.current;
    if (key === 'selectedOnly' && value && current.selectedWordIds.length === 0) return;
    setGame((prev) => ({ ...prev, draftFilters: { ...current.draftFilters, [key]: value } }));
  }

  function updateDraftFilterValue(key, value, mode = 'toggle', options = {}) {
    const currentValues = normalizeFilterValues(gameRef.current.draftFilters[key]);
    const isSelected = currentValues.includes(value);
    let nextValues = currentValues;
    if (mode === 'add' && !isSelected) nextValues = [...currentValues, value];
    if (mode === 'remove' && isSelected) nextValues = currentValues.filter((item) => item !== value);
    if (mode === 'toggle') nextValues = isSelected ? currentValues.filter((item) => item !== value) : [...currentValues, value];
    if (nextValues === currentValues) return;
    setDraftFilterValue(key, nextValues);
    if (options.advance && mode === 'toggle' && !isSelected && CATEGORY_NEXT_KEY[key]) setOpenCategoryKey(CATEGORY_NEXT_KEY[key]);
  }

  function toggleDraftFilterValue(key, value) {
    updateDraftFilterValue(key, value, 'toggle');
  }

  function applyCategoryDragValue(key, value) {
    const dragState = categoryDragRef.current;
    if (!dragState.active || dragState.key !== key || dragState.processed.has(value)) return;
    dragState.processed.add(value);
    updateDraftFilterValue(key, value, dragState.mode);
  }

  function startCategoryPointer(event, key, value, selected) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    categoryDragRef.current = {
      active: false,
      pending: true,
      key,
      value,
      mode: selected ? 'remove' : 'add',
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
      processed: new Set()
    };
  }

  function moveCategoryPointer(event) {
    const dragState = categoryDragRef.current;
    if (!dragState.pending && !dragState.active) return;
    if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) return;
    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (!dragState.active && distance >= 8) {
      categoryDragRef.current = { ...dragState, active: true, pending: false };
      setDraggingCategoryKey(dragState.key);
      applyCategoryDragValue(dragState.key, dragState.value);
    }
    if (!categoryDragRef.current.active) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-category-chip-value]');
    if (!target || target.dataset.categoryChipKey !== categoryDragRef.current.key) return;
    applyCategoryDragValue(categoryDragRef.current.key, target.dataset.categoryChipValue);
  }

  function endCategoryPointer(event) {
    const dragState = categoryDragRef.current;
    if (dragState.pointerId !== null && event?.pointerId !== undefined && event.pointerId !== dragState.pointerId) return;
    if (dragState.pending && !dragState.active && dragState.key && dragState.value) {
      updateDraftFilterValue(dragState.key, dragState.value, 'toggle');
    }
    categoryDragRef.current = { active: false, pending: false, key: '', value: '', mode: 'add', startX: 0, startY: 0, pointerId: null, processed: new Set() };
    setDraggingCategoryKey('');
  }

  function showMoreCategoryOptions(key) {
    setCategoryVisibleCounts((prev) => ({ ...prev, [key]: (prev[key] || CATEGORY_INITIAL_VISIBLE_COUNT) + CATEGORY_INITIAL_VISIBLE_COUNT }));
  }

  function removeDraftFilterValue(key, value) {
    setDraftFilterValue(key, normalizeFilterValues(gameRef.current.draftFilters[key]).filter((item) => item !== value));
  }

  function updateCategorySearch(key, value) {
    setCategorySearch((prev) => ({ ...prev, [key]: value }));
    setCategoryVisibleCounts((prev) => ({ ...prev, [key]: CATEGORY_INITIAL_VISIBLE_COUNT }));
  }


  async function resolveAllMatchingSelection(sourceGame = gameRef.current) {
    const response = await fetch('/api/word-picker/resolve-selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'allMatching',
        query: sourceGame.selectionQuery,
        excludedIds: sourceGame.excludedWordIds
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '条件内の単語確定に失敗しました。');
    return data.words || [];
  }

  function selectAllMatching() {
    setGame((prev) => ({
      ...prev,
      selectionMode: 'allMatching',
      selectionQuery: createSelectionQuery(prev.v2Search, prev.filters),
      selectedWordIds: [],
      excludedWordIds: [],
      errorMessage: ''
    }));
  }

  function clearSelection() {
    setGame((prev) => ({ ...prev, selectionMode: 'manual', selectedWordIds: [], excludedWordIds: [], selectionQuery: {}, errorMessage: '' }));
  }

  function selectVisible(shouldSelect) {
    const visibleIds = gameRef.current.v2Words.map((word) => word.id);
    setGame((prev) => {
      if (prev.selectionMode === 'allMatching') {
        const excluded = new Set(prev.excludedWordIds);
        visibleIds.forEach((id) => (shouldSelect ? excluded.delete(id) : excluded.add(id)));
        return { ...prev, excludedWordIds: [...excluded] };
      }
      const current = new Set(prev.selectedWordIds);
      visibleIds.forEach((id) => (shouldSelect ? current.add(id) : current.delete(id)));
      return { ...prev, selectedWordIds: [...current] };
    });
  }

  function clearSingleFilter(key) {
    const nextFilters = { ...gameRef.current.filters, [key]: key === 'importantOnly' ? false : '' };
    setGame((prev) => ({
      ...prev,
      filters: nextFilters,
      draftFilters: nextFilters,
      v2Words: [],
      v2NextCursor: '0',
      v2HasMore: false,
      v2Total: null,
      selectionMode: 'manual',
      selectedWordIds: [],
      excludedWordIds: [],
      selectionQuery: {}
    }));
    void loadV2Words({ reset: true, search: gameRef.current.v2Search, filters: nextFilters });
  }

  function applyV2WordSearch() {
    const nextSearch = gameRef.current.v2SearchDraft;
    clearSelection();
    void loadV2Words({ reset: true, search: nextSearch, preferCache: false });
  }

  function handleV2WordSearchKeyDown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyV2WordSearch();
  }

  function handleV2ListScroll(event) {
    const target = event.currentTarget;
    const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 240;
    if (nearBottom && gameRef.current.v2HasMore && !gameRef.current.v2Loading && !gameRef.current.v2LoadingMore) {
      void loadV2Words({ reset: false });
    }
  }


  return (
    <main className="pageShell">
      <section className="appCard" aria-label="Muse Note learning game">
        {game.showCircle && <div className="circleMark">◯</div>}

        {game.screen === 'intro' && (
          <div className="intro">
            <div className="topBar">
              <div className="logo large">Muse Note</div>
              <button type="button" className="logoutBtn" onClick={handleLogout}>
                ログアウト
              </button>
            </div>
            <div className="inputRow">
              <input
                className="nameInput"
                value={game.userName}
                onChange={(event) => setGame((prev) => ({ ...prev, userName: event.target.value, errorMessage: '' }))}
                placeholder="ユーザー名"
                autoComplete="name"
              />
              <input
                className="countInput"
                type="number"
                min="1"
                value={game.countInput}
                onChange={(event) => setGame((prev) => ({ ...prev, countInput: event.target.value, errorMessage: '' }))}
                placeholder="出題数（空=全件）"
                aria-label="出題数"
              />
            </div>
            {renderQuestionSettings()}
            {game.questionMode === 'select' && (
              <div className="selectArea">
                <p className="selectedCount">選択中：{selectedCount}語</p>
                {game.isLoading && <p className="wordListHint">単語一覧を読み込んでいます</p>}
                <div className="selectAreaActions">
                  <button type="button" className="openWordModalBtn primaryOpen" onClick={() => void openWordPicker()}>
                    単語を選ぶ
                  </button>
                  <button type="button" className="openWordModalBtn" onClick={() => void openWordPicker('open')}>
                    保存済みセットから選ぶ
                  </button>
                </div>
              </div>
            )}
            <p className="sectionLabel">出題スピード</p>
            <div className="modeButtons" aria-label="スピードモード選択">
              {Object.entries(MODE_TIMING).map(([mode, setting]) => (
                <button
                  className={`modeBtn ${game.mode === mode ? 'active' : ''}`}
                  disabled={game.isLoading}
                  key={mode}
                  onClick={() => setGame((prev) => ({ ...prev, mode, errorMessage: '' }))}
                  type="button"
                >
                  {setting.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="retryBtn primary"
              disabled={game.isLoading}
              onClick={() => (game.questionMode === 'select' ? void handleStartSelected() : handleStart())}
            >
              {game.isLoading ? '読み込み中...' : '開始'}
            </button>
            {game.errorMessage && <p className="errorMessage">{game.errorMessage}</p>}
            {game.wrongModeFallbackAvailable && (
              <button type="button" className="backSettingBtn" onClick={handleStartNormalFallback}>
                通常で始める
              </button>
            )}
          </div>
        )}

        {game.screen === 'game' && (
          <>
            <header className="gameHeader">
              <div className="logo small">Muse Note</div>
              <div className="headerRight">
                <div>{game.answeredCount} / {game.targetCount}</div>
                <div>
                  {formatElapsed(totalElapsed)} / {formatElapsed(questionElapsed, false)}
                </div>
              </div>
            </header>

            <div className="gameArea">
              <button
                className="questionButton"
                onClick={() => speak(currentWord?.english)}
                title="タップで発音します"
                type="button"
              >
                {currentWord?.japanese || '読み込み中...'}
              </button>
              {game.showPhonetic && currentWord?.phonetic && <div className="hintIpa">{currentWord.phonetic}</div>}
              <input
                ref={answerRef}
                className="answerInput"
                value={game.answer}
                onChange={handleAnswerChange}
                onKeyDown={handleAnswerKeyDown}
                inputMode="latin"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck="false"
                disabled={game.state !== 'asking'}
                aria-label="英単語の回答"
              />
              <button className="answerBtn" type="button" onClick={handleAnswerButton}>
                {game.state === 'asking' ? 'Answer ▶' : 'Next ▶'}
              </button>

              {game.result && (
                <div className="resultArea" aria-live="polite">
                  {game.result.correct ? (
                    <div className="compare">
                      <div className="wordLine">
                        <span className="wordCorrect">✔ {game.result.word.english}</span>
                        {game.result.word.phonetic && <span className="ipa">{game.result.word.phonetic}</span>}
                      </div>
                      <div className="feedback correct">正解です！</div>
                    </div>
                  ) : (
                    <div className="compare">
                      <div className="feedback wrong">不正解です</div>
                      <div className="wordLine">
                        正 <span className="wordCorrect">{game.result.word.english}</span>
                        {game.result.word.phonetic && <span className="ipa">{game.result.word.phonetic}</span>}
                      </div>
                      <div className="wordLine">
                        答 <span className="wordInput"><DiffText answer={game.result.answer} correct={game.result.word.english} /></span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {game.screen === 'result' && (
          <div className="reviewScreen">
            <h1>{game.answeredCount}問終了</h1>
            <div className="resultStats">
              <div><strong>{game.correctCount}</strong><span>正解</span></div>
              <div><strong>{game.wrongCount}</strong><span>誤答</span></div>
              <div><strong>{accuracy}%</strong><span>正答率</span></div>
            </div>
            <div className="reviewList">
              {game.reviewData.map((item, index) => (
                <article className="reviewItem" key={`${item.id}-${index}`}>
                  <div className="reviewQuestion">{index + 1}. {item.japanese}</div>
                  <div className="wordRow">
                    <span className="wordLabel">正</span>
                    <span className="wordValue">
                      <span className="wordCorrect">{item.english}</span>
                      <button className="soundBtn" type="button" onClick={() => speak(item.english)} aria-label={`${item.english}を発音`} title="発音を聞く">
                        <span className="soundIcon" aria-hidden="true" />
                      </button>
                      {item.phonetic && <span className="ipa">{item.phonetic}</span>}
                    </span>
                  </div>
                  {!item.correct && (
                    <div className="wordRow">
                      <span className="wordLabel">答</span>
                      <span className="wordValue wordInput"><DiffText answer={item.answer} correct={item.english} /></span>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <div className="retryPanel">
              <p className="sectionLabel">出題設定</p>
              <div className="inputRow">
                <input
                  className="countInput"
                  type="number"
                  min="1"
                  value={game.countInput}
                  onChange={(event) => setGame((prev) => ({ ...prev, countInput: event.target.value, errorMessage: '' }))}
                  placeholder="出題数（空=全件）"
                  aria-label="出題数"
                />
              </div>
              {renderQuestionSettings(true)}
              <div className="modeButtons" aria-label="スピードモード選択">
                {Object.entries(MODE_TIMING).map(([mode, setting]) => (
                  <button
                    className={`modeBtn ${game.mode === mode ? 'active' : ''}`}
                    disabled={game.isLoading}
                    key={mode}
                    onClick={() => setGame((prev) => ({ ...prev, mode, errorMessage: '' }))}
                    type="button"
                  >
                    {setting.label}
                  </button>
                ))}
              </div>
              <div className="retryActions">
                <button className="retryBtn primary" type="button" onClick={handleRetry} disabled={game.isLoading}>
                  {game.isLoading ? '読み込み中...' : '次の問題へ'}
                </button>
                <button className="retryBtn secondary" type="button" onClick={handleRetrySameWords}>
                  もう一度
                </button>
                <button className="retryBtn tertiary" type="button" onClick={() => setGame((prev) => ({ ...prev, screen: 'intro', state: 'idle' }))}>
                  設定
                </button>
              </div>
              {game.wrongModeFallbackAvailable && (
                <button type="button" className="backSettingBtn" onClick={handleStartNormalFallback}>
                  通常で始める
                </button>
              )}
            </div>
          </div>
        )}
      </section>
      {game.screen === 'intro' && game.questionMode === 'select' && game.isWordPickerOpen && (
        <div className="wordPickerScreen" role="dialog" aria-modal="true" aria-label="単語を選ぶ">
          <div className="wordPickerShell">
            <header className="wordPickerHeader compactHeader">
              <h2>単語を選ぶ</h2>
              <button type="button" className="pickerCloseBtn" onClick={() => setGame((prev) => ({ ...prev, isWordPickerOpen: false, pickerPanel: '' }))} aria-label="単語選択を閉じる">×</button>
            </header>

            <section className="pickerControlPanel simplePickerControls" aria-label="検索と操作">
              <div className="pickerSearchRow simpleSearchRow">
                <input
                  className="searchInput pickerSearchInput"
                  placeholder="英語・日本語で検索"
                  value={game.v2SearchDraft}
                  onChange={(event) => setGame((prev) => ({ ...prev, v2SearchDraft: event.target.value }))}
                  onKeyDown={handleV2WordSearchKeyDown}
                />
                <button type="button" className="pickerActionBtn primaryAction" onClick={applyV2WordSearch}>検索</button>
              </div>
              <div className="activeFilterChips" aria-label="現在の条件">
                <span className="conditionLabel">条件：</span>
                {getActiveFilterEntries(game.filters).length === 0 ? (
                  <span className="filterChip neutral">すべて</span>
                ) : getActiveFilterEntries(game.filters).map((filter) => (
                  <button key={filter.key} type="button" className="filterChip removable" onClick={() => clearSingleFilter(filter.key)} aria-label={`${filter.label}条件を解除`}>
                    {filter.label}：{filter.value} <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
              <div className="pickerPrimaryActions" aria-label="単語選択操作">
                <button type="button" className="pickerActionBtn" onClick={() => openPickerPanel('category')}>カテゴリ{activeFilterCount ? `（${activeFilterCount}）` : ''}</button>
                <button type="button" className="pickerActionBtn" onClick={selectAllMatching}>条件内を全件選択</button>
                <button type="button" className="pickerActionBtn" onClick={() => selectVisible(true)}>表示中を選択</button>
                <button type="button" className="pickerActionBtn" onClick={clearSelection}>解除</button>
                <button type="button" className="pickerActionBtn" onClick={() => openPickerPanel('save')}>保存</button>
                <button type="button" className="pickerActionBtn" onClick={() => openPickerPanel('open')}>開く</button>
              </div>
              <div className="pickerResultCount" aria-live="polite">
                <span>表示中：{game.v2Words.length}件</span>
                <span>対象：{game.v2Total !== null ? game.v2Total : '-'}件</span>
                <span>選択中：{selectedCount}語</span>
                {game.selectionMode === 'allMatching' && <span>条件内を全件選択中（除外{game.excludedWordIds.length}語）</span>}
                {game.v2CacheNotice && <span className="cacheNotice">{game.v2CacheNotice}</span>}
              </div>
            </section>
            {!game.pickerPanel && game.wordSetMessage && <p className={`wordSetMessage floatingMessage ${game.wordSetMessageType === 'error' ? 'error' : 'success'}`}>{game.wordSetMessage}</p>}

            {game.pickerPanel === 'category' && (
              <div className="pickerPanelOverlay" role="presentation">
                <section className="pickerPopoverPanel categoryPanel" role="dialog" aria-modal="true" aria-label="カテゴリ選択">
                  <div className="panelTitleRow">
                    <div>
                      <h3>カテゴリを選ぶ</h3>
                    </div>
                    <button type="button" className="panelCloseButton" onClick={closeWordPickerPanel} aria-label="カテゴリ選択を閉じる">×</button>
                  </div>
                  <div className="categoryDraftTotal" aria-live="polite">
                    <span>この条件で表示できる単語：<strong>{categoryState.total}</strong>件</span>
                    {(game.categoryIndexLoading || game.categoryIndexRefreshing || game.categoryIndexCacheNotice) && (
                      <small>{game.categoryIndexCacheNotice || '候補を更新中...'}</small>
                    )}
                  </div>
                  {game.categoryIndexError && <p className="wordSetMessage error">{game.categoryIndexError}</p>}
                  <div className="selectedFilterSummary" aria-label="選択中条件">
                    <span className="selectedFilterSummaryLabel">選択中：</span>
                    {draftFilterEntries.length > 0 ? (
                      <div className="selectedFilterChips">
                        {draftFilterEntries.map((entry) => (
                          <button type="button" className="selectedFilterChip" key={`${entry.key}:${entry.value}`} onClick={() => removeDraftFilterValue(entry.key, entry.value)}>
                            <span>{entry.label}：{entry.value}</span>
                            <b>×</b>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="selectedAllText">すべて</span>
                    )}
                  </div>
                  <div className="categoryAccordionList">
                    {FILTER_KEYS.map((key) => {
                      const options = categoryState.options[key] || [];
                      const selectedValues = normalizeFilterValues(game.draftFilters[key]);
                      const isOpen = openCategoryKey === key;
                      const isUnused = game.categoryIndexLoaded && options.length === 0;
                      return (
                        <div className={`categoryAccordionItem ${isOpen ? 'open' : ''}`} key={key}>
                          <button type="button" className={`categoryAccordionRow ${isOpen ? 'open' : ''} ${isUnused ? 'unused' : ''}`} onClick={() => setOpenCategoryKey(key)} disabled={!game.categoryIndexLoaded} aria-expanded={isOpen} aria-controls={`category-sheet-${key}`}>
                            <span>{FILTER_LABELS[key] || key}</span>
                            <strong>{selectedValues.length ? `${selectedValues.length}件` : (isUnused ? '未使用' : '未選択')}</strong>
                            <b aria-hidden="true">›</b>
                          </button>
                        </div>
                      );
                    })}
                    <label className={`pillCheck filterToggleField importantChipRow ${game.draftFilters.importantOnly ? 'active' : ''}`}>
                      <input type="checkbox" checked={game.draftFilters.importantOnly} onChange={(event) => setDraftFilterValue('importantOnly', event.target.checked)} />
                      <span>{game.draftFilters.importantOnly ? '✓ ' : ''}重要のみ</span>
                    </label>
                  </div>
                  {game.categoryIndexLoaded && !hasAnyCategoryOptions(categoryState.options) && (
                    <p className="wordListHint">カテゴリ項目は未使用です</p>
                  )}
                  <div className="panelActions categoryPanelActions">
                    <button type="button" className="retryBtn secondaryAction compact" onClick={clearDraftCategoryFilters}>クリア</button>
                    <button type="button" className="retryBtn primary compact" onClick={applyCategoryFilters}>適用</button>
                  </div>
                </section>
                {openCategoryKey && (() => {
                  const key = openCategoryKey;
                  const options = categoryState.options[key] || [];
                  const selectedValues = normalizeFilterValues(game.draftFilters[key]);
                  const query = categorySearch[key] || '';
                  const normalizedQuery = normalizeText(query);
                  const selectedOptionItems = options.filter((option) => selectedValues.includes(option.value));
                  const candidateOptions = options
                    .filter((option) => !selectedValues.includes(option.value))
                    .filter((option) => !normalizedQuery || normalizeText(option.value).includes(normalizedQuery))
                    .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0) || a.value.localeCompare(b.value, 'ja', { numeric: true }));
                  const visibleCount = categoryVisibleCounts[key] || CATEGORY_INITIAL_VISIBLE_COUNT;
                  const visibleCandidateOptions = candidateOptions.slice(0, visibleCount);
                  const hasMoreOptions = visibleCandidateOptions.length < candidateOptions.length;
                  return (
                    <section id={`category-sheet-${key}`} className="categoryChoiceSheet" role="dialog" aria-modal="true" aria-label={`${FILTER_LABELS[key] || key}の候補`}>
                      <div className="choiceSheetHandle" aria-hidden="true" />
                      <div className="choiceSheetHeader">
                        <h4>{FILTER_LABELS[key] || key}</h4>
                        <small>{selectedValues.length ? `${selectedValues.length}件選択中` : '未選択'}</small>
                        <button type="button" className="panelCloseButton" onClick={() => setOpenCategoryKey('')} aria-label="候補を閉じる">×</button>
                      </div>
                      <div className="choiceSheetFixedTop">
                        {options.length > CATEGORY_INITIAL_VISIBLE_COUNT && (
                          <input className="categoryOptionSearch" value={query} onChange={(event) => updateCategorySearch(key, event.target.value)} placeholder="候補を検索" aria-label={`${FILTER_LABELS[key] || key}の候補を検索`} />
                        )}
                        {selectedOptionItems.length > 0 && (
                          <div className="choiceSheetSection" aria-label="選択中の候補">
                            <span className="choiceSheetSectionTitle">選択中</span>
                            <div className="optionChipList selectedOptionChipList">
                              {selectedOptionItems.map((option) => (
                                <button type="button" className="optionChip active selectedTopChip" key={option.value} onClick={() => toggleDraftFilterValue(key, option.value)}>
                                  <span>✓ {option.value}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {game.categoryIndexLoaded && options.length === 0 ? (
                        <p className="filterUnusedText compactUnused">未使用</p>
                      ) : (
                        <div className={`choiceSheetScrollable ${draggingCategoryKey === key ? 'dragging' : ''}`} onPointerMove={moveCategoryPointer} onPointerUp={endCategoryPointer} onPointerCancel={endCategoryPointer} onPointerLeave={endCategoryPointer}>
                          <span className="choiceSheetSectionTitle">候補</span>
                          <div className="optionChipList openOptionChipList">
                            {visibleCandidateOptions.map((option) => {
                              const selected = selectedValues.includes(option.value);
                              return (
                                <button
                                  type="button"
                                  className={`optionChip dragOptionChip ${selected ? 'active' : ''}`}
                                  key={option.value}
                                  data-category-chip-key={key}
                                  data-category-chip-value={option.value}
                                  disabled={!game.categoryIndexLoaded}
                                  onPointerDown={(event) => startCategoryPointer(event, key, option.value, selected)}
                                  onClick={(event) => event.preventDefault()}
                                >
                                  <span>{selected ? `✓ ${option.value}` : option.value}</span>
                                </button>
                              );
                            })}
                          </div>
                          {hasMoreOptions && <button type="button" className="showMoreCategoryButton" onClick={() => showMoreCategoryOptions(key)}>もっと見る</button>}
                          {candidateOptions.length === 0 && <p className="filterUnusedText compactUnused">該当する候補がありません</p>}
                        </div>
                      )}
                      <div className="choiceSheetActions">
                        <button type="button" className="retryBtn secondaryAction compact" onClick={() => setDraftFilterValue(key, [])}>この項目を解除</button>
                        <button type="button" className="retryBtn primary compact" onClick={() => setOpenCategoryKey('')}>完了</button>
                      </div>
                    </section>
                  );
                })()}
              </div>
            )}

            {game.pickerPanel === 'save' && (
              <div className="pickerPanelOverlay" role="presentation">
                <section className="pickerPopoverPanel savePanel" role="dialog" aria-modal="true" aria-label="セットとして保存">
                  <div className="panelTitleRow">
                    <div>
                      <p className="panelEyebrow">Save set</p>
                      <h3>選択中の単語を保存</h3>
                    </div>
                    <button type="button" className="panelCloseButton" onClick={closeWordPickerPanel}>閉じる</button>
                  </div>
                  <div className="saveCountCard" aria-live="polite">
                    <span>保存する単語</span>
                    <strong>{selectedCount}語</strong>
                  </div>
                  <p className="panelLead">このセットに{selectedCount}語を保存します。</p>
                  <div className="wordSetSaveRow">
                    <input
                      className="wordSetInput"
                      placeholder="例：1学期期末 / PROGRAM5 / 苦手"
                      value={game.newWordSetName}
                      onChange={(event) => setGame((prev) => ({ ...prev, newWordSetName: event.target.value, wordSetMessage: '', wordSetMessageType: '' }))}
                    />
                    <button type="button" className="retryBtn secondaryAction" onClick={() => void handleSaveWordSet()} disabled={!canSaveWordSet}>保存</button>
                  </div>
                  {selectedCount === 0 && <p className="wordListHint errorHint">保存する単語を1語以上選択してください。</p>}
                  {!game.newWordSetName.trim() && <p className="wordListHint errorHint">セット名を入力すると保存できます。</p>}
                  {game.wordSetMessage && <p className={`wordSetMessage ${game.wordSetMessageType === 'error' ? 'error' : 'success'}`}>{game.wordSetMessage}</p>}
                </section>
              </div>
            )}

            {game.pickerPanel === 'open' && (
              <div className="pickerPanelOverlay" role="presentation">
                <section className="pickerPopoverPanel openPanel" role="dialog" aria-modal="true" aria-label="保存済みセットを開く">
                  <div className="panelTitleRow">
                    <div>
                      <p className="panelEyebrow">Saved sets</p>
                      <h3>保存セットを選択に追加</h3>
                    </div>
                    <button type="button" className="panelCloseButton" onClick={closeWordPickerPanel}>閉じる</button>
                  </div>
                  <div className="wordSetSearchRow">
                    <input
                      className="wordSetInput"
                      placeholder="セット名で検索（例：1学期期末、重要、PROGRAM5）"
                      value={game.wordSetSearch}
                      onChange={(event) => setGame((prev) => ({ ...prev, wordSetSearch: event.target.value }))}
                    />
                    <span className="selectedSetCount">選択中：{game.pendingWordSetIds.length}セット</span>
                  </div>
                  {game.wordSetFetchError && <p className="wordSetInlineNotice">保存済みセットを読み込めませんでした。単語選択はそのまま使えます。</p>}
                  {!game.wordSets.length ? (
                    <p className="emptyWordSets">保存済みセットはありません。</p>
                  ) : filteredWordSets.length === 0 ? (
                    <p className="emptyWordSets">検索条件に合う保存セットはありません。</p>
                  ) : (
                    <div className="savedWordSetList openSetList">
                      {filteredWordSets.map((setItem) => {
                        const checked = pendingWordSetIdSet.has(setItem.id);
                        return (
                          <div key={setItem.id} className={`savedWordSetItem selectableSetItem ${checked ? 'selected' : ''}`} onClick={() => togglePendingWordSet(setItem.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); togglePendingWordSet(setItem.id); } }}>
                            <input type="checkbox" checked={checked} onClick={(event) => event.stopPropagation()} onChange={() => togglePendingWordSet(setItem.id)} />
                            <span className="savedWordSetInfo">
                              <strong>{setItem.name}</strong>
                              <span>{setItem.word_count ?? 0}語</span>
                            </span>
                            <span className="savedWordSetActions inlineActions">
                              <button type="button" onClick={(event) => { event.stopPropagation(); void handleStartFromWordSet(setItem.id); }}>このセットで出題</button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); void handleDeleteWordSet(setItem.id); }}>削除</button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="panelActions splitActions">
                    <span>{filteredWordSets.length}件表示</span>
                    <button type="button" className="retryBtn primary compact" onClick={() => void handleApplyWordSets()} disabled={!game.pendingWordSetIds.length}>適用</button>
                  </div>
                  {game.wordSetMessage && <p className={`wordSetMessage ${game.wordSetMessageType === 'error' ? 'error' : 'success'}`}>{game.wordSetMessage}</p>}
                </section>
              </div>
            )}

            <section className="wordListPanel mainWordListPanel" aria-label="単語一覧">
              <div className="wordListHeader">
                <span>{game.v2Words.length}語表示中{game.v2Total !== null ? ` / 対象${game.v2Total}語` : ''}</span>
              </div>
              <div className="wordList inModal" onScroll={handleV2ListScroll}>
                {game.v2Loading && (
                  <div className="wordListEmpty">
                    <p>最初の20件を読み込んでいます</p>
                  </div>
                )}
                {!game.v2Loading && !game.v2Words.length && (
                  <div className="wordListEmpty compactEmpty">
                    <p>条件に合う単語がありません</p>
                    <p>条件を減らすか、重要のみを解除してください</p>
                    <button type="button" className="pickerActionBtn" onClick={clearFilters}>条件をクリア</button>
                  </div>
                )}
                {game.v2Words.map((word) => (
                  <WordRow
                    key={word.id}
                    word={word}
                    selected={game.selectionMode === 'allMatching' ? !excludedWordIdSet.has(word.id) : selectedWordIdSet.has(word.id)}
                    isImportant={isImportantWord(word)}
                    onToggle={toggleSelectedWord}
                    onSpeak={speak}
                  />
                ))}
                {game.v2Error && <div className="wordListEmpty"><p>{game.v2Error}</p><button type="button" className="pickerActionBtn" onClick={() => void loadV2Words({ reset: game.v2Words.length === 0 })}>再試行</button></div>}
                {game.v2LoadingMore && <div className="wordListEmpty"><p>次の単語を読み込んでいます</p></div>}
                {game.v2HasMore && !game.v2LoadingMore && <button type="button" className="pickerActionBtn" onClick={() => void loadV2Words({ reset: false })}>さらに20件読み込む</button>}
              </div>
            </section>

            <div className="pickerBottomBar">
              <span>選択中：<strong>{selectedCount}</strong>語</span>
              <button type="button" className="retryBtn primary compact" onClick={() => setGame((prev) => ({ ...prev, isWordPickerOpen: false, pickerPanel: '' }))}>決定</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #f6f9ff;
          color: #4f6b94;
          font-family: "Zen Maru Gothic", "Noto Sans JP", Inter, sans-serif;
          -webkit-text-size-adjust: 100%;
        }

        .srOnly {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .pageShell {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 12px;
        }

        .appCard {
          width: 100%;
          max-width: 460px;
          min-height: 420px;
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 6px 16px rgba(80, 100, 150, 0.08);
          padding: 32px 24px 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .topBar,
        .gameHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .topBar {
          margin-bottom: 0.5rem;
        }

        .gameHeader {
          margin-bottom: 1rem;
        }

        .logo.large {
          font-size: 2rem;
          font-weight: 700;
        }

        .logo.small {
          font-size: 1.1rem;
          font-weight: 700;
        }

        .headerRight {
          font-size: 1rem;
          text-align: right;
          line-height: 1.45;
        }

        .introText {
          margin: 0.5rem 0 1rem;
          color: #678;
        }

        .inputRow {
          display: flex;
          gap: 10px;
          margin-top: 0.6rem;
        }

        .nameInput,
        .countInput {
          width: 100%;
          padding: 0.8em;
          border: 2px solid #d0dbf1;
          border-radius: 12px;
          font-size: 1.1rem;
          margin-top: 0;
          background: #ffffff;
          color: #4f6b94;
        }

        .modeButtons {
          margin-top: 0.5rem;
          display: flex;
          gap: 10px;
        }
        .sectionLabel {
          margin: 0.9rem 0 0.35rem;
          font-weight: 700;
          color: #5a7498;
          text-align: left;
        }
        .questionModes {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .selectArea {
          margin-top: 0.8rem;
          text-align: left;
        }
        .openWordModalBtn {
          border: 1px solid #c7d8f0;
          border-radius: 10px;
          background: #f8fbff;
          padding: 0.6em 0.8em;
          color: #486287;
          font-weight: 600;
        }
        .searchInput {
          width: 100%;
          padding: 0.7em;
          border: 1px solid #d0dbf1;
          border-radius: 10px;
        }
        .selectedCount {
          margin: 0.4rem 0;
          font-size: 0.9rem;
        }
        .wordListHint {
          margin: 0;
          font-size: 0.82rem;
          color: #5f789f;
          text-align: left;
        }
        .errorHint {
          color: #bd3c3c;
          font-weight: 700;
        }
        .filterGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          margin-top: 6px;
        }
        .filterSelect {
          border: 1px solid #d0dbf1;
          border-radius: 8px;
          padding: 0.45em;
          font-size: 0.85rem;
        }
        .toggleRow,
        .bulkRow {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .bulkRow button {
          border: 1px solid #c7d8f0;
          border-radius: 8px;
          background: #f8fbff;
          padding: 0.4em 0.6em;
          font-size: 0.8rem;
        }
        .wordList {
          overflow: auto;
          border: 1px solid #e2eaf7;
          border-radius: 10px;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .wordItem {
          border: 1px solid #d5e1f3;
          border-radius: 8px;
          background: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          padding: 0.7em;
          color: #486287;
          text-align: left;
        }
        .wordItem.selected {
          background: #cbe7ff;
          border-color: #4a97de;
          box-shadow: 0 0 0 2px #a9d3fb inset;
        }
        .wordMain { flex: 1; min-width: 0; }
        .badgeRow { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
        .miniBadge { font-size: 0.7rem; border-radius: 999px; background: #eef4ff; padding: 2px 6px; }
        .importantBadge { font-size: 0.7rem; border-radius: 999px; background: #ffdde0; color: #b1001a; padding: 2px 7px; font-weight: 700; }
        .mini { font-size: 0.8rem; color: #6a7f9f; }
        .statsLine { font-size: 0.75rem; margin-top: 4px; color: #4f6b94; }
        .speakerBtn { font-size: 1.1rem; padding: 8px; margin-left: 6px; }
        .modalOverlay {
          position: fixed;
          inset: 0;
          background: rgba(20, 36, 60, 0.35);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 8px;
          z-index: 1000;
        }
        .wordPickerModal {
          width: min(980px, 100%);
          height: min(92vh, 100%);
          background: #fff;
          border-radius: 16px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow: hidden;
        }
        .pickerTopControls {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
        }
        .primaryActions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .compact {
          padding: 0.5em 0.8em;
          min-width: 84px;
        }
        .filterRowCompact {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }
        .filterDetails summary {
          cursor: pointer;
          color: #486287;
          font-size: 0.9rem;
        }
        .wordPickerHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .wordPickerHeader h2 {
          margin: 0;
          color: #4f6b94;
          font-size: 1.2rem;
        }
        .wordList.inModal {
          flex: 1 1 auto;
          max-height: none;
          min-height: 0;
          height: 100%;
        }
        .wordListEmpty {
          padding: 18px 12px;
          font-size: 0.86rem;
          color: #5f789f;
          text-align: center;
          border: 1px dashed #d4def0;
          border-radius: 10px;
          margin: 4px 0 10px;
          background: #f8fbff;
        }
        .wordListEmpty p {
          margin: 4px 0;
        }
        .wordSetPanel {
          border-top: 1px solid #e2eaf7;
          padding-top: 8px;
          text-align: left;
          flex: 0 0 auto;
        }
        .wordSetPanel summary {
          cursor: pointer;
        }
        .wordSetSaveRow {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .wordSetInput {
          flex: 1;
          padding: 0.65em;
          border: 1px solid #d0dbf1;
          border-radius: 10px;
          font-size: 0.95rem;
        }
        .secondaryAction {
          padding: 0.65em 0.9em;
          font-size: 0.85rem;
        }
        .wordSetMessage {
          margin: 6px 0 0;
          font-size: 0.85rem;
        }
        .wordSetMessage.success {
          color: #2f8f44;
        }
        .wordSetMessage.error {
          color: #c73e3e;
        }
        .wordSetInlineNotice {
          margin: 8px 0;
          font-size: 0.8rem;
          color: #8a6d3b;
          background: #fff8e8;
          border: 1px solid #f2e3bd;
          border-radius: 8px;
          padding: 8px 10px;
        }
        .savedWordSets {
          margin-top: 6px;
        }
        .savedWordSetList {
          max-height: 120px;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .savedWordSetItem {
          border: 1px solid #d5e1f3;
          border-radius: 8px;
          padding: 7px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .savedWordSetInfo {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 0.85rem;
        }
        .savedWordSetActions {
          display: flex;
          gap: 6px;
        }
        .savedWordSetActions button {
          border: 1px solid #c7d8f0;
          border-radius: 8px;
          background: #f8fbff;
          padding: 0.35em 0.55em;
          color: #486287;
          font-size: 0.75rem;
        }
        .emptyWordSets {
          margin: 4px 0 0;
          color: #6a7f9f;
          font-size: 0.85rem;
        }


        .selectArea {
          margin-top: 0.8rem;
          padding: 12px;
          border: 1px solid #dce8f8;
          border-radius: 16px;
          background: #f8fbff;
          text-align: left;
        }
        .selectAreaActions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .openWordModalBtn {
          border: 1px solid #c7d8f0;
          border-radius: 12px;
          background: #ffffff;
          padding: 0.75em 0.9em;
          color: #486287;
          font-weight: 700;
          cursor: pointer;
        }
        .openWordModalBtn.primaryOpen {
          background: #e8f4ff;
          border-color: #9bc7f1;
          color: #2f6da8;
        }
        .wordPickerScreen {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: linear-gradient(180deg, #f5f9ff 0%, #edf6ff 100%);
          padding: 14px;
        }
        .wordPickerShell {
          width: min(1220px, 100%);
          height: 100%;
          margin: 0 auto;
          display: grid;
          grid-template-rows: auto auto auto minmax(0, 1fr) auto;
          gap: 10px;
          color: #486287;
        }
        .wordPickerHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 4px 4px;
        }
        .wordPickerEyebrow {
          margin: 0 0 2px;
          color: #7b96b8;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .wordPickerHeader h2 {
          margin: 0;
          color: #315d91;
          font-size: clamp(1.35rem, 3vw, 2rem);
        }
        .pickerCloseBtn {
          border: 1px solid #c7d8f0;
          border-radius: 999px;
          background: #ffffff;
          color: #486287;
          padding: 0.65em 1em;
          font-weight: 700;
          cursor: pointer;
        }
        .pickerControlPanel,
        .wordListPanel {
          border: 1px solid #dce8f8;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 10px 28px rgba(75, 115, 160, 0.08);
        }
        .pickerControlPanel {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pickerSearchRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
        }
        .pickerSearchInput,
        .searchInput {
          width: 100%;
          border: 1px solid #cbdcf3;
          border-radius: 14px;
          background: #ffffff;
          color: #35577f;
          padding: 0.85em 1em;
          font-size: 1rem;
          outline: none;
        }
        .pickerSearchInput:focus,
        .wordSetInput:focus,
        .filterSelect:focus {
          border-color: #7fb1e8;
          box-shadow: 0 0 0 3px rgba(127, 177, 232, 0.18);
        }
        .pickerDecisionBox,
        .pickerBottomActions,
        .basicFilters,
        .pickerBulkRow {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .selectedCountStrong {
          color: #315d91;
          font-weight: 800;
          white-space: nowrap;
        }
        .basicFilters {
          align-items: stretch;
        }
        .filterSelect {
          min-width: 128px;
          border: 1px solid #d0dbf1;
          border-radius: 999px;
          background: #f8fbff;
          color: #486287;
          padding: 0.65em 0.9em;
          font-size: 0.9rem;
        }
        .pillCheck {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #d0dbf1;
          border-radius: 999px;
          background: #f8fbff;
          padding: 0.6em 0.9em;
          color: #486287;
          font-size: 0.9rem;
          font-weight: 700;
        }
        .pillCheck.active {
          background: #e3f1ff;
          border-color: #8fc0ef;
          color: #2f6da8;
        }
        .pillCheck.disabled {
          opacity: 0.55;
        }
        .filterDetails {
          text-align: left;
        }
        .filterDetails summary,
        .wordSetPanel summary,
        .bottomSavePanel summary {
          cursor: pointer;
          color: #426b9b;
          font-weight: 800;
          list-style: none;
        }
        .filterDetails summary::-webkit-details-marker,
        .wordSetPanel summary::-webkit-details-marker,
        .bottomSavePanel summary::-webkit-details-marker {
          display: none;
        }
        .filterDetails summary::before,
        .wordSetPanel summary::before,
        .bottomSavePanel summary::before {
          content: '＋';
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.4em;
          height: 1.4em;
          margin-right: 0.35em;
          border-radius: 999px;
          background: #e8f4ff;
          color: #2f6da8;
        }
        .filterDetails[open] summary::before,
        .wordSetPanel[open] summary::before,
        .bottomSavePanel[open] summary::before {
          content: '−';
        }
        .detailFilterGrid {
          grid-template-columns: repeat(5, minmax(130px, 1fr));
          margin-top: 8px;
        }
        .pickerBulkRow {
          margin-top: 0;
        }
        .pickerBulkRow button,
        .bulkRow button {
          border: 1px solid #bad2ef;
          border-radius: 12px;
          background: #ffffff;
          color: #486287;
          padding: 0.55em 0.75em;
          font-size: 0.86rem;
          font-weight: 700;
          cursor: pointer;
        }
        .visibleCount {
          margin-left: auto;
          color: #6a83a6;
          font-size: 0.85rem;
          font-weight: 700;
        }
        .wordSetPanel {
          border: 1px solid #e0eaf8;
          border-radius: 14px;
          background: #fbfdff;
          padding: 10px;
          text-align: left;
          flex: 0 0 auto;
        }
        .wordSetPanelBody {
          display: grid;
          grid-template-columns: minmax(260px, 0.8fr) minmax(320px, 1.2fr);
          gap: 12px;
          margin-top: 10px;
        }
        .wordSetSaveRow,
        .bottomSavePopover {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .wordSetInput {
          flex: 1;
          min-width: 0;
          padding: 0.7em 0.85em;
          border: 1px solid #d0dbf1;
          border-radius: 12px;
          font-size: 0.95rem;
        }
        .savedWordSetList {
          max-height: 132px;
          overflow: auto;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 8px;
        }
        .savedWordSetItem {
          border: 1px solid #d5e1f3;
          border-radius: 12px;
          padding: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          background: #ffffff;
        }
        .savedWordSetInfo {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 0.86rem;
        }
        .savedWordSetInfo strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .savedWordSetActions {
          display: flex;
          flex-direction: column;
          gap: 5px;
          flex: 0 0 auto;
        }
        .savedWordSetActions button {
          border: 1px solid #c7d8f0;
          border-radius: 9px;
          background: #f8fbff;
          padding: 0.35em 0.55em;
          color: #486287;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
        }
        .wordListPanel {
          min-height: 0;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .wordListHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #5a7498;
          padding: 0 2px;
        }
        .wordListHeader h3 {
          margin: 0;
          font-size: 1rem;
        }
        .wordList.inModal {
          flex: 1 1 auto;
          min-height: 0;
          height: 100%;
          max-height: none;
          overflow: auto;
          border: 1px solid #e2eaf7;
          border-radius: 14px;
          background: #f8fbff;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .wordRowItem {
          position: relative;
          width: 100%;
          display: grid;
          grid-template-columns: 30px minmax(0, 1fr) 42px;
          align-items: center;
          gap: 10px;
          border: 1px solid #dce7f6;
          border-left: 5px solid transparent;
          border-radius: 15px;
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          color: #365b86;
          padding: 10px 10px 10px 8px;
          box-shadow: 0 4px 14px rgba(60, 100, 145, 0.05);
          transition: transform 0.16s, border-color 0.16s, background 0.16s, box-shadow 0.16s;
          text-align: left;
          cursor: pointer;
        }
        .wordRowItem:hover {
          border-color: #b9d2ef;
          background: #fbfdff;
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(60, 100, 145, 0.08);
        }
        .wordRowItem.selected {
          background: linear-gradient(90deg, #dff0ff 0%, #eff8ff 100%);
          border-color: #8bc4f3;
          border-left-color: #2584d9;
          box-shadow: inset 0 0 0 1px rgba(37, 132, 217, 0.16), 0 8px 22px rgba(37, 132, 217, 0.12);
        }
        .wordCheck {
          width: 24px;
          height: 24px;
          border: 2px solid #b8cce6;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          background: #ffffff;
          font-weight: 900;
          line-height: 1;
        }
        .wordRowItem.selected .wordCheck {
          border-color: #2584d9;
          background: linear-gradient(180deg, #48a2ed 0%, #2584d9 100%);
          box-shadow: 0 4px 10px rgba(37, 132, 217, 0.28);
        }
        .wordRowMain {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .wordTitleLine {
          min-width: 0;
          display: flex;
          align-items: baseline;
          gap: 10px;
        }
        .wordEnglish {
          color: #174b82;
          font-size: 1.12rem;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }
        .wordJapanese {
          color: #365f8e;
          font-size: 0.96rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .wordMetaLine {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .wordPhonetic {
          flex: 0 0 auto;
          color: #8198b5;
          font-size: 0.8rem;
        }
        .wordTags {
          min-width: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .wordTag {
          border-radius: 999px;
          background: #eef5ff;
          color: #526f93;
          padding: 2px 7px;
          font-size: 0.68rem;
          font-weight: 800;
          line-height: 1.35;
        }
        .wordTag.important {
          background: #ffe7ec;
          color: #b62545;
        }
        .wordTag.unseen {
          background: #edf8f0;
          color: #33834b;
        }
        .wordSpeaker {
          justify-self: end;
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: linear-gradient(180deg, #eef7ff 0%, #deefff 100%);
          border: 1px solid #cfe2f7;
          font-size: 1rem;
          box-shadow: 0 4px 10px rgba(63, 142, 215, 0.10);
          transition: transform 0.16s, filter 0.16s;
        }
        .wordSpeaker:hover {
          filter: brightness(1.04);
          transform: scale(1.04);
        }

        .wordRowItem {
          grid-template-columns: 7px minmax(0, 1fr) 40px;
          gap: 10px;
          min-height: 54px;
          padding: 8px 10px 8px 0;
          border: 1px solid #dce7f6;
          background: #ffffff;
          box-shadow: 0 3px 12px rgba(60, 100, 145, 0.05);
        }
        .wordRowItem.selected {
          background: #d8edff;
          border-color: #4d9fe8;
          box-shadow: inset 0 0 0 1px rgba(37, 132, 217, 0.24), 0 10px 24px rgba(37, 132, 217, 0.18);
        }
        .wordRowItem.selected:hover {
          background: #d8edff;
          border-color: #2f8ed8;
          box-shadow: inset 0 0 0 1px rgba(37, 132, 217, 0.28), 0 12px 26px rgba(37, 132, 217, 0.20);
        }
        .wordSelectionRail {
          width: 7px;
          height: 100%;
          align-self: stretch;
          border-radius: 14px 0 0 14px;
          background: transparent;
        }
        .wordRowItem.selected .wordSelectionRail {
          background: #1f7fd1;
        }
        .wordRowMain {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 10px;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
        }
        .wordEnglish {
          flex: 0 0 auto;
          font-weight: 900;
        }
        .wordJapanese {
          flex: 0 1 auto;
          min-width: 5em;
        }
        .wordPhonetic {
          flex: 0 0 auto;
          color: #8a9fba;
        }
        .wordTags {
          flex: 1 1 auto;
          flex-wrap: nowrap;
          overflow: hidden;
        }
        .wordTag {
          flex: 0 0 auto;
          padding: 2px 6px;
          font-size: 0.66rem;
        }
        .wordSpeaker {
          flex: 0 0 auto;
        }
        .pickerBottomBar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border: 1px solid #cfe0f5;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 -8px 24px rgba(75, 115, 160, 0.10);
          color: #315d91;
          font-weight: 800;
        }
        .bottomSavePanel {
          position: relative;
        }
        .bottomSavePanel summary {
          border: 1px solid #bad2ef;
          border-radius: 12px;
          background: #ffffff;
          padding: 0.55em 0.75em;
          font-size: 0.86rem;
        }
        .bottomSavePopover {
          position: absolute;
          right: 0;
          bottom: calc(100% + 8px);
          width: min(360px, 80vw);
          border: 1px solid #d5e1f3;
          border-radius: 14px;
          background: #ffffff;
          padding: 10px;
          box-shadow: 0 14px 34px rgba(63, 94, 130, 0.18);
          z-index: 2;
        }

        .compactHeader {
          padding-bottom: 0;
        }
        .pickerHeaderActions,
        .pickerPrimaryActions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .activeFilterChips {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          padding-top: 4px;
        }
        .conditionLabel {
          font-weight: 800;
          color: #46607e;
        }
        .filterChip {
          border: 1px solid #cfe2ff;
          border-radius: 999px;
          background: #eef6ff;
          color: #2f5f91;
          font-weight: 800;
          padding: 6px 10px;
          line-height: 1;
        }
        .filterChip.removable {
          cursor: pointer;
        }
        .filterChip.neutral {
          background: #f7f9fc;
          color: #607089;
          border-color: #dfe7f2;
        }
        .allMatchingStatus {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          padding: 10px 12px;
          border: 1px solid #bfe3ff;
          border-radius: 14px;
          background: #f0f8ff;
          color: #2f5f91;
        }
        .simplePickerControls {
          gap: 8px;
        }
        .simpleSearchRow {
          grid-template-columns: minmax(180px, 1fr) auto;
          gap: 8px;
        }
        .pickerActionBtn {
          border: 1px solid #bad2ef;
          border-radius: 12px;
          background: #ffffff;
          color: #486287;
          padding: 0.65em 0.85em;
          font-size: 0.88rem;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }
        .pickerActionBtn.primaryAction {
          background: #e7f3ff;
          border-color: #8fc0ef;
          color: #27649d;
        }
        .cacheNotice {
          color: #8a6d1d;
          font-size: 0.78rem;
          background: #fff7d6;
          border: 1px solid #f3df97;
          border-radius: 999px;
          padding: 4px 8px;
        }

        .cacheNotice.underHeader {
          display: inline-block;
          margin: 0 0 8px;
        }

        .pickerPerfPanel {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 10px;
          align-items: center;
          justify-content: center;
          margin: 8px 0 10px;
          color: #6b7890;
          font-size: 0.72rem;
        }

        .pickerPerfPanel span,
        .pickerPerfPanel strong {
          border: 1px solid #dbe6f7;
          border-radius: 999px;
          background: #f8fbff;
          padding: 3px 7px;
        }

        .pickerPerfPanel strong {
          color: #b42318;
          background: #fff1f0;
          border-color: #ffccc7;
        }

        .selectedInline {
          margin-left: auto;
          color: #315d91;
          font-weight: 800;
          white-space: nowrap;
        }
        .pickerPopoverPanel {
          border: 1px solid #dce8f8;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 10px 28px rgba(75, 115, 160, 0.10);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 0;
        }

        .pickerPanelOverlay {
          position: fixed;
          inset: 0;
          z-index: 1002;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(27, 55, 92, 0.28);
          backdrop-filter: blur(3px);
        }
        .pickerPanelOverlay .pickerPopoverPanel {
          width: min(720px, calc(100vw - 28px));
          max-height: min(82vh, 720px);
          overflow: auto;
          border-color: #c8dcf4;
          border-radius: 24px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 24px 70px rgba(37, 82, 132, 0.24);
          padding: 18px;
        }
        .pickerPanelOverlay .openPanel {
          width: min(860px, calc(100vw - 28px));
        }
        .panelEyebrow {
          margin: 0 0 3px;
          color: #7e9abe;
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .panelLead {
          margin: 0;
          color: #5d789e;
          font-size: 0.9rem;
          font-weight: 700;
        }
        .wordSetSearchRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
        }
        .selectedSetCount {
          border: 1px solid #cfe0f5;
          border-radius: 999px;
          background: #eef6ff;
          color: #315d91;
          padding: 0.65em 0.9em;
          font-size: 0.86rem;
          font-weight: 900;
          white-space: nowrap;
        }
        .selectableSetItem {
          cursor: pointer;
          transition: transform 0.16s, border-color 0.16s, box-shadow 0.16s, background 0.16s;
        }
        .selectableSetItem:hover {
          transform: translateY(-1px);
          border-color: #9fc8f0;
          box-shadow: 0 10px 24px rgba(72, 113, 158, 0.12);
        }
        .selectableSetItem.selected {
          border-color: #78b5eb;
          background: #eaf5ff;
          box-shadow: inset 4px 0 0 #3f8ed7;
        }
        .selectableSetItem input {
          width: 18px;
          height: 18px;
          accent-color: #3f8ed7;
        }
        .inlineActions {
          flex-direction: row;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .splitActions {
          align-items: center;
        }
        .splitActions span {
          margin-right: auto;
          color: #6b85a8;
          font-size: 0.84rem;
          font-weight: 800;
        }
        .panelTitleRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .panelTitleRow h3 {
          margin: 0;
          color: #315d91;
          font-size: 1rem;
        }
        .panelCloseButton {
          border: 1px solid #c7d8f0;
          border-radius: 999px;
          background: #f8fbff;
          color: #486287;
          padding: 0.45em 0.8em;
          font-weight: 800;
          cursor: pointer;
        }
        .panelCountRow {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .panelCountRow span,
        .saveCountCard {
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border: 1px solid #cfe0f5;
          border-radius: 14px;
          background: #f2f8ff;
          color: #527195;
          padding: 0.65em 0.9em;
          font-size: 0.9rem;
          font-weight: 800;
        }
        .panelCountRow strong,
        .saveCountCard strong {
          color: #236aa8;
          font-size: 1rem;
        }
        .saveCountCard {
          background: linear-gradient(180deg, #eef7ff 0%, #f8fbff 100%);
        }
        .categoryFilterGrid {
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          margin-top: 0;
          align-items: end;
        }

        .categoryDraftTotal {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .categoryDraftTotal small {
          color: #7890ad;
          font-size: 0.75rem;
          font-weight: 800;
        }
        .selectedFilterChips,
        .optionChipList {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .selectedFilterChip,
        .optionChip {
          border: 1px solid #cfe0f5;
          border-radius: 999px;
          background: #ffffff;
          color: #42658d;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0.45em 0.75em;
          font-size: 0.78rem;
          font-weight: 900;
          cursor: pointer;
        }
        .selectedFilterChip {
          background: #eef7ff;
          border-color: #9dccf5;
          color: #236aa8;
        }
        .selectedFilterChip b {
          font-size: 0.9rem;
        }

        .selectedFilterSummary {
          display: grid;
          gap: 8px;
          padding: 10px;
          border: 1px solid #e0ebf8;
          border-radius: 16px;
          background: #fbfdff;
        }
        .selectedFilterSummaryLabel {
          color: #527195;
          font-size: 0.82rem;
          font-weight: 900;
        }
        .selectedAllText {
          color: #6f89aa;
          font-size: 0.9rem;
          font-weight: 900;
        }
        .categoryAccordionList {
          display: grid;
          gap: 8px;
        }
        .categoryAccordionItem {
          display: grid;
          border-radius: 18px;
        }
        .categoryAccordionRow {
          min-height: 52px;
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 10px;
          width: 100%;
          border: 1px solid #e0ebf8;
          border-radius: 16px;
          background: #ffffff;
          color: #315d91;
          padding: 0.78em 0.9em;
          text-align: left;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(62, 105, 151, 0.08);
        }
        .categoryAccordionRow.open {
          border-color: #83bff2;
          background: linear-gradient(135deg, #eef8ff 0%, #f8fcff 100%);
          box-shadow: 0 10px 24px rgba(47, 142, 216, 0.15);
        }
        .categoryAccordionRow.unused { color: #8aa0bb; }
        .categoryAccordionRow strong {
          border-radius: 999px;
          background: #eef6ff;
          color: #527195;
          font-size: 0.78rem;
          padding: 0.34em 0.65em;
          white-space: nowrap;
        }
        .categoryAccordionRow.open strong {
          background: #dff0ff;
          color: #236aa8;
        }
        .categoryAccordionRow b {
          color: #88a2c1;
          font-size: 1.25rem;
          line-height: 1;
        }
        .importantChipRow {
          justify-content: center;
          min-height: 44px;
          border-radius: 14px;
        }
        .categoryChoiceSheet {
          position: fixed;
          left: 50%;
          bottom: max(10px, env(safe-area-inset-bottom));
          z-index: 1004;
          width: min(720px, calc(100vw - 20px));
          max-height: min(72vh, 620px);
          display: grid;
          grid-template-rows: auto auto auto minmax(0, 1fr) auto;
          gap: 10px;
          border: 1px solid #c8dcf4;
          border-radius: 26px 26px 22px 22px;
          background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, #f7fbff 100%);
          box-shadow: 0 -18px 60px rgba(24, 58, 99, 0.26);
          padding: 10px 14px 14px;
          transform: translateX(-50%);
        }
        .choiceSheetHandle {
          width: 42px;
          height: 5px;
          justify-self: center;
          border-radius: 999px;
          background: #c9d8ea;
        }
        .choiceSheetHeader {
          display: grid;
          grid-template-columns: 1fr auto 40px;
          align-items: center;
          gap: 10px;
        }
        .choiceSheetHeader h4 {
          margin: 0;
          color: #315d91;
          font-size: 1rem;
        }
        .choiceSheetHeader small {
          color: #7890ad;
          font-weight: 900;
        }
        .choiceSheetFixedTop {
          display: grid;
          gap: 10px;
          min-width: 0;
        }
        .choiceSheetSection {
          display: grid;
          gap: 7px;
          min-width: 0;
        }
        .choiceSheetSectionTitle {
          color: #607b9d;
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.03em;
        }
        .categoryOptionSearch {
          min-height: 42px;
          border: 1px solid #cfe0f5;
          border-radius: 999px;
          background: #ffffff;
          color: #315d91;
          padding: 0 0.95em;
          font-weight: 800;
          min-width: 0;
        }
        .choiceSheetScrollable {
          min-height: 0;
          overflow: auto;
          display: grid;
          align-content: start;
          gap: 8px;
          padding: 2px 2px 10px;
          touch-action: pan-y;
          overscroll-behavior: contain;
        }
        .choiceSheetScrollable.dragging {
          touch-action: none;
          user-select: none;
        }
        .openOptionChipList,
        .selectedOptionChipList {
          align-content: start;
          max-height: none;
          min-height: 0;
          overflow: visible;
          padding: 0;
          touch-action: inherit;
        }
        .openOptionChipList .optionChip,
        .selectedOptionChipList .optionChip {
          min-height: 42px;
          padding: 0.64em 0.95em;
          font-size: 0.9rem;
        }
        .optionChip.active {
          border-color: #61a9e8;
          background: linear-gradient(135deg, #e5f4ff 0%, #f5fbff 100%);
          color: #1969aa;
          box-shadow: inset 0 0 0 1px rgba(63, 142, 215, 0.18);
        }
        .selectedTopChip,
        .dragOptionChip {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: transform 0.12s ease, background-color 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
        }
        .dragOptionChip:hover,
        .dragOptionChip:focus-visible {
          border-color: #83bff2;
          background: #f2f9ff;
          box-shadow: 0 5px 14px rgba(47, 142, 216, 0.12);
        }
        .dragOptionChip:active {
          transform: scale(0.98);
          box-shadow: 0 4px 12px rgba(47, 142, 216, 0.18);
        }
        .showMoreCategoryButton {
          min-height: 42px;
          border: 1px dashed #9cc8ee;
          border-radius: 14px;
          background: #f4faff;
          color: #2875b4;
          font-weight: 900;
          cursor: pointer;
        }
        .choiceSheetActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding-top: 8px;
          border-top: 1px solid #e3eefb;
          background: linear-gradient(180deg, rgba(247,251,255,0.85), #f7fbff 45%);
        }
        .choiceSheetActions .retryBtn {
          min-height: 44px;
        }
        .compactUnused {
          margin: 0;
          font-weight: 800;
        }
        .chipFilterGrid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .chipFilterField {
          display: grid;
          gap: 7px;
          padding: 10px;
          border: 1px solid #e0ebf8;
          border-radius: 16px;
          background: #fbfdff;
        }
        .chipFilterTitle {
          color: #315d91;
          font-size: 0.82rem;
          font-weight: 900;
        }
        .optionChip small {
          min-width: 1.7em;
          border-radius: 999px;
          background: #edf4fc;
          color: #6f89aa;
          padding: 0.1em 0.45em;
          font-size: 0.7rem;
        }
        .optionChip.active {
          background: #2f8ed8;
          border-color: #2f8ed8;
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(47, 142, 216, 0.18);
        }
        .optionChip.active small {
          background: rgba(255, 255, 255, 0.22);
          color: #ffffff;
        }
        .filterField {
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: #5f789f;
          font-size: 0.76rem;
          font-weight: 800;
          text-align: left;
        }
        .filterField .filterSelect {
          width: 100%;
          min-width: 0;
          height: 44px;
          border-radius: 12px;
          padding: 0 0.85em;
          background: #ffffff;
        }
        .filterUnusedText {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          width: fit-content;
          border-radius: 999px;
          padding: 0.25em 0.75em;
          background: #f3f7fb;
          color: #8aa0bb;
          font-size: 0.72rem;
          font-weight: 800;
        }
        .filterToggleField {
          min-height: 44px;
          align-self: end;
          border-radius: 12px;
          background: #ffffff;
          padding: 0 0.85em;
          font-size: 0.9rem;
          line-height: 1;
        }
        .filterToggleField input {
          width: 18px;
          height: 18px;
          margin: 0;
          accent-color: #3f8ed7;
        }
        .filterToggleField span {
          display: inline-flex;
          align-items: center;
          min-height: 42px;
        }
        .panelActions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }
        .openSetList {
          max-height: min(34vh, 260px);
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }
        .mainWordListPanel {
          min-height: 0;
        }
        .wordRowItem {
          grid-template-columns: 7px minmax(180px, 1fr) minmax(190px, 0.72fr) 36px;
          gap: 10px;
          min-height: 54px;
          align-items: center;
          padding: 7px 9px 7px 0;
          border: 1px solid #dce7f6;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 3px 12px rgba(60, 100, 145, 0.05);
        }
        .wordRowItem:hover {
          background: #fbfdff;
          border-color: #b9d2ef;
          transform: translateY(-1px);
          box-shadow: 0 8px 18px rgba(60, 100, 145, 0.08);
        }
        .wordRowItem.selected {
          background: #d8edff;
          border-color: #4d9fe8;
          box-shadow: inset 0 0 0 1px rgba(37, 132, 217, 0.24), 0 10px 24px rgba(37, 132, 217, 0.18);
        }
        .wordRowItem.selected:hover {
          background: #d8edff;
          border-color: #2f8ed8;
          box-shadow: inset 0 0 0 1px rgba(37, 132, 217, 0.28), 0 12px 26px rgba(37, 132, 217, 0.20);
        }
        .wordSelectionRail {
          width: 7px;
          height: 100%;
          align-self: stretch;
          border-radius: 14px 0 0 14px;
          background: transparent;
        }
        .wordRowItem.selected .wordSelectionRail {
          background: #1f7fd1;
        }
        .wordPrimaryInfo {
          min-width: 0;
          display: flex;
          align-items: baseline;
          gap: 9px;
          white-space: nowrap;
          overflow: hidden;
        }
        .wordEnglish {
          flex: 0 0 auto;
          color: #174b82;
          font-size: 1.08rem;
          font-weight: 900;
          letter-spacing: 0.01em;
        }
        .wordJapanese {
          flex: 0 1 auto;
          min-width: 3.5em;
          color: #365f8e;
          font-size: 0.94rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .wordPhonetic {
          flex: 0 2 auto;
          min-width: 0;
          color: #7f96b2;
          font-size: 0.78rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .wordMetaInfo {
          min-width: 0;
          display: grid;
          grid-template-rows: repeat(2, 18px);
          gap: 2px;
          padding-left: 10px;
          border-left: 1px solid #dce9f8;
          align-content: center;
        }
        .wordTagLine {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 4px;
          overflow: hidden;
        }
        .wordTag {
          flex: 0 1 auto;
          min-width: 0;
          max-width: 100%;
          border: 1px solid #d7e6f8;
          border-radius: 999px;
          background: #f1f7ff;
          color: #526f93;
          padding: 1px 6px;
          font-size: 0.64rem;
          font-weight: 800;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .wordTag.important {
          border-color: #f4b6a5;
          background: #fff0e8;
          color: #c04620;
          box-shadow: inset 0 0 0 1px rgba(232, 104, 55, 0.12);
        }
        .wordTag.unseen {
          border-color: #cce8d4;
          background: #edf8f0;
          color: #33834b;
        }
        .wordSpeaker {
          justify-self: end;
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: linear-gradient(180deg, #f7fbff 0%, #e7f3ff 100%);
          border: 1px solid #c8ddf4;
          color: #2f7fca;
          box-shadow: 0 3px 9px rgba(63, 142, 215, 0.10);
          cursor: pointer;
          padding: 0;
          transition: transform 0.16s, filter 0.16s, box-shadow 0.16s, border-color 0.16s;
        }
        .wordSpeaker:hover,
        .wordSpeaker:focus-visible {
          border-color: #8fc0ef;
          filter: brightness(1.03);
          transform: scale(1.04);
          box-shadow: 0 6px 14px rgba(63, 142, 215, 0.16);
          outline: none;
        }
        .wordSpeakerIcon {
          width: 18px;
          height: 18px;
          display: block;
        }
        .wordSpeakerIcon path:first-child {
          fill: currentColor;
          stroke: none;
        }
        .wordSpeakerIcon path:not(:first-child) {
          fill: none;
          stroke: currentColor;
          stroke-width: 1.7;
          stroke-linecap: round;
          stroke-linejoin: round;
        }


        /* Word picker V2 simplified selectable layout */
        .wordPickerShell {
          grid-template-rows: auto auto minmax(0, 1fr) auto;
        }
        .compactHeader {
          padding: 4px 2px 0;
        }
        .pickerPrimaryActions {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
        }
        .pickerPrimaryActions .pickerActionBtn {
          width: 100%;
        }
        .pickerResultCount {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          color: #607a9e;
          font-size: 0.85rem;
          font-weight: 800;
        }
        .wordListHeader {
          justify-content: flex-end;
          font-size: 0.84rem;
          font-weight: 800;
        }
        .wordRowItem {
          grid-template-columns: 7px minmax(120px, 1fr) minmax(140px, 0.56fr) 26px 34px;
          min-height: 50px;
          padding: 6px 8px 6px 0;
        }
        .wordPrimaryInfo {
          flex-wrap: wrap;
          gap: 2px 8px;
          line-height: 1.2;
        }
        .wordEnglish::after {
          content: ' /';
          color: #9aaec8;
          font-weight: 700;
        }
        .wordPhonetic {
          flex-basis: 100%;
          font-size: 0.72rem;
        }
        .wordMetaInfo {
          grid-template-rows: 18px;
        }
        .wordMetaInfo .wordTagLine:nth-child(2) {
          display: none;
        }
        .wordCheck {
          width: 24px;
          height: 24px;
          border: 2px solid #b8cce6;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          background: #ffffff;
          font-size: 0.95rem;
          font-weight: 900;
          line-height: 1;
        }
        .wordRowItem.selected .wordCheck {
          border-color: #2584d9;
          background: linear-gradient(180deg, #48a2ed 0%, #2584d9 100%);
          box-shadow: 0 4px 10px rgba(37, 132, 217, 0.28);
        }
        .pickerBottomBar {
          position: sticky;
          bottom: 0;
          z-index: 3;
        }
        .compactEmpty {
          min-height: auto;
          padding: 18px 12px;
          gap: 8px;
        }


        .pickerCloseBtn,
        .panelCloseButton {
          width: 42px;
          height: 42px;
          min-width: 42px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 1.35rem;
          line-height: 1;
        }
        .categoryDraftTotal {
          min-height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #cfe2ff;
          border-radius: 16px;
          background: linear-gradient(180deg, #eef7ff 0%, #f8fbff 100%);
          color: #42658d;
          font-size: 0.95rem;
          font-weight: 800;
          padding: 0.65em 0.9em;
        }
        .categoryDraftTotal strong {
          color: #1f6fb2;
          font-size: 1.15em;
        }
        .categoryPanelActions {
          position: sticky;
          bottom: 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding-top: 8px;
          background: linear-gradient(180deg, rgba(255,255,255,0.78), #ffffff 40%);
        }
        .categoryPanelActions .retryBtn {
          min-height: 44px;
        }

        @media (max-width: 560px) {
          .openCategoryPanelHeader { grid-template-columns: 1fr; }
          .categoryAccordionRow { grid-template-columns: 1fr auto auto; padding: 0.68em 0.75em; }
          .categoryAccordionRow strong { font-size: 0.74rem; }
        }

        @media (max-width: 780px) {
          .pickerHeaderActions {
            justify-content: flex-end;
          }
          .simpleSearchRow {
            grid-template-columns: 1fr auto;
          }
          .pickerPrimaryActions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }
          .pickerActionBtn {
            padding: 0.58em 0.45em;
            font-size: 0.82rem;
          }
          .wordPickerScreen {
            padding: 8px;
          }
          .wordPickerShell {
            gap: 8px;
          }
          .wordPickerHeader {
            padding-top: 4px;
          }
          .pickerControlPanel {
            padding: 10px;
            gap: 8px;
          }
          .pickerPanelOverlay {
            padding: 10px;
            align-items: flex-start;
          }
          .pickerPanelOverlay .pickerPopoverPanel {
            width: 100%;
            max-height: calc(100vh - 20px);
            border-radius: 20px;
            padding: 14px;
          }
          .wordSetSearchRow {
            grid-template-columns: 1fr;
          }
          .pickerSearchRow {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .pickerSearchRow.simpleSearchRow {
            grid-template-columns: 1fr auto;
          }
          .pickerDecisionBox {
            justify-content: space-between;
          }
          .basicFilters {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .filterSelect {
            width: 100%;
            min-width: 0;
          }
          .detailFilterGrid,
          .wordSetPanelBody {
            grid-template-columns: 1fr;
          }
          .pickerBulkRow {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
          .pickerBulkRow button:first-child,
          .visibleCount {
            grid-column: 1 / -1;
          }
          .visibleCount {
            margin-left: 0;
          }
          .wordListHeader {
            display: none;
          }
          .wordListPanel {
            padding: 6px;
          }
          .wordRowItem {
            grid-template-columns: 7px minmax(0, 1fr) 24px 30px;
            gap: 5px;
            min-height: 50px;
            padding: 6px 6px 6px 0;
            border-radius: 11px;
          }
          .wordSelectionRail {
            border-radius: 11px 0 0 11px;
          }
          .wordTitleLine {
            gap: 6px;
          }
          .wordEnglish {
            font-size: 0.98rem;
          }
          .wordJapanese {
            min-width: 2.5em;
            font-size: 0.84rem;
          }
          .wordRowMain {
            gap: 6px;
          }
          .wordPhonetic {
            display: inline;
            font-size: 0.68rem;
          }
          .wordTags {
            max-height: 22px;
            overflow: hidden;
          }
          .panelCountRow {
            grid-template-columns: 1fr;
          }
          .wordSpeaker {
            width: 30px;
            height: 30px;
          }
          .wordSpeakerIcon {
            width: 17px;
            height: 17px;
          }
          .wordPrimaryInfo {
            gap: 5px;
          }
          .wordMetaInfo {
            display: none;
          }
          .wordTagLine {
            gap: 3px;
          }
          .wordTag {
            padding: 1px 4px;
            font-size: 0.58rem;
          }
          .pickerBottomBar {
            padding: 8px;
            border-radius: 14px;
          }
          .pickerBottomActions {
            gap: 6px;
          }
          .bottomSavePanel summary::before {
            display: none;
          }
          .bottomSavePanel summary {
            padding: 0.55em 0.65em;
          }
        }

        .modeBtn,
        .answerBtn,
        .retryBtn,
        .logoutBtn {
          border: none;
          color: #ffffff;
          background: #a8c9f0;
          border-radius: 12px;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(168, 201, 240, 0.35);
          transition: transform 0.2s, filter 0.2s, opacity 0.2s;
        }

        .modeBtn:hover,
        .answerBtn:hover,
        .retryBtn:hover,
        .logoutBtn:hover {
          filter: brightness(1.08);
        }

        .modeBtn:active,
        .answerBtn:active,
        .retryBtn:active,
        .logoutBtn:active {
          transform: scale(0.97);
        }

        .modeBtn:disabled {
          cursor: wait;
          opacity: 0.72;
        }

        .modeBtn {
          flex: 1;
          padding: 0.9em 0;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .modeBtn.active {
          background: #7fb1e8;
        }

        .logoutBtn {
          padding: 0.55em 0.85em;
          font-size: 0.9rem;
          white-space: nowrap;
        }

        .gameArea {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .questionButton {
          margin-top: 1rem;
          font-size: 1.8rem;
          font-weight: 700;
          color: #4f6b94;
          cursor: pointer;
          background: transparent;
          border: none;
          padding: 0.2em;
        }

        .hintIpa {
          min-height: 1.5rem;
          margin-top: 0.3rem;
          color: #678;
          font-size: 0.95rem;
        }

        .answerInput {
          width: min(100%, 340px);
          margin-top: 0;
          font-size: 1.4rem;
          padding: 0.4em 0.2em;
          border: none;
          border-bottom: 3px solid #cdd9f2;
          background: transparent;
          text-align: center;
          outline: none;
          color: #333;
        }

        .answerInput:disabled {
          color: #777;
          opacity: 1;
        }

        .answerBtn {
          margin-top: 1rem;
          width: auto;
          padding: 0.7em 1.2em;
          font-size: 1.2rem;
          border-radius: 10px;
        }

        .resultArea {
          width: 100%;
          min-height: 92px;
          margin-top: 1rem;
        }

        .compare {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          margin-left: 8px;
          line-height: 1.45;
        }

        .wordLine {
          display: block;
          width: 20ch;
          text-align: left;
          margin: 4px auto;
          padding-left: 0.6ch;
        }

        .wordCorrect {
          font-size: 1.2rem;
          color: #2e7d32;
          font-weight: 700;
          letter-spacing: normal;
          word-spacing: normal;
        }

        .wordInput {
          font-size: 1.2rem;
          color: #333;
          font-weight: 600;
          letter-spacing: normal;
          word-spacing: normal;
          border-bottom: none;
          text-decoration: none;
        }

        .feedback {
          width: 100%;
          text-align: center;
          font-weight: 800;
          margin-bottom: 0.25rem;
        }

        .feedback.correct {
          color: #2e7d32;
        }

        .feedback.wrong {
          color: #c62828;
          font-weight: 900;
        }

        :global(.matchChar),
        :global(.missChar) {
          display: inline;
          min-width: 0;
          letter-spacing: normal;
        }

        :global(.matchChar) {
          color: inherit;
        }

        :global(.missChar) {
          color: #d94b4b !important;
          font-weight: 800;
          background: transparent;
        }

        :global(.wordInput .matchChar) {
          color: inherit;
        }

        :global(.wordInput .missChar) {
          color: #d94b4b !important;
          font-weight: 800;
          background: transparent;
        }

        .ipa {
          color: #678;
          font-size: 0.95rem;
          margin-left: 0.2rem;
        }

        .circleMark {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 132px;
          height: 132px;
          border: 10px solid #3fae4a;
          border-radius: 999px;
          background: transparent;
          box-shadow: 0 4px 12px rgba(48, 139, 57, 0.18);
          pointer-events: none;
          animation: pop 0.4s ease-out;
          z-index: 2;
        }

        .reviewScreen {
          text-align: left;
          max-height: 80vh;
          overflow-y: auto;
          padding: 0 2px 2px;
          color: #526b90;
          line-height: 1.55;
        }

        .reviewScreen h1 {
          text-align: center;
          font-size: 1.32rem;
          line-height: 1.35;
          margin: 0 0 0.65rem;
          color: #426083;
          letter-spacing: 0.01em;
        }

        .resultStats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          margin: 0.5rem 0 0.9rem;
        }

        .resultStats div {
          background: #f8fbff;
          border: 1px solid #e8eef9;
          border-radius: 12px;
          padding: 0.5rem 0.4rem;
          text-align: center;
        }

        .resultStats strong,
        .resultStats span {
          display: block;
        }

        .resultStats strong {
          font-size: 1.15rem;
          color: #3e6998;
        }

        .resultStats span {
          color: #7a8aa2;
          font-size: 0.82rem;
          margin-top: 0.05rem;
        }

        .reviewList {
          border-top: 1px solid #edf2fa;
        }

        .reviewItem {
          border-bottom: 1px solid #edf2fa;
          padding: 11px 0 12px;
        }

        .reviewQuestion {
          font-weight: 700;
          margin-bottom: 0.32rem;
          color: #465f82;
          font-size: 1.02rem;
          letter-spacing: 0.01em;
        }

        .wordRow {
          display: flex;
          align-items: baseline;
          gap: 0.55rem;
          margin-top: 0.12rem;
          line-height: 1.45;
        }

        .wordLabel {
          flex: 0 0 1.45rem;
          color: #7a8aa2;
          font-size: 0.96rem;
          font-weight: 700;
          text-align: right;
          letter-spacing: normal;
        }

        .wordValue {
          display: inline-flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 0.28rem;
          min-width: 0;
          color: #334155;
          letter-spacing: normal;
          word-spacing: normal;
        }

        .soundBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.28rem;
          height: 1.28rem;
          margin-left: 0.1rem;
          border: 1px solid #d5dfef;
          border-radius: 999px;
          background: transparent;
          color: #6e83a3;
          cursor: pointer;
          line-height: 1;
          user-select: none;
          vertical-align: -0.12em;
          transition: background 0.2s, border-color 0.2s, color 0.2s;
        }

        .soundBtn:hover {
          background: #f8fbff;
          border-color: #b9c9e3;
          color: #4f6b94;
        }

        .soundIcon {
          position: relative;
          display: inline-block;
          width: 0.7rem;
          height: 0.7rem;
        }

        .soundIcon::before {
          content: "";
          position: absolute;
          left: 0.02rem;
          top: 0.2rem;
          width: 0.22rem;
          height: 0.3rem;
          border-radius: 0.04rem;
          background: currentColor;
        }

        .soundIcon::after {
          content: "";
          position: absolute;
          left: 0.22rem;
          top: 0.1rem;
          width: 0.34rem;
          height: 0.5rem;
          border: solid currentColor;
          border-width: 0.1rem 0.1rem 0 0;
          border-radius: 0 999px 0 0;
          transform: rotate(45deg);
          transform-origin: center;
        }

        .retryPanel {
          margin-top: 12px;
        }
        .questionModeArea.compact .questionModes {
          gap: 8px;
        }
        .questionModeArea.compact :global(button.quizMethodCard) {
          min-height: 38px;
          padding: 0.45em 0.5em;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          background: #f4f8ff;
          border-color: #d5e3f6;
          box-shadow: none;
        }
        .questionModeArea.compact :global(button.quizMethodCard.quizMethodCardActive) {
          background: #9fc6f3;
          border-color: #7fb1e8;
          color: #fff;
        }
        .resultModes {
          margin-bottom: 10px;
        }
        .retryArea {
          text-align: center;
          margin-top: 18px;
          display: flex;
          justify-content: center;
          gap: 10px;
        }

        .retryCount {
          width: 110px;
          padding: 0.5em;
          border: 2px solid #d0dbf1;
          border-radius: 8px;
          text-align: center;
          color: #4f6b94;
        }

        .backSettingBtn {
          margin-top: 8px;
          width: 100%;
          border: 1px solid #c7d8f0;
          background: #f8fbff;
          color: #4f6b94;
          border-radius: 10px;
          padding: 0.7em 1em;
        }
        .retryBtn {
          font-size: 0.98rem;
          padding: 0.7em 1em;
          border-radius: 10px;
        }
        .retryActions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 8px;
        }
        .retryBtn.primary {
          grid-column: 1 / -1;
          font-size: 1.08rem;
          font-weight: 700;
          min-height: 46px;
        }
        .retryBtn.secondary,
        .retryBtn.tertiary {
          border: 1px solid #c7d8f0;
          background: #f8fbff;
          color: #4f6b94;
          box-shadow: none;
        }

        .errorMessage {
          margin: 1rem 0 0;
          color: #e53935;
          font-weight: 700;
        }

        @keyframes pop {
          0% {
            transform: scale(0.7);
            opacity: 0;
          }
          60% {
            transform: scale(1.05);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @media (max-width: 600px) {
          .pageShell {
            padding: 0;
          }

          .appCard {
            max-width: none;
            min-height: 100vh;
            border-radius: 0;
            box-shadow: none;
            padding: 24px 16px 32px;
          }

          .logo.large {
            font-size: 8vw;
          }

          .logo.small,
          .headerRight {
            font-size: 4vw;
          }

          .questionButton {
            font-size: 7.5vw;
            margin-top: 1.2rem;
          }

          .answerInput {
            width: 100%;
            font-size: 6.5vw;
          }

          .answerBtn {
            width: 100%;
            font-size: 5.8vw;
            margin-top: 1.2rem;
          }

          .modeButtons,
          .inputRow {
            flex-direction: column;
          }

          .modeButtons {
            gap: 12px;
          }

          .questionModes {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .modeBtn,
          .nameInput,
          .countInput {
            font-size: 5.2vw;
          }

          .retryPanel {
          margin-top: 12px;
        }
        .resultModes {
          margin-bottom: 10px;
        }
        .retryArea {
            flex-direction: column;
          }

          .retryCount,
          .backSettingBtn {
          margin-top: 8px;
          width: 100%;
          border: 1px solid #c7d8f0;
          background: #f8fbff;
          color: #4f6b94;
          border-radius: 10px;
          padding: 0.6em;
        }
        .retryBtn {
            width: 100%;
          }
        }
      `}</style>
      <style jsx global>{`
        button.wordSpeaker {
          justify-self: end;
          flex: 0 0 32px;
          width: 32px;
          height: 32px;
          min-width: 32px;
          min-height: 32px;
          max-width: 32px;
          max-height: 32px;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          appearance: none;
          -webkit-appearance: none;
          border-radius: 999px;
          border: 1px solid #c8ddf4;
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: linear-gradient(180deg, #f7fbff 0%, #e7f3ff 100%);
          color: #2f7fca;
          cursor: pointer;
          line-height: 1;
          box-shadow: 0 3px 9px rgba(63, 142, 215, 0.10);
          transition: transform 0.16s, filter 0.16s, box-shadow 0.16s, border-color 0.16s;
        }
        button.wordSpeaker:hover,
        button.wordSpeaker:focus-visible {
          border-color: #8fc0ef;
          filter: brightness(1.03);
          transform: scale(1.04);
          box-shadow: 0 6px 14px rgba(63, 142, 215, 0.16);
          outline: none;
        }
        svg.wordSpeakerIcon {
          flex: 0 0 18px;
          width: 18px;
          height: 18px;
          min-width: 18px;
          min-height: 18px;
          max-width: 18px;
          max-height: 18px;
          display: block;
          color: #2f7fca;
        }
        svg.wordSpeakerIcon path:first-child {
          fill: currentColor;
          stroke: none;
        }
        svg.wordSpeakerIcon path:not(:first-child) {
          fill: none;
          stroke: currentColor;
          stroke-width: 1.7;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .questionModes {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        button.quizMethodCard {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          border: 1px solid #c8daf1;
          margin: 0;
          border-radius: 12px;
          background: #eef5ff;
          color: #4a6f98;
          padding: 0.72em 0.5em;
          min-height: 44px;
          text-align: center;
          font: inherit;
          font-size: 0.98rem;
          font-weight: 700;
          line-height: 1.2;
          cursor: pointer;
          transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
        }
        button.quizMethodCard:hover {
          background: #e7f1ff;
          border-color: #98c0ea;
        }
        button.quizMethodCard:focus-visible {
          outline: none;
          border-color: #5a9ce0;
          box-shadow: 0 0 0 3px rgba(107, 171, 235, 0.28);
        }
        button.quizMethodCard.quizMethodCardActive {
          background: #9fc6f3;
          border-color: #7fb1e8;
          color: #ffffff;
          box-shadow: 0 4px 10px rgba(117, 167, 221, 0.35);
        }
        .quizMethodTitle {
          display: block;
          font-weight: 700;
          font-size: 0.98rem;
          letter-spacing: 0.01em;
        }
        @media (max-width: 600px) {
          .questionModes {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          button.quizMethodCard {
            min-height: 42px;
            padding: 0.66em 0.5em;
          }
        }
      `}</style>
    </main>
  );
}
