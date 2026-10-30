import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Flag,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import type {
  AdminBillRow,
  AdminOverview,
  AdminPaymentRow,
  AdminUserRow,
  AuditLog,
  MeProfile,
  Report,
} from '@shared/types';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Pill, Skeleton } from '@/components/ui/Primitives';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { formatMoney } from '@shared/money';
import { cn, formatDate, timeAgo } from '@/lib/utils';

const TABS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/bills', label: 'Bills', icon: ClipboardList },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/reports', label: 'Reports', icon: Flag },
  { to: '/admin/audit', label: 'Audit log', icon: ShieldCheck },
];

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login', { state: { from: '/admin' } });
      return;
    }
    if (user.role !== 'admin') {
      navigate('/discover', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-[13px] text-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Checking access…
      </div>
    );
  }

  if (user.role !== 'admin') return null;

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-12 pt-5 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Admin
          </p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.03em]">Operations dashboard</h1>
        </div>
        <Link to="/discover" className="text-[12.5px] font-semibold text-muted hover:text-ink">
          ← Back to app
        </Link>
      </div>

      <nav className="no-scrollbar mt-4 flex gap-1 overflow-x-auto border-b border-line pb-0">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12.5px] font-semibold transition',
                isActive
                  ? 'border-brand text-brand-ink'
                  : 'border-transparent text-[#57534E] hover:border-[#DED9D2] hover:text-ink',
              )
            }
          >
            <tab.icon className="size-3.5" aria-hidden="true" />
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="pt-5">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="bills" element={<BillsPanel />} />
          <Route path="users" element={<UsersPanel adminId={user.id} />} />
          <Route path="payments" element={<PaymentsPanel />} />
          <Route path="reports" element={<ReportsPanel />} />
          <Route path="audit" element={<AuditPanel />} />
        </Routes>
      </div>
    </div>
  );
}

function Overview() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AdminOverview>('/admin/overview')
      .then(setData)
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : 'Failed to load'));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <GridSkeleton count={8} />;

  const cards = [
    { label: 'Users', value: data.users, icon: Users, tone: 'brand' as const },
    { label: 'Bills total', value: data.bills, icon: ClipboardList, tone: 'neutral' as const },
    { label: 'Awaiting review', value: data.pendingReview, icon: ShieldAlert, tone: 'amber' as const },
    { label: 'Live bills', value: data.activeBills, icon: BadgeCheck, tone: 'mint' as const },
    { label: 'Fully funded', value: data.fullyFunded, icon: CheckCircle2, tone: 'mint' as const },
    { label: 'Succeeded volume', value: formatMoney(data.amountSucceeded), icon: CreditCard, tone: 'brand' as const },
    { label: 'Open reports', value: data.openReports, icon: Flag, tone: 'coral' as const },
    { label: 'Payment anomalies', value: data.paymentAnomalies, icon: ShieldAlert, tone: 'coral' as const },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-line bg-white p-3.5">
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-xl',
                card.tone === 'brand'
                  ? 'bg-brand-soft text-brand-ink'
                  : card.tone === 'mint'
                    ? 'bg-mint-soft text-[#0F7A52]'
                    : card.tone === 'coral'
                      ? 'bg-coral-soft text-[#C02444]'
                      : card.tone === 'amber'
                        ? 'bg-amber-soft text-[#9A6600]'
                        : 'bg-[#F3F1EE] text-[#57534E]',
              )}
            >
              <card.icon className="size-4" aria-hidden="true" />
            </span>
            <p className="money-tabular mt-2.5 text-[19px] font-bold leading-none">{card.value}</p>
            <p className="mt-1 text-[11px] text-muted">{card.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-2xl border border-line bg-white px-4 py-3 text-[12px] leading-relaxed text-muted">
        {data.demoBills} demo bills are seeded in this environment and are labelled in every surface. All volumes are
        computed from the live database — nothing here is hardcoded.
      </p>
    </div>
  );
}

