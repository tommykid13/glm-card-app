// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

// ---- App Router 原生配置：直接在 Route 文件里导出 ----
export const runtime = 'nodejs';     // 使用 Node.js 运行时（非 Edge）
export const maxDuration = 60;       // 最长执行 60 秒（可按需调整）

type Poster = {
  heroIcon?: string;
  title: string;
  subtitle?: string;
  sections?: { icon?: string; heading: string; body: string }[];
  compare?: {
    left: { title: string; bullets?: string[] };
    right: { title: string; bullets?: string[] };
  };
  grid?: { icon?: string; title: string; text: string }[];
  takeaway?: { summary: string; question?: string };
};

const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

function jsonResponse(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, init as any);
}

function extractJSONObject(text: string) {
  // 从文本中粗暴截取最外层 {...} 并 JSON.parse（适配模型偶尔包围说明文字的情况）
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s >= 0 && e > s) {
    try {
      return JSON.parse(text.slice(s, e + 1));
    } catch {}
  }
  return null;
}

function buildSystemPrompt() {
  // 约束模型输出为我们前端需要的 poster 结构
  return `
You are a JSON generator for a kid-friendly knowledge poster (Traditional Chinese).
Return ONLY a JSON object with the exact shape:

{
  "poster": {
    "heroIcon": "🎓",
    "title": "<短標題>",
    "subtitle": "<一句話引導，可省略>",
    "sections": [
      {"icon":"📌","heading":"<小節標題>","body":"<通俗描述，2-4 句>"}
    ],
    "compare": {
      "left":{"title":"<A>","bullets":["<要點1>","<要點2>"]},
      "right":{"title":"<B>","bullets":["<要點1>","<要點2>"]}
    },
    "grid": [
      {"icon":"✨","title":"<重點>","text":"<一句話>"}
    ],
    "takeaway": {"summary":"<一句話總結>","question":"<延伸思考（可選）>"}
  }
}

No Markdown. No code fences. No extra commentary.
`.trim();
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ZHIPU_API_KEY;
  const model = process.env.MODEL_NAME || 'glm-4';

  if (!apiKey) {
    return jsonResponse(
      { error: 'Missing ZHIPU_API_KEY. Please set it in Vercel → Settings → Environment Variables.' },
      { status: 400 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const topic: string = String(body?.topic ?? '').trim();
  const count: number = Number.isFinite(body?.count) ? Number(body.count) : 6;
  const tone: string = String(body?.tone ?? '兒童友好');
  const layout: 'poster' | 'list' = body?.layout === 'list' ? 'list' : 'poster';

  if (!topic) return jsonResponse({ error: 'topic is required' }, { status: 400 });

  // 生成 messages
  const system = buildSystemPrompt();
  const user = `主題：${topic}\n語氣：${tone}\n希望要點數量：${count}`;

  // 超时保护（略短于 maxDuration）
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 55_000);

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.7,
      }),
    });

    clearTimeout(timeout);

    // 读取并解析模型返回
    const data = await resp.json().catch(async () => {
      const txt = await resp.text();
      return { __raw: txt };
    });

    if (!resp.ok) {
      return jsonResponse(
        { error: `Upstream ${resp.status}`, details: data },
        { status: 502 }
      );
    }

    // 兼容 OpenAI 风格返回（choices[0].message.content）
    let content =
      (data as any)?.choices?.[0]?.message?.content ??
      (data as any)?.data?.choices?.[0]?.message?.content ??
      (data as any)?.output_text ??
      '';

    if (typeof content !== 'string') content = JSON.stringify(content);

    // 解析 JSON → 取 poster / cards
    let parsed = extractJSONObject(content) ?? null;
    if (!parsed && typeof (data as any) === 'object') {
      // 某些平台返回直接是 JSON 对象
      parsed = (data as any).poster || (data as any).cards ? (data as any) : null;
    }

    // 统一返回结构
    if (parsed?.poster) {
      return jsonResponse({ poster: parsed.poster as Poster });
    }
    if (Array.isArray(parsed?.cards)) {
      return jsonResponse({ cards: parsed.cards });
    }

    // 兜底：如果未解析出结构，构造一个最小可渲染的 poster
    const fallback: Poster = {
      heroIcon: '🧩',
      title: topic,
      sections: [{ icon: '📌', heading: '重點', body: content?.slice(0, 500) || '（內容生成失敗）' }],
      grid: [{ icon: '✨', title: '提示', text: '模型未輸出標準 JSON，已顯示純文本摘要。' }],
    };
    return jsonResponse({ poster: fallback });
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Upstream timeout (aborted)' : e?.message || 'Unknown error';
    return jsonResponse({ error: msg }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}

// 如有需要处理预检请求（通常同源不必）：
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
