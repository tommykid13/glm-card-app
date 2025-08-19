'use client';

import { useRef, useState } from 'react';
import type { Card } from '../types/card';
import type { Poster } from '../types/poster';
import { toPng } from 'html-to-image';

const SUGGESTIONS = [
  '恐龍為什麼會滅亡？',
  '太陽系有哪幾顆行星？',
  '海豚有哪些特點？',
  '植物生長要什麼？',
  '天空為什麼是藍色的？',
  '為什麼恐龍滅絕，而鱷魚還存在？',
  '科學實驗：做浮沉蛋',
];

type Layout = 'poster' | 'list';

export default function Home() {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(8);
  const [tone, setTone] = useState('兒童友好');
  const [layout, setLayout] = useState<Layout>('poster'); // 預設海報

  const [cards, setCards] = useState<Card[]>([]);
  const [poster, setPoster] = useState<Poster | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  const posterRef = useRef<HTMLDivElement>(null);

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true); setErr('');
    setCards([]); setPoster(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count, tone, layout: 'poster' }),
      });

      const raw = await res.text();
      let data: any;
      try { data = JSON.parse(raw); }
      catch {
        const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
        if (s >= 0 && e > s) data = JSON.parse(raw.slice(s, e + 1));
        else throw new Error(raw.slice(0, 200));
      }

      if (!res.ok) throw new Error(data?.error || 'Request failed');

      if (layout === 'poster' && data?.poster) setPoster(data.poster as Poster);
      else if (layout === 'list' && Array.isArray(data?.cards)) setCards(data.cards as Card[]);
      else throw new Error('Unexpected response shape');
    } catch (e: any) {
      setErr(e?.message || 'Failed to parse response');
    } finally {
      setLoading(false);
    }
  }

  function onPickSuggestion(s: string) { setTopic(s); }
  function copyJSON() {
    const obj = layout === 'poster' ? { poster } : { cards };
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
  }
  function copyAllText() {
    if (layout === 'poster' && poster) {
      const t = [
        `${poster.heroIcon || '🎓'} ${poster.title}`,
        poster.subtitle || '',
        ...(poster.sections || []).map(s => `【${s.heading}】${s.body}`),
        poster.compare ? `對比：${poster.compare.left.title} vs ${poster.compare.right.title}` : '',
        ...(poster.grid || []).map(g => `${g.icon} ${g.title}：${g.text}`),
        poster.takeaway ? `一句話：${poster.takeaway.summary}。思考：${poster.takeaway.question}` : '',
      ].filter(Boolean).join('\n');
      navigator.clipboard.writeText(t);
      return;
    }
    if (layout === 'list') {
      const t = cards.map((c,i)=>`#${i+1} ${c.icon} ${c.title}\n${c.description}\n標籤：${(c.tags||[]).join('/')}`).join('\n\n');
      navigator.clipboard.writeText(t);
    }
  }
  async function exportPNG() {
    if (!posterRef.current) return;
    const url = await toPng(posterRef.current, { cacheBust: true, pixelRatio: 2 });
    const a = document.createElement('a');
    a.href = url; a.download = 'poster.png'; a.click();
  }
  function exportHTML() {
    if (!posterRef.current) return;
    const html = `<!doctype html><meta charset="utf-8"><title>${poster?.title || 'poster'}</title>` + posterRef.current.outerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'poster.html'; a.click();
    URL.revokeObjectURL(url);
  }
  async function shareLink() {
    const text = `我用 GLM 生成了知識海報：《${poster?.title || topic}》`;
    if (navigator.share) { try { await navigator.share({ text, url: location.href }); } catch {} }
    else { await navigator.clipboard.writeText(location.href); alert('連結已複製'); }
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
                placeholder="告訴我你想了解的任何知識，我會為你做一張有趣的卡片！\n例如：我想了解恐龍為什麼會滅亡？"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">數量</label>
                  <input type="number" min={1} max={24}
                    className="w-full rounded-xl border border-amber-200 bg-white p-2"
                    value={count} onChange={(e)=>setCount(parseInt(e.target.value || '8'))}/>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">語氣</label>
                  <input className="w-full rounded-xl border border-amber-200 bg-white p-2"
                    value={tone} onChange={(e)=>setTone(e.target.value)}/>
                </div>
              </div>

              {/* 佈局切換（預設海報） */}
              <div className="mt-3 flex gap-2 text-xs">
                <button
                  className={`rounded-full px-3 py-1 border ${layout==='poster'?'bg-amber-400 text-white border-amber-400':'border-amber-200 bg-amber-50'}`}
                  onClick={()=>setLayout('poster')}
                >海報模式</button>
                <button
                  className={`rounded-full px-3 py-1 border ${layout==='list'?'bg-amber-400 text-white border-amber-400':'border-amber-200 bg-amber-50'}`}
                  onClick={()=>setLayout('list')}
                >列表模式</button>
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
                  <button key={s} onClick={()=>onPickSuggestion(s)}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs hover:bg-amber-100"
                  >{s}</button>
                ))}
              </div>
            </div>
          </aside>

          {/* 右側展示區 */}
          <section className="flex-1">
            <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
              {/* 工具列（海報模式才顯示完整） */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button onClick={generate} disabled={!topic || loading}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm hover:bg-amber-100 disabled:opacity-40">重新生成</button>
                <button onClick={copyJSON} disabled={!(poster || cards.length)}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm hover:bg-amber-100 disabled:opacity-40">複製JSON</button>
                <button onClick={copyAllText} disabled={!(poster || cards.length)}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm hover:bg-amber-100 disabled:opacity-40">複製全部文案</button>
                {layout === 'poster' && (
                  <>
                    <button onClick={exportPNG} disabled={!poster}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm hover:bg-amber-100 disabled:opacity-40">導出PNG</button>
                    <button onClick={exportHTML} disabled={!poster}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm hover:bg-amber-100 disabled:opacity-40">下載HTML</button>
                    <button onClick={shareLink} disabled={!poster}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm hover:bg-amber-100 disabled:opacity-40">分享</button>
                  </>
                )}
              </div>

              {/* 渲染 */}
              {layout === 'poster' ? (
                poster ? (
                  <div ref={posterRef} className="mx-auto max-w-2xl rounded-2xl bg-[#FFF7ED] p-6 shadow-[0_2px_0_rgba(0,0,0,0.02)]">
                    <div className="flex items-center justify-between">
                      <h1 className="text-3xl font-extrabold tracking-tight">{poster.title}</h1>
                      <div className="text-4xl">{poster.heroIcon || '🎓'}</div>
                    </div>
                    {poster.subtitle && (
                      <p className="mt-1 text-gray-600">{poster.subtitle}</p>
                    )}

                    <div className="my-4 h-px bg-amber-200" />

                    {(poster.sections || []).map((s, i) => (
                      <section key={i} className="mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                          <span className="text-2xl">{s.icon}</span>{s.heading}
                        </h2>
                        <p className="mt-1 text-gray-700 leading-relaxed">{s.body}</p>
                      </section>
                    ))}

                    {poster.compare && (
                      <div className="my-5 grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-white p-4 text-center shadow-sm border border-amber-100">
                          <div className="text-sm text-gray-500">對比</div>
                          <div className="text-lg font-semibold">{poster.compare.left.title}</div>
                          <ul className="mt-2 text-left list-disc list-inside text-gray-700">
                            {poster.compare.left.bullets.map((b, i) => <li key={i}>{b}</li>)}
                          </ul>
                        </div>
                        <div className="rounded-xl bg-white p-4 text-center shadow-sm border border-amber-100">
                          <div className="text-sm text-gray-500">VS</div>
                          <div className="text-lg font-semibold">{poster.compare.right.title}</div>
                          <ul className="mt-2 text-left list-disc list-inside text-gray-700">
                            {poster.compare.right.bullets.map((b, i) => <li key={i}>{b}</li>)}
                          </ul>
                        </div>
                      </div>
                    )}

                    {poster.grid && (
                      <>
                        <h3 className="mt-6 mb-2 text-lg font-semibold">環境變化的影響</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {poster.grid.map((g, i) => (
                            <div key={i} className="rounded-xl bg-white p-4 shadow-sm border border-amber-100">
                              <div className="flex items-center gap-2 font-semibold">
                                <span className="text-xl">{g.icon}</span>{g.title}
                              </div>
                              <p className="mt-1 text-gray-700">{g.text}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {poster.takeaway && (
                      <div className="mt-6 rounded-xl bg-white p-4 border border-amber-100">
                        <div className="font-semibold">一句話總結</div>
                        <p className="mt-1">
                          <span className="font-semibold text-amber-700">{poster.takeaway.summary}</span>
                        </p>
                        {poster.takeaway.question && (
                          <p className="mt-2 text-gray-700">{poster.takeaway.question}</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-[360px] items-center justify-center rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/40">
                    <div className="text-center text-gray-500">
                      <div className="mb-2 text-3xl">📖</div>
                      <div className="font-medium">你的知識卡片將在這裡顯示</div>
                      <div className="text-sm">在左側輸入主題，點「製作我的知識卡片」</div>
                    </div>
                  </div>
                )
              ) : (
                // 列表模式（保留原功能）
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cards.map((c, i) => (
                    <article key={i} className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                      <div className="text-3xl">{c.icon}</div>
                      <h4 className="mt-2 text-base font-semibold">{c.title}</h4>
                      <p className="mt-1 text-sm text-gray-600">{c.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(c.tags || []).map((t, j) => (
                          <span key={j} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">{t}</span>
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