function BillsPanel() {
  const toast = useToast();
  const [bills, setBills] = useState<AdminBillRow[] | null>(null);
  const [status, setStatus] = useState('pending_review');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ bills: AdminBillRow[] }>(
        `/admin/bills?status=${encodeURIComponent(status)}&q=${encodeURIComponent(query)}`,
      );
      setBills(res.bills);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Failed to load bills');
    }
  }, [status, query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, action: string, note = '') {
    setBusy(id);
    try {
      await api.post(`/admin/bills/${id}/review`, { action, note });
      toast.success(`Bill ${action}d`);
      await load();
    } catch (err) {
      toast.error('Action failed', err instanceof ApiRequestError ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#736E66]" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, email or username"
            className="h-9 w-full rounded-xl border border-line bg-white pl-8 pr-3 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-xl border border-line bg-white px-2.5 text-[12.5px] font-semibold outline-none"
          aria-label="Filter by status"
        >
          {['pending_review', 'active', 'fully_funded', 'rejected', 'suspended', 'closed', 'all'].map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <Button size="sm" variant="pass" onClick={() => void load()} icon={<RefreshCw className="size-3.5" aria-hidden="true" />}>
          Refresh
        </Button>
      </div>

      {error && <ErrorBox message={error} />}
      {!bills && <GridSkeleton count={3} />}

      <ul className="mt-3 space-y-2">
        {bills?.map((bill) => (
          <li key={bill.id} className="rounded-2xl border border-line bg-white p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link to={`/bills/${bill.id}`} className="truncate text-[13.5px] font-semibold hover:text-brand-ink">
                    {bill.title}
                  </Link>
                  {bill.isDemo && <Pill tone="neutral">Demo</Pill>}
                  <Pill tone={bill.status === 'pending_review' ? 'amber' : bill.status === 'active' ? 'brand' : 'neutral'}>
                    {bill.status.replace('_', ' ')}
                  </Pill>
                  {bill.reportCount > 0 && <Pill tone="coral">{bill.reportCount} reports</Pill>}
                </div>
                <p className="mt-1 text-[11.5px] text-muted">
                  {bill.owner.displayName} · {bill.ownerEmail} · {timeAgo(bill.createdAt)} ·{' '}
                  {formatMoney(bill.targetAmount, bill.currency)} · {bill.helperCount} helpers
                </p>
                {bill.riskFlags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {bill.riskFlags.map((flag) => (
                      <span key={flag} className="rounded bg-[#FFF4E0] px-1.5 py-0.5 text-[10px] font-semibold text-[#9A6600]">
                        {flag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {bill.receiptPresent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="border border-line text-[11.5px]"
                    onClick={() => window.open(`/api/admin/receipts/${bill.id}`, '_blank', 'noopener')}
                  >
                    Receipt
                  </Button>
                )}
                <Button size="sm" variant="help" disabled={busy === bill.id} onClick={() => void review(bill.id, 'approve', 'Looks good.')}>
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy === bill.id}
                  onClick={() => {
                    const note = window.prompt('Reason for rejection (shown to the owner)') ?? '';
                    if (note) void review(bill.id, 'reject', note);
                  }}
                >
                  <XCircle className="size-3.5" aria-hidden="true" />
                  Reject
                </Button>
                <Button size="sm" variant="ghost" className="border border-line" disabled={busy === bill.id} onClick={() => void review(bill.id, 'suspend')}>
                  Pause
                </Button>
                <Button size="sm" variant="ghost" className="border border-line" disabled={busy === bill.id} onClick={() => void review(bill.id, 'reopen')}>
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {bills?.length === 0 && <p className="mt-4 rounded-2xl bg-white py-10 text-center text-[13px] text-muted ring-1 ring-line">No bills match this filter.</p>}
    </div>
  );
}

function UsersPanel({ adminId }: { adminId: string }) {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const res = await api.get<{ users: AdminUserRow[] }>(`/admin/users?q=${encodeURIComponent(query)}`);
    setUsers(res.users);
  }, [query]);

  useEffect(() => {
    void load().catch(() => setUsers([]));
  }, [load]);

  async function setStatus(id: string, status: string) {
    const reason = status === 'active' ? 'Restored by admin' : window.prompt(`Reason for ${status}:`) ?? '';
    if (status !== 'active' && !reason) return;
    try {
      await api.post(`/admin/users/${id}/status`, { status, reason });
      toast.success(`User ${status}`);
      await load();
    } catch (err) {
      toast.error('Action failed', err instanceof ApiRequestError ? err.message : undefined);
    }
  }

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#736E66]" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email, username or name"
          className="h-9 w-full rounded-xl border border-line bg-white pl-8 pr-3 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
      </div>

      {!users && <GridSkeleton count={3} />}
      <ul className="mt-3 space-y-2">
        {users?.map((person) => (
          <li key={person.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3">
            <Avatar name={person.displayName} seed={person.avatarSeed} src={person.avatarUrl} size={34} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
                {person.displayName}
                {person.role === 'admin' && <Pill tone="brand">admin</Pill>}
                {person.isDemo && <Pill tone="neutral">demo</Pill>}
                <Pill tone={person.accountStatus === 'active' ? 'mint' : person.accountStatus === 'banned' ? 'coral' : 'amber'}>
                  {person.accountStatus}
                </Pill>
              </p>
              <p className="truncate text-[11.5px] text-muted">
                {person.email} · {person.billsPosted} bills · {formatMoney(person.helpedAmount)} helped · joined{' '}
                {formatDate(person.createdAt)}
              </p>
            </div>
            {person.id !== adminId && (
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" className="border border-line text-[11.5px]" onClick={() => void setStatus(person.id, 'restricted')}>
                  Restrict
                </Button>
                {person.accountStatus === 'banned' ? (
                  <Button size="sm" variant="help" onClick={() => void setStatus(person.id, 'active')}>
                    Restore
                  </Button>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => void setStatus(person.id, 'banned')}>
                    <Ban className="size-3.5" aria-hidden="true" />
                    Ban
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {users?.length === 0 && <p className="mt-4 rounded-2xl bg-white py-10 text-center text-[13px] text-muted ring-1 ring-line">No users found.</p>}
    </div>
  );
}

function PaymentsPanel() {
  const toast = useToast();
  const [payments, setPayments] = useState<AdminPaymentRow[] | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<{ payments: AdminPaymentRow[] }>('/admin/payments');
    setPayments(res.payments);
  }, []);

  useEffect(() => {
    void load().catch(() => setPayments([]));
  }, [load]);

  async function refund(id: string) {
    const note = window.prompt('Refund note (visible to the payer):', 'Refunded after review');
    if (!note) return;
    try {
      await api.post(`/admin/payments/${id}/refund`, { note });
      toast.success('Refund recorded');
      await load();
    } catch (err) {
      toast.error('Refund failed', err instanceof ApiRequestError ? err.message : undefined);
    }
  }

  if (!payments) return <GridSkeleton count={4} />;

  return (
    <ul className="space-y-2">
      {payments.map((payment) => (
        <li key={payment.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold">
              <Link to={`/bills/${payment.billId}`} className="truncate hover:text-brand-ink">
                {payment.billTitle}
              </Link>
              <Pill
                tone={
                  payment.status === 'succeeded'
                    ? 'mint'
                    : payment.status === 'failed' || payment.status === 'disputed'
                      ? 'coral'
                      : payment.status === 'refunded'
                        ? 'neutral'
                        : 'amber'
                }
              >
                {payment.status}
              </Pill>
              {payment.anomaly && <Pill tone="coral">{payment.anomaly}</Pill>}
            </p>
            <p className="truncate text-[11px] text-muted">
              {payment.payer} · {payment.provider} · {timeAgo(payment.createdAt)} · {payment.id}
            </p>
          </div>
          <p className="money-tabular text-[13px] font-bold">{formatMoney(payment.amount)}</p>
          {payment.status === 'succeeded' && (
            <Button size="sm" variant="ghost" className="border border-line text-[11.5px]" onClick={() => void refund(payment.id)}>
              Refund
            </Button>
          )}
        </li>
      ))}
      {payments.length === 0 && <p className="rounded-2xl bg-white py-10 text-center text-[13px] text-muted ring-1 ring-line">No payments yet.</p>}
    </ul>
  );
}

function ReportsPanel() {
  const toast = useToast();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [dialog, setDialog] = useState<Report | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<{ reports: Report[] }>('/admin/reports');
    setReports(res.reports);
  }, []);

  useEffect(() => {
    void load().catch(() => setReports([]));
  }, [load]);

  async function resolve(id: string, status: 'resolved' | 'dismissed') {
    const resolution = window.prompt('Resolution note:') ?? 'Handled by admin';
    try {
      await api.post(`/admin/reports/${id}/resolve`, { status, resolution });
      toast.success(`Report ${status}`);
      await load();
    } catch (err) {
      toast.error('Failed', err instanceof ApiRequestError ? err.message : undefined);
    }
  }

  if (!reports) return <GridSkeleton count={3} />;

  return (
    <>
      <ul className="space-y-2">
        {reports.map((report) => (
          <li key={report.id} className="rounded-2xl border border-line bg-white p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold">
                  <Flag className="size-3.5 text-[#C02444]" aria-hidden="true" />
                  {report.reason}
                  <Pill tone={report.status === 'open' ? 'amber' : report.status === 'resolved' ? 'mint' : 'neutral'}>
                    {report.status}
                  </Pill>
                </p>
                <p className="mt-1 text-[11.5px] text-muted">
                  {report.targetType}: {report.targetLabel} · reported by {report.reporter} · {timeAgo(report.createdAt)}
                </p>
                {report.details && <p className="mt-1 text-[12px] leading-relaxed text-[#3A3740]">{report.details}</p>}
              </div>
              {report.status !== 'resolved' && report.status !== 'dismissed' && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="help" onClick={() => void resolve(report.id, 'resolved')}>
                    Resolve
                  </Button>
                  <Button size="sm" variant="ghost" className="border border-line" onClick={() => void resolve(report.id, 'dismissed')}>
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
        {reports.length === 0 && <p className="rounded-2xl bg-white py-10 text-center text-[13px] text-muted ring-1 ring-line">No reports. 🎉</p>}
      </ul>
      {dialog && (
        <ReportDialog open onClose={() => setDialog(null)} targetType="bill" targetId={dialog.targetId} targetLabel={dialog.targetLabel} />
      )}
    </>
  );
}

function AuditPanel() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);

  useEffect(() => {
    api
      .get<{ logs: AuditLog[] }>('/admin/audit')
      .then((res) => setLogs(res.logs))
      .catch(() => setLogs([]));
  }, []);

  if (!logs) return <GridSkeleton count={4} />;

  return (
    <ul className="space-y-1.5">
      {logs.map((log) => (
        <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2">
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold">{log.action}</p>
            <p className="truncate text-[11px] text-muted">
              {log.adminName} · {log.targetType} {log.targetId} · {timeAgo(log.createdAt)}
            </p>
          </div>
          <code className="max-w-[45%] truncate rounded bg-[#FAF8F5] px-1.5 py-0.5 text-[10.5px] text-[#57534E]">
            {JSON.stringify(log.metadata)}
          </code>
        </li>
      ))}
      {logs.length === 0 && <p className="rounded-2xl bg-white py-10 text-center text-[13px] text-muted ring-1 ring-line">No admin actions yet.</p>}
    </ul>
  );
}

function GridSkeleton({ count }: { count: number }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <p className="mt-3 rounded-2xl bg-coral-soft px-4 py-3 text-[12.5px] text-[#C02444]">{message}</p>;
}

export type { MeProfile };
