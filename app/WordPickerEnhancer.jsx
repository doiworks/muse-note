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

function normalizeKeyPart(value) {
  return String(value || '').trim().toLowerCase();
}

function getWordKeyFromRow(row) {
  const english = row.querySelector('.wordEnglish')?.textContent;
  const japanese = row.querySelector('.wordJapanese')?.textContent;
  return `${normalizeKeyPart(english)}\u0000${normalizeKeyPart(japanese)}`;
}

function getWordKeyFromData(word) {
  return `${normalizeKeyPart(word?.english)}\u0000${normalizeKeyPart(word?.japanese)}`;
}

function getCompactTags(row) {
  const tags = [...row.querySelectorAll('.wordMetaInfo .wordTag')]
    .map((tag) => tag.textContent?.trim() || '')
    .filter(Boolean)
    .filter((tag) => tag !== '未出題' && !/^回答\d+回$/.test(tag));
  return [...new Set(tags)].slice(0, 4);
}

export default function WordPickerEnhancer() {
  useEffect(() => {
    let weakOnly = false;
    let mistakeMap = new Map();
    let refreshTimer = 0;
    const originalFetch = window.fetch.bind(window);

    function decorateRows() {
      findWordRows().forEach((row) => {
        const key = getWordKeyFromRow(row);
        const count = Number(mistakeMap.get(key) || 0);
        const phonetic = row.querySelector('.wordPhonetic')?.textContent?.trim() || '';
        const tags = getCompactTags(row);

        let secondLine = row.querySelector('.compactWordSecondLine');
        if (!secondLine) {
          secondLine = document.createElement('span');
          secondLine.className = 'compactWordSecondLine';
          row.appendChild(secondLine);
        }

        secondLine.replaceChildren();

        if (phonetic) {
          const phoneticItem = document.createElement('span');
          phoneticItem.className = 'compactPhonetic';
          phoneticItem.textContent = phonetic;
          secondLine.appendChild(phoneticItem);
        }

        tags.forEach((tag) => {
          const tagItem = document.createElement('span');
          tagItem.className = `compactMetaTag${tag === '重要' ? ' important' : ''}`;
          tagItem.textContent = tag;
          secondLine.appendChild(tagItem);
        });

        const mistakeItem = document.createElement('span');
        mistakeItem.className = `mistakeCountBadge${count > 0 ? ' hasMistake' : ''}`;
        mistakeItem.textContent = `間違い ${count}回`;
        secondLine.appendChild(mistakeItem);

        const speaker = row.querySelector('.wordSpeaker');
        if (speaker) {
          speaker.hidden = false;
          speaker.removeAttribute('aria-hidden');
          speaker.style.removeProperty('display');
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

    function removeVisibleSelectionLabels() {
      const resultSpans = [...document.querySelectorAll('.wordPickerScreen .pickerResultCount > span')];
      resultSpans.forEach((span) => {
        if (span.textContent?.trim().startsWith('選択中：')) span.classList.add('selectionCountLabel');
      });

      const bottomLabel = document.querySelector('.wordPickerScreen .pickerBottomBar > span');
      if (bottomLabel?.textContent?.includes('選択中')) bottomLabel.classList.add('selectionCountLabel');
    }

    function scheduleRefresh() {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        updateWeakButton();
        removeVisibleSelectionLabels();
        decorateRows();
      }, 20);
    }

    window.fetch = async (input, init) => {
      const nextInput = weakOnly ? withWeakOnly(input) : input;
      const response = await originalFetch(nextInput, init);

      if (typeof nextInput === 'string' && nextInput.startsWith('/api/word-picker/list')) {
        response.clone().json().then((data) => {
          const nextMistakes = new Map(mistakeMap);
          (data.words || []).forEach((word) => {
            nextMistakes.set(
              getWordKeyFromData(word),
              Number(word.stats?.mistake_count ?? word.mistake_count ?? 0)
            );
          });
          mistakeMap = nextMistakes;
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
      .wordPickerScreen .mainWordListPanel {
        padding: 6px !important;
        border-radius: 16px !important;
        background: #f2f7fd !important;
      }

      .wordPickerScreen .wordList.inModal {
        gap: 5px !important;
      }

      .wordPickerScreen .wordRowItem {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 36px !important;
        grid-template-rows: 22px 18px !important;
        column-gap: 7px !important;
        row-gap: 1px !important;
        min-height: 49px !important;
        padding: 4px 7px 4px 10px !important;
        border: 0 !important;
        border-radius: 12px !important;
        background: #ffffff !important;
        box-shadow: 0 2px 7px rgba(72, 113, 158, .09) !important;
        transition: background .14s, box-shadow .14s, transform .14s !important;
        overflow: hidden !important;
      }

      .wordPickerScreen .wordRowItem:active {
        transform: scale(.995);
      }

      .wordPickerScreen .wordRowItem.selected {
        background: linear-gradient(180deg, #e7f3ff 0%, #d8ebff 100%) !important;
        box-shadow: 0 3px 9px rgba(63, 142, 215, .16) !important;
      }

      .wordPickerScreen .wordSelectionRail,
      .wordPickerScreen .wordCheck,
      .wordPickerScreen .wordMetaInfo,
      .wordPickerScreen .wordPrimaryInfo .wordPhonetic,
      .wordPickerScreen .wordPrimaryInfo .srOnly,
      .wordPickerScreen .selectionCountLabel {
        display: none !important;
      }

      .wordPickerScreen .wordPrimaryInfo {
        grid-column: 1 !important;
        grid-row: 1 !important;
        min-width: 0 !important;
        display: flex !important;
        align-items: baseline !important;
        gap: 7px !important;
        overflow: hidden !important;
        text-align: left !important;
        white-space: nowrap !important;
      }

      .wordPickerScreen .wordEnglish {
        flex: 0 1 auto !important;
        min-width: 0 !important;
        overflow: hidden !important;
        color: #315d91 !important;
        font-size: .94rem !important;
        font-weight: 900 !important;
        line-height: 1.15 !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      .wordPickerScreen .wordEnglish::after {
        content: '' !important;
      }

      .wordPickerScreen .wordJapanese {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        overflow: hidden !important;
        color: #5c769b !important;
        font-size: .78rem !important;
        font-weight: 700 !important;
        line-height: 1.15 !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      .wordPickerScreen .compactWordSecondLine {
        grid-column: 1 !important;
        grid-row: 2 !important;
        min-width: 0 !important;
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        overflow: hidden !important;
        white-space: nowrap !important;
      }

      .wordPickerScreen .compactPhonetic {
        min-width: 0;
        overflow: hidden;
        color: #8197b3;
        font-size: .63rem;
        font-weight: 700;
        text-overflow: ellipsis;
      }

      .wordPickerScreen .compactMetaTag,
      .wordPickerScreen .mistakeCountBadge {
        flex: 0 0 auto;
        border-radius: 999px;
        padding: 1px 5px;
        font-size: .6rem;
        font-weight: 900;
        line-height: 1.35;
      }

      .wordPickerScreen .compactMetaTag {
        background: #f0f5fb;
        color: #67809f;
      }

      .wordPickerScreen .compactMetaTag.important {
        background: #e3f1ff;
        color: #2f72ad;
      }

      .wordPickerScreen .mistakeCountBadge {
        margin-left: auto;
        background: #edf3fa;
        color: #7186a2;
      }

      .wordPickerScreen .mistakeCountBadge.hasMistake {
        background: #dcecff;
        color: #285f96;
      }

      .wordPickerScreen .wordSpeaker {
        grid-column: 2 !important;
        grid-row: 1 / 3 !important;
        width: 34px !important;
        height: 34px !important;
        min-width: 34px !important;
        min-height: 34px !important;
        align-self: center !important;
        justify-self: center !important;
        display: grid !important;
        place-items: center !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        z-index: 2 !important;
        border: 0 !important;
        border-radius: 11px !important;
        background: #e7f2fd !important;
        color: #2f7fca !important;
        box-shadow: none !important;
        padding: 0 !important;
      }

      .wordPickerScreen .wordSpeaker svg,
      .wordPickerScreen .wordSpeakerIcon {
        width: 18px !important;
        height: 18px !important;
        min-width: 18px !important;
        min-height: 18px !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }

      .wordPickerScreen .pickerPrimaryActions .weakFilterActive {
        border-color: #79afe0 !important;
        background: #dceeff !important;
        color: #236aa8 !important;
        box-shadow: 0 3px 9px rgba(63, 142, 215, .13) !important;
      }

      .wordPickerScreen .pickerBottomBar {
        justify-content: flex-end !important;
      }

      @media (max-width: 780px) {
        .wordPickerScreen .wordRowItem {
          grid-template-columns: minmax(0, 1fr) 34px !important;
          grid-template-rows: 21px 17px !important;
          min-height: 47px !important;
          padding: 4px 6px 4px 9px !important;
          column-gap: 6px !important;
        }

        .wordPickerScreen .wordEnglish {
          font-size: .9rem !important;
        }

        .wordPickerScreen .wordJapanese {
          font-size: .74rem !important;
        }

        .wordPickerScreen .wordSpeaker {
          width: 32px !important;
          height: 32px !important;
          min-width: 32px !important;
          min-height: 32px !important;
          border-radius: 10px !important;
        }

        .wordPickerScreen .compactMetaTag,
        .wordPickerScreen .mistakeCountBadge {
          font-size: .57rem;
          padding: 1px 4px;
        }
      }
    `}</style>
  );
}
