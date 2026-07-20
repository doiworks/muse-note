import crypto from 'node:crypto';

const FILTER_KEYS = ['school_level', 'grade', 'term', 'exam_type', 'category1', 'category2', 'category3'];

function normalizedValues(value) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))].sort();
}

export function normalizeQuizScope(input = {}) {
  const scope = { mode: String(input.mode || 'balanced') };
  const ids = normalizedValues(input.wordIds).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (ids.length) scope.wordIds = ids;
  FILTER_KEYS.forEach((key) => {
    const values = normalizedValues(input[key]);
    if (values.length) scope[key] = values;
  });
  const search = String(input.search || '').normalize('NFKC').trim().toLowerCase();
  if (search) scope.search = search;
  if (input.importantOnly === true || input.importantOnly === 'true') scope.importantOnly = true;
  if (input.wordSetId) scope.wordSetId = String(input.wordSetId);
  return scope;
}

export function createScopeKey(input) {
  const canonical = JSON.stringify(normalizeQuizScope(input));
  return `quiz:v1:${crypto.createHash('sha256').update(canonical).digest('hex')}`;
}

// Pure reference implementation used to verify the database algorithm.
export function reserveFairBatch(progress, wordIds, count, random = Math.random) {
  const candidates = [...new Set(wordIds)].map(Number).filter(Number.isFinite);
  const selected = [];
  while (selected.length < count && selected.length < candidates.length) {
    const available = candidates.filter((id) => !selected.includes(id));
    const minimum = Math.min(...available.map((id) => progress.get(id) || 0));
    const tier = available.filter((id) => (progress.get(id) || 0) === minimum);
    const chosen = tier[Math.floor(random() * tier.length)];
    selected.push(chosen);
    progress.set(chosen, (progress.get(chosen) || 0) + 1);
  }
  return selected;
}
