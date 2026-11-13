import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ApiRequestError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Logo, Wordmark } from '@/components/brand/Logo';
import { Button, LinkButton } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/Primitives';
import { cn } from '@/lib/utils';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="grid min-h-[calc(100dvh-8rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <Link to="/" className="mb-7 inline-flex items-center gap-2">
            <Logo size={32} />
            <Wordmark className="text-[17px]" />
          </Link>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h1 className="text-[27px] font-semibold leading-tight tracking-[-0.03em]">{title}</h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{subtitle}</p>
            <div className="mt-6">{children}</div>
            <div className="mt-5 text-[13px] text-muted">{footer}</div>
          </motion.div>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-[#191919] lg:block">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(70% 60% at 20% 10%, rgba(121,87,255,0.6), transparent 60%), radial-gradient(60% 50% at 90% 30%, rgba(255,113,139,0.42), transparent 62%), radial-gradient(60% 60% at 50% 100%, rgba(41,197,138,0.32), transparent 65%)',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11.5px] font-semibold text-white/80 backdrop-blur">
            <Sparkles className="size-3" aria-hidden="true" />
            {t('Someone\'s bill. Someone\'s kindness.')}
          </span>
          <div>
            <p className="max-w-sm text-[30px] font-semibold leading-tight tracking-[-0.03em] text-white">
              {t('“I didn’t need a rescue. I needed one week of breathing room.”')}
            </p>
            <p className="mt-3 text-[13px] text-white/60">
              {t('Every story on BILL SWIPE is a specific, verifiable bill — not a campaign.')}
            </p>
          </div>
          <ul className="space-y-2.5 text-[12.5px] text-white/70">
            {[
              'Swiping never charges you',
              'Receipts stay private by default',
              'Every bill is reviewed by a human',
            ].map((line) => (
              <li key={line} className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-white/50" aria-hidden="true" />
                {t(line)}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function LoginPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/discover';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const user = await login(email.trim(), password);
      toast.success(t('Welcome back, {name}', { name: user.displayName.split(' ')[0]! }));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else {
        setError(t('Something went wrong. Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={t('Welcome back')}
      subtitle={t('Sign in to keep swiping, track your help, or manage your bills.')}
      footer={
        <>
          {t('New here?')}{' '}
          <Link to="/register" className="inline-flex min-h-[32px] items-center font-semibold text-brand-ink hover:underline">
            {t('Create an account')}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field
          id="email"
          label={t('Email')}
          icon={<Mail className="size-4" aria-hidden="true" />}
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder={t('you@example.com')}
          error={fields.email}
          required
        />
        <Field
          id="password"
          label={t('Password')}
          icon={<Lock className="size-4" aria-hidden="true" />}
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          placeholder={t('Your password')}
          error={fields.password}
          required
          trailing={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={t(show ? 'Hide password' : 'Show password')}
              className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-black/[0.05] hover:text-ink"
            >
              {show ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
            </button>
          }
        />

        {error && (
          <p role="alert" className="rounded-xl bg-coral-soft px-3 py-2.5 text-[12.5px] font-medium text-[#C02444]">
            {error}
          </p>
        )}

        <Button type="submit" block size="lg" disabled={busy} trailing={busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" aria-hidden="true" />}>
          {t('Sign in')}
        </Button>
      </form>

      <div className="mt-4 rounded-xl border border-dashed border-line bg-[#FBFAF8] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#736E66]">{t('Demo admin')}</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          <code className="rounded bg-white px-1 py-0.5 text-[11px]">admin@billswipe.local</code> ·{' '}
          <code className="rounded bg-white px-1 py-0.5 text-[11px]">BillSwipe!Admin2026</code>
          <br />
          {t('Seeded for this preview deployment only — rotate before any real launch.')}
        </p>
      </div>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { t } = useI18n();
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const usernameValid = /^[a-z0-9_]{3,20}$/.test(form.username);
  const passwordScore = scorePassword(form.password);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        username: form.username.trim().toLowerCase(),
        displayName: form.displayName.trim() || form.username.trim(),
      });
      toast.success(t('Account created'), t('Start swiping — you can post a bill any time.'));
      navigate('/discover', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else {
        setError(t('Something went wrong. Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={t("Make someone's day")}
      subtitle={t('One account for helping others and posting your own bill when you need a hand.')}
      footer={
        <>
          {t('Already have an account?')}{' '}
          <Link to="/login" className="inline-flex min-h-[32px] items-center font-semibold text-brand-ink hover:underline">
            {t('Sign in')}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field
          id="reg-email"
          label={t('Email')}
          icon={<Mail className="size-4" aria-hidden="true" />}
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
          placeholder={t('you@example.com')}
          error={fields.email}
          required
        />
        <Field
          id="reg-username"
          label={t('Username')}
          icon={<UserRound className="size-4" aria-hidden="true" />}
          autoComplete="username"
          value={form.username}
          onChange={(v) => setForm((f) => ({ ...f, username: v.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
          placeholder={t('kindness_inc')}
          error={fields.username}
          hint={
            form.username && !usernameValid
              ? t('3–20 lowercase letters, numbers or underscores.')
              : t('This is public on your profile.')
          }
          required
        />
        <Field
          id="reg-password"
          label={t('Password')}
          icon={<Lock className="size-4" aria-hidden="true" />}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={form.password}
          onChange={(v) => setForm((f) => ({ ...f, password: v }))}
          placeholder={t('At least 8 characters')}
          error={fields.password}
          required
          trailing={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={t(show ? 'Hide password' : 'Show password')}
              className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-black/[0.05] hover:text-ink"
            >
              {show ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
            </button>
          }
        />

        {form.password.length > 0 && (
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  passwordScore > i ? (passwordScore >= 3 ? 'bg-mint' : passwordScore === 2 ? 'bg-amber' : 'bg-coral') : 'bg-[#EFEDE9]',
                )}
              />
            ))}
            <span className="ml-1 w-12 text-right text-[10.5px] text-muted">
              {passwordScore >= 3 ? 'Strong' : passwordScore === 2 ? 'Fair' : 'Weak'}
            </span>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-coral-soft px-3 py-2.5 text-[12.5px] font-medium text-[#C02444]">
            {error}
          </p>
        )}

        <Button
          type="submit"
          block
          size="lg"
          disabled={busy || !usernameValid}
          trailing={busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" aria-hidden="true" />}
        >
          {t('Create account')}
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-[#736E66]">
          {t('By joining you agree to keep this place kind. We never sell your data, and anonymous help is always available.')}
        </p>
      </form>
    </AuthLayout>
  );
}

function scorePassword(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(4, score);
}

export function Field({
  id,
  label,
  icon,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  hint,
  required,
  autoComplete,
  trailing,
  inputMode,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
  trailing?: React.ReactNode;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'email';
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold text-[#57534E]">
        {label}
        {required && <span className="ml-0.5 text-[#C02444]">*</span>}
      </label>
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border bg-white px-3 transition focus-within:ring-2',
          error ? 'border-[#F3B5C3] focus-within:ring-coral/15' : 'border-line focus-within:border-brand focus-within:ring-brand/15',
        )}
      >
        {icon && <span className="shrink-0 text-[#736E66]">{icon}</span>}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="h-11 w-full min-w-0 bg-transparent text-[14px] outline-none placeholder:text-[#7C776F]"
        />
        {trailing}
      </div>
      {error ? <span id={`${id}-error`}><FieldError message={error} /></span> : hint ? <p id={`${id}-hint`} className="mt-1 text-[11.5px] text-[#736E66]">{hint}</p> : null}
    </div>
  );
}

export { LinkButton };

