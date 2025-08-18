// app/api/chat/route.ts
import { systemPrompt, buildUserPrompt } from '../../../lib/prompt/card';

export const runtime = 'edge';

const ZHIPU_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

type Body = { topic: string; count?: number; tone?: string };

function extractStrictJSON(text: string) {
  // 擋掉可能出現的前後雜訊或 ```json 標記
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = text.slice(start, end + 1);
    try { return JSON.parse(slice); } catch { /* fallthrough */ }
  }
  // 最後再嘗試直接 parse（萬一本來就是乾淨 JSON）
  return JSON.parse(text);
}

async function askZhipu(model: string, apiKey: string, userPrompt: string) {
  const res = await fetch(ZHIPU_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      stream: false,                 // 關閉流式，避免分段導致 JSON 破碎
      thinking: { type: 'disabled' } // 關閉思維輸出，避免非 JSON 內容
    }),
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

  // 服務端先嚴格轉為物件；前端就能直接 data.cards 使用
  const parsed = extractStrictJSON(content);
  if (!parsed?.cards || !Array.isArray(parsed.cards)) {
    throw new Error('Model did not return { "cards": [...] }');
  }
  return parsed;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) return new Response('Missing ZHIPU_API_KEY', { status: 500 });

    const { topic, count = 8, tone = 'neutral' } = (await req.json()) as Body;
    const userPrompt = buildUserPrompt(topic, count, tone);

    const primary = process.env.MODEL_NAME || 'glm-4.5-flash';
    try {
      const parsed = await askZhipu(primary, apiKey, userPrompt);
      return new Response(JSON.stringify(parsed), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      // 自動回退
      const fallback = 'GLM-4-Flash-250414';
      const parsed = await askZhipu(fallback, apiKey, userPrompt);
      return new Response(JSON.stringify({ ...parsed, _model: fallback }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
