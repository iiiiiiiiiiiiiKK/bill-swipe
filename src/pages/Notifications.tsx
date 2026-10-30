import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Heart, Inbox, Loader2 } from 'lucide-react';
import type { NotificationItem } from '@shared/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Primitives';
import { cn, timeAgo } from '@/lib/utils';

export default function Notifications() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: '/notifications' } });
      return;
    }
    api
      .get<{ items: NotificationItem[]; unread: number }>('/me/notifications')
      .then((res) => {
        setItems(res.items);
        setUnread(res.unread);
      })
      .catch(() => setItems([]));
  }, [authLoading, user, navigate]);

  async function markAll() {
    setBusy(true);
    try {
      await api.post('/me/notifications/read', {});
      setItems((list) => list?.map((n) => ({ ...n, isRead: true })) ?? null);
      setUnread(0);
      toast.success('All caught up');
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || items === null) {
    return (
      <div className="mx-auto max-w-[720px] px-5 pt-6 sm:px-8">
        <Skeleton className="h-8 w-40" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : 'You are all caught up.'}
        action={
          unread > 0 ? (
            <Button size="sm" variant="pass" onClick={() => void markAll()} disabled={busy} icon={<CheckCheck className="size-3.5" aria-hidden="true" />}>
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <div className="px-5 pb-12 sm:px-8">
        {items.length === 0 ? (
          <div className="card-shell">
            <EmptyState
              icon={<Bell className="size-6" aria-hidden="true" />}
              title="Nothing yet"
              description="Payment confirmations, bill approvals and updates from bills you helped will land here."
              action={<LinkButton to="/discover">Find a bill to help</LinkButton>}
            />
          </div>
        ) : (
          <ul className="overflow-hidden rounded-[22px] border border-line bg-white">
            {items.map((item) => {
              const Wrapper = item.href ? LinkButton : 'div';
              void Wrapper;
              const content = (
                <>
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-xl',
                      item.type.includes('payment') || item.type.includes('helped') || item.type.includes('funded')
                        ? 'bg-mint-soft text-[#0F7A52]'
                        : item.type.includes('reject')
                          ? 'bg-coral-soft text-[#C02444]'
                          : 'bg-brand-soft text-brand-ink',
                    )}
                  >
                    {item.type.includes('helped') || item.type.includes('funded') ? (
                      <Heart className="size-4" aria-hidden="true" />
                    ) : (
                      <Inbox className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold">{item.title}</span>
                      {!item.isRead && <span className="size-1.5 shrink-0 rounded-full bg-coral" aria-label="Unread" />}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{item.body}</span>
                    <span className="mt-0.5 block text-[10.5px] text-[#7C776F]">{timeAgo(item.createdAt)}</span>
                  </span>
                </>
              );
              return (
                <li key={item.id} className={cn('border-b border-line last:border-0', !item.isRead && 'bg-[#FCFBF9]')}>
                  {item.href ? (
                    <button
                      type="button"
                      onClick={() => navigate(item.href!)}
                      className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition hover:bg-[#FBFAF8]"
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="flex items-start gap-3 px-3.5 py-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-[#736E66]">
          Email copies are queued for the same events. Toggle them off in your profile settings.
        </p>
        {busy && (
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Updating…
          </p>
        )}
      </div>
    </div>
  );
}
