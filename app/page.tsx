'use client';

import { useState } from 'react';
import type { Card } from '../types/card';

const SUGGESTIONS = [
  '恐龍為什麼會滅亡？',
  '太陽系有哪幾顆行星？',
  '海豚有哪些特點？',
  '植物生長要什麼？',
  '天空為什麼是藍色的？',
  '為什麼恐龍滅絕，而鱷魚還存在？',
  '科學實驗：做浮沉蛋',
];

export default function Home() {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(8);
  const [tone, setTone] = useState('兒童友好');

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true);
    setErr('');
    setCards([]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count, tone }),
      });

      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        const s = raw.indexOf('{');
        const e = raw.lastIndexOf('}');
        if (s >= 0 && e > s) data = JSON.parse(raw.slice(s, e + 1));
        else throw new Error(raw.slice(0, 200));
      }

      if (!res.ok) throw new Error(data?.error || 'Request failed');
      const arr: Card[] = Array.isArray(data?.cards) ? data.cards : [];
      setCards(arr);

      const history = JSON.parse(localStorage.getItem('history') || '[]') as any[];
      history.unshift({ ts: Date.now(), topic, count, tone, cards: arr });
      localStorage.setItem('history', JSON.stringify(history.slice(0, 10)));
    } catch (e: any) {
      setErr(e?.message || 'Failed to parse response');
    } finally {
      setLoading(false);
    }
  }

  function onPickSuggestion(s: string) {
    setTopic(s);
  }

  function copyJSON() {
    const text = JSON.stringify({ cards }, null, 2);
    navigator.clipboard.writeText(text);
  }

  function copyAllText() {
    const text = cards
      .map(
        (c, i) =>
          `#${i + 1} ${c.icon} ${c.title}\n${c.description}\n標籤：${(c.tags || []).join(' / ')}`
      )
      .join('\n\n');
    navigator.clipboard.writeText(text);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ cards }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = 'cards.json';
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    setCards([]);
    setErr('');
  }

  return (
    <div className="min-h-screen bg-[#FFF8F1] text-[#3b3b3b]">
      <header className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🧠</div>
          <div>
            <h1 className="text-2xl font-semibold">小朋友知識卡片</h1>
            <p className="text-sm text-gray-600">用自然語言學新知，創建有趣學習卡片！</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <div className="flex flex-col md:flex-row gap-6">
          {/* 左側控制欄 */}
          <aside className="w-full md:w-[360px]">
            <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-[15px] font-semibold">💡 你想學什麼知識呢？</h2>
              <textarea
                className="w-full rounded-xl border border-amber-200 bg-amber-50/60 p-3 outline-none focus:ring-2 focus:ring-amber-300"
                rows={5}
                placeholder="告訴我你想了解的任何知識，我會為你做一張有趣的卡片！\n例如：我想了解恐龍的種類，或者太陽系有哪些行星。"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">數量</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    className="w-full rounded-xl border border-amber-200 bg-white p-2"
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value || '8'))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">語氣</label>
                  <input
                    className="w-full rounded-xl border border-amber-200 bg-white p-2"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                  />
                </div>
              </div>

              <button
                onClick={generate}
                disabled={!topic || loading}
                className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-3 font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {loading ? '製作中…' : '✨ 製作我的知識卡片'}
              </button>
            </div>

            {/* 推薦主題 */}
            <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[15px] font-semibold">⚡ 試試這些知識主題</h3>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => onPickSuggestion(s)}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs hover:bg-amber-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* 右側展示區 */}
          <section className="flex-1">
            <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
              {/* 工具列 */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={copyJSON}
                  disabled={!cards.length}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm hover:bg-amber-100 disabled:opacity-40"
                >
                  複製 JSON
                </button>
                <button
                  onClick={copyAllText}
                  disabled={!cards.length}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm hover:bg-amber-100 disabled:opacity-40"
                >
                  複製全部文案
                </button>
                <button
                  onClick={exportJSON}
                  disabled={!cards.length}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm hover:bg-amber-100 disabled:opacity-40"
                >
                  導出 JSON
                </button>
                <button
                  onClick={clearAll}
                  disabled={!cards.length}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 disabled:opacity-40"
                >
                  清空
                </button>
              </div>

              {cards.length === 0 ? (
                <div className="flex h-[360px] items-center justify-center rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/40">
                  <div className="text-center text-gray-500">
                    <div className="mb-2 text-3xl">📖</div>
                    <div className="font-medium">你的知識卡片將在這裡顯示</div>
                    <div className="text-sm">在左側輸入主題，點「製作我的知識卡片」</div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cards.map((c, i) => (
                    <article key={i} className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                      <div className="text-3xl">{c.icon}</div>
                      <h4 className="mt-2 text-base font-semibold">{c.title}</h4>
                      <p className="mt-1 text-sm text-gray-600">{c.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(c.tags || []).map((t, j) => (
                          <span key={j} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {err && <div className="mt-3 text-sm text-red-600">錯誤：{err}</div>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
