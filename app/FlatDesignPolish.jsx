'use client';

export default function FlatDesignPolish() {
  return (
    <style jsx global>{`
      /* 追加機能だけに入っていた、ぼやける表現を既存画面へ合わせる */
      .wordPickerScreen .importantPriorityBadge {
        background: #f28c28 !important;
        color: #ffffff !important;
        border: 1px solid #d96f08 !important;
        box-shadow: none !important;
      }

      .wordPickerScreen .importantWordRow:not(.selected) {
        background: #fff7e8 !important;
        box-shadow: none !important;
      }

      .wordPickerScreen .wordRowItem.selected {
        background: #9fcaf3 !important;
        box-shadow: inset 0 0 0 2px #4f91cd !important;
      }

      .wordPickerScreen .wordRowItem.selected .wordEnglish,
      .wordPickerScreen .wordRowItem.selected .wordJapanese {
        color: #173f66 !important;
      }

      .selectAreaActions .openWordModalBtn {
        border: 2px solid #6ea6da !important;
        background: #ffffff !important;
        color: #2f6598 !important;
        box-shadow: none !important;
      }

      .selectAreaActions .openWordModalBtn.primaryOpen {
        border-color: #4f91cd !important;
        background: #7fb1e8 !important;
        color: #ffffff !important;
        box-shadow: none !important;
      }

      .selectAreaActions .openWordModalBtn:active,
      .selectAreaActions .openWordModalBtn:focus-visible {
        transform: none !important;
        outline: 2px solid #315d91 !important;
        outline-offset: 2px !important;
      }

      .learningOverviewCompact .overviewCard {
        border: 1px solid #c7d8f0 !important;
        background: #f8fbff !important;
        box-shadow: none !important;
      }

      .learningOverviewCompact .compactMetric {
        border: 1px solid #c7d8f0 !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }

      .learningOverviewCompact .detailsButton {
        border: 1px solid #4f91cd !important;
        background: #7fb1e8 !important;
        color: #ffffff !important;
        font-size: .9rem !important;
        box-shadow: none !important;
      }

      .analyticsOverlay {
        background: rgba(34, 61, 92, .42) !important;
        backdrop-filter: none !important;
      }

      .analyticsPanel {
        border: 1px solid #b8cde6 !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }

      .analyticsPanel .summaryCard,
      .analyticsPanel .dailyCard,
      .analyticsPanel .gradeRow,
      .analyticsPanel .weakWordRow,
      .analyticsPanel .weakWordEmpty {
        border: 1px solid #c7d8f0 !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }

      .analyticsPanel .refreshButton,
      .analyticsPanel .speakButton {
        border: 1px solid #6ea6da !important;
        background: #ffffff !important;
        color: #315d91 !important;
        box-shadow: none !important;
      }

      .analyticsPanel .closeButton {
        border: 1px solid #4f91cd !important;
        background: #7fb1e8 !important;
        color: #ffffff !important;
        box-shadow: none !important;
      }

      .analyticsPanel .gradeTrack {
        background: #dce8f5 !important;
      }

      .analyticsPanel .gradeTrack span {
        background: #4f91cd !important;
      }

      .analyticsPanel .rank {
        border: 1px solid #8fb6dc !important;
        background: #eaf3fc !important;
      }

      .wordPickerScreen .savePanel .panelCloseButton,
      .wordPickerScreen .openPanel .panelCloseButton {
        border: 1px solid #6ea6da !important;
        background: #ffffff !important;
        color: #315d91 !important;
        box-shadow: none !important;
      }

      @media (max-width: 560px) {
        .learningOverviewCompact .detailsButton {
          font-size: .8rem !important;
        }
      }
    `}</style>
  );
}
