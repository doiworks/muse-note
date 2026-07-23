// Next.js App Router では、このファイル（app/layout.jsx）が必須です。
// これが無いと、Vercel build で
// "page.jsx doesn't have a root layout" エラーになります。

import QuizKeyboardContinuity from './QuizKeyboardContinuity';
import LearningOverview from './LearningOverview';
import WordPickerEnhancer from './WordPickerEnhancer';

// 全ページ共通のメタ情報（タブ名など）です。
export const metadata = {
  title: 'Muse Note',
  description: '英単語学習アプリ Muse Note'
};

// RootLayout は、全ページの共通の外枠です。
// children には app/page.jsx など、各ページの中身が入ります。
export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <QuizKeyboardContinuity />
        <LearningOverview />
        <WordPickerEnhancer />
        {children}
      </body>
    </html>
  );
}
