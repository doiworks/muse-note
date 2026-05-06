'use client';

import { useEffect, useState } from 'react';

export default function HomePage() {
  // 画面表示に使う状態（state）をわかりやすい名前で宣言します。
  const [wordList, setWordList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // 初回表示時に単語データをAPIから読み込みます。
  useEffect(() => {
    async function loadWords() {
      try {
        // URLに ?preview_token=xxxx がある場合だけ、管理者確認モードとしてAPIへ渡します。
        // 例: http://localhost:3000?preview_token=your-secret-token
        const searchParams = new URLSearchParams(window.location.search);
        const previewToken = searchParams.get('preview_token');
        const apiUrl = previewToken ? `/api/words?preview_token=${encodeURIComponent(previewToken)}` : '/api/words';
        const response = await fetch(apiUrl);
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

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Muse Note（英単語学習）</h1>
      <p>まずはログインなしで動く最小構成です。あとでLINE Loginを追加しやすい構成にしています。</p>

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
