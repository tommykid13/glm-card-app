"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Card } from '../types/card';

/**
 * Main page component for the card generation app.
 *
 * Users can enter a topic, number of cards and tone. The form submits to
 * the serverless /api/chat endpoint which proxies the Zhipu API. Streaming
 * responses are parsed and progressively rendered. Generated cards can be
 * copied, exported or cleared. Previous generations are stored in
 * localStorage and shown in a history list.
 */
export default function Page() {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(4);
  const [tone, setTone] = useState('business');
  const [cards, setCards] = useState<Card[]>([]);
  const [rawResponse, setRawResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ timestamp: number; topic: string; cards: Card[] }>>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('glm_card_history');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Persist history to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('glm_card_history', JSON.stringify(history));
    } catch (err) {
      console.error(err);
    }
  }, [history]);

  /**
   * Handle form submission: call the chat API and stream results.
   */
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }
    setError(null);
    setCards([]);
    setRawResponse('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), count, tone }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.error || `Request failed with status ${res.status}`);
        setLoading(false);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        // Non-stream response fallback
        const text = await res.text();
        try {
          const obj = JSON.parse(text);
          if (obj.cards) {
            setCards(obj.cards as Card[]);
            // update history
            setHistory((prev) => {
              const newEntry = { timestamp: Date.now(), topic: topic.trim(), cards: obj.cards as Card[] };
              return [newEntry, ...prev].slice(0, 10);
            });
          }
        } catch (jsonErr) {
          setError('Failed to parse response');
        }
        setLoading(false);
        return;
      }
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let finished = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Split into SSE events separated by two newlines
        const events = buffer.split(/\n\n/);
        // Keep the last partial event in buffer
        buffer = events.pop() || '';
        for (const event of events) {
          const lines = event.split(/\n/);
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (data === '[DONE]') {
                finished = true;
                break;
              }
              try {
                const payload = JSON.parse(data);
                const content = payload.choices?.[0]?.delta?.content;
                if (content) {
                  setRawResponse((prev) => prev + content);
                }
              } catch (e) {
                // Not valid JSON, ignore
              }
            }
          }
          if (finished) break;
        }
        if (finished) break;
      }
      // Once finished, parse the accumulated content to extract cards
      try {
        // The model should return only JSON; trim whitespace before parsing
        const jsonStr = rawResponse + buffer;
        const parsed = JSON.parse(jsonStr);
        if (parsed.cards) {
          setCards(parsed.cards as Card[]);
          // Add to history
          setHistory((prev) => {
            const newEntry = { timestamp: Date.now(), topic: topic.trim(), cards: parsed.cards as Card[] };
            return [newEntry, ...prev].slice(0, 10);
          });
        } else {
          setError('Response did not contain cards');
        }
      } catch (e) {
        setError('Failed to parse JSON response');
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  /** Copy JSON representation of cards to clipboard */
  const copyJson = async () => {
    if (!cards.length) return;
    await navigator.clipboard.writeText(JSON.stringify({ cards }, null, 2));
  };

  /** Copy all card titles and descriptions as plain text */
  const copyText = async () => {
    if (!cards.length) return;
    const text = cards
      .map((c, idx) => `${idx + 1}. ${c.icon} ${c.title}\n${c.description}\nTags: ${c.tags.join(', ')}`)
      .join('\n\n');
    await navigator.clipboard.writeText(text);
  };

  /** Export cards as a JSON file */
  const exportJson = () => {
    if (!cards.length) return;
    const blob = new Blob([JSON.stringify({ cards }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cards.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  /** Clear current cards */
  const clearCards = () => {
    setCards([]);
    setRawResponse('');
    setError(null);
  };

  /** Restore a previous generation from history */
  const restoreHistory = (index: number) => {
    const item = history[index];
    if (item) {
      setTopic(item.topic);
      setCards(item.cards);
      setRawResponse(JSON.stringify({ cards: item.cards }));
      setError(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">GLM 卡片生成器</h1>
        <p className="text-gray-600">輸入主題、數量與語氣，即可生成一組卡片。</p>
      </header>

      <section className="bg-white shadow rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex flex-col space-y-1">
            <label htmlFor="topic" className="font-medium">主題</label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：現代 Web 性能優化"
              className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col space-y-1">
            <label htmlFor="count" className="font-medium">數量</label>
            <select
              id="count"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10))}
              className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col space-y-1">
            <label htmlFor="tone" className="font-medium">語氣</label>
            <select
              id="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="business">商務 (business)</option>
              <option value="casual">休閒 (casual)</option>
              <option value="friendly">友善 (friendly)</option>
              <option value="informative">資訊 (informative)</option>
              <option value="academic">學術 (academic)</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? '生成中...' : '生成卡片'}
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </section>

      {cards.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyJson}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded"
            >複製 JSON</button>
            <button
              onClick={copyText}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded"
            >複製文本</button>
            <button
              onClick={exportJson}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded"
            >導出 JSON</button>
            <button
              onClick={clearCards}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded"
            >清空</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {cards.map((card, idx) => (
              <div key={idx} className="bg-white shadow rounded-lg p-4 space-y-2 border border-gray-200">
                <div className="text-4xl">{card.icon}</div>
                <h3 className="text-lg font-semibold">{card.title}</h3>
                <p className="text-gray-700 text-sm">{card.description}</p>
                <div className="flex flex-wrap gap-1">
                  {card.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-bold">歷史記錄</h2>
          <ul className="space-y-1">
            {history.map((item, idx) => (
              <li key={idx} className="flex justify-between items-center bg-white border border-gray-200 rounded p-2">
                <div className="flex flex-col">
                  <span className="font-medium">{item.topic}</span>
                  <span className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => restoreHistory(idx)}
                  className="text-blue-600 hover:underline text-sm"
                >恢復</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}