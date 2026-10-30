import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  Eye,
  FileText,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import type { BillDetail } from '@shared/types';
import { BILL_CATEGORIES, categoryOf } from '@shared/categories';
import { formatMoney, parseMoneyInput, percent } from '@shared/money';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Button, LinkButton } from '@/components/ui/Button';
import { Field } from './Auth';
import { FieldError, Pill, ProgressBar } from '@/components/ui/Primitives';
import { ReceiptArt } from '@/components/bill/ReceiptArt';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS = ['Category', 'Details', 'Receipt', 'Story', 'Review'] as const;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export default function NewBill({ edit = false }: { edit?: boolean }) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState<string>('groceries');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paid, setPaid] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [handle, setHandle] = useState('');
  const [story, setStory] = useState('');
  const [file, setFile] = useState<{ name: string; size: number; type: string; preview: string | null } | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loadingExisting, setLoadingExisting] = useState(edit);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate('/login', { state: { from: window.location.pathname } });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!edit || !id) return;
    let cancelled = false;
    setLoadingExisting(true);
    api
      .get<{ bill: BillDetail }>(`/bills/${id}`)
      .then(({ bill }) => {
        if (cancelled) return;
        if (!bill.viewer.canEdit) {
          toast.error('This bill can no longer be edited', 'Amounts lock once help has been received.');
          navigate(`/bills/${id}`, { replace: true });
          return;
        }
        setCategory(bill.category);
        setTitle(bill.title);
        setAmount((bill.targetAmount / 100).toFixed(2));
        setCurrency(bill.currency);
        setPaid(bill.paidAmount ? (bill.paidAmount / 100).toFixed(2) : '');
        setDueDate(bill.dueDate ? bill.dueDate.slice(0, 10) : '');
        setStory(bill.story);
      })
      .catch(() => toast.error('Could not load this bill'))
      .finally(() => !cancelled && setLoadingExisting(false));
    return () => {
      cancelled = true;
    };
  }, [edit, id, navigate, toast]);

  const amountMinor = parseMoneyInput(amount) ?? 0;
  const paidMinor = parseMoneyInput(paid) ?? 0;
  const remainingMinor = Math.max(0, amountMinor - paidMinor);
  const storyWords = story.trim().split(/\s+/).filter(Boolean).length;

  const stepValid = useMemo(() => {
    if (step === 1) return !!category;
    if (step === 2) return title.trim().length >= 6 && amountMinor >= 100 && amountMinor <= 5_000_000 && paidMinor <= amountMinor;
    if (step === 3) return true; // receipt optional at this stage, but recommended
    if (step === 4) return story.trim().length >= 60;
    return true;
  }, [step, category, title, amountMinor, paidMinor, story]);

  const onFile = useCallback(
    async (selected: File | null) => {
      if (!selected) return;
      if (!/^image\/(jpeg|png|webp|gif)$/.test(selected.type) && selected.type !== 'application/pdf') {
        toast.error('Unsupported file', 'Use JPG, PNG, WEBP or PDF.');
        return;
      }
      if (selected.size > MAX_FILE_BYTES) {
        toast.error('File too large', 'Receipts must be under 8 MB.');
        return;
      }
      const preview = selected.type === 'application/pdf' ? null : URL.createObjectURL(selected);
      setFile({ name: selected.name, size: selected.size, type: selected.type, preview });
      setBusy(true);
      try {
        const base64 = await toBase64(selected);
        const res = await api.post<{ receipt: { id: string } }>('/receipts', {
          fileName: selected.name,
          mimeType: selected.type,
          data: base64,
        });
        setReceiptId(res.receipt.id);
        toast.success('Receipt uploaded', 'The original stays private.');
      } catch (err) {
        setFile(null);
        setReceiptId(null);
        toast.error('Upload failed', err instanceof ApiRequestError ? err.message : 'Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  async function submit() {
    setBusy(true);
    setError(null);
    setFields({});
    const payload = {
      title: title.trim(),
      description: story.trim(),
      category,
      targetAmount: amountMinor,
      currency,
      paidAmount: paidMinor,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      settlementHandle: handle.trim() || undefined,
      receiptId,
      resubmit: true,
    };
    try {
      if (edit && id) {
        await api.patch(`/bills/${id}`, payload);
        toast.success('Bill updated', 'It is back in the review queue.');
        navigate(`/bills/${id}`);
      } else {
        const res = await api.post<{ bill: { id: string } }>('/bills', payload);
        toast.success('Bill submitted', 'A moderator will review it shortly.');
        navigate(`/bills/${res.bill.id}`);
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else {
        setError('Could not submit the bill. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (loadingExisting || authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-[13px] text-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-12 pt-5 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (step === 1 ? navigate(-1) : setStep((s) => (s - 1) as Step))}
          className="inline-flex items-center gap-1.5 rounded-xl px-1 py-1 text-[13px] font-semibold text-[#57534E] transition hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {step === 1 ? 'Cancel' : 'Back'}
        </button>
        <Pill tone="neutral">
          Step {step} of 5
        </Pill>
      </div>

      <h1 className="mt-4 text-[26px] font-semibold leading-tight tracking-[-0.03em]">
        {edit ? 'Edit your bill' : 'Post a bill'}
      </h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
        Specific beats dramatic. Tell people exactly what the money covers and upload the document that shows it.
      </p>

      <ol className="mt-5 flex items-center gap-1.5" aria-label="Progress">
        {STEPS.map((label, i) => {
          const index = (i + 1) as Step;
          const done = step > index;
          const active = step === index;
          return (
            <li key={label} className="flex flex-1 flex-col gap-1.5">
              <span
                className={cn(
                  'h-1 rounded-full transition-colors',
                  done ? 'bg-mint' : active ? 'bg-brand' : 'bg-[#E8E4DE]',
                )}
              />
              <span
                className={cn(
                  'hidden text-[10.5px] font-semibold sm:block',
                  active ? 'text-ink' : done ? 'text-[#0F7A52]' : 'text-[#7C776F]',
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            {step === 1 && (
              <section>
                <h2 className="text-[16px] font-semibold">What kind of bill is it?</h2>
                <p className="mt-1 text-[12.5px] text-muted">Pick the closest match — it helps people find your story.</p>
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {BILL_CATEGORIES.map((item) => {
                    const active = category === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCategory(item.id)}
                        className={cn(
                          'relative flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition',
                          active ? 'border-brand bg-brand-soft/70 shadow-soft' : 'border-line bg-white hover:border-[#CFC9C0]',
                        )}
                        aria-pressed={active}
                      >
                        {active && (
                          <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-brand text-white">
                            <Check className="size-2.5" strokeWidth={3.5} aria-hidden="true" />
                          </span>
                        )}
                        <span className="flex size-8 items-center justify-center rounded-xl" style={{ background: item.tint, color: item.ink }}>
                          <FileText className="size-4" aria-hidden="true" />
                        </span>
                        <span className="text-[12.5px] font-semibold leading-tight">{item.short}</span>
                        <span className="text-[10.5px] leading-snug text-muted">{item.blurb}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-[16px] font-semibold">The basics</h2>
                  <p className="mt-1 text-[12.5px] text-muted">Be concrete: what is the bill for, how much, and by when?</p>
                </div>
                <Field
                  id="bill-title"
                  label="Bill title"
                  value={title}
                  onChange={setTitle}
                  placeholder="Groceries for the week until my first paycheck"
                  error={fields.title}
                  hint={`${title.length}/90 characters`}
                  required
                />
                <div className="grid gap-3 sm:grid-cols-[1fr_112px]">
                  <div>
                    <label htmlFor="bill-amount" className="mb-1.5 block text-[12px] font-semibold text-[#57534E]">
                      Amount needed <span className="text-[#C02444]">*</span>
                    </label>
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-xl border bg-white px-3 focus-within:ring-2',
                        fields.targetAmount ? 'border-[#F3B5C3]' : 'border-line focus-within:border-brand focus-within:ring-brand/15',
                      )}
                    >
                      <span className="text-[15px] font-semibold text-muted">$</span>
                      <input
                        id="bill-amount"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="186.50"
                        className="money-tabular h-11 w-full bg-transparent text-[16px] font-semibold outline-none placeholder:font-normal placeholder:text-[#7C776F]"
                      />
                    </div>
                    <FieldError message={fields.targetAmount} />
                  </div>
                  <div>
                    <label htmlFor="bill-currency" className="mb-1.5 block text-[12px] font-semibold text-[#57534E]">
                      Currency
                    </label>
                    <select
                      id="bill-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="h-11 w-full rounded-xl border border-line bg-white px-2.5 text-[13.5px] font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                    >
                      {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id="bill-paid"
                    label="Already paid (optional)"
                    icon={<span className="text-[13px] font-semibold">$</span>}
                    inputMode="decimal"
                    value={paid}
                    onChange={(v) => setPaid(v.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    hint="Money you already put toward this bill."
                  />
                  <div>
                    <label htmlFor="bill-due" className="mb-1.5 block text-[12px] font-semibold text-[#57534E]">
                      Due date (optional)
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
                      <CalendarDays className="size-4 text-[#736E66]" aria-hidden="true" />
                      <input
                        id="bill-due"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="h-11 w-full bg-transparent text-[13.5px] outline-none"
                      />
                    </div>
                  </div>
                </div>
                <Field
                  id="bill-handle"
                  label="Where should help go? (optional)"
                  value={handle}
                  onChange={setHandle}
                  placeholder="@handle, bank reference, or leave blank"
                  hint="Shown only to moderators. Never collect card numbers here."
                />

                {amountMinor > 0 && (
                  <div className="rounded-2xl bg-[#FAF8F5] p-3.5">
                    <div className="flex items-baseline justify-between text-[12.5px]">
                      <span className="text-muted">Still needed</span>
                      <span className="money-tabular text-[17px] font-bold">{formatMoney(remainingMinor, currency)}</span>
                    </div>
                    <ProgressBar value={percent(paidMinor, amountMinor)} tone="mint" className="mt-2 h-1.5" />
                  </div>
                )}
              </section>
            )}

            {step === 3 && (
              <section>
                <h2 className="text-[16px] font-semibold">Upload the bill</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  A screenshot or photo of the actual bill. JPG, PNG, WEBP or PDF up to 8 MB.
                </p>

                <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-dashed border-[#E4B33D] bg-amber-soft px-3.5 py-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#9A6600]" aria-hidden="true" />
                  <p className="text-[11.5px] leading-relaxed text-[#7A5200]">
                    <strong className="font-semibold">Cover up sensitive details first.</strong> Blur or crop ID numbers,
                    card numbers, full home addresses, and medical specifics. Originals are visible only to moderators —
                    but never upload what you would not want a stranger to see by mistake.
                  </p>
                </div>

                <label
                  htmlFor="receipt-file"
                  className={cn(
                    'mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-9 text-center transition',
                    file ? 'border-mint/50 bg-mint-soft/40' : 'border-[#DED9D2] bg-white hover:border-brand/50 hover:bg-brand-soft/30',
                  )}
                >
                  <input
                    id="receipt-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    className="sr-only"
                    onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                  />
                  {busy ? (
                    <>
                      <Loader2 className="size-7 animate-spin text-brand-ink" aria-hidden="true" />
                      <span className="mt-2.5 text-[13px] font-semibold">Uploading…</span>
                    </>
                  ) : file ? (
                    <>
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-mint-soft">
                        <BadgeCheck className="size-5 text-[#0F7A52]" aria-hidden="true" />
                      </span>
                      <span className="mt-2.5 text-[13px] font-semibold">{file.name}</span>
                      <span className="mt-0.5 text-[11.5px] text-muted">
                        {(file.size / 1024).toFixed(0)} KB · {receiptId ? 'stored privately' : 'not saved yet'}
                      </span>
                      <span className="mt-2 text-[11.5px] font-semibold text-brand-ink">Replace file</span>
                    </>
                  ) : (
                    <>
                      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft">
                        <Upload className="size-5 text-brand-ink" aria-hidden="true" />
                      </span>
                      <span className="mt-3 text-[13.5px] font-semibold">Tap to choose a file</span>
                      <span className="mt-1 text-[11.5px] text-muted">or drag it in on desktop</span>
                    </>
                  )}
                </label>

                {file?.preview && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-line">
                    <img src={file.preview} alt="Receipt preview" className="max-h-64 w-full object-contain bg-[#FAF8F5]" />
                  </div>
                )}

                <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-[#736E66]">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  You can submit without a receipt, but bills with a clear document are approved far more often.
                </p>
              </section>
            )}

            {step === 4 && (
              <section>
                <h2 className="text-[16px] font-semibold">Tell your story</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  People connect with people, not just numbers. What happened, why you need help, and how the money
                  will be used.
                </p>
                <textarea
                  value={story}
                  onChange={(e) => setStory(e.target.value.slice(0, 2000))}
                  rows={10}
                  aria-describedby="story-hint"
                  className="mt-3 w-full resize-y rounded-2xl border border-line bg-white px-3.5 py-3 text-[14px] leading-relaxed outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
                  placeholder="I just started a new job, but my first paycheck won't arrive until next week. Between rent and bus fare there is nothing left for food…"
                />
                <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
                  <span id="story-hint" className={storyWords < 20 ? 'text-[#A96A00]' : 'text-[#0F7A52]'}>
                    {storyWords} words · {story.length}/2000 characters
                  </span>
                  <span className="text-[#736E66]">Minimum 60 characters</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    { q: 'What happened?', body: 'One or two sentences of context.' },
                    { q: 'Why this amount?', body: 'Show how the total adds up.' },
                    { q: 'How will it help?', body: 'What changes once it is covered.' },
                  ].map((tip) => (
                    <div key={tip.q} className="rounded-xl border border-line bg-white p-2.5">
                      <p className="text-[11.5px] font-semibold">{tip.q}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted">{tip.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {step === 5 && (
              <section>
                <h2 className="text-[16px] font-semibold">Review before submitting</h2>
                <p className="mt-1 text-[12.5px] text-muted">
                  A moderator reviews every bill before it appears in Discover.
                </p>

                <div className="mt-3 overflow-hidden rounded-[22px] border border-line bg-white">
                  <div className="relative h-32">
                    <ReceiptArt seed={`preview-${title}`} category={category} amount={amountMinor} currency={currency} compact />
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider"
                        style={{ background: categoryOf(category).tint, color: categoryOf(category).ink }}
                      >
                        {categoryOf(category).short}
                      </span>
                      <Pill tone="amber">Pending review</Pill>
                      {receiptId ? <Pill tone="mint">Receipt attached</Pill> : <Pill tone="neutral">No receipt</Pill>}
                    </div>
                    <h3 className="mt-2 text-[16px] font-semibold leading-snug">{title || 'Untitled bill'}</h3>
                    <p className="mt-1 line-clamp-4 whitespace-pre-line text-[13px] leading-relaxed text-[#5C5862]">{story}</p>
                    <div className="mt-3 flex items-baseline justify-between border-t border-line pt-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#736E66]">Asking for</span>
                      <span className="money-tabular text-[19px] font-bold">{formatMoney(remainingMinor, currency)}</span>
                    </div>
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {[
                    'You can edit this bill until it receives its first payment.',
                    'Once help arrives, the amount and recipient are locked.',
                    'You can post updates so helpers see how it is going.',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2 text-[12px] leading-relaxed text-[#5C5862]">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-mint" aria-hidden="true" />
                      {line}
                    </li>
                  ))}
                </ul>

                {error && (
                  <p role="alert" className="mt-3 rounded-xl bg-coral-soft px-3 py-2.5 text-[12.5px] font-medium text-[#C02444]">
                    {error}
                  </p>
                )}
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center gap-2.5">
        {step > 1 && (
          <Button variant="pass" size="lg" onClick={() => setStep((s) => (s - 1) as Step)}>
            Back
          </Button>
        )}
        {step < 5 ? (
          <Button
            size="lg"
            className="flex-1"
            disabled={!stepValid}
            onClick={() => setStep((s) => (s + 1) as Step)}
            trailing={<ArrowRight className="size-4" aria-hidden="true" />}
          >
            Continue
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1"
            onClick={() => void submit()}
            disabled={busy}
            trailing={busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" aria-hidden="true" />}
          >
            {edit ? 'Save changes' : 'Submit for review'}
          </Button>
        )}
      </div>

      {step === 3 && !receiptId && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#FAF8F5] px-3 py-2.5 text-[12px]">
          <span className="flex items-center gap-1.5 text-muted">
            <ImagePlus className="size-3.5" aria-hidden="true" />
            Skip without a receipt?
          </span>
          <button type="button" onClick={() => setStep(4)} className="font-semibold text-brand-ink">
            Continue anyway
          </button>
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-[#736E66]">
        <Eye className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        Never publish ID numbers, card numbers, full addresses, or medical records. Public pages show a redacted
        preview only.
      </p>

      <div className="mt-4 flex items-center justify-between text-[12px]">
        <LinkButton to="/trust" variant="ghost" size="sm">
          Safety guidelines
        </LinkButton>
        <button type="button" onClick={() => navigate(-1)} className="text-muted hover:text-ink">
          <X className="mr-1 inline size-3.5" aria-hidden="true" />
          Discard
        </button>
      </div>
    </div>
  );
}

async function toBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
