import { useMemo } from 'react';
import { cn, initials } from '@/lib/utils';

/**
 * Deterministic, generated avatars. We never fetch remote avatar services, so
 * demo people are obviously illustrated and no third-party data is involved.
 */
const PALETTES: [string, string][] = [
  ['#4C2FD1', '#6E4BFF'],
  ['#9E1236', '#C42A4E'],
  ['#0A6440', '#0F8055'],
  ['#7A4800', '#9C5D00'],
  ['#14549E', '#1B6AC4'],
  ['#7B1FA2', '#9B27C7'],
  ['#9E3400', '#BE3F00'],
  ['#095C57', '#0C7069'],
];

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function Avatar({
  name,
  seed,
  src,
  size = 44,
  className,
  ring = false,
}: {
  name: string;
  seed?: string;
  src?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const key = seed ?? name;
  const h = useMemo(() => hashSeed(key), [key]);
  const [from, to] = PALETTES[h % PALETTES.length]!;
  const angle = h % 360;
  const rotation = (h >> 3) % 40;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className={cn('shrink-0 rounded-full object-cover', ring && 'ring-2 ring-white', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full', ring && 'ring-2 ring-white', className)}
      style={{ width: size, height: size, background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
      aria-label={name}
      role="img"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(circle at ${30 + (h % 40)}% ${20 + (h % 30)}%, rgba(255,255,255,0.65), transparent 60%)`,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute rounded-full bg-white/25"
        style={{
          width: size * 0.55,
          height: size * 0.55,
          right: -size * 0.12,
          bottom: -size * 0.16,
          transform: `rotate(${rotation}deg)`,
        }}
      />
      <span
        className="relative font-semibold text-white"
        style={{ fontSize: Math.max(10, size * 0.36), letterSpacing: '-0.02em' }}
      >
        {initials(name)}
      </span>
    </span>
  );
}

export function AvatarStack({
  people,
  size = 26,
  max = 4,
}: {
  people: { displayName: string; avatarSeed?: string; avatarUrl?: string | null }[];
  size?: number;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={`${p.displayName}-${i}`} style={{ marginLeft: i === 0 ? 0 : -size * 0.32, zIndex: max - i }}>
          <Avatar name={p.displayName} seed={p.avatarSeed} src={p.avatarUrl} size={size} ring />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="ml-[-6px] inline-flex items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-ink ring-2 ring-white"
          style={{ width: size, height: size, fontSize: size * 0.34 }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
