'use client';

import { useEffect } from 'react';

const NORMAL_RATE = 1.0;
const SLOW_RATE = 0.78;
const VERY_SLOW_RATE = 0.62;
const SAME_WORD_WINDOW_MS = 30000;
const THIRD_HINT_DELAY_MS = 350;
const PATCH_KEY = '__museProgressiveHintSpeechPatch';

function copyUtterance(source) {
  const utterance = new SpeechSynthesisUtterance(source.text || '');
  if (source.voice) utterance.voice = source.voice;
  utterance.lang = source.lang || 'en-US';
  utterance.pitch = Number.isFinite(source.pitch) ? source.pitch : 1;
  utterance.volume = Number.isFinite(source.volume) ? source.volume : 1;
  utterance.rate = VERY_SLOW_RATE;
  return utterance;
}

export default function ProgressiveHintSpeech() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return undefined;
    if (window[PATCH_KEY]) return undefined;

    const synthesis = window.speechSynthesis;
    const originalSpeak = synthesis.speak.bind(synthesis);
    const originalCancel = synthesis.cancel.bind(synthesis);

    let lastWord = '';
    let repeatCount = 0;
    let lastSpokenAt = 0;
    let generation = 0;
    let thirdHintTimer = 0;

    function clearThirdHint() {
      if (!thirdHintTimer) return;
      window.clearTimeout(thirdHintTimer);
      thirdHintTimer = 0;
    }

    function invalidatePendingHint() {
      generation += 1;
      clearThirdHint();
    }

    function isAutomaticEnglishHint(utterance) {
      const text = String(utterance?.text || '').trim();
      const lang = String(utterance?.lang || 'en-US').toLowerCase();
      const isSilentWarmup = Number(utterance?.volume) === 0;
      const isUserOperation = Boolean(window.navigator?.userActivation?.isActive);
      return Boolean(text) && lang.startsWith('en') && !isSilentWarmup && !isUserOperation;
    }

    function patchedCancel() {
      invalidatePendingHint();
      return originalCancel();
    }

    function patchedSpeak(utterance) {
      if (!isAutomaticEnglishHint(utterance)) return originalSpeak(utterance);

      const text = String(utterance.text || '').trim().toLowerCase();
      const now = Date.now();
      const isSameWord = text === lastWord && now - lastSpokenAt <= SAME_WORD_WINDOW_MS;

      repeatCount = isSameWord ? repeatCount + 1 : 1;
      lastWord = text;
      lastSpokenAt = now;

      if (repeatCount === 1) utterance.rate = NORMAL_RATE;
      else if (repeatCount === 2) utterance.rate = SLOW_RATE;
      else utterance.rate = VERY_SLOW_RATE;

      if (repeatCount === 2) {
        const hintGeneration = generation;
        const previousOnEnd = utterance.onend;
        const previousOnError = utterance.onerror;

        utterance.onend = (event) => {
          if (typeof previousOnEnd === 'function') previousOnEnd.call(utterance, event);
          if (generation !== hintGeneration || document.hidden) return;

          clearThirdHint();
          thirdHintTimer = window.setTimeout(() => {
            thirdHintTimer = 0;
            if (generation !== hintGeneration || document.hidden) return;

            const verySlowUtterance = copyUtterance(utterance);
            repeatCount = 3;
            lastSpokenAt = Date.now();
            originalSpeak(verySlowUtterance);
          }, THIRD_HINT_DELAY_MS);
        };

        utterance.onerror = (event) => {
          clearThirdHint();
          if (typeof previousOnError === 'function') previousOnError.call(utterance, event);
        };
      }

      return originalSpeak(utterance);
    }

    try {
      synthesis.speak = patchedSpeak;
      synthesis.cancel = patchedCancel;
    } catch (error) {
      console.warn('Progressive hint pronunciation could not be enabled:', error);
      return undefined;
    }

    const stopOnUserAction = () => invalidatePendingHint();
    document.addEventListener('input', stopOnUserAction, true);
    document.addEventListener('keydown', stopOnUserAction, true);
    document.addEventListener('pointerdown', stopOnUserAction, true);

    window[PATCH_KEY] = { patchedSpeak, patchedCancel };

    return () => {
      clearThirdHint();
      document.removeEventListener('input', stopOnUserAction, true);
      document.removeEventListener('keydown', stopOnUserAction, true);
      document.removeEventListener('pointerdown', stopOnUserAction, true);

      if (synthesis.speak === patchedSpeak) synthesis.speak = originalSpeak;
      if (synthesis.cancel === patchedCancel) synthesis.cancel = originalCancel;
      delete window[PATCH_KEY];
    };
  }, []);

  return null;
}
