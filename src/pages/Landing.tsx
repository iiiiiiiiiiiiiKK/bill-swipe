import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Heart,
  HeartHandshake,
  Lock,
  ScanEye,
  Sparkles,
  Star,
  Users,
  Wallet,
} from 'lucide-react';
import type { BillSummary, CommunityPost, CommunityStats } from '@shared/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { usePostCopy } from '@/lib/communityCopy';
import { Button, LinkButton } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Logo } from '@/components/brand/Logo';
import { BillCardPreview } from '@/components/bill/BillCard';
import { ReceiptArt } from '@/components/bill/ReceiptArt';
import { ProgressBar, Pill } from '@/components/ui/Primitives';
import { formatMoney } from '@shared/money';
import { categoryOf } from '@shared/categories';

export default function Landing() {
  const { user } = useAuth();
  const [bills, setBills] = useState<BillSummary[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<{ bills: BillSummary[] }>('/bills/discover?limit=6').catch(() => ({ bills: [] })),
      api.get<{ posts: CommunityPost[]; stats: CommunityStats }>('/community?limit=4').catch(() => ({ posts: [], stats: null })),
    ]).then(([feed, community]) => {
      if (cancelled) return;
      setBills(feed.bills ?? []);
      setPosts(community.posts ?? []);
      setStats(community.stats ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="overflow-x-clip">
      <Hero user={user} reduce={!!reduce} />
      <CommunityImpact stats={stats} />
      <HowItWorks />
      <FeaturedBills bills={bills} />
      <RecentKindness posts={posts} />
      <TrustSection />
      <Faq />
      <FinalCta user={user} />
    </div>
  );
}

function Hero({ user, reduce }: { user: { displayName: string } | null; reduce: boolean }) {
  const { t } = useI18n();
  const stack = [
    {
      category: 'groceries',
      amount: 18650,
      title: 'Groceries until my first paycheck lands',
      name: 'Maria R.',
      progress: 62,
      tilt: -9,
      x: '-10%',
      y: '8%',
      z: 1,
      scale: 0.86,
    },
    {
      category: 'medical',
      amount: 42000,
      title: 'Six more physical therapy sessions',
      name: 'James K.',
      progress: 78,
      tilt: 5,
      x: '10%',
      y: '4%',
      z: 2,
      scale: 0.9,
    },
    {
      category: 'rent',
      amount: 95000,
      title: 'February rent while I recover',
      name: 'Diego S.',
      progress: 40,
      tilt: -2,
      x: '0%',
      y: '0%',
      z: 3,
      scale: 1,
    },
  ];

  return (
    <section className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-32 -top-40 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(121,87,255,0.16),transparent_66%)]" />
        <div className="absolute -right-24 top-10 size-[460px] rounded-full bg-[radial-gradient(circle,rgba(255,113,139,0.16),transparent_66%)]" />
        <div className="absolute bottom-0 left-1/3 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(41,197,138,0.13),transparent_68%)]" />
      </div>

      <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 pb-8 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-16 lg:pb-16 lg:pt-16">
        <div className="max-w-xl">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-[#57534E] shadow-soft"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-brand-soft">
              <Sparkles className="size-3 text-brand-ink" aria-hidden="true" />
            </span>
            {t('Swipe to discover · help only when you choose')}
          </motion.div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="mt-5 text-[40px] font-semibold leading-[1.03] tracking-[-0.045em] sm:text-[56px] lg:text-[62px]"
          >
            {t('A little swipe.')}
            <br />
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-brand via-[#8C63FF] to-coral bg-clip-text text-transparent">
                {t('A big difference.')}
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 320 16"
                className="absolute -bottom-1 left-0 h-3 w-full text-brand-ink/25"
                preserveAspectRatio="none"
              >
                <path d="M2 12C60 4 120 3 180 7c50 3 90 5 138-1" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-[#5C5862] sm:text-base"
          >
            {t("Somewhere out there, someone needs a little help right now. Browse real bills, swipe past what you can't take on, and step in where you can. You might be the person who makes their day.")}
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            className="mt-7 flex flex-wrap items-center gap-3"
          >
            <LinkButton to="/discover" size="xl" trailing={<ArrowRight className="size-[18px]" aria-hidden="true" />}>
              {t('Start swiping')}
            </LinkButton>
            <LinkButton to={user ? '/bills/new' : '/register'} size="xl" variant="pass">
              {t('Post your bill')}
            </LinkButton>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12.5px] text-muted"
          >
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-4 text-mint" aria-hidden="true" />
              {t('Every bill human-reviewed')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-4 text-brand-ink" aria-hidden="true" />
              {t('Receipts stay private')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <HeartHandshake className="size-4 text-[#C02444]" aria-hidden="true" />
              {t('Swiping never charges you')}
            </span>
          </motion.div>
        </div>

        <div className="relative mx-auto w-full max-w-[420px]">
          <div className="relative aspect-[4/5] w-full">
            {stack.map((card, i) => {
              const cat = categoryOf(card.category);
              return (
                <motion.div
                  key={t(card.title)}
                  initial={reduce ? false : { opacity: 0, y: 40, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.65, delay: 0.15 + i * 0.1, type: 'spring', stiffness: 90, damping: 16 }}
                  className="absolute inset-x-7 inset-y-2"
                  style={{ zIndex: card.z }}
                >
                  <div
                    style={{
                      transform: `translate(${card.x}, ${card.y}) rotate(${card.tilt}deg) scale(${card.scale})`,
                      animation: reduce ? undefined : 'float-slow 9s ease-in-out infinite',
                      ['--tilt' as string]: `${card.tilt}deg`,
                      animationDelay: `${i * 1.4}s`,
                    }}
                    className="h-full w-full"
                  >
                    <div className="overflow-hidden rounded-[26px] border border-line bg-white shadow-card">
                      <div className="relative h-[52%] min-h-[150px]">
                        <ReceiptArt seed={card.title} category={card.category} amount={card.amount} compact />
                        <div className="absolute left-3 top-3">
                          <span
                            className="rounded-full px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider"
                            style={{ background: cat.tint, color: cat.ink }}
                          >
                            {cat.short}
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={card.name} size={26} />
                          <span className="text-[12.5px] font-semibold">{t(card.name)}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug">{t(card.title)}</p>
                        <div className="mt-3 flex items-end justify-between">
                          <span className="money-tabular text-[22px] font-bold leading-none tracking-[-0.03em]">
                            {formatMoney(card.amount)}
                          </span>
                          <span className="text-[11px] font-semibold text-[#0F7A52]">{card.progress}%</span>
                        </div>
                        <ProgressBar value={card.progress} className="mt-2 h-1" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, type: 'spring', stiffness: 200, damping: 18 }}
            className="absolute -bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-line bg-white/95 px-3.5 py-2.5 shadow-lift backdrop-blur"
          >
            <span className="flex size-8 items-center justify-center rounded-xl bg-coral-soft">
              <Heart className="size-4 text-[#C02444]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[12.5px] font-semibold leading-tight">{t('Swipe right to help')}</p>
              <p className="text-[11px] text-muted">{t('Swipe left to pass. No charge, ever.')}</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function CommunityImpact({ stats }: { stats: CommunityStats | null }) {
  const { t } = useI18n();
  const items = [
    { label: 'Bills helped', value: stats ? stats.billsHelped.toLocaleString() : '—', icon: Heart },
    { label: 'Given in help', value: stats ? formatMoney(stats.amountGiven, stats.currency) : '—', icon: Wallet },
    { label: 'People supported', value: stats ? stats.peopleSupported.toLocaleString() : '—', icon: Users },
    { label: 'Connections made', value: stats ? stats.connections.toLocaleString() : '—', icon: HeartHandshake },
  ];
  return (
    <section className="border-y border-line bg-white/55">
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                <item.icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="money-tabular truncate text-[19px] font-bold leading-none tracking-[-0.02em]">{item.value}</p>
                <p className="mt-1 truncate text-[11.5px] text-muted">{t(item.label)}</p>
              </div>
            </div>
          ))}
        </div>
        {stats?.demoIncluded && (
          <p className="mt-4 text-[11px] text-muted">
            {t('Includes clearly-labelled demo data seeded for this preview build — never presented as real platform performance.')}
          </p>
        )}
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    {
      title: 'Swipe through bills',
      body: 'Real people post the bill they cannot cover this week. Swipe left to pass, right when you want to help, up for Super Help.',
      icon: ScanEye,
      tone: 'brand' as const,
    },
    {
      title: 'Choose your amount',
      body: 'Nothing is charged by a swipe. Pick $5, $10, $25, or your own amount and see exactly what you pay — fee included — before confirming.',
      icon: Wallet,
      tone: 'mint' as const,
    },
    {
      title: 'Watch it land',
      body: 'Your help updates the bill instantly, both sides get a notification, and the story shows up in the community feed.',
      icon: Heart,
      tone: 'coral' as const,
    },
  ];
  return (
    <section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:py-20" id="how-it-works">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink">{t('How it works')}</p>
        <h2 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.035em] sm:text-[38px]">
          {t('Three taps from scrolling to someone\'s good day.')}
        </h2>
      </div>
      <div className="mt-9 grid gap-4 sm:grid-cols-3">
        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            className="relative overflow-hidden rounded-[22px] border border-line bg-white p-5 shadow-soft"
          >
            <span className="absolute right-4 top-3 text-[42px] font-bold leading-none text-black/[0.04]">
              0{i + 1}
            </span>
            <span
              className={
                step.tone === 'brand'
                  ? 'flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink'
                  : step.tone === 'mint'
                    ? 'flex size-11 items-center justify-center rounded-2xl bg-mint-soft text-[#0F7A52]'
                    : 'flex size-11 items-center justify-center rounded-2xl bg-coral-soft text-[#C02444]'
              }
            >
              <step.icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-[16px] font-semibold">{t(step.title)}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#5C5862]">{t(step.body)}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function FeaturedBills({ bills }: { bills: BillSummary[] }) {
  const { t } = useI18n();
  if (bills.length === 0) return null;
  return (
    <section className="border-y border-line bg-white/55">
      <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink">{t('Live now')}</p>
            <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.03em] sm:text-[32px]">
              {t('Bills waiting for a little kindness')}
            </h2>
          </div>
          <LinkButton to="/discover" variant="ghost" size="sm" trailing={<ArrowRight className="size-4" aria-hidden="true" />}>
            {t('See all')}
          </LinkButton>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {bills.slice(0, 6).map((bill) => (
            <BillCardPreview key={bill.id} bill={bill} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RecentKindness({ posts }: { posts: CommunityPost[] }) {
  const { t, timeAgo } = useI18n();
  const postCopy = usePostCopy();
  const fallback = useMemo(
    () => [
      { id: 'f1', headline: 'Someone helped Maria R. with groceries', detail: 'A $25 top-up arrived four hours after she posted.', when: '2h ago' },
      { id: 'f2', headline: 'James K. reached 78% of his therapy bill', detail: 'Eleven people chipped in this week.', when: '6h ago' },
      { id: 'f3', headline: 'A family got their rent covered', detail: 'Diego S. is three days from his deadline.', when: '1d ago' },
    ],
    [],
  );
  const items = posts.length > 0 ? posts.slice(0, 3) : fallback;
  return (
    <section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-14">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C02444]">{t('Recent acts of kindness')}</p>
          <h2 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.035em] sm:text-[36px]">
            {t('Good things happen here, quietly.')}
          </h2>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-muted">
            {t('Anonymous by default if you want. Every entry below is generated from an actual help record — no stock testimonials, no invented numbers.')}
          </p>
          <LinkButton to="/community" variant="soft" size="md" className="mt-5" trailing={<ArrowRight className="size-4" aria-hidden="true" />}>
            {t('Open the community')}
          </LinkButton>
        </div>
        <ul className="space-y-3">
          {items.map((item, i) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: 14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="flex items-start gap-3.5 rounded-2xl border border-line bg-white p-4 shadow-soft"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint-soft">
                <Heart className="size-4 text-[#0F7A52]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-snug">
                  {'headline' in item ? postCopy.headline(item as CommunityPost) : ''}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-muted">
                  {'detail' in item ? postCopy.detail(item as CommunityPost) : ''}
                </p>
              </div>
              <span className="shrink-0 text-[11.5px] text-[#736E66]">
                {'createdAt' in item ? timeAgo(item.createdAt as string) : (item as { when: string }).when}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TrustSection() {
  const { t } = useI18n();
  const points = [
    {
      icon: BadgeCheck,
      title: 'Human review before anything goes live',
      body: 'Every bill is checked by a moderator against its uploaded receipt before it appears in Discover.',
    },
    {
      icon: Lock,
      title: 'Receipts are private by default',
      body: 'Original documents live in private storage. The public page only ever shows a redacted preview.',
    },
    {
      icon: ScanEye,
      title: 'Fees and totals shown before you pay',
      body: 'The confirmation screen lists the amount, any platform fee, and the exact total. Swiping never charges you.',
    },
    {
      icon: Star,
      title: 'No poverty leaderboards',
      body: 'We do not rank people by need or helpers by generosity. Achievements track presence, never spending.',
    },
  ];
  return (
    <section className="border-y border-line bg-[#F5F2EC]/70">
      <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:py-20">
        <div className="grid gap-9 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-16">
          <div>
            <Pill tone="brand" icon={<Lock className="size-3" aria-hidden="true" />}>
              {t('Trust & safety')}
            </Pill>
            <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.035em] sm:text-[36px]">
              {t('Money between strangers needs guardrails, not vibes.')}
            </h2>
            <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[#5C5862]">
              {t('BILL SWIPE is designed so that no swipe, tap, or stray request can move money without an explicit, itemised confirmation.')}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {points.map((point) => (
              <div key={point.title} className="rounded-2xl border border-line bg-white p-4">
                <point.icon className="size-[18px] text-brand-ink" aria-hidden="true" />
                <h3 className="mt-2.5 text-[14px] font-semibold leading-snug">{t(point.title)}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t(point.body)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const { t } = useI18n();
  const items = [
    {
      q: 'Does swiping right send money?',
      a: 'No. A right swipe records that you are willing to help and opens the amount picker. Nothing is charged until you pick an amount, review the itemised total, and confirm on the payment screen.',
    },
    {
      q: 'Is this deployment handling real money?',
      a: 'Not yet. This build runs a clearly-labelled Payment Sandbox. Every payment is marked as a sandbox transaction, the server settles it, and no card or bank is ever charged. Switching to a real provider is a configuration change, not a rewrite.',
    },
    {
      q: 'Who can see my receipt?',
      a: 'Only you and the moderation team. Originals are stored privately; the public bill page shows a redacted preview at most. Please cover ID numbers, card numbers, full addresses and medical details before uploading.',
    },
    {
      q: 'What if a bill is fully funded?',
      a: 'It flips to Fully Funded automatically, new payments are refused at the API level, and both the owner and everyone who helped get a notification.',
    },
    {
      q: 'Can I stay anonymous?',
      a: 'Yes. Anonymous help hides your name from the bill owner and community feed, but our moderation team can still see the record if there is a dispute.',
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-[880px] px-5 py-14 sm:px-8 lg:py-20">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink">{t('FAQ')}</p>
        <h2 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.035em] sm:text-[36px]">
          {t('The questions people actually ask')}
        </h2>
      </div>
      <div className="mt-8 divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-white">
        {items.map((item, i) => (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#FBFAF8]"
            >
              <span className="text-[14.5px] font-semibold">{t(item.q)}</span>
              <ChevronDown
                className={`size-4 shrink-0 text-muted transition-transform ${open === i ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="overflow-hidden"
              >
                <p className="px-5 pb-4 text-[13.5px] leading-relaxed text-[#5C5862]">{t(item.a)}</p>
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta({ user }: { user: { displayName: string } | null }) {
  const { t } = useI18n();
  return (
    <section className="mx-auto max-w-[1440px] px-5 pb-16 sm:px-8">
      <div className="relative overflow-hidden rounded-[28px] bg-[#191919] px-6 py-12 text-center sm:px-12 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(60% 80% at 20% 0%, rgba(121,87,255,0.55), transparent 60%), radial-gradient(50% 70% at 85% 20%, rgba(255,113,139,0.4), transparent 60%), radial-gradient(50% 60% at 50% 100%, rgba(41,197,138,0.3), transparent 62%)',
          }}
        />
        <div className="relative">
          <Logo size={44} className="mx-auto" />
          <h2 className="mx-auto mt-5 max-w-2xl text-[30px] font-semibold leading-tight tracking-[-0.035em] text-white sm:text-[42px]">
            {user ? t('Ready when you are, {name}.', { name: user.displayName.split(' ')[0]! }) : t('Someone is one swipe away from a better day.')}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-white/65">
            {t('Free to browse. Free to post. You only ever pay when you decide to help, and you always see the total first.')}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton to="/discover" size="lg" variant="help" trailing={<ArrowRight className="size-4" aria-hidden="true" />}>
              {t('Start swiping')}
            </LinkButton>
            <LinkButton
              to={user ? '/bills/new' : '/register'}
              size="lg"
              variant="ghost"
              className="border border-white/20 bg-white/10 text-white hover:bg-white/15"
            >
              {t('Post your bill')}
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}

export { Button };

