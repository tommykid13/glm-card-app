// app/api/chat/route.ts
import { systemPrompt, buildUserPrompt } from '../../../lib/prompt/card';
import { posterSystemPrompt, buildPosterPrompt } from '../../../lib/prompt/poster';

export const runtime = 'nodejs';          // 改為 Node.js runtime（更穩定）
export const maxDuration = 60;            // 放寬執行上限（依方案/配額實際生效）
export const dynamic = 'force-dynamic';   // 禁用預渲染快取

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

async function askZhipu(
  model: string,
  apiKey: string,
  system: string,
  user: string,
  timeoutMs = 20000 // 20s：避免卡到整體執行上限
) {
  const res = await fetch(ZHIPU_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    // 關閉流式，避免片段造成 JSON 破碎；同時關掉 thinking 避免非 JSON
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: false,
      thinking: { type: 'disabled' },
    }),
    signal: AbortSignal.timeout(timeoutMs),
    // @ts-ignore keepalive 在部分環境可用
    keepalive: true,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Zhipu ${model} HTTP ${res.status}`;
    throw new Error(msg);
  }

  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.delta?.content ??
    '';

  if (!content) throw new Error('Empty content from model');

  return extractStrictJSON(content);
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) return Response.json({ error: 'Missing ZHIPU_API_KEY' }, { status: 500 });

    const { topic, count = 6, tone = '兒童友好', layout = 'poster' } =
      (await req.json()) as Body;

    const primary = process.env.MODEL_NAME || 'glm-4.5-flash';
    const sys = layout === 'poster' ? posterSystemPrompt : systemPrompt;
    const user =
      layout === 'poster'
        ? buildPosterPrompt(topic, tone)
        : buildUserPrompt(topic, count, tone);

    try {
      const parsed = await askZhipu(primary, apiKey, sys, user, 20000);
      if (layout === 'poster') {
        if (!parsed?.poster) throw new Error('Model did not return { poster: {...} }');
        return Response.json({ poster: parsed.poster });
      }
      if (!parsed?.cards || !Array.isArray(parsed.cards)) {
        throw new Error('Model did not return { cards: [...] }');
      }
      return Response.json(parsed);
    } catch (e: any) {
      // 逾時/錯誤 → 回退模型再試一次
      const fallback = 'GLM-4-Flash-250414';
      const parsed = await askZhipu(fallback, apiKey, sys, user, 20000);
      if (layout === 'poster') return Response.json({ poster: parsed.poster, _model: fallback });
      return Response.json({ cards: parsed.cards, _model: fallback });
    }
  } catch (err: any) {
    return Response.json({ error: String(err?.message || err) }, { status: 422 });
  }
}
