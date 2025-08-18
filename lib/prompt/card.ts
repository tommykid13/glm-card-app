/**
 * Prompt generator for card generation.
 *
 * The system prompt instructs the model to return strictly formatted JSON
 * containing a single field `cards` which is an array of objects. Each
 * object in the array has the shape `{ title: string, description: string,
 * tags: string[], icon: string }`. You must not include any extra text
 * outside of the JSON payload. The model should respect the constraints
 * specified in the template regarding the maximum number of words and
 * items.
 */
export const systemPrompt = `You return ONLY strict JSON. Generate cards for a topic.\nShape: { "cards": Array<{title:string, description:string, tags:string[], icon:string}> }.\nConstraints: title ≤ 8 words; description ≤ 40 words; tags ≤ 4; icon is a single emoji. No extra text.`;

/**
 * Build the user prompt given topic, count and tone.
 *
 * Example:
 *   buildUserPrompt('現代 Web 性能優化', 8, '商務');
 *   // => "topic: '現代 Web 性能優化', count: 8, tone: '商務'"
 */
export function buildUserPrompt(topic: string, count: number, tone: string): string {
  return `topic: '${topic}', count: ${count}, tone: '${tone}'`;
}