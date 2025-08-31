'use client';

import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';

type Layout = 'poster' | 'list';

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
  const [count, setCount] = useState(6);
  const [tone, setTone] = useState('兒童友好');
  const [layout, setLayout] = useState<Layout>('poster');

  // 简化类型，避免与外部定义不一致导致的编译问题
  const [cards, setCards] = useState<any[]>([]);
  const [poster, setPoster] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const posterRef = useRef<HTMLDivElement | null>(null);

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true);
    setErr('');
    setCards([]);
    setPoster(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count, tone, layout: 'poster' }), // 固定向後端請海報
      });

      // —— 更稳健的解析：优先 .json()；失败再回退 text() → 手动截取大括号 —— //
      let data: any;
      try {
        data = await res.json();
      } catch {
        const raw = await res.text();
        const s = raw.indexOf('{');
        const e = raw.lastIndexOf('}');
        data = JSON.parse(raw.slice(s, e + 1));
      }

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      if (data?.poster) {
        setLayout('poster');
        setPoster(data.poster);
        return;
      }
      if (Array.isArray(data?.cards)) {
        setLayout('list');
        setCards(data.cards);
        return;
      }

      if (data?.error) throw new Error(String(data.error));
      throw new Error('Unexpected response');
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
    const obj = layout === 'poster' ? { poster } : { cards };
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
  }

  function copyAllText() {
    if (layout === 'poster' && poster) {
      const t = [
        `${poster.heroIcon || '🎓'} ${poster.title}`,
        poster.subtitle || '',
        ...(poster.sections || []).map((s: any) => `【${s.heading}】${s.body}`),
        poster.compare
          ? `對比：${poster.compare.left.title} vs ${poster.compare.right.title}`
          : '',
        ...(poster.grid || []).map((g: any) => `${g.icon} ${g.title}：${g.text}`),
        poster.takeaway
          ? `一句話：${poster.takeaway.summary}。思考：${poster.takeaway.question}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
      navigator.clipboard.writeText(t);
      return;
    }
    if (layout === 'list') {
      const t = cards
        .map(
          (c: any, i: number) =>
            `#${i + 1} ${c.icon || ''} ${c.title}\n${c.description}\n標籤：${
              (c.tags || []).join('/') || '-'
            }`,
        )
        .join('\n\n');
      navigator.clipboard.writeText(t);
    }
  }

  async function exportPNG() {
    if (!posterRef.current) return;
    const url = await toPng(posterRef.current, { cacheBust: true, pixelRatio: 2 });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'poster.png';
    a.click();
  }

  function exportHTML() {
    if (!posterRef.current) return;
    const html =
      `<!doctype html><meta charset="utf-8"><title>${poster?.title || 'poster'}</title>` +
      posterRef.current.outerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'poster.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      {/* 頭部 */}
      <header className="mb-4">
        <h1 className="text-2xl font-bold">小朋友知識卡片</h1>
        <p className="text-sm text-gray-600">用自然語言學新知，創建有趣學習卡片！</p>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-[320px,1fr]">
        {/* 左側控制欄 */}
        <aside className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <label className="mb-2 block text-sm font-medium">💡 你想學什麼知識呢？</label>
          <textarea
            className="mb-3 h-24 w-full resize-none rounded border p-2"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例如：太陽系有哪幾顆行星？"
          />

          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm">數量</label>
              <input
                type="number"
                min={1}
                max={20}
                className="w-full rounded border p-2"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value || '6'))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">語氣</label>
              <select
                className="w-full rounded border p-2"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                <option>兒童友好</option>
                <option>科學嚴謹</option>
                <option>輕鬆幽默</option>
              </select>
            </div>
          </div>

          <div className="mb-3 flex gap-2">
            <button
              className={`rounded border px-3 py-1 text-sm ${
                layout === 'poster'
                  ? 'border-amber-400 bg-amber-100'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => setLayout('poster')}
            >
              海報模式
            </button>
            <button
              className={`rounded border px-3 py-1 text-sm ${
                layout === 'list'
                  ? 'border-amber-400 bg-amber-100'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => setLayout('list')}
            >
              列表模式
            </button>
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="w-full rounded bg-amber-400 px-4 py-2 font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '製作中…' : '✨ 製作我的知識卡片'}
          </button>

          {/* 推薦主題 */}
          <div className="mt-5">
            <div className="mb-2 text-sm font-medium">⚡ 試試這些知識主題</div>
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
        <section className="rounded-lg border p-4">
          {/* 工具列 */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              onClick={generate}
              disabled={loading}
            >
              重新生成
            </button>
            <button
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              onClick={copyJSON}
            >
              複製JSON
            </button>
            <button
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              onClick={copyAllText}
            >
              複製全部文案
            </button>
            {layout === 'poster' && poster ? (
              <>
                <button
                  className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                  onClick={exportPNG}
                >
                  導出PNG
                </button>
                <button
                  className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                  onClick={exportHTML}
                >
                  下載HTML
                </button>
              </>
            ) : null}
          </div>

          {/* 渲染 */}
          {layout === 'poster' ? (
            poster ? (
              <div className="space-y-4 overflow-y-auto" ref={posterRef}>
                {/* 標題區 */}
                <h2 className="flex items-center text-xl font-bold">
                  <span className="mr-2">{poster.heroIcon || '🎓'}</span>
                  <span>{poster.title}</span>
                </h2>

                {/* 副標題 */}
                {poster.subtitle ? (
                  <p className="text-sm text-gray-600">{poster.subtitle}</p>
                ) : null}

                {/* 主內容區 */}
                <div className="space-y-3">
                  {(poster.sections || []).map((s: any, i: number) => (
                    <section key={i}>
                      <h3 className="font-semibold">
                        {s.icon} {s.heading}
                      </h3>
                      <p className="text-sm">{s.body}</p>
                    </section>
                  ))}
                </div>

                {/* 對比區 */}
                {poster.compare ? (
                  <section>
                    <h3 className="font-semibold">對比</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="underline">
                          {poster.compare.left.title}
                        </h4>
                        {(poster.compare.left.bullets || []).map(
                          (b: string, i: number) => (
                            <p key={i}>• {b}</p>
                          ),
                        )}
                      </div>
                      <div>
                        <h4 className="underline">
                          {poster.compare.right.title}
                        </h4>
                        {(poster.compare.right.bullets || []).map(
                          (b: string, i: number) => (
                            <p key={i}>• {b}</p>
                          ),
                        )}
                      </div>
                    </div>
                  </section>
                ) : null}

                {/* 網格區 */}
                {Array.isArray(poster.grid) && poster.grid.length ? (
                  <section>
                    <h3 className="font-semibold">重點</h3>
                    {poster.grid.map((g: any, i: number) => (
                      <div key={i}>
                        <h4>
                          {g.icon} {g.title}
                        </h4>
                        <p>{g.text}</p>
                      </div>
                    ))}
                  </section>
                ) : null}

                {/* 一句話總結 */}
                {poster.takeaway ? (
                  <section>
                    <h3 className="font-semibold">一句話總結</h3>
                    <p>{poster.takeaway.summary}</p>
                    {poster.takeaway.question ? (
                      <p>{poster.takeaway.question}</p>
                    ) : null}
                  </section>
                ) : null}

                {/* 調試：仍看不到時可展開 JSON 數據 */}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-gray-400">
                    調試：查看 poster JSON
                  </summary>
                  <pre className="max-h-64 overflow-auto rounded bg-gray-50 p-2 text-xs">
                    {JSON.stringify(poster, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="flex h-60 flex-col items-center justify-center text-center text-gray-400">
                <span className="text-3xl">📖</span>
                <p>你的知識卡片將在這裡顯示</p>
                <p>在左側輸入主題，點「製作我的知識卡片」</p>
              </div>
            )
          ) : (
            // list 模式
            <div className="space-y-3">
              {cards.map((c: any, i: number) => (
                <div key={i} className="rounded border p-3">
                  <div className="font-semibold">
                    {c.icon || ''} {c.title}
                  </div>
                  <p className="text-sm">{c.description}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
                    {(c.tags || []).map((t: string, j: number) => (
                      <span
                        key={j}
                        className="rounded-full border px-2 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 錯誤提示 */}
          {err ? (
            <p className="mt-3 text-xs text-red-500">錯誤：{String(err)}</p>
          ) : null}
        </section>
      </section>
    </main>
  );
}
