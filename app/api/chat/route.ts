import { systemPrompt, buildUserPrompt } from '../../../lib/prompt/card';

export const runtime = 'edge';

/**
 * Chat API route that proxies requests to the Zhipu Chat Completions endpoint.
 *
 * This endpoint accepts a JSON body with fields `topic`, `count` and `tone`.
 * It constructs the appropriate prompt using the system and user prompts,
 * then forwards the request to the Zhipu API. Streaming is enabled by
 * default. If the primary model fails (4xx/5xx response), the route
 * automatically falls back to the older model and retries once. If both
 * attempts fail a JSON error response is returned.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const { topic, count, tone } = await req.json();
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing ZHIPU_API_KEY in environment variables' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserPrompt(topic, Number(count), tone) },
    ];

    // Determine model order: primary from env (default glm-4.5-flash), fallback static
    const primaryModel = process.env.MODEL_NAME || 'glm-4.5-flash';
    const fallbackModel = 'GLM-4-Flash-250414';
    const modelsToTry = [primaryModel, fallbackModel];

    let lastError: any = null;
    for (const model of modelsToTry) {
      try {
        const zhipuRes = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            stream: true,
            // enable thinking to reduce hallucination
            thinking: { type: 'enabled' },
          }),
        });
        if (!zhipuRes.ok) {
          // capture error status and continue to fallback
          lastError = new Error(`Model ${model} responded with status ${zhipuRes.status}`);
          continue;
        }
        // Proxy the response body (SSE stream) directly to the client.
        return new Response(zhipuRes.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      } catch (err) {
        lastError = err;
        continue;
      }
    }
    return new Response(
      JSON.stringify({ error: lastError?.message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}