import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { categoryOf } from '@shared/categories';
import { formatMoney } from '@shared/money';

/**
 * Deterministic "receipt" artwork rendered as SVG.
 *
 * Demo bills use these so the product looks complete without shipping photos of
 * real people's documents. Real uploads render through <BillImage /> instead.
 */
export function ReceiptArt({
  seed,
  category,
  amount,
  currency = 'USD',
  merchant,
  className,
  compact = false,
}: {
  seed: string;
  category: string;
  amount: number;
  currency?: string;
  merchant?: string;
  className?: string;
  compact?: boolean;
}) {
  const { t, lang } = useI18n();
  const art = useMemo(() => buildArt(seed, category), [seed, category]);
  const cat = categoryOf(category);
  const label = merchant ?? t(art.merchant);

  return (
    <div
      className={cn('relative h-full w-full overflow-hidden', className)}
      style={{ background: art.backdrop }}
      aria-hidden="true"
    >
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at 20% 0%, ${cat.tint}, transparent 70%)` }} />
      <div
        className="absolute -right-10 -top-12 size-40 rounded-full opacity-60 blur-2xl"
        style={{ background: cat.ink }}
      />

      <div
        className={cn(
          'absolute left-1/2 top-1/2 w-[70%] max-w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-[10px] bg-white p-[5.5%] shadow-[0_18px_40px_-18px_rgba(25,25,25,0.45)]',
        )}
        style={{ transform: `translate(-50%, -50%) rotate(${art.rotate}deg)` }}
      >
        <div className="flex items-center justify-between border-b border-dashed border-[#E4E0D9] pb-2">
          <div className="min-w-0">
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: cat.ink }}>
              {label}
            </p>
            <p className="mt-0.5 text-[7px] uppercase tracking-[0.1em] text-[#736E66]">{t(art.docType)}</p>
          </div>
          <span className="rounded-full px-1.5 py-0.5 text-[6.5px] font-bold uppercase tracking-wider" style={{ background: cat.tint, color: cat.ink }}>
            {t(cat.short)}
          </span>
        </div>

        <div className="space-y-1 py-2">
          {art.lines.slice(0, compact ? 2 : 4).map((line, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[7px] text-[#8B857C]">{t(line.label)}</span>
              <span className="shrink-0 text-[7.5px] font-semibold tabular-nums text-[#4A453F]">{line.value}</span>
            </div>
          ))}
        </div>

        <div className="flex items-baseline justify-between border-t border-[#EDEAE4] pt-2">
          <span className="text-[7px] font-semibold uppercase tracking-[0.1em] text-[#8B857C]">{t('Total due')}</span>
          <span className="text-[15px] font-bold tabular-nums leading-none text-[#1B1917]">
            {formatMoney(amount, currency)}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-[2px]">
            {art.barcode.map((w, i) => (
              <span key={i} className="block h-3 bg-[#2B2724]" style={{ width: w, opacity: 0.82 }} />
            ))}
          </div>
          <span className="text-[6px] uppercase tracking-[0.12em] text-[#B3ADA5]">{lang === 'zh' ? '编号' : 'REF'} {art.ref}</span>
        </div>
      </div>

      {!compact && (
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
      )}
    </div>
  );
}

function buildArt(seed: string, category: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = (offset: number, mod: number) => (((h >>> offset) % mod) + mod) % mod;

  const merchants: Record<string, string[]> = {
    rent: ['Maple Court Apartments', 'Riverside Rentals', 'Harbor View Homes'],
    medical: ['Northside Clinic', 'Bay Medical Center', 'Family Health Group'],
    education: ['City College Bookstore', 'Lincoln High School', 'State University'],
    groceries: ['Fresh Market', 'Corner Grocery Co.', 'Green Basket Foods'],
    utilities: ['Metro Power & Light', 'Clearwater Utilities', 'City Gas Service'],
    transportation: ['Reliable Auto Repair', 'Transit Authority', 'Midtown Bike Works'],
    emergency: ['QuickFix Services', 'Emergency Home Repair', 'Community Aid Office'],
    other: ['Local Services', 'City Office', 'Community Support'],
  };
  const docTypes: Record<string, string> = {
    rent: 'Rent statement',
    medical: 'Medical statement',
    education: 'Invoice',
    groceries: 'Grocery receipt',
    utilities: 'Utility bill',
    transportation: 'Repair estimate',
    emergency: 'Service invoice',
    other: 'Invoice',
  };
  const labels: Record<string, string[]> = {
    rent: ['Monthly rent', 'Parking', 'Late fee waiver', 'Utilities share'],
    medical: ['Consultation', 'Treatment', 'Prescription', 'Lab work'],
    education: ['Tuition balance', 'Course materials', 'Lab fee', 'Registration'],
    groceries: ['Produce & dairy', 'Pantry staples', 'Household', 'Weekly shop'],
    utilities: ['Electricity', 'Water & sewer', 'Heating', 'Service charge'],
    transportation: ['Parts', 'Labour', 'Diagnostics', 'Safety inspection'],
    emergency: ['Call-out fee', 'Materials', 'Labour', 'Disposal'],
    other: ['Service', 'Materials', 'Processing', 'Adjustment'],
  };

  const list = merchants[category] ?? merchants.other!;
  const merchant = list[n(3, list.length)]!;
  const items = labels[category] ?? labels.other!;
  const rotation = (n(7, 7) - 3) * 0.9;

  const lines = items.slice(0, 4).map((label, i) => ({
    label,
    value: `$${(((n(11 + i * 3, 90) + 12) * 0.97) | 0)}.${String(n(13 + i * 5, 99)).padStart(2, '0')}`,
  }));

  const barcode = Array.from({ length: 22 }, (_, i) => [1, 1, 2, 1, 3, 2][n(17 + i, 6)]!);

  return {
    merchant,
    docType: docTypes[category] ?? 'Invoice',
    ref: `#${(h % 900000) + 100000}`,
    rotate: rotation,
    lines,
    barcode,
    backdrop: 'linear-gradient(155deg, #F6F3EE 0%, #FBF9F6 45%, #F1EDE7 100%)',
  };
}

export function BillImage({
  src,
  alt,
  category,
  amount,
  currency,
  seed,
  className,
  compact,
}: {
  src: string | null;
  alt: string;
  category: string;
  amount: number;
  currency: string;
  seed: string;
  className?: string;
  compact?: boolean;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn('h-full w-full object-cover', className)}
      />
    );
  }
  return <ReceiptArt seed={seed} category={category} amount={amount} currency={currency} className={className} compact={compact} />;
}
