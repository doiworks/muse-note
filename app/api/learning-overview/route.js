import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { getAppSessionFromRequest } from '../../../lib/auth/appSession';

const PAGE_SIZE = 1000;

async function fetchAllRows(queryFactory) {
  const rows = [];
  for (let from = 0;; from += PAGE_SIZE) {
    const { data, error } = await queryFactory().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < PAGE_SIZE) return rows;
  }
}

function tokyoDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function buildDailyActivity(historyRows) {
  const byDate = new Map();
  for (const row of historyRows) {
    const key = tokyoDateKey(row.answered_at);
    if (!key) continue;
    const current = byDate.get(key) || { date: key, answers: 0, correct: 0, wrong: 0 };
    current.answers += 1;
    if (row.correct === true) current.correct += 1;
    else current.wrong += 1;
    byDate.set(key, current);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000);
    const key = tokyoDateKey(date);
    const item = byDate.get(key) || { date: key, answers: 0, correct: 0, wrong: 0 };
    return {
      ...item,
      accuracy: item.answers ? Math.round((item.correct / item.answers) * 100) : 0
    };
  });
}

function buildGradeAnalysis(words, historyRows) {
  const wordMap = new Map(words.map((word) => [Number(word.id), word]));
  const grades = new Map();

  for (const word of words) {
    const grade = String(word.grade || '未分類');
    const item = grades.get(grade) || {
      grade,
      total_words: 0,
      studied_word_ids: new Set(),
      answers: 0,
      correct: 0,
      wrong: 0
    };
    item.total_words += 1;
    grades.set(grade, item);
  }

  for (const row of historyRows) {
    const word = wordMap.get(Number(row.word_id));
    if (!word) continue;
    const grade = String(word.grade || '未分類');
    const item = grades.get(grade);
    if (!item) continue;
    item.studied_word_ids.add(Number(row.word_id));
    item.answers += 1;
    if (row.correct === true) item.correct += 1;
    else item.wrong += 1;
  }

  return [...grades.values()]
    .map((item) => ({
      grade: item.grade,
      total_words: item.total_words,
      studied_words: item.studied_word_ids.size,
      progress_percent: item.total_words ? Math.round((item.studied_word_ids.size / item.total_words) * 100) : 0,
      answers: item.answers,
      correct: item.correct,
      wrong: item.wrong,
      accuracy: item.answers ? Math.round((item.correct / item.answers) * 100) : 0
    }))
    .sort((a, b) => a.grade.localeCompare(b.grade, 'ja', { numeric: true }));
}

export async function GET(request) {
  const session = await getAppSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });

  try {
    const supabase = getSupabaseAdmin();
    const [historyRows, words, sessionsResult] = await Promise.all([
      fetchAllRows(() => supabase
        .from('history')
        .select('word_id,correct,answered_at')
        .eq('app_user_id', session.appUserId)
        .order('answered_at', { ascending: false })),
      fetchAllRows(() => supabase
        .from('words')
        .select('id,english,japanese,phonetic,grade,term,category1,category2,category3,importance')
        .order('id', { ascending: true })),
      supabase
        .from('study_sessions')
        .select('status,completed_questions,total_questions,correct_count,wrong_count,started_at,ended_at')
        .eq('app_user_id', session.appUserId)
        .order('started_at', { ascending: false })
        .limit(20)
    ]);

    if (sessionsResult.error) throw sessionsResult.error;

    const totalAnswers = historyRows.length;
    const correctAnswers = historyRows.filter((row) => row.correct === true).length;
    const wrongAnswers = totalAnswers - correctAnswers;
    const studiedWordIds = new Set(historyRows.map((row) => Number(row.word_id)).filter(Number.isFinite));
    const wordMap = new Map(words.map((word) => [Number(word.id), word]));

    const wrongByWord = new Map();
    for (const row of historyRows) {
      if (row.correct !== false) continue;
      const wordId = Number(row.word_id);
      if (!Number.isFinite(wordId)) continue;
      const current = wrongByWord.get(wordId) || { word_id: wordId, mistake_count: 0, last_wrong_at: null };
      current.mistake_count += 1;
      if (!current.last_wrong_at || Date.parse(row.answered_at) > Date.parse(current.last_wrong_at)) {
        current.last_wrong_at = row.answered_at;
      }
      wrongByWord.set(wordId, current);
    }

    const weakWords = [...wrongByWord.values()]
      .map((item) => ({ ...item, word: wordMap.get(item.word_id) || null }))
      .filter((item) => item.word)
      .sort((a, b) => {
        if (a.mistake_count !== b.mistake_count) return b.mistake_count - a.mistake_count;
        return Date.parse(b.last_wrong_at || 0) - Date.parse(a.last_wrong_at || 0);
      });

    const recentSessions = sessionsResult.data || [];
    const completedSessions = recentSessions.filter((item) => item.status === 'completed').length;
    const interruptedSessions = recentSessions.filter((item) => item.status === 'interrupted').length;
    const totalWords = words.length;
    const dailyActivity = buildDailyActivity(historyRows);

    return NextResponse.json({
      summary: {
        total_answers: totalAnswers,
        correct_answers: correctAnswers,
        wrong_answers: wrongAnswers,
        accuracy: totalAnswers ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
        studied_words: studiedWordIds.size,
        total_words: totalWords,
        progress_percent: totalWords ? Math.round((studiedWordIds.size / totalWords) * 100) : 0,
        weak_words: weakWords.length,
        completed_sessions: completedSessions,
        interrupted_sessions: interruptedSessions,
        active_days_7: dailyActivity.filter((item) => item.answers > 0).length
      },
      daily_activity: dailyActivity,
      grade_analysis: buildGradeAnalysis(words, historyRows),
      weak_words: weakWords.slice(0, 50),
      recent_sessions: recentSessions.slice(0, 10)
    });
  } catch (error) {
    console.error('Failed to load learning overview:', error);
    return NextResponse.json({ error: '学習状況を取得できませんでした。' }, { status: 500 });
  }
}
