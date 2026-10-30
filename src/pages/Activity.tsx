import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, Clock3, Heart, Inbox, Loader2, Receipt, Wallet } from 'lucide-react';
import type { Payment } from '@shared/types';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/AppShell';
import { EmptyState, Pill, Skeleton } from '@/components/ui/Primitives';
import { LinkButton } from '@/components/ui/Button';
import { cn, timeAgo } from '@/lib/utils';
import { formatMoney } from '@shared/money';

type Tab = 'given' | 'received';

interface ReceivedEntry {
  id: string;
  billId: string;
  billTitle: string;
  amount: number;
  from: string | null;
  anonymous: boolean;
  createdAt: string;
  status: string;
}

export default function Activity() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('given');
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [received, setReceived] = useState<{ total: number; currency: string; entries: ReceivedEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: '/activity' } });
      return;
    }
    let cancelled = false;
    Promise.all([
      api.get<{ payments: Payment[] }>('/payments/mine'),
      api.get<{ total: number; currency: string; entries: ReceivedEntry[] }>('/payments/received'),
    ])
      .then(([mine, incoming]) => {
        if (cancelled) return;
        setPayments(mine.payments);
        setReceived(incoming);
      })
      .catch((err) => !cancelled && setError(err instanceof ApiRequestError ? err.message : 'Could not load activity.'));
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate]);

  const totals = useMemo(() => {
    const succeeded = (payments ?? []).filter((p) => p.status === 'succeeded');
    return {
      count: succeeded.length,
      amount: succeeded.reduce((sum, p) => sum + p.amount, 0),
      pending: (payments ?? []).filter((p) => p.status === 'pending').length,
    };
  }, [payments]);

  if (authLoading || (payments === null && !error)) {
    return (
      <div className="px-5 pt-6 sm:px-8">
        <Skeleton className="h-8 w-36" />
        <div className="mt-5 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Activity" description="Everything you have given — and everything that came in.">
        <div className="mt-5 flex gap-1.5 rounded-xl bg-white p-1 ring-1 ring-line">
          {(['given', 'received'] as Tab[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition',
                tab === id ? 'bg-ink text-white' : 'text-[#57534E] hover:bg-black/[0.04]',
              )}
            >
              {id === 'given' ? 'Help I gave' : 'Help I received'}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="px-5 pb-10 sm:px-8">
        {error && <p className="mb-4 rounded-2xl bg-coral-soft px-4 py-3 text-[13px] text-[#C02444]">{error}</p>}

        {tab === 'given' ? (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <MiniStat label="Bills helped" value={String(totals.count)} icon={<Heart className="size-3.5" aria-hidden="true" />} />
              <MiniStat label="Total given" value={formatMoney(totals.amount)} icon={<Wallet className="size-3.5" aria-hidden="true" />} />
              <MiniStat label="Pending" value={String(totals.pending)} icon={<Clock3 className="size-3.5" aria-hidden="true" />} />
            </div>

            {(payments ?? []).length === 0 ? (
              <div className="card-shell mt-4">
                <EmptyState
                  icon={<Heart className="size-6" aria-hidden="true" />}
                  title="No help sent yet"
                  description="When you choose to help someone, the payment and its status will show up here."
                  action={<LinkButton to="/discover">Find a bill to help</LinkButton>}
                />
              </div>
            ) : (
              <ul className="mt-4 overflow-hidden rounded-[22px] border border-line bg-white">
                {(payments ?? []).map((payment) => (
                  <li key={payment.id} className="flex items-center gap-3 border-b border-line px-3.5 py-3 last:border-0">
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-xl',
                        payment.status === 'succeeded'
                          ? 'bg-mint-soft text-[#0F7A52]'
                          : payment.status === 'pending'
                            ? 'bg-amber-soft text-[#9A6600]'
                            : 'bg-coral-soft text-[#C02444]',
                      )}
                    >
                      {payment.status === 'succeeded' ? (
                        <BadgeCheck className="size-4" aria-hidden="true" />
                      ) : payment.status === 'pending' ? (
                        <Clock3 className="size-4" aria-hidden="true" />
                      ) : (
                        <Receipt className="size-4" aria-hidden="true" />
                      )}
                    </span>
                    <Link to={`/bills/${payment.billId}`} className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold hover:text-brand-ink">{payment.billTitle}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                        {timeAgo(payment.createdAt)}
                        <span className="text-[#CFC9C0]">·</span>
                        {payment.isAnonymous ? 'Anonymous' : 'Named'}
                        {payment.sandbox && (
                          <>
                            <span className="text-[#CFC9C0]">·</span>
                            sandbox
                          </>
                        )}
                      </p>
                    </Link>
                    <div className="shrink-0 text-right">
                      <p className="money-tabular text-[13.5px] font-bold">{formatMoney(payment.amount, payment.currency)}</p>
                      <StatusTag status={payment.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-[#736E66]">
              Refunds are processed by moderators. A refunded payment reverses the bill&apos;s raised total — the record
              stays here with its new status.
            </p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <MiniStat label="Total received" value={formatMoney(received?.total ?? 0, received?.currency)} icon={<Inbox className="size-3.5" aria-hidden="true" />} />
              <MiniStat label="Helpers" value={String(received?.entries.length ?? 0)} icon={<Heart className="size-3.5" aria-hidden="true" />} />
            </div>

            {(received?.entries.length ?? 0) === 0 ? (
              <div className="card-shell mt-4">
                <EmptyState
                  icon={<Inbox className="size-6" aria-hidden="true" />}
                  title="No help received yet"
                  description="Once someone helps one of your bills, their contribution appears here — anonymously if they chose that."
                  action={<LinkButton to="/bills/new">Post a bill</LinkButton>}
                />
              </div>
            ) : (
              <ul className="mt-4 overflow-hidden rounded-[22px] border border-line bg-white">
                {received!.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 border-b border-line px-3.5 py-3 last:border-0">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-[#0F7A52]">
                      <Heart className="size-4" aria-hidden="true" />
                    </span>
                    <Link to={`/bills/${entry.billId}`} className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold hover:text-brand-ink">{entry.billTitle}</p>
                      <p className="truncate text-[11px] text-muted">
                        {entry.anonymous ? 'Anonymous helper' : entry.from ?? 'A helper'} · {timeAgo(entry.createdAt)}
                      </p>
                    </Link>
                    <p className="money-tabular shrink-0 text-[13.5px] font-bold">{formatMoney(entry.amount)}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-[#736E66]">
              Helpers who choose anonymity stay hidden from everyone except moderators handling a dispute.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <span className="flex size-6 items-center justify-center rounded-lg bg-[#FAF8F5] text-[#57534E]">{icon}</span>
      <p className="money-tabular mt-1.5 text-[16px] font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10.5px] text-muted">{label}</p>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: 'mint' | 'amber' | 'coral' | 'neutral' | 'brand' }> = {
    succeeded: { label: 'Succeeded', tone: 'mint' },
    pending: { label: 'Pending', tone: 'amber' },
    processing: { label: 'Processing', tone: 'brand' },
    failed: { label: 'Failed', tone: 'coral' },
    refunded: { label: 'Refunded', tone: 'neutral' },
    disputed: { label: 'Disputed', tone: 'coral' },
  };
  const item = map[status] ?? { label: status, tone: 'neutral' as const };
  return (
    <span className="mt-0.5 block">
      <Pill tone={item.tone} className="px-1.5 py-0 text-[10px]">
        {item.label}
      </Pill>
    </span>
  );
}

export { Loader2 };
