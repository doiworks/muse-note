'use client';

import { useEffect } from 'react';

export default function SelectionPolish() {
  useEffect(() => {
    let timer = 0;

    function isImportantOnlyActive() {
      return [...document.querySelectorAll('.wordPickerScreen .activeFilterChips .filterChip')]
        .some((chip) => {
          const text = chip.textContent?.replace(/\s+/g, '') || '';
          return text.includes('重要') && (text.includes('重要のみ') || text.includes('×'));
        });
    }

    function applyPolish() {
      const importantOnly = isImportantOnlyActive();

      document.querySelectorAll('.wordPickerScreen .wordRowItem').forEach((row) => {
        const hiddenImportantTag = [...row.querySelectorAll('.wordMetaInfo .wordTag')]
          .some((tag) => tag.textContent?.trim() === '重要');
        const compactImportantTag = Boolean(row.querySelector('.compactMetaTag.important'));
        const isImportant = importantOnly || hiddenImportantTag || compactImportantTag;

        // 「重要のみ」の結果はサーバー側で importance=1 に限定済み。
        // 追加読み込み直後でも、そのページの全行へ即座に重要表示を付ける。
        row.classList.toggle('importantWordRow', isImportant);
        row.querySelectorAll('.importantPriorityBadge').forEach((badge) => badge.remove());
      });
    }

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(applyPolish, 0);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class']
    });
    schedule();

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <style jsx global>{`
      .wordPickerScreen .wordRowItem.selected {
        background: linear-gradient(180deg, #b9dcff 0%, #9bc9f5 100%) !important;
        box-shadow: 0 4px 12px rgba(42, 111, 176, .28) !important;
      }

      .wordPickerScreen .wordRowItem.selected .wordEnglish,
      .wordPickerScreen .wordRowItem.selected .wordJapanese {
        color: #204f7b !important;
      }

      /* 既存処理が生成する重要タグは隠し、必ず1個だけ固定表示する */
      .wordPickerScreen .importantPriorityBadge,
      .wordPickerScreen .compactMetaTag.important {
        display: none !important;
      }

      .wordPickerScreen .importantWordRow .compactWordSecondLine::before {
        content: '重要';
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 1px 7px;
        background: #b996f2;
        color: #3f236d;
        font-size: .61rem;
        font-weight: 900;
        line-height: 1.4;
        box-shadow: 0 1px 3px rgba(63, 35, 109, .18);
      }

      /* 重要単語は色面で区別せず、重要マークだけを常に残す */
      .wordPickerScreen .importantWordRow:not(.selected) {
        background: #ffffff !important;
        box-shadow: 0 2px 7px rgba(72, 113, 158, .09) !important;
      }

      .selectAreaActions {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 10px !important;
      }

      .selectAreaActions .openWordModalBtn {
        min-height: 64px !important;
        width: 100% !important;
        padding: 10px 12px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        border: 0 !important;
        border-radius: 17px !important;
        background: linear-gradient(180deg, #f4f9ff 0%, #e6f2ff 100%) !important;
        color: #315d91 !important;
        font-size: .88rem !important;
        font-weight: 900 !important;
        line-height: 1.35 !important;
        text-align: center !important;
        box-shadow: 0 5px 14px rgba(72, 113, 158, .13) !important;
      }

      .selectAreaActions .openWordModalBtn.primaryOpen {
        background: linear-gradient(180deg, #9fc8f0 0%, #7eb1e3 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 6px 16px rgba(47, 119, 184, .24) !important;
      }

      .wordPickerScreen .savePanel .panelCloseButton,
      .wordPickerScreen .openPanel .panelCloseButton {
        width: auto !important;
        min-width: 78px !important;
        height: 40px !important;
        padding: 0 14px !important;
        border: 0 !important;
        border-radius: 13px !important;
        background: #e8f3ff !important;
        color: #315d91 !important;
        font-size: .78rem !important;
        font-weight: 900 !important;
        line-height: 1 !important;
        box-shadow: 0 3px 9px rgba(72, 113, 158, .12) !important;
      }

      @media (max-width: 560px) {
        .selectAreaActions {
          gap: 8px !important;
        }

        .selectAreaActions .openWordModalBtn {
          min-height: 58px !important;
          padding: 8px 9px !important;
          font-size: .8rem !important;
          border-radius: 15px !important;
        }
      }
    `}</style>
  );
}
