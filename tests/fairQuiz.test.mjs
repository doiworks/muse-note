import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopeKey, reserveFairBatch } from '../lib/fairQuiz.js';

const rng = () => 0;
function batches(size, batchSize, calls) {
  const progress = new Map();
  const ids = Array.from({ length: size }, (_, i) => i);
  return { progress, output: Array.from({ length: calls }, () => reserveFairBatch(progress, ids, batchSize, rng)) };
}

test('100 words complete a duplicate-free round before round two', () => {
  const { progress, output } = batches(100, 10, 11);
  assert.equal(new Set(output.slice(0, 10).flat()).size, 100);
  assert.equal(output[10].length, 10);
  const counts = [...progress.values()];
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
});

test('505 boundary returns five remaining then five from round two', () => {
  const { output } = batches(505, 10, 51);
  const first500 = output.slice(0, 50).flat();
  assert.equal(new Set(first500).size, 500);
  assert.equal(new Set(output.flat()).size, 505);
  const last = output[50];
  assert.equal(last.filter((id) => !first500.includes(id)).length, 5);
  assert.equal(last.filter((id) => first500.includes(id)).length, 5);
});

test('scope normalization is stable for filters, selection, and changed sets', () => {
  assert.equal(createScopeKey({ mode:'select', wordIds:[3,1,2] }), createScopeKey({ wordIds:[2,3,1], mode:'select' }));
  assert.equal(createScopeKey({ grade:['2','1'], category1:['b','a'], importantOnly:true, search:' TEST ' }), createScopeKey({ search:'test', importantOnly:'true', category1:['a','b'], grade:['1','2'] }));
  assert.notEqual(createScopeKey({ wordSetId:'set', wordIds:[1,2] }), createScopeKey({ wordSetId:'set', wordIds:[1,2,3] }));
});

test('all documented filter scopes remain duplicate-free', () => {
  for (const scope of [{grade:1},{term:2},{category1:'a'},{category2:'b'},{category3:'c'},{importantOnly:true},{grade:1,term:2},{search:'ab'},{mode:'allMatching'}]) {
    assert.ok(createScopeKey(scope));
    const { output } = batches(23, 5, 5);
    assert.equal(new Set(output.flat()).size, 23);
  }
});
