import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { BillSummary } from '@shared/types';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Button, LinkButton } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/AppShell';
import { EmptyState, Pill, ProgressBar, Skeleton } from '@/components/ui/Primitives';
import { ReceiptArt } from '@/components/bill/ReceiptArt';
import { categoryOf } from '@shared/categories';
import { formatMoney, percent } from '@shared/money';
import { cn, daysUntil, formatDate, timeAgo } from '@/lib/utils';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending_review', label: 'In review' },
  { id: 'active', label: 'Live' },
  { id: 'fully_funded', label: 'Funded' },
  { id: 'rejected', label: 'Needs changes' },
  { id: 'closed', label: 'Closed' },
] as const;

export default function MyBills() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [bills, setBills] = useState<BillSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: '/bills' } });
      return;
    }
    let cancelled = false;
    setError(null);
    api
      .get<{ bills: BillSummary[] }>('/bills/mine')
      .then((res) => !cancelled && setBills(res.bills))
      .catch((err) => !cancelled && setError(err instanceof ApiRequestError ? err.message : 'Could not load your bills.'))
      .finally(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate]);

  const filtered = useMemo(() => {
    if (!bills) return [];
    if (filter === 'all') return bills;
    return bills.filter((bill) => bill.status === filter);
  }, [bills, filter]);

  const totals = useMemo(() => {
    const list = bills ?? [];
    return {
      count: list.length,
      raised: list.reduce((sum, bill) => sum + bill.raisedAmount, 0),
      live: list.filter((b) => b.status === 'active').length,
      funded: list.filter((b) => b.status === 'fully_funded').length,
    };
  }, [bills]);

  async function closeBill(id: string) {
    setBusyId(id);
    try {
      await api.post(`/bills/${id}/close`);
      setBills((prev) => prev?.map((b) => (b.id === id ? { ...b, status: 'closed' } : b)) ?? null);
      toast.success('Bill closed', 'It is no longer visible in Discover.');
    } catch (err) {
      toast.error('Could not close bill', err instanceof ApiRequestError ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || bills === null) {
    return (
      <div className="px-5 pt-6 sm:px-8">
        <Skeleton className="h-8 w-40" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My bills"
        description="Everything you have posted, from review to fully funded."
        action={
          <LinkButton to="/bills/new" icon={<Plus className="size-4" aria-hidden="true" />}>
            Post a bill
          </LinkButton>
        }
      >
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Bills posted" value={String(totals.count)} icon={<FileText className="size-4" aria-hidden="true" />} />
          <Stat label="Live now" value={String(totals.live)} icon={<Clock3 className="size-4" aria-hidden="true" />} />
          <Stat label="Fully funded" value={String(totals.funded)} icon={<BadgeCheck className="size-4" aria-hidden="true" />} />
          <Stat
            label="Raised total"
            value={formatMoney(totals.raised)}
            icon={<Wallet className="size-4" aria-hidden="true" />}
          />
        </div>
      </PageHeader>

      <div className="px-5 sm:px-8">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {FILTERS.map((item) => {
            const count = item.id === 'all' ? (bills ?? []).length : (bills ?? []).filter((b) => b.status === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition',
                  filter === item.id ? 'bg-ink text-white' : 'bg-white text-[#57534E] ring-1 ring-line hover:bg-[#FBFAF8]',
                )}
              >
                {item.label}
                {count > 0 && <span className={cn('ml-1.5', filter === item.id ? 'text-white/60' : 'text-muted')}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-5 sm:px-8">
        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-coral-soft px-4 py-3">
            <p className="text-[13px] font-medium text-[#C02444]">{error}</p>
            <Button size="sm" variant="pass" onClick={() => location.reload()} icon={<RefreshCw className="size-3.5" aria-hidden="true" />}>
              Retry
            </Button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="card-shell">
            <EmptyState
              icon={<Wallet className="size-6" aria-hidden="true" />}
              title={filter === 'all' ? 'No bills yet' : 'Nothing in this filter'}
              description={
                filter === 'all'
                  ? 'When something unexpected lands, you can post the bill here and let people decide whether to help.'
                  : 'Try another filter, or post a new bill.'
              }
              action={
                <LinkButton to="/bills/new" icon={<Plus className="size-4" aria-hidden="true" />}>
                  Post a bill
                </LinkButton>
              }
            />
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((bill) => {
              const cat = categoryOf(bill.category);
              const due = daysUntil(bill.dueDate);
              const locked = bill.raisedAmount > 0;
              return (
                <li key={bill.id} className="group overflow-hidden rounded-[22px] border border-line bg-white shadow-soft">
                  <Link to={`/bills/${bill.id}`} className="block">
                    <div className="relative h-28">
                      <ReceiptArt seed={bill.id} category={bill.category} amount={bill.targetAmount} currency={bill.currency} compact />
                      <div className="absolute left-3 top-3 flex gap-1.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: cat.tint, color: cat.ink }}
                        >
                          {cat.short}
                        </span>
                      </div>
                      <div className="absolute right-3 top-3">
                        <StatusPill status={bill.status} />
                      </div>
                    </div>
                  </Link>
                  <div className="p-3.5">
                    <Link to={`/bills/${bill.id}`}>
                      <h3 className="line-clamp-2 text-[13.5px] font-semibold leading-snug hover:text-brand-ink">{bill.title}</h3>
                    </Link>
                    <div className="mt-2.5">
                      <div className="flex items-baseline justify-between text-[11.5px]">
                        <span className="font-semibold">
                          {formatMoney(bill.raisedAmount, bill.currency)}
                          <span className="font-normal text-muted"> of {formatMoney(bill.targetAmount, bill.currency)}</span>
                        </span>
                        <span className="text-muted">{percent(bill.raisedAmount, bill.targetAmount)}%</span>
                      </div>
                      <ProgressBar value={percent(bill.raisedAmount, bill.targetAmount)} className="mt-1.5 h-1" tone={bill.status === 'fully_funded' ? 'mint' : 'brand'} />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" aria-hidden="true" />
                        {bill.helperCount} helpers
                      </span>
                      <span>
                        {due !== null && due >= 0 ? `Due in ${due}d` : formatDate(bill.dueDate)}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-1.5 border-t border-line pt-2.5">
                      <LinkButton to={`/bills/${bill.id}`} size="sm" variant="ghost" className="flex-1 border border-line text-[12px]">
                        View
                      </LinkButton>
                      {!locked && bill.status !== 'closed' ? (
                        <LinkButton
                          to={`/bills/${bill.id}/edit`}
                          size="sm"
                          variant="ghost"
                          className="flex-1 border border-line text-[12px]"
                          icon={<Pencil className="size-3" aria-hidden="true" />}
                        >
                          Edit
                        </LinkButton>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 border border-line text-[12px]"
                          disabled={busyId === bill.id || locked}
                          onClick={() => void closeBill(bill.id)}
                          icon={busyId === bill.id ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" aria-hidden="true" />}
                        >
                          Close
                        </Button>
                      )}
                    </div>
                    <p className="mt-1.5 text-center text-[10px] text-[#7C776F]">
                      Posted {timeAgo(bill.createdAt)}
                      {locked && ' · locked (help received)'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <span className="flex size-7 items-center justify-center rounded-lg bg-[#FAF8F5] text-[#57534E]">{icon}</span>
      <p className="money-tabular mt-2 text-[18px] font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: 'brand' | 'mint' | 'coral' | 'amber' | 'neutral' }> = {
    active: { label: 'Live', tone: 'brand' },
    fully_funded: { label: 'Funded', tone: 'mint' },
    pending_review: { label: 'In review', tone: 'amber' },
    rejected: { label: 'Changes', tone: 'coral' },
    closed: { label: 'Closed', tone: 'neutral' },
    suspended: { label: 'Paused', tone: 'coral' },
    approved: { label: 'Approved', tone: 'mint' },
    draft: { label: 'Draft', tone: 'neutral' },
  };
  const item = map[status] ?? { label: status, tone: 'neutral' as const };
  return <Pill tone={item.tone}>{item.label}</Pill>;
}

export { ArrowRight };
