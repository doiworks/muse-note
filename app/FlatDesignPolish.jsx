'use client';

export default function FlatDesignPolish() {
  return (
    <style jsx global>{`
      /* 既存の「早い・通常・ゆっくり・開始」と同じ柔らかさへ統一 */
      .wordPickerScreen .importantPriorityBadge {
        background: #f3a45b !important;
        color: #ffffff !important;
        border: 0 !important;
        box-shadow: none !important;
      }

      .wordPickerScreen .importantWordRow:not(.selected) {
        background: #fffaf2 !important;
        box-shadow: 0 2px 7px rgba(72, 113, 158, .08) !important;
      }

      .wordPickerScreen .wordRowItem.selected {
        background: #b9daf6 !important;
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
        background: #f7fbff !important;
        box-shadow: none !important;
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
        background: rgba(52, 76, 104, .24) !important;
        backdrop-filter: none !important;
      }

      .analyticsPanel {
        width: min(620px, calc(100vw - 24px)) !important;
        max-width: calc(100vw - 24px) !important;
        padding: 16px !important;
        border: 0 !important;
        border-radius: 20px !important;
        background: #ffffff !important;
        box-shadow: 0 10px 28px rgba(52, 76, 104, .16) !important;
        overflow-x: hidden !important;
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
        background: #f7fbff !important;
        box-shadow: none !important;
      }

      .analyticsPanel .refreshButton,
      .analyticsPanel .speakButton {
        border: 0 !important;
        background: #edf5ff !important;
        color: #315d91 !important;
        box-shadow: none !important;
      }

      .analyticsPanel .closeButton {
        border: 0 !important;
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

      .analyticsPanel .rank {
        border: 0 !important;
        background: #e7f2fd !important;
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
          padding: 15px 14px 22px !important;
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
