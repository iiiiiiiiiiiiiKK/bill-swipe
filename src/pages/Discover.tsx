import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowLeftRight,
  HandHeart,
  HeartHandshake,
  Loader2,
  RefreshCw,
  Sparkles,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import type { BillSummary, MeProfile } from '@shared/types';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Button, LinkButton } from '@/components/ui/Button';
import { BillCard, type SwipeDirection } from '@/components/bill/BillCard';
import { EmptyState, Pill, Skeleton } from '@/components/ui/Primitives';
import { Avatar } from '@/components/ui/Avatar';
import { HelpSheet } from '@/components/payment/HelpSheet';
import { formatMoney } from '@shared/money';
import { cn, haptic, timeAgo } from '@/lib/utils';

interface FeedState {
  bills: BillSummary[];
  cursor: string | null;
  loading: boolean;
  error: string | null;
  /** True only while the server says there is another page behind this one. */
  hasMore: boolean;
}

export default function Discover() {
  const { t, tp } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const reduce = useReducedMotion();
  const [feed, setFeed] = useState<FeedState>({ bills: [], cursor: null, loading: true, error: null, hasMore: false });
  const [history, setHistory] = useState<BillSummary[]>([]);
  const [helpTarget, setHelpTarget] = useState<BillSummary | null>(null);
  const [superHelp, setSuperHelp] = useState(false);
  const loadingRef = useRef(false);
  const didInit = useRef(false);
  const feedCursorRef = useRef<string | null>(null);

  /**
   * mode:
   *   initial — first load for this view
   *   more    — append the next page
   *   refresh — start over from the newest bill
   *
   * hasMore is only true when the server returned a full page AND still reports
   * bills remaining. That single flag is what stops the deck from re-fetching
   * itself forever once the stack is empty.
   */
  const load = useCallback(async (mode: 'initial' | 'more' | 'refresh' = 'initial') => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setFeed((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const cursor = mode === 'more' ? (feedCursorRef.current ?? null) : null;
      const params = new URLSearchParams({ limit: '12' });
      if (cursor) params.set('cursor', cursor);
      const res = await api.get<{ bills: BillSummary[]; remaining: number }>(`/bills/discover?${params.toString()}`);
      const page = res.bills ?? [];
      setFeed((prev) => {
        const base = mode === 'more' ? prev.bills : [];
        const seen = new Set(base.map((bill) => bill.id));
        const merged = [...base, ...page.filter((bill) => !seen.has(bill.id))];
        const last = page[page.length - 1];
        const nextCursor = last ? (last.createdAt ?? prev.cursor) : prev.cursor;
        feedCursorRef.current = nextCursor;
        return {
          bills: merged,
          cursor: nextCursor,
          loading: false,
          error: null,
          hasMore: page.length > 0 && res.remaining > page.length,
        };
      });
    } catch (error) {
      setFeed((prev) => ({
        ...prev,
        loading: false,
        hasMore: false,
        error: error instanceof ApiRequestError ? error.message : 'Could not load bills right now.',
      }));
    } finally {
      loadingRef.current = false;
    }
  }, []);

  // First load once authentication has settled.
  useEffect(() => {
    if (authLoading || didInit.current) return;
    didInit.current = true;
    void load('initial');
  }, [authLoading, load]);

  // Keep a small buffer behind the current card — but only while the server says
  // there is more to fetch. Without this guard an exhausted deck would re-fetch
  // in a loop whenever its length stayed <= 2.
  useEffect(() => {
    if (!feed.hasMore || feed.loading || feed.error) return;
    if (feed.bills.length > 2) return;
    void load('more');
  }, [feed.hasMore, feed.loading, feed.error, feed.bills.length, load]);

  const top = feed.bills[0];
  const visible = feed.bills.slice(0, 3);

  const commitSwipe = useCallback(
    async (direction: SwipeDirection, bill: BillSummary) => {
      setFeed((prev) => ({ ...prev, bills: prev.bills.filter((b) => b.id !== bill.id) }));
      setHistory((prev) => [bill, ...prev].slice(0, 10));
      const action = direction === 'up' ? 'super_help' : direction === 'right' ? 'help' : 'pass';
      try {
        await api.post(`/bills/${bill.id}/swipe`, { action });
      } catch {
        /* swipe bookkeeping is best-effort; never block the UI on it */
      }
      if (direction !== 'left') {
        if (direction === 'up') setSuperHelp(true);
        setHelpTarget(bill);
      }
    },
    [],
  );

  const handleSwipe = useCallback(
    (direction: SwipeDirection) => {
      if (!top) return;
      void commitSwipe(direction, top);
      if (direction === 'right') haptic(14);
    },
    [commitSwipe, top],
  );

  const handlePass = useCallback(() => {
    if (!top) return;
    haptic(8);
    void commitSwipe('left', top);
  }, [commitSwipe, top]);

  const handleHelp = useCallback(() => {
    if (!top) return;
    haptic(14);
    void commitSwipe('right', top);
  }, [commitSwipe, top]);

  const handleSuper = useCallback(() => {
    if (!top) return;
    haptic([10, 30, 10]);
    void commitSwipe('up', top);
  }, [commitSwipe, top]);

  const handleUndo = useCallback(async () => {
    if (history.length === 0) {
      toast.info('Nothing to undo yet');
      return;
    }
    const [last, ...rest] = history;
    setHistory(rest);
    setFeed((prev) => ({ ...prev, bills: [last!, ...prev.bills] }));
    haptic(6);
    try {
      await api.post('/swipes/undo');
    } catch {
      /* ignore */
    }
  }, [history, toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (helpTarget) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePass();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleHelp();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        handleSuper();
      } else if (event.key === 'Enter' && top) {
        navigate(`/bills/${top.id}`);
      } else if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        void handleUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleHelp, handlePass, handleSuper, handleUndo, helpTarget, navigate, top]);

  const exhausted = !feed.loading && feed.bills.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-0 lg:flex-row lg:gap-8 lg:px-8 lg:pt-6">
      <section className="flex min-h-[calc(100dvh-8.5rem)] flex-1 flex-col lg:min-h-0">
        <div className="flex items-center justify-between gap-3 px-5 pt-3 lg:px-0 lg:pt-0">
          <div>
            <h1 className="text-[19px] font-semibold tracking-[-0.02em] lg:text-[22px]">{t('Discover')}</h1>
            <p className="mt-0.5 text-[12px] text-muted">
              {feed.bills.length > 0 ? tp(feed.bills.length, '{n} bill in your stack', '{n} bills in your stack') : t('Fresh bills, reviewed by humans')}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void load('refresh')}
              aria-label={t('Refresh bills')}
              className="inline-flex size-9 items-center justify-center rounded-xl border border-line bg-white text-[#57534E] transition hover:bg-[#FBFAF8]"
            >
              <RefreshCw className={cn('size-4', feed.loading && 'animate-spin')} aria-hidden="true" />
            </button>
            <Pill tone="neutral" className="hidden sm:inline-flex">
              {t('← pass · → help')}
            </Pill>
          </div>
        </div>

        <div className="relative mx-4 mt-3 flex-1 lg:mx-0 lg:mt-4">
          <div className="relative mx-auto h-full w-full max-w-[430px]">
            <div className="relative aspect-[3/4.15] w-full max-h-[min(62dvh,560px)] lg:max-h-[560px]">
              <AnimatePresence initial={false}>
                {visible.map((bill, index) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    index={index}
                    isTop={index === 0}
                    onSwipe={handleSwipe}
                    onOpen={() => navigate(`/bills/${bill.id}`)}
                    reducedMotion={!!reduce}
                  />
                ))}
              </AnimatePresence>

              {feed.loading && feed.bills.length === 0 && <CardSkeleton />}

              {exhausted && (
                <div className="card-shell flex h-full flex-col items-center justify-center px-6 text-center">
                  <span className="flex size-16 items-center justify-center rounded-3xl bg-brand-soft">
                    <Sparkles className="size-7 text-brand-ink" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-[19px] font-semibold">{t('That\'s the whole stack')}</h2>
                  <p className="mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted">
                    You have seen every bill available right now. New ones appear as they pass review — check back in a
                    little while.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Button onClick={() => void load('refresh')} icon={<RefreshCw className="size-4" aria-hidden="true" />}>
                      {t('Refresh')}
                    </Button>
                    <LinkButton to="/bills/new" variant="pass">
                      {t('Post a bill')}
                    </LinkButton>
                  </div>
                  <p className="mt-4 text-[11.5px] text-[#736E66]">
                    Undo still works — press <kbd className="rounded border border-line px-1">Z</kbd> to go back.
                  </p>
                </div>
              )}

              {feed.error && feed.bills.length === 0 && (
                <div className="card-shell flex h-full flex-col items-center justify-center px-6 text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-coral-soft">
                    <X className="size-6 text-[#C02444]" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-[18px] font-semibold">{t('Could not load bills')}</h2>
                  <p className="mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted">{feed.error}</p>
                  <Button className="mt-5" onClick={() => void load('refresh')} icon={<RefreshCw className="size-4" aria-hidden="true" />}>
                    {t('Try again')}
                  </Button>
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="mt-5 flex items-center justify-center gap-3 lg:gap-4">
              <ActionButton
                label={t('Undo')}
                onClick={() => void handleUndo()}
                disabled={history.length === 0}
                className="size-[52px] border border-line bg-white text-[#57534E] shadow-soft hover:bg-[#FBFAF8]"
              >
                <Undo2 className="size-[19px]" aria-hidden="true" />
              </ActionButton>
              <ActionButton
                label={t('Pass')}
                onClick={handlePass}
                disabled={!top}
                className="size-[62px] bg-white text-[#C02444] shadow-lift ring-1 ring-[#FFD8E0] hover:bg-[#FFF7F9]"
              >
                <X className="size-6" aria-hidden="true" strokeWidth={2.6} />
              </ActionButton>
              <ActionButton
                label={t('Super Help')}
                onClick={handleSuper}
                disabled={!top}
                className="size-[52px] bg-brand-soft text-brand-ink shadow-soft hover:bg-[#E4DAFF]"
              >
                <Zap className="size-[19px]" aria-hidden="true" strokeWidth={2.6} />
              </ActionButton>
              <ActionButton
                label={t('Help')}
                onClick={handleHelp}
                disabled={!top}
                className="size-[62px] bg-mint text-white shadow-[0_14px_28px_-14px_rgba(41,197,138,0.95)] hover:bg-[#22b47c]"
              >
                <HeartHandshake className="size-6" aria-hidden="true" strokeWidth={2.4} />
              </ActionButton>
              <ActionButton
                label={t('Open')}
                onClick={() => top && navigate(`/bills/${top.id}`)}
                disabled={!top}
                className="size-[52px] border border-line bg-white text-[#57534E] shadow-soft hover:bg-[#FBFAF8]"
              >
                <ArrowLeftRight className="size-[19px]" aria-hidden="true" />
              </ActionButton>
            </div>
            <p className="mt-2.5 text-center text-[11px] text-[#736E66]">
              {t('Swiping records intent only — you always confirm the amount and total before paying.')}
            </p>
          </div>
        </div>
      </section>

      <aside className="hidden w-[300px] shrink-0 flex-col gap-4 py-6 lg:flex xl:w-[336px]">
        <SidebarStats user={user} />
        <SidebarHint />
      </aside>

      <HelpSheet
        bill={helpTarget}
        open={!!helpTarget}
        superHelp={superHelp}
        onClose={() => {
          setHelpTarget(null);
          setSuperHelp(false);
        }}
      />
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex items-center justify-center rounded-full transition-all duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}

function CardSkeleton() {
  return (
    <div className="card-shell absolute inset-0 overflow-hidden">
      <Skeleton className="h-[46%] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

function SidebarStats({ user }: { user: MeProfile | null }) {
  const { t } = useI18n();
  return (
    <div className="card-shell p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#736E66]">{t('Your impact')}</p>
        {user && <Avatar name={user.displayName} seed={user.avatarSeed} src={user.avatarUrl} size={24} />}
      </div>
      {user ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#FAF8F5] p-2.5">
              <p className="money-tabular text-[17px] font-bold leading-none">{user.stats.helpedCount}</p>
              <p className="mt-1 text-[10.5px] text-muted">{t('bills helped')}</p>
            </div>
            <div className="rounded-xl bg-[#FAF8F5] p-2.5">
              <p className="money-tabular text-[17px] font-bold leading-none">
                {formatMoney(user.stats.helpedAmount)}
              </p>
              <p className="mt-1 text-[10.5px] text-muted">{t('given')}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {user.achievements
              .filter((a) => a.earned)
              .slice(0, 3)
              .map((a) => (
                <Pill key={a.id} tone="mint">
                  {a.label}
                </Pill>
              ))}
            {user.achievements.every((a) => !a.earned) && <p className="text-[11.5px] text-muted">{t('Your first badge is one swipe away.')}</p>}
          </div>
        </>
      ) : (
        <div className="mt-3">
          <p className="text-[13px] leading-relaxed text-muted">{t('Sign in to track your help and see your badges.')}</p>
          <LinkButton to="/login" size="sm" className="mt-3" block>
            {t('Sign in')}
          </LinkButton>
        </div>
      )}
    </div>
  );
}

function SidebarHint() {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-line bg-white/70 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#736E66]">
        <HandHeart className="size-3.5" aria-hidden="true" />
        {t('Keyboard shortcuts')}
      </p>
      <ul className="mt-2.5 space-y-1.5 text-[12px] text-[#5C5862]">
        <li className="flex items-center justify-between">
          <span>{t('Pass')}</span>
          <kbd className="rounded border border-line bg-white px-1.5 py-0.5 text-[10.5px]">←</kbd>
        </li>
        <li className="flex items-center justify-between">
          <span>{t('Help')}</span>
          <kbd className="rounded border border-line bg-white px-1.5 py-0.5 text-[10.5px]">→</kbd>
        </li>
        <li className="flex items-center justify-between">
          <span>{t('Super Help')}</span>
          <kbd className="rounded border border-line bg-white px-1.5 py-0.5 text-[10.5px]">↑</kbd>
        </li>
        <li className="flex items-center justify-between">
          <span>{t('Open bill')}</span>
          <kbd className="rounded border border-line bg-white px-1.5 py-0.5 text-[10.5px]">↵</kbd>
        </li>
        <li className="flex items-center justify-between">
          <span>{t('Undo')}</span>
          <kbd className="rounded border border-line bg-white px-1.5 py-0.5 text-[10.5px]">Z</kbd>
        </li>
      </ul>
      <p className="mt-3 border-t border-line pt-2.5 text-[11px] leading-relaxed text-[#736E66]">
        {t('Recently passed? Undo restores the last card and removes the swipe record.')}
      </p>
    </div>
  );
}

export const DiscoverExports = { Loader2, timeAgo, EmptyState };

