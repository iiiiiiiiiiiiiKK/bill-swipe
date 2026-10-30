import { describe, expect, it } from 'vitest';
import { computeFee, formatMoney, parseMoneyInput, percent, splitMoney } from '../src/shared/money';
import { categoryOf, BILL_CATEGORIES } from '../src/shared/categories';
import { excerpt } from '../src/worker/lib/serialize';

describe('money helpers', () => {
  it('formats integer minor units as currency', () => {
    expect(formatMoney(18650)).toBe('$186.50');
    expect(formatMoney(500)).toBe('$5.00');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(123456789)).toBe('$1,234,567.89');
  });

  it('splits money for display without losing precision', () => {
    expect(splitMoney(18650)).toEqual({ symbol: '$', whole: '186', cents: '50' });
    expect(splitMoney(500)).toEqual({ symbol: '$', whole: '5', cents: '00' });
  });

  it('parses user input into minor units', () => {
    expect(parseMoneyInput('186.50')).toBe(18650);
    expect(parseMoneyInput('$1,200')).toBe(120000);
    expect(parseMoneyInput('0.005')).toBe(1);
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('1.2.3')).toBeNull();
    expect(parseMoneyInput('')).toBeNull();
  });

  it('never produces floating point drift', () => {
    // 0.1 + 0.2 style errors must be impossible with integer minor units.
    let total = 0;
    for (let i = 0; i < 10; i++) total += parseMoneyInput('0.10')!;
    expect(total).toBe(100);
    expect(formatMoney(total)).toBe('$1.00');
  });

  it('computes progress clamped to 0..100', () => {
    expect(percent(0, 1000)).toBe(0);
    expect(percent(500, 1000)).toBe(50);
    expect(percent(2000, 1000)).toBe(100);
    expect(percent(10, 0)).toBe(0);
  });

  it('computes platform fee from basis points with rounding', () => {
    expect(computeFee(1000, 0)).toBe(0);
    expect(computeFee(1000, 250)).toBe(25);
    expect(computeFee(999, 250)).toBe(25); // 24.975 -> 25
    expect(computeFee(1, 250)).toBe(0);
  });
});

describe('categories', () => {
  it('has a stable unique id per category', () => {
    const ids = BILL_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('groceries');
    expect(ids).toHaveLength(8);
  });

  it('falls back to "other" for unknown ids', () => {
    expect(categoryOf('nope').id).toBe('other');
    expect(categoryOf('medical').label).toBe('Medical');
  });
});

describe('text helpers', () => {
  it('builds a word-boundary excerpt', () => {
    const long = 'word '.repeat(80);
    const result = excerpt(long, 40);
    expect(result.length).toBeLessThanOrEqual(42);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('wor…');
  });

  it('keeps short text intact', () => {
    expect(excerpt('short story', 40)).toBe('short story');
  });
});
