import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterWordsByWrongHistory, uniqueWrongWordIds, wrongEmptyMessage } from '../lib/wrongWords.js';

const words = [{ id: 1 }, { id: 2 }, { id: 3 }];

test('wrong history returns words when stats is empty or has mistake_count zero', () => {
  const history = [{ app_user_id: 'me', word_id: 2, correct: false }];
  const staleStats = [{ app_user_id: 'me', word_id: 2, mistake_count: 0 }];
  assert.deepEqual(filterWordsByWrongHistory(words, uniqueWrongWordIds(history)), [{ id: 2 }]);
  assert.equal(staleStats[0].mistake_count, 0, 'stats is intentionally not consulted');
});

test('another user history is excluded by the authenticated-user query boundary', () => {
  const rowsReturnedForCurrentUser = [
    { app_user_id: 'me', word_id: 1, correct: false }
  ];
  assert.deepEqual(uniqueWrongWordIds(rowsReturnedForCurrentUser), [1]);
  assert.deepEqual(filterWordsByWrongHistory(words, uniqueWrongWordIds(rowsReturnedForCurrentUser)), [{ id: 1 }]);
});

test('duplicate mistakes produce one candidate', () => {
  assert.deepEqual(uniqueWrongWordIds([
    { word_id: 3, correct: false }, { word_id: 3, correct: false }
  ]), [3]);
});

test('a later correct answer does not remove a wrong candidate', () => {
  assert.deepEqual(uniqueWrongWordIds([
    { word_id: 1, correct: false }, { word_id: 1, correct: true }
  ]), [1]);
});

test('empty message distinguishes no wrong history from no matching word', () => {
  assert.equal(wrongEmptyMessage(false), '間違えた単語はまだありません');
  assert.equal(wrongEmptyMessage(true), 'この条件に合う苦手単語はありません');
});

test('database failures are handled as errors rather than empty history', async () => {
  await assert.rejects(async () => { throw new Error('database unavailable'); }, /database unavailable/);
  const route = fs.readFileSync(new URL('../app/api/word-picker/quiz-selection/route.js', import.meta.url), 'utf8');
  assert.match(route, /if \(queryError\) throw queryError/);
});

test('existing history is queried directly and fair reservation remains in use', () => {
  const route = fs.readFileSync(new URL('../app/api/word-picker/quiz-selection/route.js', import.meta.url), 'utf8');
  assert.match(route, /from\('history'\)/);
  assert.match(route, /eq\('correct', false\)/);
  assert.match(route, /rpc\('reserve_fair_quiz_words'/);
});

test('stats rebuild is replacement-based, priority-preserving, and rerunnable', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/20260721_history_source_of_truth.sql', import.meta.url), 'utf8');
  const rebuild = sql.slice(sql.indexOf('-- Idempotent repair'));
  assert.match(rebuild, /on conflict\(app_user_id, word_id\) do update/);
  assert.match(rebuild, /success_count = excluded\.success_count/);
  assert.doesNotMatch(rebuild, /success_count\s*=\s*public\.stats\.success_count\s*\+/);
  assert.doesNotMatch(rebuild, /priority\s*=/);
});
