// app/page.tsx
'use client';

import { useState } from 'react';
import type { Card } from '../types/card';

export default function Home() {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(8);
  const [tone, setTone]   = useState('neutral');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  async function generate() {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Request failed');
      setCards(data.cards || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to parse JSON response');
      setCards([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">GLM Card Generator</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <input className="border p-2 rounded"
          placeholder="Topic"
          value={topic} onChange={e=>setTopic(e.target.value)} />
        <input className="border p-2 rounded"
          type="number" min={1} max={24}
          value={count} onChange={e=>setCount(parseInt(e.target.value||'8'))}/>
        <input className="border p-2 rounded"
          placeholder="Tone (e.g. business)"
          value={tone} onChange={e=>setTone(e.target.value)} />
      </div>

      <button
        onClick={generate}
        disabled={!topic || loading}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate'}
      </button>

      {err && <div className="text-red-600">{err}</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <div key={i} className="border rounded p-4 bg-white">
            <div className="text-3xl">{c.icon}</div>
            <div className="font-semibold mt-2">{c.title}</div>
            <div className="text-sm text-gray-600 mt-1">{c.description}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {c.tags?.map((t, j)=>(
                <span key={j} className="text-xs px-2 py-0.5 bg-gray-100 rounded">{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
