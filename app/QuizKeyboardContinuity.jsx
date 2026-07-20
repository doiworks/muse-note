'use client';

import { useEffect } from 'react';

const QUIZ_SELECTOR = '.quizViewport';
const INPUT_SELECTOR = `${QUIZ_SELECTOR} .answerInput`;
const ACTION_SELECTOR = `${QUIZ_SELECTOR} .answerBtn`;

function getQuizElements() {
  return {
    input: document.querySelector(INPUT_SELECTOR),
    action: document.querySelector(ACTION_SELECTOR)
  };
}

function restoreInputFocus() {
  const { input } = getQuizElements();
  if (!input || input.disabled || !document.contains(input)) return;

  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
}

function keepActionVisible() {
  const { action } = getQuizElements();
  if (!action) return;

  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
  const rect = action.getBoundingClientRect();
  const safeTop = viewportTop + 8;
  const safeBottom = viewportBottom - 10;

  if (rect.top >= safeTop && rect.bottom <= safeBottom) return;

  const gameArea = action.closest('.gameArea');
  if (!gameArea) return;

  const delta = rect.bottom > safeBottom
    ? rect.bottom - safeBottom
    : rect.top - safeTop;

  gameArea.scrollBy({ top: delta, behavior: 'smooth' });
}

export default function QuizKeyboardContinuity() {
  useEffect(() => {
    let actionPointerStartedWithInput = false;
    let lastActionLabel = '';
    let frameId = 0;

    const scheduleActionVisibility = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        keepActionVisible();
        restoreInputFocus();
      });
    };

    const handleMouseDown = (event) => {
      const action = event.target.closest?.(ACTION_SELECTOR);
      if (!action) return;

      const { input } = getQuizElements();
      actionPointerStartedWithInput = Boolean(input && document.activeElement === input);

      // Pressing Answer / Next must not move focus from the input to the button.
      // Losing focus here closes the iPhone/Android software keyboard and it
      // cannot be reliably reopened outside the original user gesture.
      if (actionPointerStartedWithInput) event.preventDefault();
    };

    const handleFocusIn = (event) => {
      if (!event.target.closest?.(ACTION_SELECTOR)) return;
      restoreInputFocus();
    };

    const handleClick = (event) => {
      const action = event.target.closest?.(ACTION_SELECTOR);
      if (!action) return;

      // React handles the actual Answer / Next action. Refocus in the same
      // interaction frame as a safety net without scrolling the page.
      if (actionPointerStartedWithInput || document.querySelector(INPUT_SELECTOR)) {
        scheduleActionVisibility();
      }
      actionPointerStartedWithInput = false;
    };

    const syncActionState = () => {
      const { action } = getQuizElements();
      const nextLabel = action?.textContent?.trim() || '';
      if (!nextLabel || nextLabel === lastActionLabel) return;
      lastActionLabel = nextLabel;

      // When Answer changes to Next, make the result and Next action visible
      // above the software keyboard while keeping the input focused.
      if (nextLabel.startsWith('Next')) scheduleActionVisibility();
    };

    const observer = new MutationObserver(syncActionState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('click', handleClick, true);
    window.visualViewport?.addEventListener('resize', scheduleActionVisibility);
    window.visualViewport?.addEventListener('scroll', scheduleActionVisibility);
    syncActionState();

    return () => {
      observer.disconnect();
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('click', handleClick, true);
      window.visualViewport?.removeEventListener('resize', scheduleActionVisibility);
      window.visualViewport?.removeEventListener('scroll', scheduleActionVisibility);
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <style jsx global>{`
      .quizViewport .gameArea {
        justify-content: flex-start !important;
        scroll-padding-bottom: 210px;
      }

      .quizViewport .questionButton {
        flex: 0 0 auto;
      }

      .quizViewport .answerControls {
        position: sticky !important;
        z-index: 5;
        bottom: 0 !important;
        flex: 0 0 auto;
        margin-top: auto;
        padding: 4px 0 max(2px, env(safe-area-inset-bottom));
        background: #ffffff;
      }

      .quizViewport .resultArea:empty {
        min-height: 0 !important;
        margin-top: 0 !important;
      }

      .quizViewport .answerBtn {
        flex: 0 0 auto;
        min-height: 44px;
        margin-bottom: 0;
      }
    `}</style>
  );
}
