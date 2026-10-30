import { useMemo, useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { BadgeCheck, Clock3, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BillSummary } from '@shared/types';
import { categoryOf } from '@shared/categories';
import { formatMoney, percent, splitMoney } from '@shared/money';
import { Avatar } from '@/components/ui/Avatar';
import { ProgressBar } from '@/components/ui/Primitives';
import { BillImage } from './ReceiptArt';
import { cn, daysUntil, haptic } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useBillCopy } from '@/lib/demoContent';

export type SwipeDirection = 'left' | 'right' | 'up';

interface BillCardProps {
  bill: BillSummary;
  onSwipe: (direction: SwipeDirection) => void;
  onOpen: () => void;
  isTop: boolean;
  index: number;
  reducedMotion?: boolean;
}

const SWIPE_THRESHOLD = 96;

export function BillCard({ bill: rawBill, onSwipe, onOpen, isTop, index, reducedMotion }: BillCardProps) {
  const { t, tp } = useI18n();
  const localize = useBillCopy();
  const bill = localize(rawBill);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], [-14, 0, 14]);
  const helpOpacity = useTransform(x, [24, 140], [0, 1]);
  const passOpacity = useTransform(x, [-24, -140], [0, 1]);
  const superOpacity = useTransform(y, [-30, -130], [0, 1]);
  const cardScale = useTransform(x, [-260, 0, 260], [0.96, 1, 0.96]);
  const [dragging, setDragging] = useState(false);
  const exited = useRef(false);

  const cat = categoryOf(bill.category);
  const { symbol, whole, cents } = splitMoney(bill.targetAmount, bill.currency);
  const progress = percent(bill.raisedAmount, bill.targetAmount);
  const remaining = Math.max(0, bill.targetAmount - bill.raisedAmount);
  const due = daysUntil(bill.dueDate);
  const fullyFunded = bill.status === 'fully_funded' || remaining === 0;

  const flyOut = useCallback(
    (direction: SwipeDirection) => {
      if (exited.current) return;
      exited.current = true;
      haptic(direction === 'left' ? 8 : 14);
      const target =
        direction === 'right' ? { x: 560, y: 40, rotate: 20 } : direction === 'left' ? { x: -560, y: 40, rotate: -20 } : { x: 0, y: -620, rotate: 0 };
      animate(x, target.x, { duration: reducedMotion ? 0.01 : 0.34, ease: [0.32, 0.72, 0, 1] });
      animate(y, target.y, { duration: reducedMotion ? 0.01 : 0.34, ease: [0.32, 0.72, 0, 1] });
      setTimeout(() => onSwipe(direction), reducedMotion ? 0 : 170);
    },
    [onSwipe, reducedMotion, x, y],
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      setDragging(false);
      const { offset, velocity } = info;
      const velocityX = velocity.x;
      if (offset.y < -SWIPE_THRESHOLD * 1.15 && Math.abs(offset.x) < 90) {
        flyOut('up');
        return;
      }
      if (offset.x > SWIPE_THRESHOLD || velocityX > 720) {
        flyOut('right');
        return;
      }
      if (offset.x < -SWIPE_THRESHOLD || velocityX < -720) {
        flyOut('left');
        return;
      }
      animate(x, 0, { type: 'spring', stiffness: 420, damping: 34 });
      animate(y, 0, { type: 'spring', stiffness: 420, damping: 34 });
    },
    [flyOut, x, y],
  );

  const stackStyle = useMemo(() => {
    if (index === 0) return { scale: 1, y: 0 };
    if (index === 1) return { scale: 0.955, y: 14 };
    if (index === 2) return { scale: 0.912, y: 26 };
    return { scale: 0.88, y: 36 };
  }, [index]);

  return (
    <motion.div
      className={cn('absolute inset-0', isTop ? 'z-20' : index === 1 ? 'z-10' : 'z-0')}
      style={isTop ? { x, y, rotate, scale: cardScale } : undefined}
      initial={false}
      animate={isTop ? { opacity: 1 } : { opacity: index > 2 ? 0 : 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        animate={isTop ? { scale: 1, y: 0 } : stackStyle}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="h-full w-full origin-top"
        style={{ pointerEvents: isTop ? 'auto' : 'none' }}
      >
        <div
          className={cn(
            'relative flex h-full w-full cursor-grab select-none flex-col overflow-hidden rounded-[28px] border border-line bg-white shadow-card active:cursor-grabbing',
          )}
        >
          {isTop && (
            <motion.div
              drag={!fullyFunded}
              dragElastic={0.18}
              dragMomentum={false}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragStart={() => setDragging(true)}
              onDragEnd={handleDragEnd}
              className="absolute inset-0 z-30"
              aria-hidden="true"
              style={{ touchAction: 'pan-y' }}
            />
          )}

          {/* Image / receipt artwork */}
          <div className="relative h-[46%] min-h-[168px] shrink-0 overflow-hidden">
            <BillImage
              src={bill.imageUrl}
              alt={`${bill.title} — receipt preview`}
              category={bill.category}
              amount={bill.targetAmount}
              currency={bill.currency}
              seed={bill.id}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/28 to-transparent" />

            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] backdrop-blur"
                style={{ background: 'rgba(255,255,255,0.92)', color: cat.ink }}
              >
                {cat.short}
              </span>
              <div className="flex flex-col items-end gap-1.5">
                {bill.verificationStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-[10.5px] font-semibold text-[#0F7A52] backdrop-blur">
                    <BadgeCheck className="size-3.5" aria-hidden="true" />
                    {t('Verified')}
                  </span>
                )}
                {bill.isDemo && (
                  <span className="rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
                    {t('Demo')}
                  </span>
                )}
              </div>
            </div>

            {/* Swipe intent stamps */}
            {isTop && (
              <>
                <motion.div
                  style={{ opacity: helpOpacity }}
                  className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rotate-[-9deg]"
                >
                  <Stamp tone="help">HELP</Stamp>
                </motion.div>
                <motion.div
                  style={{ opacity: passOpacity }}
                  className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rotate-[9deg]"
                >
                  <Stamp tone="pass">PASS</Stamp>
                </motion.div>
                <motion.div
                  style={{ opacity: superOpacity }}
                  className="pointer-events-none absolute left-1/2 top-8 z-20 -translate-x-1/2"
                >
                  <Stamp tone="super">SUPER HELP</Stamp>
                </motion.div>
              </>
            )}
          </div>

          {/* Content */}
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-4 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={bill.owner.displayName} seed={bill.owner.avatarSeed} src={bill.owner.avatarUrl} size={38} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold leading-tight">{bill.owner.displayName}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-muted">
                    <MapPin className="size-3" aria-hidden="true" />
                    {bill.owner.region || bill.owner.country || 'Somewhere'}
                  </p>
                </div>
              </div>
              <div className="flex items-baseline gap-0.5 text-right">
                <span className="text-[15px] font-semibold text-muted">{symbol}</span>
                <span className="money-tabular text-[28px] font-bold leading-none tracking-[-0.03em]">{whole}</span>
                {cents && <span className="money-tabular text-[15px] font-semibold text-muted">.{cents}</span>}
              </div>
            </div>

            <h3 className="mt-3 line-clamp-2 text-[16.5px] font-semibold leading-snug">{bill.title}</h3>
            <p className="mt-1.5 line-clamp-3 text-[13.5px] leading-relaxed text-[#5C5862]">{bill.excerpt}</p>

            <div className="mt-auto pt-3">
              <div className="mb-1.5 flex items-end justify-between text-[12px]">
                <span className="font-semibold text-[#0F7A52]">
                  {percent(bill.raisedAmount, bill.targetAmount)}% funded
                </span>
                <span className="text-muted">
                  {remaining > 0 ? t('{amount} to go', { amount: formatMoney(remaining, bill.currency) }) : t('Goal reached')}
                </span>
              </div>
              <ProgressBar value={progress} tone={fullyFunded ? 'mint' : 'brand'} />

              <div className="mt-3 flex items-center justify-between text-[12px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5" aria-hidden="true" />
                  {tp(bill.helperCount, '{n} helper', '{n} helpers')}
                </span>
                {due !== null && due >= 0 && due <= 14 ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-[#A96A00]">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    {due === 0 ? t('Due today') : t('{n}d left', { n: due })}
                  </span>
                ) : (
                  <span className="truncate pl-3 text-right">{bill.owner.country}</span>
                )}
              </div>
            </div>
          </div>

          {isTop && !dragging && (
            <button
              type="button"
              onClick={onOpen}
              aria-label={`Open details for ${bill.title}`}
              className="absolute inset-x-0 bottom-0 z-10 h-11 bg-gradient-to-t from-black/[0.04] to-transparent focus-visible:opacity-100"
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stamp({ tone, children }: { tone: 'help' | 'pass' | 'super'; children: string }) {
  const styles =
    tone === 'help'
      ? 'border-[#29C58A] text-[#0F7A52]'
      : tone === 'pass'
        ? 'border-[#FF718B] text-[#C02444]'
        : 'border-brand text-brand-ink';
  return (
    <span
      className={cn(
        'rounded-xl border-[3px] bg-white/90 px-4 py-2 text-2xl font-black uppercase tracking-[0.14em] backdrop-blur-sm',
        styles,
      )}
    >
      {children}
    </span>
  );
}

export function BillCardPreview({ bill: rawBill }: { bill: BillSummary }) {
  const { tp } = useI18n();
  const localize = useBillCopy();
  const bill = localize(rawBill);
  const cat = categoryOf(bill.category);
  return (
    <Link
      to={`/bills/${bill.id}`}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative h-32 overflow-hidden">
        <BillImage
          src={bill.imageUrl}
          alt=""
          category={bill.category}
          amount={bill.targetAmount}
          currency={bill.currency}
          seed={bill.id}
          compact
        />
        <span
          className="absolute left-3 top-3 rounded-full px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider"
          style={{ background: cat.tint, color: cat.ink }}
        >
          {cat.short}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{bill.title}</p>
        <p className="mt-1 text-[12px] text-muted">
          by {bill.owner.displayName}
        </p>
        <div className="mt-auto pt-2.5">
          <ProgressBar value={percent(bill.raisedAmount, bill.targetAmount)} className="h-1" />
          <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
            <span className="font-semibold">{percent(bill.raisedAmount, bill.targetAmount)}%</span>
            <span className="text-muted">{tp(bill.helperCount, '{n} helper', '{n} helpers')}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

