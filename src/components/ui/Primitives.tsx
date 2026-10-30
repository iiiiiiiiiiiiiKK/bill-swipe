import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function Card({ className, children, as: _as }: { className?: string; children: ReactNode; as?: string }) {
  return <div className={cn('card-shell', className)}>{children}</div>;
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink">{eyebrow}</p>
        )}
        <h2 className="text-[22px] font-semibold leading-tight sm:text-2xl">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({
  value,
  className,
  tone = 'brand',
  animate = true,
}: {
  value: number;
  className?: string;
  tone?: 'brand' | 'mint' | 'coral';
  animate?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const bg = tone === 'mint' ? 'bg-mint' : tone === 'coral' ? 'bg-coral' : 'bg-brand';
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[#EFEDE9]', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={cn('h-full rounded-full', bg)}
        initial={animate ? { width: 0 } : false}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 24 }}
      />
    </div>
  );
}

export function Pill({
  children,
  tone = 'neutral',
  className,
  icon,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'mint' | 'coral' | 'amber';
  className?: string;
  icon?: ReactNode;
}) {
  const tones = {
    neutral: 'bg-[#F3F1EE] text-[#57534E]',
    brand: 'bg-brand-soft text-brand-ink',
    mint: 'bg-mint-soft text-[#0F7A52]',
    coral: 'bg-coral-soft text-[#C02444]',
    amber: 'bg-amber-soft text-[#9A6600]',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-gradient-to-r from-[#F1EEE9] via-[#F7F5F2] to-[#F1EEE9] bg-[length:800px_100%]',
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">{icon}</div>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-[#C02444]">
      {message}
    </p>
  );
}
