// app/api/chat/route.ts
import { systemPrompt, buildUserPrompt } from '../../../lib/prompt/card';
import { posterSystemPrompt, buildPosterPrompt } from '../../../lib/prompt/poster';

export const runtime = 'edge';

const ZHIPU_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

type Body = {
  topic: string;
  count?: number;
  tone?: string;
  layout?: 'poster' | 'list';
};

function extractStrictJSON(text: string) {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s >= 0 && e > s) {
    const cut = text.slice(s, e + 1);
    try { return JSON.parse(cut); } catch { /* fallthrough */ }
  }
  return JSON.parse(text);
}

async function askZhipu(model: string, apiKey: string, system: string, user: string) {
  const res = await fetch(ZHIPU_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: false,
      thinking: { type: 'disabled' },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Zhipu ${model} HTTP ${res.status}`;
    throw new Error(msg);
  }

  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.delta?.content ?? '';

  if (!content) throw new Error('Empty content from model');

  return extractStrictJSON(content);
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) return Response.json({ error: 'Missing ZHIPU_API_KEY' }, { status: 500 });

    const { topic, count = 8, tone = 'neutral', layout = 'poster' } = (await req.json()) as Body;

    const modelPrimary = process.env.MODEL_NAME || 'glm-4.5-flash';
    const sys = layout === 'poster' ? posterSystemPrompt : systemPrompt;
    const user = layout === 'poster'
      ? buildPosterPrompt(topic, tone)
      : buildUserPrompt(topic, count, tone);

    try {
      const parsed = await askZhipu(modelPrimary, apiKey, sys, user);
      if (layout === 'poster') {
        if (!parsed?.poster) throw new Error('Model did not return { poster: {...} }');
        return Response.json({ poster: parsed.poster });
      }
      // list
      if (!parsed?.cards || !Array.isArray(parsed.cards)) {
        throw new Error('Model did not return { cards: [...] }');
      }
      return Response.json(parsed);
    } catch (e: any) {
      // fallback
      const fallback = 'GLM-4-Flash-250414';
      const parsed = await askZhipu(fallback, apiKey, sys, user);
      if (layout === 'poster') {
        return Response.json({ poster: parsed.poster, _model: fallback });
      }
      return Response.json({ cards: parsed.cards, _model: fallback });
    }
  } catch (err: any) {
    return Response.json({ error: String(err?.message || err) }, { status: 422 });
  }
}
