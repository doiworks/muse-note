'use client';

import { useEffect } from 'react';

function withWeakOnly(input) {
  if (typeof input !== 'string') return input;
  if (!input.startsWith('/api/word-picker/list') && !input.startsWith('/api/word-picker/count')) return input;
  const url = new URL(input, window.location.origin);
  url.searchParams.set('weakOnly', 'true');
  return `${url.pathname}${url.search}`;
}

function findWordRows() {
  return [...document.querySelectorAll('.wordPickerScreen .wordRowItem')];
}

function getWordKey(row) {
  return row.querySelector('.wordEnglish')?.textContent?.trim().toLowerCase() || '';
}

export default function WordPickerEnhancer() {
  useEffect(() => {
    let weakOnly = false;
    let mistakeMap = new Map();
    let refreshTimer = 0;
    const originalFetch = window.fetch.bind(window);

    function decorateRows() {
      findWordRows().forEach((row) => {
        const key = getWordKey(row);
        const count = mistakeMap.get(key) || 0;
        let badge = row.querySelector('.mistakeCountBadge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'mistakeCountBadge';
          const primary = row.querySelector('.wordPrimaryInfo');
          primary?.appendChild(badge);
        }
        if (count > 0) {
          badge.textContent = `間違い ${count}回`;
          badge.hidden = false;
        } else {
          badge.textContent = '';
          badge.hidden = true;
        }
      });
    }

    function updateWeakButton() {
      const buttons = [...document.querySelectorAll('.wordPickerScreen .pickerPrimaryActions .pickerActionBtn')];
      const button = buttons.find((item) => ['表示中を選択', '苦手'].includes(item.textContent?.trim()));
      if (!button) return;
      button.textContent = '苦手';
      button.classList.toggle('weakFilterActive', weakOnly);
      button.setAttribute('aria-pressed', weakOnly ? 'true' : 'false');
      button.title = weakOnly ? '苦手単語を表示中。もう一度押すと全単語へ戻ります' : '間違えたことがある単語だけを表示';
    }

    function scheduleRefresh() {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        updateWeakButton();
        decorateRows();
      }, 30);
    }

    window.fetch = async (input, init) => {
      const nextInput = weakOnly ? withWeakOnly(input) : input;
      const response = await originalFetch(nextInput, init);

      if (typeof nextInput === 'string' && nextInput.startsWith('/api/word-picker/list')) {
        response.clone().json().then((data) => {
          mistakeMap = new Map((data.words || []).map((word) => [
            String(word.english || '').trim().toLowerCase(),
            Number(word.stats?.mistake_count ?? word.mistake_count ?? 0)
          ]));
          scheduleRefresh();
        }).catch(() => {});
      }

      return response;
    };

    function reloadCurrentList() {
      const searchButton = [...document.querySelectorAll('.wordPickerScreen .pickerSearchRow button')]
        .find((button) => button.textContent?.trim() === '検索');
      searchButton?.click();
    }

    function handleClick(event) {
      const button = event.target.closest?.('.wordPickerScreen .pickerPrimaryActions .pickerActionBtn');
      if (!button || button.textContent?.trim() !== '苦手') return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      weakOnly = !weakOnly;
      mistakeMap = new Map();
      updateWeakButton();
      reloadCurrentList();
    }

    function handlePickerClose() {
      if (document.querySelector('.wordPickerScreen')) return;
      weakOnly = false;
      mistakeMap = new Map();
    }

    const observer = new MutationObserver(() => {
      handlePickerClose();
      scheduleRefresh();
    });

    document.addEventListener('click', handleClick, true);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    scheduleRefresh();

    return () => {
      window.fetch = originalFetch;
      document.removeEventListener('click', handleClick, true);
      observer.disconnect();
      window.clearTimeout(refreshTimer);
    };
  }, []);

  return (
    <style jsx global>{`
      .wordPickerScreen .wordRowItem {
        grid-template-columns: minmax(0, 1fr) 42px !important;
        gap: 10px !important;
        min-height: 64px !important;
        padding: 10px 10px 10px 12px !important;
        border: 0 !important;
        border-radius: 15px !important;
        background: #ffffff !important;
        box-shadow: 0 4px 12px rgba(72, 113, 158, .10) !important;
        transition: background .16s, box-shadow .16s, transform .16s !important;
      }

      .wordPickerScreen .wordRowItem:active {
        transform: scale(.99);
      }

      .wordPickerScreen .wordRowItem.selected {
        background: #dceeff !important;
        box-shadow: 0 5px 14px rgba(63, 142, 215, .18) !important;
      }

      .wordPickerScreen .wordSelectionRail,
      .wordPickerScreen .wordCheck,
      .wordPickerScreen .wordMetaInfo {
        display: none !important;
      }

      .wordPickerScreen .wordPrimaryInfo {
        min-width: 0;
        display: grid !important;
        grid-template-columns: auto minmax(0, 1fr) !important;
        grid-template-areas:
          "english japanese"
          "phonetic mistake" !important;
        align-items: center !important;
        gap: 3px 8px !important;
        text-align: left;
      }

      .wordPickerScreen .wordEnglish {
        grid-area: english;
        color: #315d91 !important;
        font-size: 1rem !important;
        font-weight: 900 !important;
      }

      .wordPickerScreen .wordEnglish::after {
        content: '' !important;
      }

      .wordPickerScreen .wordJapanese {
        grid-area: japanese;
        min-width: 0;
        overflow: hidden;
        color: #5f789f !important;
        font-size: .82rem !important;
        font-weight: 700 !important;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .wordPickerScreen .wordPhonetic {
        grid-area: phonetic;
        color: #8298b5 !important;
        font-size: .68rem !important;
      }

      .wordPickerScreen .mistakeCountBadge {
        grid-area: mistake;
        justify-self: start;
        border-radius: 999px;
        background: #e8f3ff;
        color: #315d91;
        padding: 3px 8px;
        font-size: .68rem;
        font-weight: 900;
        white-space: nowrap;
      }

      .wordPickerScreen .mistakeCountBadge[hidden] {
        display: none !important;
      }

      .wordPickerScreen .wordSpeaker {
        grid-column: 2 !important;
        width: 40px !important;
        height: 40px !important;
        align-self: center;
        border: 0 !important;
        border-radius: 13px !important;
        background: #edf6ff !important;
        box-shadow: none !important;
      }

      .wordPickerScreen .pickerPrimaryActions .weakFilterActive {
        border-color: #6ca9df !important;
        background: #dceeff !important;
        color: #236aa8 !important;
        box-shadow: inset 0 0 0 2px rgba(63, 142, 215, .12);
      }

      @media (max-width: 780px) {
        .wordPickerScreen .wordRowItem {
          grid-template-columns: minmax(0, 1fr) 40px !important;
          gap: 8px !important;
        }

        .wordPickerScreen .wordSpeaker {
          width: 38px !important;
          height: 38px !important;
        }
      }
    `}</style>
  );
}
