export const systemPrompt = `You return ONLY strict JSON. Generate cards for a topic.
Shape: { "cards": Array<{title:string, description:string, tags:string[], icon:string}> }.
Constraints: title ≤ 8 words; description ≤ 40 words; tags ≤ 4; icon is a single emoji. No extra text.`;

export function buildUserPrompt(topic: string, count: number, tone: string) {
  return `topic: '${topic}', count: ${count}, tone: '${tone}'. Output only JSON with { "cards": [...] }.`;
}
