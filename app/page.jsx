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

const INITIAL_GAME = {
  screen: 'intro',
  state: 'idle',
  userName: '',
  countInput: '',
  mode: 'normal',
  words: [],
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
    return <span className="emptyAnswer" aria-label="未入力" />;
  }

  function countCharThrough(chars, targetChar, lastIndex) {
    const normalizedTarget = targetChar.toLowerCase();
    return chars
      .slice(0, lastIndex + 1)
      .filter((char) => char.toLowerCase() === normalizedTarget).length;
  }

  return answerChars.map((userChar, index) => {
    const correctChar = correctChars[index];
    const isSamePositionMatch =
      typeof correctChar === 'string' && userChar.toLowerCase() === correctChar.toLowerCase();
    const hasSameOccurrenceCount =
      isSamePositionMatch &&
      countCharThrough(answerChars, userChar, index) === countCharThrough(correctChars, correctChar, index);
    const className = isSamePositionMatch && hasSameOccurrenceCount ? 'matchChar' : 'miss missChar';

    return (
      <span className={className} key={`${userChar}-${index}`}>
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

  function prepareWords(words, requestedCount) {
    const availableWords = words
      .filter((word) => word?.id && word?.japanese && word?.english)
      .map((word) => ({
        id: word.id,
        japanese: word.japanese,
        english: word.english,
        phonetic: word.phonetic || ''
      }));
    const shuffled = shuffleLocal(availableWords);
    const target = requestedCount > 0 ? Math.min(requestedCount, shuffled.length) : shuffled.length;
    return { quizWords: shuffled.slice(0, target), targetCount: target };
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

  async function handleStart(mode) {
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
      const response = await fetch('/api/words');
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || '単語データの取得に失敗しました。時間をおいて再度お試しください。');
      }

      const { quizWords, targetCount } = prepareWords(data.words || [], safeRequestedCount);
      if (!targetCount) {
        setGame((prev) => ({ ...prev, isLoading: false, errorMessage: '出題できる単語がありません。' }));
        return;
      }

      startQuestion({
        ...INITIAL_GAME,
        userName,
        countInput: game.countInput,
        mode,
        words: data.words || [],
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

    if (isCorrect) {
      playCorrectSound();
      addTimer(() => setGame((current) => ({ ...current, showCircle: false })), 400);
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
    const { quizWords, targetCount } = prepareWords(game.words, safeRequestedCount);
    if (!targetCount) {
      setGame((prev) => ({ ...prev, screen: 'intro', errorMessage: '出題できる単語がありません。' }));
      return;
    }

    startQuestion({
      ...INITIAL_GAME,
      userName: game.userName,
      countInput: String(safeRequestedCount || ''),
      mode: game.mode,
      words: game.words,
      quizWords,
      targetCount,
      totalStart: Date.now(),
      now: Date.now()
    });
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
            <div className="modeButtons" aria-label="スピードモード選択">
              {Object.entries(MODE_TIMING).map(([mode, setting]) => (
                <button
                  className={`modeBtn ${game.mode === mode ? 'active' : ''}`}
                  disabled={game.isLoading}
                  key={mode}
                  onClick={() => handleStart(mode)}
                  type="button"
                >
                  {game.isLoading && game.mode === mode ? '読み込み中...' : setting.label}
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
                  <div>
                    正 <span className="wordCorrect">{item.english}</span>
                    <button className="soundBtn" type="button" onClick={() => speak(item.english)} aria-label={`${item.english}を発音`} title="発音を聞く">
                      ♪
                    </button>
                    {item.phonetic && <span className="ipa">{item.phonetic}</span>}
                  </div>
                  {!item.correct && (
                    <div>
                      答 <span className="wordInput"><DiffText answer={item.answer} correct={item.english} /></span>
                    </div>
                  )}
                </article>
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
          font-size: 1.25rem;
          color: #2e7d32;
          font-weight: 700;
        }

        .wordInput {
          font-size: 1.25rem;
          color: #333;
          font-weight: 600;
          letter-spacing: 0.03em;
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

        .matchChar,
        .missChar {
          display: inline-block;
          min-width: 0.62em;
        }

        .missChar {
          margin: 0 1px;
          padding: 0 0.12em 0.08em;
          border-radius: 5px;
          background: #ffebee;
          box-shadow: inset 0 -3px 0 #ef5350;
          color: #c62828;
          font-weight: 900;
          text-decoration: underline;
          text-decoration-color: #b71c1c;
          text-decoration-thickness: 2px;
          text-underline-offset: 3px;
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
          width: 180px;
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8rem;
          line-height: 1;
          color: #66bb6a;
          text-shadow: 0 6px 14px rgba(102, 187, 106, 0.18);
          background: rgba(255, 255, 255, 0.78);
          pointer-events: none;
          animation: pop 0.4s ease-out;
          z-index: 2;
        }

        .reviewScreen {
          text-align: left;
          max-height: 80vh;
          overflow-y: auto;
        }

        .reviewScreen h1 {
          text-align: center;
          font-size: 1.45rem;
          margin: 0 0 1rem;
        }

        .scoreLine {
          text-align: center;
          margin: 0 0 1rem;
        }

        .resultStats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin: 1rem 0;
        }

        .resultStats div {
          background: #f6f9ff;
          border: 1px solid #e6ebf7;
          border-radius: 14px;
          padding: 0.75rem 0.4rem;
          text-align: center;
        }

        .resultStats strong,
        .resultStats span {
          display: block;
        }

        .resultStats strong {
          font-size: 1.35rem;
          color: #2e7d32;
        }

        .reviewList {
          border-top: 1px solid #e6ebf7;
        }

        .reviewItem {
          border-bottom: 1px solid #e6ebf7;
          padding: 10px 0;
        }

        .reviewQuestion {
          font-weight: 700;
          margin-bottom: 0.3rem;
        }

        .soundBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.55rem;
          height: 1.55rem;
          margin-left: 0.35rem;
          border: 1px solid #c9d6ed;
          border-radius: 999px;
          background: #ffffff;
          color: #4f6b94;
          cursor: pointer;
          font-size: 0.85rem;
          line-height: 1;
          user-select: none;
          vertical-align: middle;
        }

        .soundBtn:hover {
          background: #f6f9ff;
          border-color: #9fbbe2;
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

          .retryArea {
            flex-direction: column;
          }

          .retryCount,
          .retryBtn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
