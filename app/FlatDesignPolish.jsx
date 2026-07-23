'use client';

export default function FlatDesignPolish() {
  return (
    <style jsx global>{`
      /* 「早い・通常」ボタンと同じ、輪郭に頼らない柔らかな色面へ統一 */
      .questionModeArea :global(button.quizMethodCard),
      button.quizMethodCard {
        border: 0 !important;
        background: #dcecff !important;
        color: #4f6b94 !important;
        box-shadow: 0 3px 8px rgba(127, 177, 232, .18) !important;
      }

      .questionModeArea :global(button.quizMethodCard:hover),
      button.quizMethodCard:hover {
        background: #cfe3fb !important;
      }

      .questionModeArea :global(button.quizMethodCard.quizMethodCardActive),
      button.quizMethodCard.quizMethodCardActive {
        border: 0 !important;
        background: #7fb1e8 !important;
        color: #ffffff !important;
        box-shadow: 0 4px 10px rgba(127, 177, 232, .28) !important;
      }

      .wordPickerScreen .importantPriorityBadge,
      .wordPickerScreen .compactMetaTag.important,
      .wordPickerScreen .wordTag.important {
        background: #e9ddff !important;
        color: #6d4aa8 !important;
        border: 0 !important;
        box-shadow: none !important;
      }

      .wordPickerScreen .importantWordRow:not(.selected) {
        background: #f8f3ff !important;
        box-shadow: 0 2px 7px rgba(112, 82, 158, .08) !important;
      }

      .wordPickerScreen .mistakeCountBadge.hasMistake {
        background: #ffe4e8 !important;
        color: #b74f62 !important;
      }

      .wordPickerScreen .pickerPrimaryActions .weakFilterActive {
        border: 0 !important;
        background: #ffdce3 !important;
        color: #ad465b !important;
        box-shadow: 0 3px 8px rgba(190, 76, 100, .14) !important;
      }

      .wordPickerScreen .wordRowItem.selected {
        background: #cfe5fb !important;
        box-shadow: 0 2px 8px rgba(72, 113, 158, .12) !important;
      }

      .wordPickerScreen .wordRowItem.selected .wordEnglish,
      .wordPickerScreen .wordRowItem.selected .wordJapanese {
        color: #315d91 !important;
      }

      .selectAreaActions {
        width: 100% !important;
        max-width: 100% !important;
      }

      .selectAreaActions .openWordModalBtn {
        min-width: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        border: 0 !important;
        background: #a8c9f0 !important;
        color: #ffffff !important;
        box-shadow: 0 4px 10px rgba(168, 201, 240, .28) !important;
        overflow-wrap: anywhere !important;
      }

      .selectAreaActions .openWordModalBtn.primaryOpen {
        background: #7fb1e8 !important;
        color: #ffffff !important;
        box-shadow: 0 4px 10px rgba(127, 177, 232, .30) !important;
      }

      .selectAreaActions .openWordModalBtn:active {
        transform: scale(.99) !important;
      }

      .selectAreaActions .openWordModalBtn:focus-visible {
        outline: 2px solid #a8c9f0 !important;
        outline-offset: 2px !important;
      }

      .learningOverviewCompact .overviewCard {
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      .learningOverviewCompact .compactMetric {
        border: 0 !important;
        background: #dcecff !important;
        box-shadow: 0 3px 8px rgba(127, 177, 232, .16) !important;
      }

      .learningOverviewCompact .detailsButton {
        border: 0 !important;
        background: #a8c9f0 !important;
        color: #ffffff !important;
        font-size: .86rem !important;
        box-shadow: 0 4px 10px rgba(168, 201, 240, .28) !important;
      }

      .analyticsOverlay {
        padding: 12px !important;
        background: rgba(78, 68, 104, .18) !important;
        backdrop-filter: none !important;
      }

      .analyticsPanel {
        width: min(620px, calc(100vw - 24px)) !important;
        max-width: calc(100vw - 24px) !important;
        padding: 16px !important;
        border: 0 !important;
        border-radius: 20px !important;
        background: #f4effc !important;
        box-shadow: 0 10px 28px rgba(78, 68, 104, .14) !important;
        overflow-x: hidden !important;
      }

      .analyticsPanel .analyticsHeader {
        padding: 12px !important;
        border: 0 !important;
        border-radius: 16px !important;
        background: #ffffff !important;
      }

      .analyticsPanel .summaryGrid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }

      .analyticsPanel .summaryCard,
      .analyticsPanel .dailyCard,
      .analyticsPanel .gradeRow,
      .analyticsPanel .weakWordRow,
      .analyticsPanel .weakWordEmpty {
        min-width: 0 !important;
        border: 0 !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }

      .analyticsPanel .analysisSection h3,
      .analyticsPanel .analyticsHeader strong {
        color: #655087 !important;
      }

      .analyticsPanel .summaryCard span,
      .analyticsPanel .dailyCard span,
      .analyticsPanel .dailyCard small,
      .analyticsPanel .gradeLabel span,
      .analyticsPanel .gradeNumbers span,
      .analyticsPanel .weakWordName span,
      .analyticsPanel .weakWordMeta span {
        color: #8a7ca0 !important;
      }

      .analyticsPanel .summaryCard b,
      .analyticsPanel .dailyCard b,
      .analyticsPanel .gradeLabel strong,
      .analyticsPanel .gradeNumbers b,
      .analyticsPanel .weakWordName strong,
      .analyticsPanel .weakWordMeta b {
        color: #655087 !important;
      }

      .analyticsPanel .refreshButton,
      .analyticsPanel .speakButton {
        border: 0 !important;
        background: #eee6f9 !important;
        color: #655087 !important;
        box-shadow: none !important;
      }

      .analyticsPanel .closeButton {
        border: 0 !important;
        background: #b9a6dc !important;
        color: #ffffff !important;
        box-shadow: 0 3px 8px rgba(117, 91, 158, .20) !important;
      }

      .analyticsPanel .gradeTrack {
        background: #e6ddf2 !important;
      }

      .analyticsPanel .gradeTrack span {
        background: #b9a6dc !important;
      }

      .analyticsPanel .rank {
        border: 0 !important;
        background: #eee6f9 !important;
        color: #655087 !important;
      }

      .wordPickerScreen .savePanel .panelCloseButton,
      .wordPickerScreen .openPanel .panelCloseButton {
        border: 0 !important;
        background: #edf5ff !important;
        color: #315d91 !important;
        box-shadow: none !important;
      }

      @media (max-width: 560px) {
        .selectAreaActions {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }

        .selectAreaActions .openWordModalBtn {
          min-width: 0 !important;
          min-height: 56px !important;
          padding: 8px 7px !important;
          font-size: .77rem !important;
          line-height: 1.25 !important;
        }

        .learningOverviewCompact .overviewCard {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 72px !important;
          gap: 6px !important;
        }

        .learningOverviewCompact .detailsButton {
          min-width: 72px !important;
          font-size: .76rem !important;
        }

        .analyticsOverlay {
          padding: 0 !important;
          align-items: flex-end !important;
        }

        .analyticsPanel {
          width: 100% !important;
          max-width: 100% !important;
          max-height: 92dvh !important;
          padding: 14px 14px 22px !important;
          border-radius: 20px 20px 0 0 !important;
        }

        .analyticsPanel .summaryGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 7px !important;
        }

        .analyticsPanel .dailyGrid {
          max-width: 100% !important;
          grid-template-columns: repeat(7, 72px) !important;
          overflow-x: auto !important;
        }

        .analyticsPanel .gradeRow {
          grid-template-columns: 76px minmax(54px, 1fr) 84px !important;
          gap: 7px !important;
          padding: 11px 10px !important;
        }

        .analyticsPanel .weakWordRow {
          grid-template-columns: 30px minmax(0, 1fr) auto 36px !important;
          gap: 7px !important;
          padding: 10px !important;
        }
      }
    `}</style>
  );
}
