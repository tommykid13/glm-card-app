export const posterSystemPrompt = `You return ONLY strict JSON. Create a kids-friendly knowledge POSTER.
Shape:
{
  "poster": {
    "title": string,
    "subtitle": string,
    "heroIcon": string,
    "sections": Array<{
      "icon": string,
      "heading": string,
      "body": string
    }>,
    "compare": {
      "left":  { "title": string, "bullets": string[] },
      "right": { "title": string, "bullets": string[] }
    },
    "grid": [
      { "icon": string, "title": string, "text": string }
    ],
    "takeaway": {
      "summary": string,
      "question": string
    }
  }
}
Constraints:
- Chinese (Traditional), kid-friendly, positive.
- No markdown, no code fences, no extra text outside JSON.`;

export function buildPosterPrompt(topic: string, tone: string) {
  return `topic: '${topic}', tone: '${tone}', audience: children (age 6-12). Output the POSTER JSON.`;
}
