export const WRONG_EMPTY_MESSAGES = Object.freeze({
  noHistory: '間違えた単語はまだありません',
  noMatch: 'この条件に合う苦手単語はありません'
});

export function uniqueWrongWordIds(historyRows = []) {
  return [...new Set(historyRows
    .filter((row) => row?.correct === false)
    .map((row) => Number(row.word_id))
    .filter(Number.isFinite))];
}

export function filterWordsByWrongHistory(words, wrongWordIds) {
  const wrong = new Set(wrongWordIds.map(Number));
  return words.filter((word) => wrong.has(Number(word.id)));
}

export function wrongEmptyMessage(hasWrongHistory) {
  return hasWrongHistory ? WRONG_EMPTY_MESSAGES.noMatch : WRONG_EMPTY_MESSAGES.noHistory;
}
