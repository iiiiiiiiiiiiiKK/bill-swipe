import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { usePostCopy } from '@/lib/communityCopy';
import { useDemoTitle } from '@/lib/demoContent';
import { Link } from 'react-router-dom';
import { Heart, HeartHandshake, Loader2, MessageCircle, Send, Sparkles, Users } from 'lucide-react';
import type { CommunityPost, CommunityStats } from '@shared/types';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/layout/AppShell';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Pill, Skeleton } from '@/components/ui/Primitives';
import { cn } from '@/lib/utils';

export default function Community() {
  const { t, timeAgo, money, num } = useI18n();
  const postCopy = usePostCopy();
  const demoTtitle = useDemoTitle();
  const { user } = useAuth();
  const toast = useToast();
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ posts: CommunityPost[]; stats: CommunityStats }>('/community?limit=30')
      .then((res) => {
        if (cancelled) return;
        setPosts(res.posts);
        setStats(res.stats);
      })
      .catch((err) => !cancelled && setError(err instanceof ApiRequestError ? err.message : 'Could not load the feed.'))
      .finally(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function like(post: CommunityPost) {
    if (!user) {
      toast.info('Sign in to react', 'Create a free account in a few seconds.');
      return;
    }
    setPosts((list) =>
      list?.map((p) => (p.id === post.id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)) ?? null,
    );
    try {
      const res = await api.post<{ liked: boolean; likes: number }>(`/community/${post.id}/like`);
      setPosts((list) => list?.map((p) => (p.id === post.id ? { ...p, liked: res.liked, likes: res.likes } : p)) ?? null);
    } catch {
      /* revert silently on failure */
      setPosts((list) =>
        list?.map((p) => (p.id === post.id ? { ...p, liked: post.liked, likes: post.likes } : p)) ?? null,
      );
    }
  }

  async function submitComment(post: CommunityPost) {
    if (!user) {
      toast.info('Sign in to comment');
      return;
    }
    if (comment.trim().length < 2) return;
    setBusy(true);
    try {
      await api.post(`/community/${post.id}/comments`, { body: comment.trim() });
      setPosts(
        (list) =>
          list?.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  comments: [
                    ...p.comments,
                    {
                      id: Math.random().toString(36),
                      body: comment.trim(),
                      createdAt: new Date().toISOString(),
                      author: {
                        displayName: user.displayName,
                        username: user.username,
                        avatarUrl: user.avatarUrl,
                        avatarSeed: user.avatarSeed,
                      },
                    },
                  ],
                }
              : p,
          ) ?? null,
      );
      setComment('');
      toast.success('Comment posted');
    } catch (err) {
      toast.error('Could not comment', err instanceof ApiRequestError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHeader
        title={t('Community')}
        description={t('Real help, as it happens. Every entry is generated from an actual payment record.')}
      />

      {stats && (
        <div className="px-5 sm:px-8">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatCard icon={<Heart className="size-4" aria-hidden="true" />} label={t('Bills helped')} value={num(stats.billsHelped)} />
            <StatCard icon={<Sparkles className="size-4" aria-hidden="true" />} label="Given" value={money(stats.amountGiven, stats.currency)} />
            <StatCard icon={<Users className="size-4" aria-hidden="true" />} label={t('People supported')} value={num(stats.peopleSupported)} />
            <StatCard icon={<HeartHandshake className="size-4" aria-hidden="true" />} label="Connections" value={num(stats.connections)} />
          </div>
          {stats.demoIncluded && (
            <p className="mt-2 text-[11px] text-[#736E66]">
              {t('Includes labelled demo records seeded for this preview. No figures are fabricated beyond that.')}
            </p>
          )}
        </div>
      )}

      <div className="space-y-3 px-5 py-5 sm:px-8">
        {error && <p className="rounded-2xl bg-coral-soft px-4 py-3 text-[13px] text-[#C02444]">{error}</p>}

        {posts === null && !error && (
          <>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </>
        )}

        {posts?.length === 0 && (
          <div className="card-shell px-6 py-12 text-center">
            <p className="text-[15px] font-semibold">{t('No moments yet')}</p>
            <p className="mt-1 text-[13px] text-muted">{t('Be the first to help someone — it will show up right here.')}</p>
          </div>
        )}

        {posts?.map((post) => (
          <article key={post.id} className="rounded-[22px] border border-line bg-white p-4 shadow-soft">
            <div className="flex items-start gap-3">
              {post.actor ? (
                <Avatar name={post.actor.displayName} seed={post.actor.avatarSeed} src={post.actor.avatarUrl} size={38} />
              ) : (
                <span className="flex size-[38px] items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[13.5px] font-semibold">
                    {post.actor?.isAnonymous ? t('Someone kind') : t(post.actor?.displayName ?? 'BILL SWIPE')}
                  </p>
                  {post.kind === 'help' && <Pill tone="mint">{t('Helped')}</Pill>}
                  {post.kind === 'milestone' && <Pill tone="neutral">{t('Update')}</Pill>}
                  <span className="text-[11px] text-[#736E66]">· {timeAgo(post.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#3A3740]">{t(postCopy.headline(post))}</p>
                {post.detail && <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t(postCopy.detail(post))}</p>}
                {post.billId && (
                  <Link
                    to={`/bills/${post.billId}`}
                    className="mt-2 inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[#FAF8F5] px-2.5 text-[11.5px] font-semibold text-[#57534E] transition hover:bg-brand-soft hover:text-brand-ink"
                  >
                    {post.billTitle ? demoTtitle(post.billTitle) : t('View bill')} →
                  </Link>
                )}
                {post.amount !== null && (
                  <p className="money-tabular mt-2 text-[15px] font-bold">
                    {money(post.amount, post.currency)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 border-t border-line pt-2.5">
              <button
                type="button"
                onClick={() => void like(post)}
                className={cn(
                  'inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition',
                  post.liked ? 'text-[#C02444]' : 'text-muted hover:text-ink',
                )}
                aria-pressed={post.liked}
                aria-label={post.liked ? 'Remove reaction' : 'React to this'}
              >
                <Heart className={cn('size-3.5', post.liked && 'fill-current')} aria-hidden="true" />
                {post.likes}
              </button>
              <button
                type="button"
                onClick={() => setOpenComment(openComment === post.id ? null : post.id)}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold text-muted transition hover:text-ink"
                aria-expanded={openComment === post.id}
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
                {post.comments.length}
              </button>
            </div>

            {post.comments.length > 0 && (
              <ul className="mt-2 space-y-2 border-t border-line pt-2.5">
                {post.comments.map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <Avatar name={c.author.displayName} seed={c.author.avatarSeed} src={c.author.avatarUrl} size={22} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] leading-relaxed">
                        <span className="font-semibold">{t(c.author.displayName)}</span>{' '}
                        <span className="text-[#3A3740]">{c.body}</span>
                      </p>
                      <p className="text-[10px] text-[#7C776F]">{timeAgo(c.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {openComment === post.id && (
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitComment(post);
                  }}
                  placeholder={user ? 'Add a kind word…' : 'Sign in to comment'}
                  disabled={!user}
                  className="h-9 min-w-0 flex-1 rounded-xl border border-line px-3 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:bg-[#FAF8F5]"
                />
                <Button size="sm" onClick={() => void submitComment(post)} disabled={busy || !user} aria-label={t('Send comment')}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}
                </Button>
              </div>
            )}
          </article>
        ))}

        <p className="pt-2 text-center text-[11px] leading-relaxed text-[#736E66]">
          {t("Comments are rate-limited and moderated. Harassment or exposing someone's identity gets removed.")}
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">{icon}</span>
      <p className="money-tabular mt-2 text-[17px] font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10.5px] text-muted">{label}</p>
    </div>
  );
}
