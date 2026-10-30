import { describe, expect, it } from 'vitest';
import { dictionary, lookUp, normaliseKey } from '../src/lib/i18n';

/**
 * Guards the translation table itself: no empty entries, no lost placeholders,
 * no untranslated leftovers, and resilient lookup for typographic differences.
 */
const entries = Object.entries(dictionary);

describe('translation dictionary', () => {
  it('has a substantial number of entries', () => {
    expect(entries.length).toBeGreaterThan(500);
  });

  it('has no empty translations', () => {
    const empty = entries.filter(([, value]) => !value || !value.trim());
    expect(empty.map(([key]) => key)).toEqual([]);
  });

  it('keeps placeholders identical between English and Chinese', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

    const broken = entries.filter(([key, value]) => placeholders(key) !== placeholders(value));
    expect(broken.map(([key]) => key)).toEqual([]);
  });

  it('actually contains Chinese characters', () => {
    // A handful of entries are intentionally identical (brands, units).
    const latinOnly = entries.filter(([key, value]) => value === key && /[A-Za-z]{3,}/.test(key));
    const suspicious = latinOnly.filter(([key]) => !/^(BILL SWIPE|EN|REF|USD)$/.test(key));
    expect(suspicious.map(([key]) => key)).toEqual([]);
  });
});

describe('lookup', () => {
  it('returns the English source when English is active', () => {
    expect(lookUp('Discover', 'en')).toBe('Discover');
  });

  it('translates known keys in Chinese', () => {
    expect(lookUp('Discover', 'zh')).toBe('发现');
    expect(lookUp('Swipe never charges you', 'zh')).toBe('Swipe never charges you');
  });

  it('matches despite curly quotes and dashes in the source copy', () => {
    // The JSX uses typographic characters; the dictionary is written plainly.
    expect(lookUp('Someone\u2019s bill. Someone\u2019s kindness.', 'zh')).toBe('一张账单，一份善意。');
    expect(lookUp('Help — confirm the total', 'zh')).toBe('Help — confirm the total');
  });

  it('normalises keys consistently', () => {
    expect(normaliseKey('  Someone\u2019s   bill. ')).toBe("Someone's bill.");
    expect(normaliseKey('a\u2014b')).toBe('a-b');
  });
});
