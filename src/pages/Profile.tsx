import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAchievementLabel } from '@/lib/labels';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, LogOut, Lock, Save, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, LinkButton } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Pill, ProgressBar, Skeleton } from '@/components/ui/Primitives';
import { Field } from './Auth';


import { cn } from '@/lib/utils';
import type { MeProfile, PublicUser } from '@shared/types';

export default function ProfilePage() {
  const { t, money, date: formatDate } = useI18n();
  const achievementLabel = useAchievementLabel();
  const { user, loading: authLoading, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ displayName: '', bio: '', region: '', country: 'US' });
  const [prefs, setPrefs] = useState({ anonymousByDefault: false, publicProfile: true, notifyEmail: true, notifyInApp: true });
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' });
  const [pwdBusy, setPwdBusy] = useState(false);
  const [blocked, setBlocked] = useState<PublicUser[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: '/profile' } });
      return;
    }
    setForm({
      displayName: user.displayName,
      bio: user.bio,
      region: user.region,
      country: user.country,
    });
    setPrefs({
      anonymousByDefault: user.anonymousByDefault,
      publicProfile: user.publicProfile,
      notifyEmail: user.notifyEmail,
      notifyInApp: user.notifyInApp,
    });
    api
      .get<{ users: PublicUser[] }>('/blocks')
      .then((res) => setBlocked(res.users))
      .catch(() => undefined);
  }, [authLoading, user, navigate]);

  async function save() {
    setSaving(true);
    try {
      const res = await api.patch<{ user: MeProfile }>('/me', {
        displayName: form.displayName,
        bio: form.bio,
        region: form.region,
        country: form.country,
        ...prefs,
      });
      setUser(res.user);
      toast.success('Profile saved');
    } catch (err) {
      toast.error('Could not save', err instanceof ApiRequestError ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPwdBusy(true);
    try {
      await api.post('/auth/password', pwd);
      toast.success('Password updated', 'Please sign in again.');
      await logout();
      navigate('/login');
    } catch (err) {
      toast.error('Could not update password', err instanceof ApiRequestError ? err.message : undefined);
    } finally {
      setPwdBusy(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="px-5 pt-6 sm:px-8">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader title={t('Your profile')} description="Control how you appear, how you are notified, and how you help." />

      <div className="space-y-4 px-5 pb-12 sm:px-8">
        <section className="overflow-hidden rounded-[24px] border border-line bg-white shadow-soft">
          <div className="relative h-24 bg-gradient-to-r from-brand-soft via-[#FFF0F3] to-mint-soft">
            <div className="absolute -bottom-7 left-5">
              <Avatar name={user.displayName} seed={user.avatarSeed} src={user.avatarUrl} size={64} ring />
            </div>
            {user.role === 'admin' && (
              <div className="absolute right-4 top-4">
                <Pill tone="brand" icon={<ShieldCheck className="size-3" aria-hidden="true" />}>
                  {t('Admin')}
                </Pill>
              </div>
            )}
          </div>
          <div className="px-5 pb-5 pt-9">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-[19px] font-semibold">
                  {user.displayName}
                  {user.emailVerified && <Check className="size-4 text-mint" aria-label={t('Email verified')} />}
                </h2>
                <p className="text-[12.5px] text-muted">
                  @{user.username} · {t('Joined {date}', { date: formatDate(user.createdAt) })}
                </p>
              </div>
              <div className="flex gap-1.5">
                <LinkButton to="/bills" variant="ghost" size="sm" className="border border-line">
                  {t('My bills')}
                </LinkButton>
                <Button
                  variant="ghost"
                  size="sm"
                  className="border border-line"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                  icon={<LogOut className="size-3.5" aria-hidden="true" />}
                >
                  {t('Sign out')}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={t('Bills helped')} value={String(user.stats.helpedCount)} />
              <Stat label={t('Total given')} value={money(user.stats.helpedAmount)} />
              <Stat label={t('Bills posted')} value={String(user.stats.billsPosted)} />
              <Stat label={t('Fully funded')} value={String(user.stats.billsCompleted)} />
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold">
            <Sparkles className="size-4 text-brand-ink" aria-hidden="true" />
            {t('Achievements')}
          </h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            Earned by showing up, never by spending the most. No leaderboards here.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {user.achievements.map((raw) => {
              const achievement = { ...raw, ...achievementLabel(raw.id, raw.label, raw.description) };
              return (
              <li
                key={achievement.id}
                className={cn(
                  'rounded-2xl border p-3 transition',
                  achievement.earned ? 'border-mint/40 bg-mint-soft/50' : 'border-line bg-[#FBFAF8]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-[12.5px] font-semibold', !achievement.earned && 'text-[#8A867F]')}>{achievement.label}</p>
                  {achievement.earned ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-mint text-white">
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                  ) : (
                    <Lock className="size-3.5 text-[#7C776F]" aria-hidden="true" />
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted">{achievement.description}</p>
                {!achievement.earned && <ProgressBar value={achievement.progress * 100} className="mt-2 h-1" />}
              </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-[22px] border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold">
            <UserRound className="size-4 text-brand-ink" aria-hidden="true" />
            {t('Public profile')}
          </h2>
          <div className="mt-3 space-y-3">
            <Field id="display-name" label={t('Display name')} value={form.displayName} onChange={(v) => setForm((f) => ({ ...f, displayName: v }))} />
            <div>
              <label htmlFor="bio" className="mb-1.5 block text-[12px] font-semibold text-[#57534E]">
                {t('Short bio')}
              </label>
              <textarea
                id="bio"
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value.slice(0, 300) }))}
                rows={3}
                className="w-full resize-none rounded-xl border border-line px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                placeholder={t('A line or two about you.')}
              />
              <p className="mt-1 text-[11px] text-[#736E66]">{form.bio.length}/300</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="region" label={t('Region')} value={form.region} onChange={(v) => setForm((f) => ({ ...f, region: v }))} hint="Coarse only — city or state. Never an address." />
              <div>
                <label htmlFor="country" className="mb-1.5 block text-[12px] font-semibold text-[#57534E]">
                  {t('Country')}
                </label>
                <select
                  id="country"
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-line bg-white px-3 text-[13.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                >
                  {['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'ES', 'IT', 'BR', 'IN', 'JP', 'KR', 'SG', 'ZA', 'NG', 'MX'].map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-line bg-white p-5">
          <h2 className="text-[14px] font-semibold">{t('Privacy & notifications')}</h2>
          <div className="mt-3 space-y-1.5">
            <Toggle
              label={t('Help anonymously by default')}
              description={t('Pre-checks the anonymous option on every payment.')}
              checked={prefs.anonymousByDefault}
              onChange={(v) => setPrefs((p) => ({ ...p, anonymousByDefault: v }))}
            />
            <Toggle
              label={t('Public profile')}
              description={t('Let other members see your name and help stats.')}
              checked={prefs.publicProfile}
              onChange={(v) => setPrefs((p) => ({ ...p, publicProfile: v }))}
            />
            <Toggle
              label={t('Email notifications')}
              description={t('Payment receipts, bill approvals and review results.')}
              checked={prefs.notifyEmail}
              onChange={(v) => setPrefs((p) => ({ ...p, notifyEmail: v }))}
            />
            <Toggle
              label={t('In-app notifications')}
              description={t('The bell icon updates.')}
              checked={prefs.notifyInApp}
              onChange={(v) => setPrefs((p) => ({ ...p, notifyInApp: v }))}
            />
          </div>
          <Button className="mt-4" onClick={() => void save()} disabled={saving} icon={saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" aria-hidden="true" />}>
            {t('Save changes')}
          </Button>
        </section>

        <section className="rounded-[22px] border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold">
            <Lock className="size-4 text-[#57534E]" aria-hidden="true" />
            {t('Account security')}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              id="current-password"
              label={t('Current password')}
              type="password"
              value={pwd.currentPassword}
              onChange={(v) => setPwd((p) => ({ ...p, currentPassword: v }))}
              autoComplete="current-password"
            />
            <Field
              id="new-password"
              label={t('New password')}
              type="password"
              value={pwd.newPassword}
              onChange={(v) => setPwd((p) => ({ ...p, newPassword: v }))}
              autoComplete="new-password"
              hint={t('At least 8 characters. Signs you out everywhere.')}
            />
          </div>
          <Button
            className="mt-3"
            variant="pass"
            size="sm"
            disabled={pwdBusy || !pwd.currentPassword || pwd.newPassword.length < 8}
            onClick={() => void changePassword()}
            icon={pwdBusy ? <Loader2 className="size-3.5 animate-spin" /> : undefined}
          >
            {t('Update password')}
          </Button>
        </section>

        {blocked.length > 0 && (
          <section className="rounded-[22px] border border-line bg-white p-5">
            <h2 className="text-[14px] font-semibold">{t('Blocked people')}</h2>
            <ul className="mt-3 space-y-2">
              {blocked.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF8F5] px-3 py-2">
                  <span className="flex items-center gap-2">
                    <Avatar name={person.displayName} seed={person.avatarSeed} size={26} />
                    <span className="text-[12.5px] font-semibold">{person.displayName}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[11.5px]"
                    onClick={async () => {
                      await api.post('/blocks', { targetId: person.id });
                      setBlocked((list) => list.filter((p) => p.id !== person.id));
                      toast.success('Unblocked');
                    }}
                  >
                    {t('Unblock')}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#FAF8F5] p-2.5">
      <p className="money-tabular text-[16px] font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10.5px] text-muted">{label}</p>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2 transition hover:bg-[#FBFAF8]">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-[#DED9D2]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold">{label}</span>
        <span className="block text-[11px] leading-snug text-muted">{description}</span>
      </span>
    </label>
  );
}
