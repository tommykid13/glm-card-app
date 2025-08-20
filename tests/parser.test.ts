import { describe, it, expect } from 'vitest';

// simple shapes to sanity-check JSON structures
const isCard = (x:any) => x && typeof x.title==='string' && typeof x.description==='string' && Array.isArray(x.tags) && typeof x.icon==='string';
const isPoster = (p:any) => p && typeof p.title==='string' && Array.isArray(p.sections);

describe('shapes', () => {
  it('cards shape valid', () => {
    const sample = { cards: [{ title:'A', description:'B', tags:['t'], icon:'✨' }] };
    expect(Array.isArray(sample.cards) && isCard(sample.cards[0])).toBe(true);
  });
  it('poster shape valid', () => {
    const sample = { poster: { title:'T', sections:[{icon:'✨', heading:'H', body:'...'}] } };
    expect(isPoster(sample.poster)).toBe(true);
  });
});
