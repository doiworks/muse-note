import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { PREVIEW_SESSION_COOKIE_NAME, verifyPreviewSessionCookieValue } from '../../../../lib/auth/previewSession';
import { applyWordPickerFilters } from '../list/route';

const QUIZ_WORD_COLUMNS = 'id,japanese,english,phonetic,importance,school_level,grade,term,exam_type,category1,category2,category3';
const DEFAULT_CANDIDATE_LIMIT = 100;
const MIN_CANDIDATE_LIMIT = 50;
const MAX_CANDIDATE_LIMIT = 200;

function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeRequestedCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function getCandidateLimit(requestedCount) {
  if (!requestedCount) return DEFAULT_CANDIDATE_LIMIT;
  return Math.min(Math.max(requestedCount * 3, MIN_CANDIDATE_LIMIT), MAX_CANDIDATE_LIMIT);
}

function normalizeExcludedIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => Number(id)).filter(Number.isFinite))];
}

function createParams(body) {
  return {
    get(key) {
      if (key === 'search') return body.search || '';
      if (key === 'importantOnly') return body.importantOnly ? 'true' : '';
      return body[key] || '';
    }
  };
}

export async function POST(request) {
  const sessionCookie = request.cookies.get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  if (!(await verifyPreviewSessionCookieValue(sessionCookie))) return jsonError('仮ログインが必要です。', 401);

  try {
    const body = await request.json().catch(() => ({}));
    const requestedCount = normalizeRequestedCount(body.requestedCount);
    const candidateLimit = getCandidateLimit(requestedCount);
    const excludedIds = normalizeExcludedIds(body.excludedIds);
    const excludedSet = new Set(excludedIds);
    const fetchLimit = Math.min(candidateLimit + excludedSet.size, MAX_CANDIDATE_LIMIT + excludedSet.size);

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await applyWordPickerFilters(
      supabaseAdmin.from('words').select(QUIZ_WORD_COLUMNS),
      createParams(body)
    )
      .order('id', { ascending: true })
      .limit(fetchLimit);

    if (error) {
      console.error('Failed to fetch quiz selection words:', error);
      return jsonError('問題用の単語取得に失敗しました。時間をおいて再度お試しください。');
    }

    const words = (data ?? []).filter((word) => !excludedSet.has(Number(word.id))).slice(0, candidateLimit);
    return NextResponse.json({ words });
  } catch (error) {
    console.error('Failed to initialize quiz selection:', error);
    return jsonError('問題用の単語取得に失敗しました。時間をおいて再度お試しください。');
  }
}
