/**
 * Money helpers.
 *
 * Financial values are ALWAYS stored and transported as integer minor units
 * (cents). Floating point is never used for storage or arithmetic.
 */

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Format integer minor units for display, e.g. 18650 -> "$186.50". */
export function formatMoney(minor: number, currency: string = 'USD', opts?: { compact?: boolean }): string {
  const locale = 'en-US';
  const value = minor / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: opts?.compact && Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Split display parts so the UI can style decimals smaller than the integer part. */
export function splitMoney(minor: number, currency = 'USD'): { symbol: string; whole: string; cents: string } {
  const formatted = formatMoney(minor, currency);
  const match = formatted.match(/^([^\d-]*)([\d,]+)(?:\.(\d{2}))?/);
  if (!match) return { symbol: '', whole: formatted, cents: '' };
  return { symbol: match[1], whole: match[2], cents: match[3] ?? '' };
}

/** Parse a user-entered amount ("186.5", "1,200", "$25") into minor units, or null. */
export function parseMoneyInput(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned || (cleaned.match(/\./g) ?? []).length > 1) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function percent(raised: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((raised / target) * 100)));
}

/** Platform fee in minor units, basis points of the help amount. */
export function computeFee(amount: number, feeBps: number): number {
  return Math.round((amount * feeBps) / 10_000);
}
