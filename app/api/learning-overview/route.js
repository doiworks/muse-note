import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { getAppSessionFromRequest } from '../../../lib/auth/appSession';

const PAGE_SIZE = 1000;
const WORD_CHUNK_SIZE = 500;

async function fetchAllHistory(supabase, appUserId) {
  const rows = [];
  for (let from = 0;; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('history')
      .select('word_id,correct,answered_at')
      .eq('app_user_id', appUserId)
      .order('answered_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < PAGE_SIZE) return rows;
  }
}

async function fetchWordsByIds(supabase, wordIds) {
  const rows = [];
  for (let index = 0; index < wordIds.length; index += WORD_CHUNK_SIZE) {
    const chunk = wordIds.slice(index, index + WORD_CHUNK_SIZE);
    if (!chunk.length) continue;
    const { data, error } = await supabase
      .from('words')
      .select('id,english,japanese,phonetic,grade,term,category1,category2,category3,importance')
      .in('id', chunk);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

export async function GET(request) {
  const session = await getAppSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });

  try {
    const supabase = getSupabaseAdmin();
    const [historyRows, wordsCountResult, sessionsResult] = await Promise.all([
      fetchAllHistory(supabase, session.appUserId),
      supabase.from('words').select('id', { count: 'exact', head: true }),
      supabase
        .from('study_sessions')
        .select('status,completed_questions,total_questions,correct_count,wrong_count,started_at,ended_at')
        .eq('app_user_id', session.appUserId)
        .order('started_at', { ascending: false })
        .limit(20)
    ]);

    if (wordsCountResult.error) throw wordsCountResult.error;
    if (sessionsResult.error) throw sessionsResult.error;

    const totalAnswers = historyRows.length;
    const correctAnswers = historyRows.filter((row) => row.correct === true).length;
    const wrongAnswers = totalAnswers - correctAnswers;
    const studiedWordIds = new Set(historyRows.map((row) => Number(row.word_id)).filter(Number.isFinite));

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

    const wrongIds = [...wrongByWord.keys()];
    const wordRows = wrongIds.length ? await fetchWordsByIds(supabase, wrongIds) : [];
    const wordMap = new Map(wordRows.map((word) => [Number(word.id), word]));
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
    const totalWords = Number(wordsCountResult.count || 0);

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
        interrupted_sessions: interruptedSessions
      },
      weak_words: weakWords.slice(0, 20),
      recent_sessions: recentSessions.slice(0, 5)
    });
  } catch (error) {
    console.error('Failed to load learning overview:', error);
    return NextResponse.json({ error: '学習状況を取得できませんでした。' }, { status: 500 });
  }
}
