import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flag, Loader2, X } from 'lucide-react';
import { api, ApiRequestError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const REASONS = [
  'Fake or stolen receipt',
  'Story does not match the bill',
  'Duplicate listing',
  'Requests off-platform payment',
  'Abusive or harassing content',
  'Sensitive personal data exposed',
  'Something else',
];

export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  targetLabel,
}: {
  open: boolean;
  onClose: () => void;
  targetType: 'bill' | 'user' | 'comment';
  targetId: string;
  targetLabel: string;
}) {
  const toast = useToast();
  const [reason, setReason] = useState(REASONS[0]!);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/reports', { targetType, targetId, reason, details });
      toast.success('Report sent', 'Our moderators will review this shortly.');
      onClose();
      setDetails('');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send the report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#191919]/45" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Report"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="relative w-full max-w-md rounded-t-[24px] bg-white p-4 shadow-lift sm:rounded-[24px]"
          >
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <Flag className="size-4 text-[#C02444]" aria-hidden="true" />
                Report this {targetType}
              </h2>
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-black/5" aria-label="Close">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-1 truncate text-[12.5px] text-muted">{targetLabel}</p>

            <fieldset className="mt-3 space-y-1.5">
              <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#736E66]">Reason</legend>
              {REASONS.map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] transition',
                    reason === option ? 'border-brand bg-brand-soft font-semibold text-brand-ink' : 'border-line hover:bg-[#FBFAF8]',
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={option}
                    checked={reason === option}
                    onChange={() => setReason(option)}
                    className="size-3.5 text-brand-ink focus:ring-brand"
                  />
                  {option}
                </label>
              ))}
            </fieldset>

            <label htmlFor="report-details" className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#736E66]">
              Details (optional)
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-line px-3 py-2 text-[13px] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="Anything we should know?"
            />

            {error && (
              <p role="alert" className="mt-2 rounded-lg bg-coral-soft px-3 py-2 text-[12px] font-medium text-[#C02444]">
                {error}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <Button variant="pass" block onClick={onClose}>
                Cancel
              </Button>
              <Button variant="danger" block onClick={() => void submit()} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : 'Send report'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
