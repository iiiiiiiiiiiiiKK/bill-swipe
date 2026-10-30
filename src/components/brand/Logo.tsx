import { cn } from '@/lib/utils';

export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <linearGradient id="bs-logo-grad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8E6BFF" />
          <stop offset="0.55" stopColor="#7957FF" />
          <stop offset="1" stopColor="#FF718B" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#bs-logo-grad)" />
      <path
        d="M31.5 15.5c-1.9-1.7-4.4-2.6-7-2.5-4.6.2-8 3.1-8 7 0 4.2 3.7 5.6 7 6.4 2.6.6 4.3 1.2 4.3 2.7 0 1.4-1.6 2.4-3.7 2.4-2 0-3.9-.8-5.2-2.2"
        stroke="white"
        strokeWidth="3.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.95"
      />
      <path d="M24 8.5v4M24 35.5v4" stroke="white" strokeWidth="3.1" strokeLinecap="round" opacity="0.95" />
      <path
        d="M36.4 24.6c1.9-1.7 4.4-1.2 5.1.6.7 1.8-.7 4.1-5.1 6.8-4.4-2.7-5.8-5-5.1-6.8.7-1.8 3.2-2.3 5.1-.6Z"
        fill="white"
        opacity="0.32"
      />
    </svg>
  );
}

export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-baseline gap-[0.3em] font-semibold tracking-[-0.03em]', className)}>
      <span>BILL</span>
      <span className="text-brand-ink">SWIPE</span>
      {!compact && (
        <span className="hidden text-[10px] font-medium tracking-normal text-[#6B6873] sm:inline">beta</span>
      )}
    </span>
  );
}

export function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
