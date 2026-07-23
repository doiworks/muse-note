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

      .wordPickerScreen .importantWordRow:not(.selected) {
        background: #f1e7ff !important;
        box-shadow: 0 2px 8px rgba(86, 49, 132, .14) !important;
      }

      /* 分析詳細はアプリ全体と同じ青系へ戻す */
      .analyticsOverlay {
        background: rgba(52, 76, 104, .24) !important;
      }

      .analyticsPanel {
        background: #edf5ff !important;
        box-shadow: 0 10px 28px rgba(52, 76, 104, .16) !important;
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
    `}</style>
  );
}
