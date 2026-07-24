'use client';

import { useEffect } from 'react';

const SPEED_LABELS = {
  'A.早い': '早い',
  'B.通常': '通常',
  'C.ゆっくり': 'ゆっくり'
};

export default function MainScreenPolish() {
  useEffect(() => {
    let timer = 0;

    function applyLabels() {
      document.querySelectorAll('button.modeBtn').forEach((button) => {
        const current = button.textContent?.trim();
        const next = SPEED_LABELS[current];
        if (next) button.textContent = next;
      });
    }

    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(applyLabels, 20);
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    applyLabels();

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <style jsx global>{`
      /* 右上のLINEプロフィール画像とメニューを押しやすくする */
      .intro .profileMenuButton {
        min-width: 70px !important;
        min-height: 58px !important;
        justify-content: flex-end !important;
        gap: 8px !important;
        padding: 5px 7px !important;
      }

      .intro .profileImage,
      .intro .profileImageFallback {
        width: 46px !important;
        height: 46px !important;
        font-size: 21px !important;
      }

      .intro .profileMenuDots {
        min-width: 13px !important;
        font-size: 1.45rem !important;
        font-weight: 900 !important;
        line-height: 1 !important;
        letter-spacing: 0 !important;
        opacity: .9 !important;
      }

      /* 分析の文字を通常・苦手・選択と同等の見やすさにする */
      .learningOverviewCompact .detailsButton {
        font-size: 1rem !important;
        font-weight: 900 !important;
      }

      .learningOverviewCompact .detailsButton > span:last-child {
        font-size: 1rem !important;
        line-height: 1 !important;
      }

      @media (max-width: 560px) {
        .intro .profileMenuButton {
          min-width: 68px !important;
          min-height: 56px !important;
        }

        .intro .profileImage,
        .intro .profileImageFallback {
          width: 44px !important;
          height: 44px !important;
        }

        .intro .profileMenuDots {
          font-size: 1.35rem !important;
        }

        .learningOverviewCompact .detailsButton,
        .learningOverviewCompact .detailsButton > span:last-child {
          font-size: .98rem !important;
        }
      }
    `}</style>
  );
}
