import { createHash } from 'crypto';

const FAIR_RESERVATION_TTL_MINUTES = 45;
const DEFAULT_QUIZ_LIMIT = 50;
const MAX_QUIZ_LIMIT = 2000;
const STATS_CHUNK_SIZE = 500;

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

export function normalizeQuizLimit(value, fallback = DEFAULT_QUIZ_LIMIT) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  if (parsed === 0) return 0;
  return Math.min(Math.floor(parsed), MAX_QUIZ_LIMIT);
}

export function normalizeWordIds(values) {
  const source = Array.isArray(values) ? values : [];
  return [...new Set(source.map((value) => Number(value)).filter(Number.isInteger))].sort((a, b) => a - b);
}

export function buildFairScopeKey(kind, descriptor = {}) {
  const canonical = JSON.stringify(stableValue({ kind, descriptor }));
  const digest = createHash('sha256').update(canonical).digest('hex');
  return `${kind}:${digest}`;
}

export async function fetchStatsForWordIds(supabaseAdmin, appUserId, wordIds) {
  const ids = normalizeWordIds(wordIds);
  const rows = [];

  for (let index = 0; index < ids.length; index += STATS_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + STATS_CHUNK_SIZE);
    if (!chunk.length) continue;
    const { data, error } = await supabaseAdmin
      .from('stats')
      .select('word_id,accuracy,attempt_count,success_count,mistake_count,last_correct,last_wrong,priority,updated_at')
      .eq('app_user_id', appUserId)
      .in('word_id', chunk);
    if (error) throw error;
    rows.push(...(data ?? []));
  }

  return new Map(rows.map((row) => [Number(row.word_id), row]));
}

function toQuizStats(actualStats, fairRound) {
  return {
    accuracy: actualStats?.accuracy ?? 0,
    attempt_count: Number(fairRound ?? 0),
    actual_attempt_count: Number(actualStats?.attempt_count ?? 0),
    success_count: Number(actualStats?.success_count ?? 0),
    mistake_count: Number(actualStats?.mistake_count ?? 0),
    last_correct: actualStats?.last_correct ?? null,
    last_wrong: actualStats?.last_wrong ?? null,
    priority: Number(actualStats?.priority ?? 0),
    updated_at: actualStats?.updated_at ?? null,
    fair_round: Number(fairRound ?? 0)
  };
}

export async function reserveFairQuizWords({
  supabaseAdmin,
  appUserId,
  scopeKey,
  candidateWords,
  requestedCount
}) {
  const wordMap = new Map();
  for (const word of candidateWords ?? []) {
    const id = Number(word?.id);
    if (!Number.isInteger(id) || !word?.japanese || !word?.english) continue;
    if (!wordMap.has(id)) wordMap.set(id, word);
  }

  const candidateIds = [...wordMap.keys()].sort((a, b) => a - b);
  if (!candidateIds.length) return [];

  const normalizedLimit = normalizeQuizLimit(requestedCount, candidateIds.length);
  const limit = normalizedLimit === 0 ? candidateIds.length : Math.min(normalizedLimit, candidateIds.length);
  if (!limit) return [];

  const { data: reservations, error: reservationError } = await supabaseAdmin.rpc(
    'reserve_fair_quiz_words',
    {
      p_app_user_id: appUserId,
      p_scope_key: scopeKey,
      p_candidate_ids: candidateIds,
      p_limit: limit,
      p_ttl_minutes: FAIR_RESERVATION_TTL_MINUTES
    }
  );

  if (reservationError) {
    const error = new Error('均一出題用のデータベース更新が未適用です。Supabaseの最新マイグレーションを実行してください。');
    error.cause = reservationError;
    throw error;
  }

  const reservedRows = reservations ?? [];
  const selectedIds = reservedRows.map((row) => Number(row.word_id)).filter(Number.isInteger);
  const statsMap = await fetchStatsForWordIds(supabaseAdmin, appUserId, selectedIds);

  return reservedRows
    .map((reservation) => {
      const id = Number(reservation.word_id);
      const word = wordMap.get(id);
      if (!word) return null;
      const actualStats = statsMap.get(id) ?? null;
      return {
        ...word,
        stats: toQuizStats(actualStats, reservation.fair_round),
        last_answered_at: actualStats?.updated_at ?? null,
        fair_round: Number(reservation.fair_round ?? 0),
        fair_position: Number(reservation.position ?? 0)
      };
    })
    .filter(Boolean);
}

export async function attachActualStats({ supabaseAdmin, appUserId, words }) {
  const wordIds = (words ?? []).map((word) => word?.id);
  const statsMap = await fetchStatsForWordIds(supabaseAdmin, appUserId, wordIds);
  return (words ?? []).map((word) => {
    const stats = statsMap.get(Number(word.id)) ?? null;
    return {
      ...word,
      stats,
      last_answered_at: stats?.updated_at ?? null
    };
  });
}
