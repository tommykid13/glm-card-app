import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Define a Zod schema matching the expected card shape
const CardSchema = z.object({
  title: z.string().min(1).max(8 * 15), // rough bound on characters (8 words roughly 15 chars each)
  description: z.string().min(1).max(200),
  tags: z.array(z.string()).max(4),
  icon: z.string().emoji(),
});

const ResponseSchema = z.object({ cards: z.array(CardSchema) });

describe('Card parsing', () => {
  it('parses valid JSON response and matches schema', () => {
    const json = `{"cards":[{"title":"示例","description":"這是一個描述","tags":["範例","測試"],"icon":"🧪"}]}`;
    const parsed = JSON.parse(json);
    const result = ResponseSchema.parse(parsed);
    expect(result.cards.length).toBe(1);
    expect(result.cards[0].title).toBe('示例');
  });

  it('throws on invalid structure', () => {
    const json = `{"cards":[{"name":"bad","description":123,"tags":"not array","icon":":)"}]}`;
    const parsed = JSON.parse(json);
    expect(() => ResponseSchema.parse(parsed)).toThrowError();
  });
});