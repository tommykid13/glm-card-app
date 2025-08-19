// app/api/chat/route.ts
import { systemPrompt, buildUserPrompt } from '../../../lib/prompt/card';
import { posterSystemPrompt, buildPosterPrompt } from '../../../lib/prompt/poster';

export const runtime = 'nodejs';         // ← 改成 Node
export const dynamic = 'force-dynamic';
export const preferredRegion = ['iad1']; // ← 偏好跑在 IAD
export const maxDuration = 60;           // ← Node 最長執行時間

const ZHIPU_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 前端會送 layout: 'poster' | 'list'；你若只用海報，可不傳，預設 poster
type Body = { topic: string; count?: number; tone?: string; layout?: 'poster' | 'list' };

const DEADLINE_MS = 24_000; // Edge 執行大致 30s，留 3 秒緩衝
const SLICE_MS     = 9_000; // 主模型 12s，夠快則回應；失敗再給備援 12s

function extractStrictJSON(text: string) {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s >= 0 && e > s) {
    const cut = text.slice(s, e + 1);
    try { return JSON.parse(cut); } catch { /* fallthrough */ }
  }
  return JSON.parse(text);
}
function normalizePoster(parsed: any) {
  const p = parsed?.poster ?? parsed;
  if (!p || typeof p !== 'object') throw new Error('Model did not return poster');

  const sec = Array.isArray(p.sections) ? p.sections : [];
  const grid = Array.isArray(p.grid) ? p.grid : [];

  return {
    title: String(p.title ?? '我的知識卡'),
    subtitle: p.subtitle ? String(p.subtitle) : '',
    heroIcon: String(p.heroIcon ?? '🧠'),
    sections: sec.slice(0, 3).map((s: any) => ({
      icon: String(s?.icon ?? '✨'),
      heading: String(s?.heading ?? ''),
      body: String(s?.body ?? ''),
    })),
    compare: p.compare && p.compare.left && p.compare.right
      ? {
          left: { title: String(p.compare.left.title ?? '前'), bullets: (p.compare.left.bullets || []).map(String).slice(0, 3) },
          right:{ title: String(p.compare.right.title?? '後'), bullets: (p.compare.right.bullets|| []).map(String).slice(0, 3) }
        }
      : undefined,
    grid: grid.slice(0, 4).map((g: any) => ({
      icon: String(g?.icon ?? '•'), title: String(g?.title ?? ''), text: String(g?.text ?? '')
    })),
    takeaway: p.takeaway
      ? { summary: String(p.takeaway.summary ?? ''), question: p.takeaway.question ? String(p.takeaway.question) : '' }
      : undefined,
  };
}
async function askOnce(model: string, apiKey: string, system: string, user: string, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort('timeout'), timeoutMs);

  const res = await fetch(ZHIPU_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
      stream: false,
      thinking: { type: 'disabled' }
    }),
    signal: ctrl.signal,
    // @ts-ignore
    keepalive: true,
  }).finally(() => clearTimeout(t));

  const raw = await res.text();
  let json: any = {};
  try { json = JSON.parse(raw); } catch { /* 可能是反向代理錯頁 */ }

  if (!res.ok) {
    const msg = json?.error?.message || raw.slice(0, 160) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.delta?.content ?? '';

  if (!content) throw new Error('Empty content from model');

  return extractStrictJSON(content);
}

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'Missing ZHIPU_API_KEY' }), { status: 500 });

    const { topic, count = 6, tone = '兒童友好', layout = 'poster' } = (await req.json()) as Body;

    const sys  = layout === 'poster' ? posterSystemPrompt : systemPrompt;
    const user = layout === 'poster' ? buildPosterPrompt(topic, tone) : buildUserPrompt(topic, count, tone);

    const primary  = process.env.MODEL_NAME || 'glm-4.5-flash';
    const fallback = 'GLM-4-Flash-250414';

    let remaining = DEADLINE_MS - (Date.now() - started);
    const firstTimeout = Math.min(SLICE_MS, Math.max(6_000, remaining - 5_000));

    try {
      const parsed = await askOnce(primary, apiKey, sys, user, firstTimeout);
      if (layout === 'poster') {
          return new Response(JSON.stringify({ poster: normalizePoster(parsed) }), {
    headers: { 'Content-Type': 'application/json' },
  });
    } catch (e) {
      // 計算剩餘時間再決定是否嘗試備援
      remaining = DEADLINE_MS - (Date.now() - started);
      if (remaining < 7_000) throw e; // 剩太少就直接回錯，避免再超時

      const parsed = await askOnce(fallback, apiKey, sys, user, Math.min(SLICE_MS, remaining - 3_000));
      if (layout === 'poster') {
  return new Response(JSON.stringify({ poster: normalizePoster(parsed), _model: fallback }), {
    headers: { 'Content-Type': 'application/json' },
  });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
