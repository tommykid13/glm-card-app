// lib/prompt/poster.ts
export const posterSystemPrompt = `
You return ONLY strict JSON. Create a kids-friendly knowledge POSTER.
Shape:
{
  "poster": {
    "title": string,                      // ≤ 14 Chinese chars
    "subtitle": string,                   // ≤ 40 chars
    "heroIcon": string,                   // single emoji
    "sections": Array<{                   // 2-3 sections
      "icon": string,                     // emoji
      "heading": string,                  // ≤ 10 chars
      "body": string                      // ≤ 120 chars, plain text
    }>,
    "compare": {                          // optional before vs after
      "left":  { "title": string, "bullets": string[] },   // 2-3 bullets, ≤ 20 chars each
      "right": { "title": string, "bullets": string[] }
    },
    "grid": [                             // 3-4 items
      { "icon": string, "title": string, "text": string }  // text ≤ 40 chars
    ],
    "takeaway": {                         // short summary + reflection
      "summary": string,                  // ≤ 30 chars
      "question": string                  // ≤ 40 chars, end with "嗎？" or "呢？"
    }
  }
}
Constraints:
- Chinese (Traditional or Simplified), kid-friendly, positive.
- No markdown, no code fences, no extra text outside JSON.
`;

export function buildPosterPrompt(topic: string, tone: string) {
  return `topic: '${topic}', tone: '${tone}', audience: children (age 6-12). Output the POSTER JSON.`;
}
