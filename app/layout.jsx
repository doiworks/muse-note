// ✅ Next.js App Router では、この app/layout.jsx が必須です。
// このファイルがないと、Vercel ビルド時に
// "page.jsx doesn't have a root layout" エラーになります。

// metadata は、ブラウザのタブ名や検索エンジン向け情報です。
export const metadata = {
  title: 'Muse Note',
  description: '英単語学習アプリ Muse Note'
};

// RootLayout は全ページ共通の「親レイアウト」です。
// children には app/page.jsx など各ページの中身が入ります。
export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        {/* 共通ヘッダー・フッターは、将来ここに追加できます。 */}
        {children}
      </body>
    </html>
  );
}
