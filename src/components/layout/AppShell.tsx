import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useEffect, useState, type ReactNode } from 'react';
import { Bell, Compass, Heart, House, Plus, Search, Shield, Sparkles, UserRound, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { Logo, Wordmark, XIcon } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { LinkButton } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/bills', label: 'My Bills', icon: Wallet },
  { to: '/activity', label: 'Activity', icon: Heart },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

const MOBILE_NAV = [
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/bills', label: 'My Bills', icon: Wallet },
  { to: '/activity', label: 'Activity', icon: Heart },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    api
      .get<{ unread: number }>('/me/notifications')
      .then((res) => {
        if (!cancelled) setUnread(res.unread ?? 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, location.pathname]);

  const isImmersive = location.pathname === '/discover';

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
      >
        {t('Skip to content')}
      </a>

      {/* Desktop top bar */}
      <header className="sticky top-0 z-40 hidden border-b border-line/80 glass-bar lg:block">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-8">
          <LinkBrand />
          <nav aria-label={t('Primary')} className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition',
                    isActive ? 'text-brand-ink' : 'text-[#57534E] hover:bg-black/[0.04] hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-xl bg-brand-soft"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative">{t(item.label)}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LinkButton to="/discover" variant="ghost" size="sm" icon={<Search className="size-4" aria-hidden="true" />}>
              {t('Find a bill')}
            </LinkButton>
            <a
              href="https://x.com/0xkillcoin"
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t('Author on X')}
              className="inline-flex size-9 items-center justify-center rounded-xl text-[#57534E] transition hover:bg-black/[0.05] hover:text-ink"
            >
              <XIcon className="size-[15px]" />
            </a>
            {user?.role === 'admin' && (
              <LinkButton to="/admin" variant="ghost" size="sm" icon={<Shield className="size-4" aria-hidden="true" />}>
                {t('Admin')}
              </LinkButton>
            )}
            <LanguageSwitcher className="mr-0.5" />
            <LinkButton to="/notifications" variant="ghost" size="sm" aria-label={t('Notifications')} className="relative">
              <Bell className="size-[18px]" aria-hidden="true" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-coral text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </LinkButton>
            <LinkButton to="/bills/new" variant="primary" size="sm" icon={<Plus className="size-4" aria-hidden="true" />}>
              {t('Post a bill')}
            </LinkButton>
            {loading ? (
              <div className="size-9 animate-pulse rounded-full bg-[#EFEDE9]" />
            ) : user ? (
              <NavLink to="/profile" aria-label={t('Your profile')} className="ml-1">
                <Avatar name={user.displayName} seed={user.avatarSeed} src={user.avatarUrl} size={34} />
              </NavLink>
            ) : (
              <LinkButton to="/login" variant="secondary" size="sm">
                {t('Sign in')}
              </LinkButton>
            )}
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-line/70 glass-bar safe-top lg:hidden">
        <div className="flex h-14 items-center gap-2 px-3 min-[360px]:gap-3 min-[360px]:px-4">
          <LinkBrand compact />
          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher variant="compact" />
            <a
              href="https://x.com/0xkillcoin"
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t('Author on X')}
              className="inline-flex size-9 items-center justify-center rounded-xl text-[#57534E] transition active:bg-black/[0.06]"
            >
              <XIcon className="size-[15px]" />
            </a>
            {user?.role === 'admin' && (
              <LinkButton to="/admin" variant="ghost" size="sm" aria-label={t('Admin')} className="px-2">
                <Shield className="size-[18px]" aria-hidden="true" />
              </LinkButton>
            )}
            <LinkButton to="/notifications" variant="ghost" size="sm" aria-label={t('Notifications')} className="relative px-2">
              <Bell className="size-[19px]" aria-hidden="true" />
              {unread > 0 && (
                <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-coral text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </LinkButton>
            {loading ? (
              <div className="size-8 animate-pulse rounded-full bg-[#EFEDE9]" />
            ) : user ? (
              <NavLink to="/profile" aria-label={t('Your profile')}>
                <Avatar name={user.displayName} seed={user.avatarSeed} src={user.avatarUrl} size={30} />
              </NavLink>
            ) : (
              <LinkButton to="/login" variant="primary" size="sm" className="h-8 px-2.5 text-[12px] min-[360px]:px-3 min-[360px]:text-[12.5px]">
                {t('Sign in')}
              </LinkButton>
            )}
          </div>
        </div>
      </header>

      <main id="main" className={cn('mx-auto w-full max-w-[1440px] px-0 lg:px-8', isImmersive && 'lg:pb-10')}>
        {children}
      </main>

      <Footer />

      {/* Mobile bottom nav */}
      <nav
        aria-label={t('Primary mobile')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 glass-bar safe-bottom lg:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around gap-0.5 px-1 pb-1 pt-1.5">
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10.5px] font-semibold transition',
                  isActive ? 'text-brand-ink' : 'text-[#6F6B63] active:bg-black/[0.04]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('size-[21px]', isActive && 'stroke-[2.4]')} aria-hidden="true" />
                  <span className="truncate">{t(item.label)}</span>
                  {isActive && (
                    <motion.span
                      layoutId="mobile-nav-dot"
                      className="absolute -top-0.5 h-[3px] w-6 rounded-full bg-brand"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => navigate('/bills/new')}
            aria-label={t('Post a bill')}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10.5px] font-semibold text-[#6F6B63] active:bg-black/[0.04]"
          >
            <span className="flex size-[21px] items-center justify-center rounded-lg bg-brand text-white">
              <Plus className="size-3.5" aria-hidden="true" strokeWidth={3} />
            </span>
            <span>{t('Post')}</span>
          </button>
        </div>
      </nav>
      <div className="h-16 lg:hidden" aria-hidden="true" />
    </div>
  );
}

function LinkBrand({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <NavLink to="/" className="flex min-h-[36px] shrink-0 items-center gap-2 py-1" aria-label={t('BILL SWIPE home')}>
      <Logo size={compact ? 28 : 32} />
      <Wordmark className={compact ? 'text-[15px]' : 'text-[17px]'} compact={compact} />
    </NavLink>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-14 border-t border-line bg-white/60">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 py-9 sm:px-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xs">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <Wordmark className="text-[15px]" />
          </div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
            {t("Someone's bill. Someone's kindness. Swipe to discover real stories, then choose to help — never automatically.")}
          </p>
          <a
            href="https://x.com/0xkillcoin"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex min-h-[32px] items-center gap-1.5 text-[12.5px] font-semibold text-[#57534E] transition hover:text-ink"
          >
            <XIcon className="size-3.5" />
            {t('Built by @0xkillcoin')}
          </a>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-5 text-[13px] sm:grid-cols-3">
          <FooterCol
            title={t('Product')}
            links={[
              { to: '/discover', label: 'Discover' },
              { to: '/bills/new', label: 'Post a bill' },
              { to: '/community', label: 'Community' },
              { to: '/activity', label: 'Activity' },
            ]}
          />
          <FooterCol
            title={t('Trust')}
            links={[
              { to: '/trust', label: 'Trust & safety' },
              { to: '/payments-info', label: 'Payment sandbox' },
              { to: '/faq', label: 'FAQ' },
            ]}
          />
          <FooterCol
            title={t('More')}
            links={[
              { to: '/how-it-works', label: 'How it works' },
              { to: '/about', label: 'About the project' },
              { to: '/x', label: 'Author on X', external: true },
            ]}
          />
        </div>
      </div>
      <div className="border-t border-line/70 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-2 text-[11.5px] text-muted sm:flex-row sm:items-center">
          <p>{t('© {year} BILL SWIPE · Payment sandbox build. No real money is moved in this deployment.', { year: new Date().getFullYear() })}</p>
          <p className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3" aria-hidden="true" />
            {t("Someone's bill. Someone's kindness.")}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string; external?: boolean }[];
}) {
  const { t } = useI18n();
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#736E66]">{t(title)}</p>
      <ul className="space-y-0.5">
        {links.map((link) => (
          <li key={link.label}>
            {link.external ? (
              <a
                href={link.to === '/x' ? 'https://x.com/0xkillcoin' : link.to}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-[32px] items-center text-[#57534E] transition hover:text-brand-ink"
              >
                {t(link.label)} ↗
              </a>
            ) : (
              <NavLink to={link.to} className="inline-flex min-h-[32px] items-center text-[#57534E] transition hover:text-brand-ink">
                {t(link.label)}
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="px-5 pb-5 pt-6 sm:px-8 lg:pt-9">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] sm:text-[30px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function IconBubble({ icon, tone = 'brand' }: { icon: ReactNode; tone?: 'brand' | 'mint' | 'coral' }) {
  const tones = {
    brand: 'bg-brand-soft text-brand-ink',
    mint: 'bg-mint-soft text-[#0F7A52]',
    coral: 'bg-coral-soft text-[#C02444]',
  } as const;
  return <span className={cn('flex size-10 items-center justify-center rounded-2xl', tones[tone])}>{icon}</span>;
}

export { House };
