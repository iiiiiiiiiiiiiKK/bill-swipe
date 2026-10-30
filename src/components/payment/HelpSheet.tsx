import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  CreditCard,
  Heart,
  Info,
  Loader2,
  Lock,
  PartyPopper,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { BillSummary, Payment } from '@shared/types';
import { api, ApiRequestError, newIdempotencyKey } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Button, LinkButton } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { formatMoney, parseMoneyInput, percent } from '@shared/money';
import { ProgressBar, Pill } from '@/components/ui/Primitives';
import { cn } from '@/lib/utils';
import { ReceiptArt } from '@/components/bill/ReceiptArt';

type Step = 'amount' | 'confirm' | 'processing' | 'success';

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];

export function HelpSheet({
  bill,
  open,
  superHelp = false,
  onClose,
}: {
  bill: BillSummary | null;
  open: boolean;
  superHelp?: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState<number>(1000);
  const [custom, setCustom] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [idemKey, setIdemKey] = useState<string>('');
  const [receiptTotal, setReceiptTotal] = useState<{ amount: number; fee: number; total: number } | null>(null);

  const remaining = bill ? Math.max(0, bill.targetAmount - bill.raisedAmount) : 0;

  useEffect(() => {
    if (!open) return;
    setStep('amount');
    setError(null);
    setPayment(null);
    setCustom('');
    setProcessing(false);
    setReceiptTotal(null);
    setIdemKey(newIdempotencyKey());
    setAnonymous(user?.anonymousByDefault ?? false);
    const suggested = Math.min(1000, Math.max(500, Math.round(remaining / 4 / 100) * 100));
    setAmount(suggested);
  }, [open, user?.anonymousByDefault, remaining]);

  const feeRate = 0;
  const effectiveAmount = useMemo(() => {
    const customValue = custom ? parseMoneyInput(custom) : null;
    const value = customValue ?? amount;
    return Math.min(Math.max(value, 100), Math.max(remaining, 100));
  }, [amount, custom, remaining]);
  const fee = Math.round((effectiveAmount * feeRate) / 10_000);
  const total = effectiveAmount + fee;

  if (!bill) return null;

  const canAffordMin = remaining >= 100;

  async function createIntent() {
    if (!bill) return;
    if (effectiveAmount < 100) {
      setError('The minimum help amount is 1.00.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const res = await api.post<{ payment: Payment; sandbox: boolean; clientSecret: string | null }>('/payments/intent', {
        billId: bill.id,
        amount: effectiveAmount,
        isAnonymous: anonymous,
        idempotencyKey: idemKey,
      });
      setPayment(res.payment);
      setReceiptTotal({ amount: res.payment.amount, fee: res.payment.fee, total: res.payment.amount + res.payment.fee });
      setStep('confirm');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not start the payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  async function settle() {
    if (!payment || !bill) return;
    setProcessing(true);
    setError(null);
    setStep('processing');
    try {
      const res = await api.post<{ payment: Payment; alreadySettled: boolean }>(`/payments/${payment.id}/sandbox/settle`, {});
      setPayment(res.payment);
      setStep('success');
      toast.success('Help confirmed', 'Your contribution is now part of this bill.');
    } catch (err) {
      setStep('confirm');
      setError(err instanceof ApiRequestError ? err.message : 'Payment could not be completed.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close payment panel"
            onClick={onClose}
            className="absolute inset-0 bg-[#191919]/45 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Help ${bill.owner.displayName}`}
            initial={{ y: '100%', opacity: 1 }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="relative w-full max-w-[480px] overflow-hidden rounded-t-[26px] bg-white shadow-lift sm:rounded-[26px]"
            style={{ maxHeight: '92dvh' }}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-1.5">
                {step === 'confirm' && (
                  <button
                    type="button"
                    onClick={() => setStep('amount')}
                    className="-ml-1 rounded-lg p-1.5 text-[#57534E] transition hover:bg-black/5"
                    aria-label="Back to amount"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </button>
                )}
                <p className="text-[14px] font-semibold">
                  {step === 'success' ? 'All done' : step === 'confirm' || step === 'processing' ? 'Confirm payment' : 'Choose an amount'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted transition hover:bg-black/5 hover:text-ink"
                aria-label="Close"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[calc(92dvh-112px)] overflow-y-auto overscroll-contain px-4 pb-5 pt-4">
              {step === 'amount' && (
                <>
                  <div className="flex items-center gap-3 rounded-2xl bg-[#FAF8F5] p-3">
                    <div className="size-12 shrink-0 overflow-hidden rounded-xl">
                      <ReceiptArt seed={bill.id} category={bill.category} amount={bill.targetAmount} currency={bill.currency} compact />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold leading-snug">{bill.title}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                        <Avatar name={bill.owner.displayName} seed={bill.owner.avatarSeed} size={16} />
                        {bill.owner.displayName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="money-tabular text-[15px] font-bold leading-none">{formatMoney(remaining)}</p>
                      <p className="mt-1 text-[10.5px] text-muted">still needed</p>
                    </div>
                  </div>

                  {superHelp && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2.5">
                      <Heart className="mt-0.5 size-3.5 shrink-0 text-brand-ink" aria-hidden="true" />
                      <p className="text-[12px] leading-relaxed text-brand-ink">
                        Super Help opens this panel first for people you want to prioritise. It still never pays
                        automatically.
                      </p>
                    </div>
                  )}

                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#736E66]">Quick amounts</p>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {QUICK_AMOUNTS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setAmount(Math.min(value, Math.max(remaining, 100)));
                            setCustom('');
                          }}
                          className={cn(
                            'rounded-xl border py-2.5 text-[14px] font-semibold transition',
                            !custom && effectiveAmount === Math.min(value, Math.max(remaining, 100))
                              ? 'border-brand bg-brand-soft text-brand-ink'
                              : 'border-line bg-white text-ink hover:border-[#CFC9C0]',
                          )}
                        >
                          {formatMoney(value)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3">
                    <label htmlFor="custom-amount" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#736E66]">
                      Custom amount
                    </label>
                    <div className="relative mt-1.5">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted">$</span>
                      <input
                        id="custom-amount"
                        inputMode="decimal"
                        value={custom}
                        onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder={(remaining / 100).toFixed(2)}
                        className="h-12 w-full rounded-xl border border-line bg-white pl-8 pr-3 text-[15px] font-semibold tabular-nums outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
                        aria-describedby="amount-hint"
                      />
                    </div>
                    <p id="amount-hint" className="mt-1.5 text-[11.5px] text-muted">
                      Between $1.00 and {formatMoney(Math.max(remaining, 100))}. Your kindness makes a difference.
                    </p>
                  </div>

                  <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={anonymous}
                      onChange={(e) => setAnonymous(e.target.checked)}
                      className="size-4 rounded border-[#CFC9C0] text-brand-ink focus:ring-brand"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">Help anonymously</span>
                      <span className="block text-[11.5px] text-muted">Your name stays hidden from the bill owner and feed.</span>
                    </span>
                  </label>

                  {error && (
                    <p role="alert" className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-[12.5px] font-medium text-[#C02444]">
                      {error}
                    </p>
                  )}

                  <div className="mt-4 rounded-xl bg-[#FAF8F5] px-3 py-2.5">
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="text-muted">You pay</span>
                      <span className="money-tabular font-semibold">{formatMoney(total)}</span>
                    </div>
                  </div>

                  <Button
                    block
                    size="lg"
                    className="mt-3"
                    onClick={() => void createIntent()}
                    disabled={processing || !canAffordMin || !!user === false}
                    trailing={processing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" aria-hidden="true" />}
                  >
                    {user ? 'Continue to confirmation' : 'Sign in to continue'}
                  </Button>
                  {!user && (
                    <LinkButton to="/login" block size="md" variant="soft" className="mt-2">
                      Sign in
                    </LinkButton>
                  )}
                  <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-[#736E66]">
                    <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    Nothing is charged yet. You will see the full breakdown on the next screen.
                  </p>
                </>
              )}

              {(step === 'confirm' || step === 'processing') && (
                <>
                  <div className="rounded-2xl border border-line p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#736E66]">You are helping</p>
                    <div className="mt-2 flex items-center gap-2.5">
                      <Avatar name={anonymous ? 'Anonymous helper' : user?.displayName ?? 'You'} seed={user?.avatarSeed} size={36} />
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold">{bill.owner.displayName}</p>
                        <p className="truncate text-[11.5px] text-muted">{bill.title}</p>
                      </div>
                    </div>
                  </div>

                  <dl className="mt-3 space-y-2 rounded-2xl bg-[#FAF8F5] p-3.5 text-[13px]">
                    <div className="flex items-center justify-between">
                      <dt className="text-[#5C5862]">Help amount</dt>
                      <dd className="money-tabular font-semibold">{formatMoney(receiptTotal?.amount ?? effectiveAmount)}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-[#5C5862]">Platform fee</dt>
                      <dd className="money-tabular font-semibold">
                        {(receiptTotal?.fee ?? fee) === 0 ? 'Free' : formatMoney(receiptTotal?.fee ?? fee)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between border-t border-line pt-2">
                      <dt className="font-semibold">Total</dt>
                      <dd className="money-tabular text-[17px] font-bold">{formatMoney(receiptTotal?.total ?? total)}</dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-dashed border-[#E4B33D] bg-amber-soft px-3 py-2.5">
                    <ShieldCheck className="size-4 shrink-0 text-[#9A6600]" aria-hidden="true" />
                    <p className="text-[11.5px] leading-relaxed text-[#7A5200]">
                      <strong className="font-semibold">Sandbox mode</strong> — this deployment simulates settlement. No
                      card is charged, no funds move.
                    </p>
                  </div>

                  <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5">
                    <CreditCard className="size-4 shrink-0 text-[#57534E]" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold">Sandbox wallet</p>
                      <p className="text-[11px] text-muted">Simulated · settles server-side</p>
                    </div>
                    <Check className="size-4 text-mint" aria-hidden="true" />
                  </div>

                  <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-[#736E66]">
                    <p className="flex items-start gap-1.5">
                      <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                      The server verifies every payment before the bill total changes. Double-submits are ignored.
                    </p>
                    <p>
                      Refunds for this build are handled by the moderation team. Bills that received help cannot be
                      edited, closed, or re-pointed by the owner.
                    </p>
                  </div>

                  {error && (
                    <p role="alert" className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-[12.5px] font-medium text-[#C02444]">
                      {error}
                    </p>
                  )}

                  <Button
                    block
                    size="lg"
                    className="mt-4"
                    variant="help"
                    onClick={() => void settle()}
                    disabled={processing}
                    trailing={processing ? <Loader2 className="size-4 animate-spin" /> : undefined}
                  >
                    {processing ? 'Processing…' : `Confirm ${formatMoney(receiptTotal?.total ?? total)}`}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStep('amount')}
                    className="mt-2 w-full py-1.5 text-[12.5px] font-semibold text-muted transition hover:text-ink"
                    disabled={processing}
                  >
                    Change amount
                  </button>
                </>
              )}

              {step === 'processing' && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-t-[26px] bg-white/85 backdrop-blur-sm">
                  <Loader2 className="size-7 animate-spin text-brand-ink" aria-hidden="true" />
                  <p className="text-[13px] font-semibold">Confirming with the server…</p>
                </div>
              )}

              {step === 'success' && (
                <div className="py-3 text-center">
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 16 }}
                    className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-mint-soft"
                  >
                    <PartyPopper className="size-7 text-[#0F7A52]" aria-hidden="true" />
                  </motion.div>
                  <h2 className="mt-4 text-[20px] font-semibold tracking-[-0.02em]">You just made someone&apos;s day. ❤️</h2>
                  <p className="mx-auto mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-muted">
                    {formatMoney(receiptTotal?.amount ?? effectiveAmount)} landed on &quot;{bill.title}&quot;. Both of you
                    will see it in notifications.
                  </p>

                  <div className="mt-4 rounded-2xl border border-line p-3.5 text-left">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-[#0F7A52]">
                        {percent(bill.raisedAmount + (receiptTotal?.amount ?? 0), bill.targetAmount)}% funded
                      </span>
                      <span className="text-muted">{bill.helperCount + 1} helpers</span>
                    </div>
                    <ProgressBar value={percent(bill.raisedAmount + (receiptTotal?.amount ?? 0), bill.targetAmount)} tone="mint" className="mt-2" />
                    <p className="mt-2 text-[11.5px] text-muted">
                      {Math.max(0, bill.targetAmount - bill.raisedAmount - (receiptTotal?.amount ?? 0)) > 0
                        ? `${formatMoney(Math.max(0, bill.targetAmount - bill.raisedAmount - (receiptTotal?.amount ?? 0)))} still needed.`
                        : 'This bill is now fully funded.'}
                    </p>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <LinkButton to="/activity" size="md" className="flex-1" variant="soft">
                      View activity
                    </LinkButton>
                    <Button size="md" className="flex-1" onClick={onClose}>
                      Keep swiping
                    </Button>
                  </div>
                  {payment && (
                    <p className="mt-3 flex items-center justify-center gap-1 text-[10.5px] text-[#736E66]">
                      <BadgeCheck className="size-3" aria-hidden="true" />
                      Payment {payment.id} · sandbox reference
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                    <Pill tone="amber">Sandbox</Pill>
                    <Pill tone="neutral">{anonymous ? 'Anonymous' : 'Named'}</Pill>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
