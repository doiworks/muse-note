'use client';

export default function ColorContrastPolish() {
  return (
    <style jsx global>{`
      /* 重要表示は淡すぎない紫で、文字とのコントラストを確保 */
      .wordPickerScreen .importantPriorityBadge,
      .wordPickerScreen .compactMetaTag.important,
      .wordPickerScreen .wordTag.important {
        background: #d8c2ff !important;
        color: #563184 !important;
        font-weight: 900 !important;
      }

      /* 重要単語は背景色ではなく、常時表示の重要マークだけで区別する */
      .wordPickerScreen .importantWordRow:not(.selected) {
        background: #ffffff !important;
        box-shadow: 0 2px 7px rgba(72, 113, 158, .09) !important;
      }

      /* カテゴリ設定のクリア・適用を常に横並びにする */
      .wordPickerScreen .categoryPanelActions {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 10px !important;
        width: 100% !important;
      }

      .wordPickerScreen .categoryPanelActions button {
        width: 100% !important;
        min-width: 0 !important;
        margin: 0 !important;
      }

      /* 分析詳細はアプリ全体と同じ青系へ戻す */
      .analyticsOverlay {
        background: rgba(52, 76, 104, .24) !important;
      }

      .analyticsPanel {
        background: #edf5ff !important;
        box-shadow: 0 10px 28px rgba(52, 76, 104, .16) !important;
        padding-top: 0 !important;
      }

      /* 更新・閉じるをスクロール中も上部へ固定する */
      .analyticsPanel .analyticsHeader {
        position: sticky !important;
        top: 0 !important;
        z-index: 20 !important;
        margin: 0 -16px 16px !important;
        padding: 14px 16px !important;
        border-radius: 0 0 16px 16px !important;
        background: rgba(255, 255, 255, .98) !important;
        box-shadow: 0 4px 12px rgba(52, 76, 104, .10) !important;
      }

      .analyticsPanel .analysisSection h3,
      .analyticsPanel .analyticsHeader strong,
      .analyticsPanel .summaryCard b,
      .analyticsPanel .dailyCard b,
      .analyticsPanel .gradeLabel strong,
      .analyticsPanel .gradeNumbers b,
      .analyticsPanel .weakWordName strong,
      .analyticsPanel .weakWordMeta b {
        color: #315d91 !important;
      }

      .analyticsPanel .summaryCard span,
      .analyticsPanel .dailyCard span,
      .analyticsPanel .dailyCard small,
      .analyticsPanel .gradeLabel span,
      .analyticsPanel .gradeNumbers span,
      .analyticsPanel .weakWordName span,
      .analyticsPanel .weakWordMeta span {
        color: #6f8daf !important;
      }

      .analyticsPanel .refreshButton,
      .analyticsPanel .speakButton,
      .analyticsPanel .rank {
        background: #e7f2fd !important;
        color: #315d91 !important;
      }

      .analyticsPanel .closeButton {
        background: #a8c9f0 !important;
        color: #ffffff !important;
        box-shadow: 0 3px 8px rgba(168, 201, 240, .24) !important;
      }

      .analyticsPanel .gradeTrack {
        background: #e2edf8 !important;
      }

      .analyticsPanel .gradeTrack span {
        background: #7fb1e8 !important;
      }

      @media (max-width: 560px) {
        .analyticsPanel .analyticsHeader {
          margin: 0 -14px 14px !important;
          padding: 12px 14px !important;
          border-radius: 0 0 15px 15px !important;
        }
      }
    `}</style>
  );
}
