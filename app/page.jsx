'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const router = useRouter();

  // 画面表示に使う状態（state）をわかりやすい名前で宣言します。
  const [wordList, setWordList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // 初回表示時に単語データをAPIから読み込みます。
  useEffect(() => {
    async function loadWords() {
      try {
        const response = await fetch('/api/words');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '単語データの取得に失敗しました。');
        }

        setWordList(data.words || []);
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadWords();
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/preview-logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
        <h1>Muse Note（英単語学習）</h1>
        <button type="button" onClick={handleLogout} style={{ padding: '8px 12px', cursor: 'pointer' }}>
          ログアウト
        </button>
      </div>
      <p>現在は開発確認用の仮ログイン中です。あとで LINE Login に置き換えやすい構成にしています。</p>

      {isLoading && <p>読み込み中です...</p>}
      {!isLoading && errorMessage && <p style={{ color: 'crimson' }}>{errorMessage}</p>}

      {!isLoading && !errorMessage && (
        <section>
          <h2>単語一覧（最初の20件）</h2>
          <ul>
            {wordList.slice(0, 20).map((word) => (
              <li key={word.id}>
                <strong>{word.english}</strong> - {word.japanese}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
