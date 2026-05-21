'use client';

import { useEffect, useRef, useState } from 'react';
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
  { key: 'normal', label: '通常', description: 'ランダムに出題' },
  { key: 'balanced', label: '均等出題', description: '未学習・回答が少ない単語を優先' },
  { key: 'review', label: '復習', description: '苦手な単語を優先' },
  { key: 'select', label: '選択', description: '単語を選んで出題' }
];

const INITIAL_GAME = {
  screen: 'intro',
  state: 'idle',
  userName: '',
  countInput: '',
  mode: 'normal',
  questionMode: 'normal',
  words: [],
  selectableWords: [],
  selectedWordIds: [],
  wordSearch: '',
  filters: {
    school_level: '',
    grade: '',
    term: '',
    exam_type: '',
    category1: '',
    category2: '',
    category3: '',
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
  showPhonetic: false
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

export default function HomePage() {
  const router = useRouter();
  const [game, setGame] = useState(INITIAL_GAME);
  const answerRef = useRef(null);
  const timersRef = useRef([]);
  const intervalRef = useRef(null);
  const voicesRef = useRef([]);
  const gameRef = useRef(INITIAL_GAME);
  const audioContextRef = useRef(null);
  const currentWord = game.quizWords[game.currentIndex] || null;
  const totalElapsed = game.now && game.totalStart ? game.now - game.totalStart : 0;
  const questionElapsed = game.now && game.questionStart ? game.now - game.questionStart : 0;
  const accuracy = game.answeredCount ? Math.round((game.correctCount / game.answeredCount) * 100) : 0;
  const filterOptions = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3'].reduce((acc, key) => {
    acc[key] = [...new Set(game.selectableWords.map((word) => word[key]).filter(hasValue).map(String))].sort((a, b) => a.localeCompare(b, 'ja'));
    return acc;
  }, {});
  const filteredWords = game.selectableWords.filter((word) => {
    const keyword = normalizeText(game.wordSearch);
    const matchesKeyword =
      !keyword ||
      ['english', 'japanese', 'phonetic', 'example', 'pos_j', 'category1', 'category2', 'category3', 'exam_type'].some((field) =>
        normalizeText(word[field]).includes(keyword)
      );
    if (!matchesKeyword) return false;
    const { filters } = game;
    const matchesFilters =
      (!filters.school_level || String(word.school_level) === filters.school_level) &&
      (!filters.grade || String(word.grade) === filters.grade) &&
      (!filters.term || String(word.term) === filters.term) &&
      (!filters.exam_type || String(word.exam_type) === filters.exam_type) &&
      (!filters.category1 || String(word.category1) === filters.category1) &&
      (!filters.category2 || String(word.category2) === filters.category2) &&
      (!filters.category3 || String(word.category3) === filters.category3) &&
      (!filters.importantOnly || isImportantWord(word)) &&
      (!filters.selectedOnly || game.selectedWordIds.includes(word.id));
    return matchesFilters;
  });


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

  function prepareWords(words, requestedCount, questionMode = 'normal') {
    const availableWords = words
      .filter((word) => word?.id && word?.japanese && word?.english)
      .map((word) => ({
        id: word.id,
        japanese: word.japanese,
        english: word.english,
        phonetic: word.phonetic || '',
        stats: word.stats || null
      }));

    const rankedWords = (() => {
      if (questionMode === 'review') {
        return [...availableWords].sort((a, b) => {
          const accuracyA = Number(a.stats?.accuracy ?? 0);
          const accuracyB = Number(b.stats?.accuracy ?? 0);
          const attemptsA = Number(a.stats?.attempt_count ?? 0);
          const attemptsB = Number(b.stats?.attempt_count ?? 0);
          if (accuracyA !== accuracyB) return accuracyA - accuracyB;
          if (attemptsA !== attemptsB) return attemptsA - attemptsB;
          return Math.random() - 0.5;
        });
      }
      if (questionMode === 'balanced') {
        return [...availableWords];
      }
      return shuffleLocal(availableWords);
    })();

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

  async function fetchWords(requestedCount = null) {
    const query = Number.isFinite(requestedCount) && requestedCount > 0 ? `?limit=${Math.floor(requestedCount)}` : '';
    const response = await fetch(`/api/words${query}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || '単語データの取得に失敗しました。時間をおいて再度お試しください。');
    }
    return data.words || [];
  }

  async function handleQuestionModeChange(questionMode) {
    setGame((prev) => ({ ...prev, questionMode, errorMessage: '' }));
    if (questionMode !== 'select' || game.selectableWords.length) return;
    try {
      const words = await fetchWords();
      setGame((prev) => ({ ...prev, selectableWords: words }));
    } catch (error) {
      setGame((prev) => ({ ...prev, errorMessage: error.message }));
    }
  }

  async function handleStart(mode, selectedWords = null) {
    const userName = game.userName.trim();
    if (!userName) {
      setGame((prev) => ({ ...prev, errorMessage: 'ユーザー名を入力してください。' }));
      return;
    }

    clearAllTimers();
    warmupTTS();
    const requestedCount = Number(game.countInput);
    const safeRequestedCount = Number.isFinite(requestedCount) && requestedCount > 0 ? Math.floor(requestedCount) : 0;

    setGame((prev) => ({ ...prev, mode, isLoading: true, errorMessage: '' }));

    try {
      const words = selectedWords || (await fetchWords(safeRequestedCount));

      const { quizWords, targetCount } = prepareWords(words, safeRequestedCount, game.questionMode);
      if (!targetCount) {
        setGame((prev) => ({ ...prev, isLoading: false, errorMessage: '出題できる単語がありません。' }));
        return;
      }

      startQuestion({
        ...INITIAL_GAME,
        userName,
        countInput: game.countInput,
        mode,
        questionMode: game.questionMode,
        words,
        selectableWords: game.selectableWords,
        selectedWordIds: game.selectedWordIds,
        wordSearch: game.wordSearch,
        filters: game.filters,
        quizWords,
        targetCount,
        totalStart: Date.now(),
        now: Date.now()
      });
    } catch (error) {
      setGame((prev) => ({
        ...prev,
        isLoading: false,
        errorMessage: error.message || '単語データの取得に失敗しました。時間をおいて再度お試しください。'
      }));
    }
  }

  async function saveAnswerHistory({ word, answer, correct }) {
    if (!word?.id) return;

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
        setGame((current) => ({ ...current, screen: 'result', state: 'finished', showCircle: false, now: Date.now() }));
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
    }
  }

  function handleAnswerKeyDown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleAnswerButton();
  }

  function handleRetry() {
    const requestedCount = Number(game.countInput);
    const safeRequestedCount = Number.isFinite(requestedCount) && requestedCount > 0 ? Math.floor(requestedCount) : game.targetCount;
    const { quizWords, targetCount } = prepareWords(game.words, safeRequestedCount, game.questionMode);
    if (!targetCount) {
      setGame((prev) => ({ ...prev, screen: 'intro', errorMessage: '出題できる単語がありません。' }));
      return;
    }

    startQuestion({
      ...INITIAL_GAME,
      userName: game.userName,
      countInput: String(safeRequestedCount || ''),
      mode: game.mode,
      questionMode: game.questionMode,
      words: game.words,
      selectableWords: game.selectableWords,
      selectedWordIds: game.selectedWordIds,
      wordSearch: game.wordSearch,
      filters: game.filters,
      quizWords,
      targetCount,
      totalStart: Date.now(),
      now: Date.now()
    });
  }

  function toggleSelectedWord(wordId) {
    setGame((prev) => {
      const exists = prev.selectedWordIds.includes(wordId);
      return {
        ...prev,
        selectedWordIds: exists ? prev.selectedWordIds.filter((id) => id !== wordId) : [...prev.selectedWordIds, wordId],
        errorMessage: ''
      };
    });
  }

  function handleStartSelected(mode) {
    if (!game.selectedWordIds.length) {
      setGame((prev) => ({ ...prev, errorMessage: '単語を1つ以上選択してください。' }));
      return;
    }
    const selectedWords = game.selectableWords.filter((word) => game.selectedWordIds.includes(word.id));
    void handleStart(mode, selectedWords);
  }

  function setFilterValue(key, value) {
    setGame((prev) => ({ ...prev, filters: { ...prev.filters, [key]: value } }));
  }

  function selectVisible(shouldSelect) {
    const visibleIds = filteredWords.map((word) => word.id);
    setGame((prev) => {
      const current = new Set(prev.selectedWordIds);
      visibleIds.forEach((id) => (shouldSelect ? current.add(id) : current.delete(id)));
      return { ...prev, selectedWordIds: [...current] };
    });
  }

  function selectAll(shouldSelect) {
    setGame((prev) => ({
      ...prev,
      selectedWordIds: shouldSelect ? prev.selectableWords.map((word) => word.id) : []
    }));
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
            <p className="introText">日本語を見て、対応する英単語を入力しましょう。</p>
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
                value={game.countInput}
                onChange={(event) => setGame((prev) => ({ ...prev, countInput: event.target.value, errorMessage: '' }))}
                type="number"
                min="1"
                placeholder="出題数（空=全件）"
              />
            </div>
            <div className="questionModeArea">
              <p className="sectionLabel">出題方法</p>
              <div className="questionModes">
                {QUESTION_MODE_OPTIONS.map((option) => (
                  <button type="button" key={option.key} className={`questionModeBtn ${game.questionMode === option.key ? 'active' : ''} ${option.key === 'select' ? 'subtleMode' : ''}`} onClick={() => void handleQuestionModeChange(option.key)}>
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            </div>
            {game.questionMode === 'select' && (
              <div className="selectArea">
                <input className="searchInput" placeholder="検索: english / japanese / phonetic / example / 品詞 / カテゴリ" value={game.wordSearch} onChange={(event) => setGame((prev) => ({ ...prev, wordSearch: event.target.value }))} />
                <div className="filterGrid">
                  {['school_level','grade','term','exam_type','category1','category2','category3'].map((key) => (
                    <select key={key} className="filterSelect" value={game.filters[key]} onChange={(event) => setFilterValue(key, event.target.value)}>
                      <option value="">{key}</option>
                      {(filterOptions[key] || []).map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  ))}
                </div>
                <div className="toggleRow">
                  <label><input type="checkbox" checked={game.filters.importantOnly} onChange={(event) => setFilterValue('importantOnly', event.target.checked)} /> 重要のみ</label>
                  <label><input type="checkbox" checked={game.filters.selectedOnly} onChange={(event) => setFilterValue('selectedOnly', event.target.checked)} /> 選択済みだけ表示</label>
                </div>
                <p className="selectedCount">選択数: {game.selectedWordIds.length}件 / 表示中: {filteredWords.length}件</p>
                <div className="bulkRow">
                  <button type="button" onClick={() => selectVisible(true)}>表示中をすべて選択</button>
                  <button type="button" onClick={() => selectVisible(false)}>表示中をすべて解除</button>
                  <button type="button" onClick={() => selectAll(true)}>すべて選択</button>
                  <button type="button" onClick={() => selectAll(false)}>すべて解除</button>
                </div>
                <div className="wordList">
                  {filteredWords.map((word) => {
                    const selected = game.selectedWordIds.includes(word.id);
                    const isImportant = isImportantWord(word);
                    const stats = word.stats;
                    return (
                      <button type="button" key={word.id} className={`wordItem ${selected ? 'selected' : ''}`} onClick={() => toggleSelectedWord(word.id)}>
                        <div className="wordMain">
                          <div><strong>{word.english}</strong> / {word.japanese} {word.phonetic ? <span className="mini">{word.phonetic}</span> : null}</div>
                          <div className="badgeRow">
                            {word.grade ? <span className="miniBadge">G{word.grade}</span> : null}
                            {word.term ? <span className="miniBadge">T{word.term}</span> : null}
                            {word.category1 ? <span className="miniBadge">{word.category1}</span> : null}
                            {word.category2 ? <span className="miniBadge">{word.category2}</span> : null}
                            {word.category3 ? <span className="miniBadge">{word.category3}</span> : null}
                            {isImportant ? <span className="importantBadge">重要</span> : null}
                          </div>
                          <div className="statsLine">{stats ? `正答率 ${Math.round(Number(stats.accuracy || 0))}% / 回答 ${stats.attempt_count} / 正 ${stats.success_count} / 誤 ${stats.mistake_count}` : '未出題'}</div>
                        </div>
                        <span className="speakerBtn" onClick={(event) => { event.stopPropagation(); speak(word.english); }} role="button" aria-label={`${word.english}を発音`} tabIndex={0}>🔊</span>
                      </button>
                    );
                  })}
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
                  onClick={() => (game.questionMode === 'select' ? handleStartSelected(mode) : handleStart(mode))}
                  type="button"
                >
                  {game.isLoading && game.mode === mode ? '読み込み中...' : game.questionMode === 'select' ? `${setting.label}で選択した単語で開始` : setting.label}
                </button>
              ))}
            </div>
            {game.errorMessage && <p className="errorMessage">{game.errorMessage}</p>}
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
            <h1>🎉 Complete! {game.answeredCount}問 終了しました。</h1>
            <p className="scoreLine">正解 {game.correctCount}・誤答 {game.wrongCount}（正答率 {accuracy}%）</p>
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
              <p className="sectionLabel">再チャレンジ設定</p>
              <div className="questionModes resultModes">
                {QUESTION_MODE_OPTIONS.map((option) => (
                  <button type="button" key={`result-${option.key}`} className={`questionModeBtn ${game.questionMode === option.key ? 'active' : ''} ${option.key === 'select' ? 'subtleMode' : ''}`} onClick={() => void handleQuestionModeChange(option.key)}>
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
              <div className="retryArea">
                <input
                  className="retryCount"
                  type="number"
                  min="1"
                  value={game.countInput || game.targetCount}
                  onChange={(event) => setGame((prev) => ({ ...prev, countInput: event.target.value }))}
                  aria-label="再チャレンジの出題数"
                />
                <button className="retryBtn" type="button" onClick={handleRetry}>
                  🔁 もう一度チャレンジ
                </button>
              </div>
              <button className="backSettingBtn" type="button" onClick={() => setGame((prev) => ({ ...prev, screen: 'intro', state: 'idle' }))}>
                出題設定に戻る
              </button>
            </div>
          </div>
        )}
      </section>

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
        }

        .nameInput,
        .countInput {
          width: 100%;
          padding: 0.8em;
          border: 2px solid #d0dbf1;
          border-radius: 12px;
          font-size: 1.1rem;
          margin-top: 10px;
          background: #ffffff;
          color: #4f6b94;
        }

        .modeButtons {
          margin-top: 1rem;
          display: flex;
          gap: 10px;
        }
        .sectionLabel {
          margin: 1rem 0 0.3rem;
          font-weight: 700;
          color: #5a7498;
          text-align: left;
        }
        .questionModes {
          display: flex;
          gap: 8px;
        }
        .questionModeBtn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          border: 1px solid #c7d8f0;
          border-radius: 10px;
          background: #f8fbff;
          color: #4f6b94;
          padding: 0.6em;
        }
        .questionModeBtn small {
          font-size: 0.68rem;
          color: #6f86a9;
        }
        .questionModeBtn.subtleMode {
          opacity: 0.88;
        }
        .questionModeBtn.active {
          background: #dbe9fb;
          border-color: #a8c9f0;
        }
        .selectArea {
          margin-top: 0.8rem;
          text-align: left;
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
        .filterGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          margin-top: 8px;
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
          max-height: 220px;
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
          margin-top: 10px;
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

        .scoreLine {
          text-align: center;
          margin: 0 0 0.85rem;
          color: #6a7d98;
          font-size: 0.96rem;
        }

        .resultStats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin: 0.8rem 0 0.9rem;
        }

        .resultStats div {
          background: #f8fbff;
          border: 1px solid #e8eef9;
          border-radius: 14px;
          padding: 0.65rem 0.4rem;
          text-align: center;
        }

        .resultStats strong,
        .resultStats span {
          display: block;
        }

        .resultStats strong {
          font-size: 1.28rem;
          color: #2e7d32;
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
          padding: 0.6em;
        }
        .retryBtn {
          font-size: 1.05rem;
          padding: 0.6em 1.2em;
          border-radius: 10px;
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
    </main>
  );
}
