import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  Heart,
  HeartHandshake,
  Info,
  Loader2,
  MapPin,
  Pencil,
  Share2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { BillDetail } from '@shared/types';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Button, LinkButton } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Pill, ProgressBar, Skeleton } from '@/components/ui/Primitives';
import { ReceiptArt } from '@/components/bill/ReceiptArt';
import { HelpSheet } from '@/components/payment/HelpSheet';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { categoryOf } from '@shared/categories';
import { formatMoney, percent } from '@shared/money';
import { cn, daysUntil, formatDate, timeAgo } from '@/lib/utils';

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [bill, setBill] = useState<BillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ bill: BillDetail }>(`/bills/${id}`);
      setBill(res.bill);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load this bill.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const share = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: bill?.title ?? 'BILL SWIPE', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link copied', 'Share it with someone who can help.');
    } catch {
      toast.error('Could not share', 'Copy the address from your browser instead.');
    }
  }, [bill?.title, toast]);

  if (loading) return <DetailSkeleton />;

  if (error || !bill) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-5 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-coral-soft">
          <X className="size-6 text-[#C02444]" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-[20px] font-semibold">Bill unavailable</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{error ?? 'This bill may have been removed.'}</p>
        <div className="mt-5 flex gap-2">
          <Button onClick={() => void load()} variant="soft">
            Try again
          </Button>
          <LinkButton to="/discover" variant="pass">
            Back to Discover
          </LinkButton>
        </div>
      </div>
    );
  }

  const cat = categoryOf(bill.category);
  const progress = percent(bill.raisedAmount, bill.targetAmount);
  const remaining = Math.max(0, bill.targetAmount - bill.raisedAmount);
  const due = daysUntil(bill.dueDate);
  const statusPill = statusTone(bill.status, bill.verificationStatus);

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-10 pt-4 sm:px-8 lg:pt-8">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/discover'))}
        className="mb-4 inline-flex items-center gap-1.5 rounded-xl px-1 py-1 text-[13px] font-semibold text-[#57534E] transition hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-[24px] border border-line bg-white shadow-soft">
            <div className="relative h-[220px] sm:h-[280px]">
              <ReceiptArt
                seed={bill.id}
                category={bill.category}
                amount={bill.targetAmount}
                currency={bill.currency}
                merchant={bill.receipt?.fileName?.replace(/\.\w+$/, '').replace(/[-_]/g, ' ')}
              />
              <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
                  style={{ background: cat.tint, color: cat.ink }}
                >
                  {cat.label}
                </span>
                {bill.isDemo && <Pill tone="neutral">Demo</Pill>}
              </div>
              <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5">
                {bill.verificationStatus === 'verified' && (
                  <Pill tone="mint" icon={<BadgeCheck className="size-3" aria-hidden="true" />}>
                    Verified
                  </Pill>
                )}
                <Pill tone={statusPill.tone}>{statusPill.label}</Pill>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] sm:text-[26px]">{bill.title}</h1>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {bill.owner.region || '—'}, {bill.owner.country}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      Due {formatDate(bill.dueDate)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      Posted {timeAgo(bill.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-[#FAF8F5] p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#736E66]">Needed</p>
                    <p className="money-tabular mt-0.5 text-[32px] font-bold leading-none tracking-[-0.03em]">
                      {formatMoney(bill.targetAmount, bill.currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#736E66]">Raised</p>
                    <p className="money-tabular mt-0.5 text-[17px] font-semibold text-[#0F7A52]">
                      {formatMoney(bill.raisedAmount, bill.currency)}
                    </p>
                  </div>
                </div>
                <ProgressBar value={progress} tone={remaining === 0 ? 'mint' : 'brand'} className="mt-3 h-2" />
                <div className="mt-2 flex items-center justify-between text-[12px]">
                  <span className="font-semibold">{progress}% funded</span>
                  <span className="text-muted">
                    {remaining > 0 ? `${formatMoney(remaining, bill.currency)} to go` : 'Goal reached 🎉'}
                  </span>
                </div>
              </div>

              <div className="mt-5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#736E66]">Their story</h2>
                <div className="mt-2 space-y-3 text-[14.5px] leading-[1.7] text-[#3A3740]">
                  {bill.story.split(/\n{2,}/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>

              {bill.receipt && (
                <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-dashed border-line bg-[#FBFAF8] p-3.5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#57534E]" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold">Receipt on file: {bill.receipt.fileName}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                      Uploaded {timeAgo(bill.receipt.uploadedAt)} · {Math.round(bill.receipt.size / 1024)} KB. The original
                      stays private and is only visible to moderators; a redacted preview is shown publicly.
                    </p>
                  </div>
                </div>
              )}

              {bill.reviewNote && (bill.viewer.isOwner || bill.admin) && (
                <div className="mt-4 rounded-2xl bg-amber-soft p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A6600]">Reviewer note</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#7A5200]">{bill.reviewNote}</p>
                </div>
              )}
            </div>
          </section>

          {bill.updates.length > 0 && (
            <section className="rounded-[22px] border border-line bg-white p-5 shadow-soft">
              <h2 className="text-[14px] font-semibold">Updates</h2>
              <ul className="mt-3 space-y-3">
                {bill.updates.map((update) => (
                  <li key={update.id} className="flex gap-3">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[13.5px] leading-relaxed">{update.body}</p>
                      <p className="mt-0.5 text-[11px] text-[#736E66]">
                        {update.author} · {timeAgo(update.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-[22px] border border-line bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">
                Helpers {bill.helpers.length > 0 && <span className="text-muted">· {bill.helpers.length}</span>}
              </h2>
              {bill.helperCount > bill.helpers.length && (
                <span className="text-[11.5px] text-muted">showing latest {bill.helpers.length}</span>
              )}
            </div>
            {bill.helpers.length === 0 ? (
              <p className="mt-3 rounded-xl bg-[#FAF8F5] px-3 py-3 text-[12.5px] leading-relaxed text-muted">
                No confirmed help yet. The first person to step in will show up here.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {bill.helpers.map((record) => (
                  <li key={record.id} className="flex items-center gap-3 py-2.5">
                    <Avatar
                      name={record.helper?.displayName ?? 'Anonymous helper'}
                      seed={record.helper?.avatarSeed ?? record.id}
                      src={record.helper?.avatarUrl}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">
                        {record.helper?.displayName ?? 'Anonymous helper'}
                      </p>
                      <p className="truncate text-[11.5px] text-muted">
                        {record.message ?? (record.isAnonymous ? 'Chose to stay anonymous' : 'Sent help')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="money-tabular text-[13px] font-semibold">{formatMoney(record.amount, record.currency)}</p>
                      <p className="text-[10.5px] text-muted">{timeAgo(record.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-[22px] border border-line bg-white p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <Avatar name={bill.owner.displayName} seed={bill.owner.avatarSeed} src={bill.owner.avatarUrl} size={46} />
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold">{bill.owner.displayName}</p>
                <p className="truncate text-[12px] text-muted">@{bill.owner.username}</p>
              </div>
            </div>
            {bill.owner.bio && <p className="mt-3 text-[12.5px] leading-relaxed text-[#5C5862]">{bill.owner.bio}</p>}

            <div className="mt-4 space-y-2">
              {bill.viewer.isOwner ? (
                <>
                  <LinkButton to={`/bills/${bill.id}/edit`} block variant="soft" icon={<Pencil className="size-4" aria-hidden="true" />}>
                    Edit bill
                  </LinkButton>
                  <p className="text-center text-[11px] leading-relaxed text-[#736E66]">
                    {bill.viewer.canEdit
                      ? 'You can still edit while no help has arrived.'
                      : 'Amounts and recipients are locked once help has been received.'}
                  </p>
                </>
              ) : (
                <>
                  <Button
                    block
                    size="lg"
                    variant="help"
                    onClick={() => {
                      if (!user) {
                        navigate('/login');
                        return;
                      }
                      setHelpOpen(true);
                    }}
                    disabled={!bill.viewer.canHelp}
                    icon={<HeartHandshake className="size-[18px]" aria-hidden="true" />}
                  >
                    {bill.viewer.canHelp ? 'Help this person' : remaining === 0 ? 'Fully funded' : 'Not accepting help'}
                  </Button>
                  {user && bill.viewer.hasHelped && (
                    <p className="flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-[#0F7A52]">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      You already helped {formatMoney(bill.viewer.helpedAmount, bill.currency)}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="pass" size="sm" onClick={() => void share()} icon={<Share2 className="size-3.5" aria-hidden="true" />}>
                      Share
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-line"
                      onClick={() => (user ? setReportOpen(true) : navigate('/login'))}
                      icon={<Flag className="size-3.5" aria-hidden="true" />}
                    >
                      Report
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#FAF8F5] px-3 py-2.5">
              <Info className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
              <p className="text-[11px] leading-relaxed text-muted">
                Swiping or tapping Help never charges you. You confirm an exact amount, fee and total before any
                payment is created.
              </p>
            </div>
          </section>

          <section className="rounded-[22px] border border-line bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#736E66]">Bill facts</p>
            <dl className="mt-2.5 space-y-2 text-[12.5px]">
              <Row label="Category" value={cat.label} />
              <Row label="Currency" value={bill.currency} />
              <Row label="Helpers" value={`${bill.helperCount}`} icon={<Users className="size-3" aria-hidden="true" />} />
              <Row label="Due" value={formatDate(bill.dueDate)} />
              {due !== null && due >= 0 && due <= 30 && <Row label="Days left" value={`${due}`} />}
              <Row label="Status" value={statusPill.label} />
            </dl>
          </section>

          <Link
            to="/trust"
            className="flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-[12.5px] font-semibold text-[#57534E] transition hover:border-[#CFC9C0]"
          >
            <ShieldCheck className="size-4 text-brand-ink" aria-hidden="true" />
            How we keep this safe
          </Link>
        </aside>
      </div>

      <HelpSheet bill={bill} open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="bill"
        targetId={bill.id}
        targetLabel={bill.title}
      />
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="inline-flex items-center gap-1 truncate font-semibold">
        {icon}
        {value}
      </dd>
    </div>
  );
}

function statusTone(status: string, verification: string): { label: string; tone: 'brand' | 'mint' | 'coral' | 'amber' | 'neutral' } {
  if (verification === 'rejected') return { label: 'Not approved', tone: 'coral' };
  switch (status) {
    case 'active':
      return { label: 'Accepting help', tone: 'brand' };
    case 'fully_funded':
      return { label: 'Fully funded', tone: 'mint' };
    case 'pending_review':
      return { label: 'In review', tone: 'amber' };
    case 'suspended':
      return { label: 'Suspended', tone: 'coral' };
    case 'closed':
      return { label: 'Closed', tone: 'neutral' };
    default:
      return { label: status.replace('_', ' '), tone: 'neutral' };
  }
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1120px] px-4 pt-6 sm:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-[24px] border border-line bg-white">
            <Skeleton className="h-[240px] w-full rounded-none" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
      <div className="mt-8 flex items-center justify-center gap-2 text-[12px] text-muted">
        <Loader2 className={cn('size-4 animate-spin')} aria-hidden="true" />
        Loading bill…
      </div>
    </div>
  );
}

export const BillDetailExports = { Heart };
