import { DurableObject } from 'cloudflare:workers';
import { Db } from '../db';
import * as svc from './service';
import { DomainError } from './service';
import type { Env } from '../env';
import { ensureSeed } from '../seed/seed';
import * as rateLimiter from '../lib/ratelimit';

interface RpcEnvelope {
  method: string;
  payload: Record<string, unknown>;
}

type Handler = (ctx: svc.ServiceContext, payload: Record<string, unknown>) => unknown;

/**
 * The Core Durable Object owns the single SQLite database and serializes every
 * business operation, giving us transactional writes and atomic fund accounting.
 */
export class Core extends DurableObject<Env> {
  private db: Db;
  private ready: Promise<void>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.db = new Db(state.storage.sql, state.storage);
    this.ready = state.blockConcurrencyWhile(async () => {
      this.db.migrate();
      if (env.ALLOW_DEMO_SEED !== 'false') {
        await ensureSeed(this.db, env);
      }
    });
  }

  private context(payload: Record<string, unknown>): svc.ServiceContext {
    return {
      db: this.db,
      feeBps: Number((payload.__feeBps as string | number | undefined) ?? 0) || 0,
      env: this.env.ENVIRONMENT ?? 'production',
      paymentMode: (this.env.PAYMENT_MODE as string) ?? 'sandbox',
      ip: (payload.__ip as string | undefined) ?? undefined,
      userAgent: (payload.__userAgent as string | undefined) ?? undefined,
    };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);
    const secret = request.headers.get('x-core-secret');
    if (this.env.SESSION_SECRET && secret !== this.env.SESSION_SECRET) {
      return json({ ok: false, code: 'unauthorized' }, 401);
    }
    let envelope: RpcEnvelope;
    try {
      envelope = (await request.json()) as RpcEnvelope;
    } catch {
      return json({ ok: false, code: 'bad_request' }, 400);
    }
    const handler = HANDLERS[envelope.method];
    if (!handler) return json({ ok: false, code: 'unknown_method', message: envelope.method }, 404);
    await this.ready;
    try {
      const ctx = this.context(envelope.payload ?? {});
      const data = await handler(ctx, envelope.payload ?? {});
      return json({ ok: true, data });
    } catch (error) {
      if (error instanceof DomainError) {
        return json({ ok: false, code: error.code, message: error.message, fields: error.fields }, 400);
      }
      const err = error as Error & { code?: string };
      console.error('core_error', envelope.method, err?.stack ?? err);
      return json({ ok: false, code: err?.code ?? 'internal_error', message: err?.message ?? 'Internal error' }, 500);
    }
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const bool = (v: unknown): boolean => v === true || v === 'true' || v === 1;

const HANDLERS: Record<string, Handler> = {
  ping: () => ({ pong: true, at: new Date().toISOString() }),

  'system.ratelimit': (ctx, p) => {
    const { rateLimit: limit } = rateLimiter;
    return limit(ctx.db, str(p.bucket), num(p.limit), num(p.windowMs));
  },

  // auth
  'auth.register': (ctx, p) =>
    svc.registerUser(ctx, {
      email: str(p.email),
      password: str(p.password),
      username: str(p.username),
      displayName: str(p.displayName),
      country: str(p.country),
      region: str(p.region),
    }),
  'auth.login': (ctx, p) => svc.loginUser(ctx, { email: str(p.email), password: str(p.password) }),
  'auth.session': (ctx, p) => svc.resolveSession(ctx, str(p.token)),
  'auth.logout': (ctx, p) => svc.logout(ctx, str(p.token)),
  'auth.changePassword': (ctx, p) =>
    svc.changePassword(ctx, str(p.userId), str(p.currentPassword), str(p.newPassword)),

  // profile
  'profile.get': (ctx, p) => svc.profileFor(ctx, str(p.userId)),
  'profile.update': (ctx, p) => svc.updateProfile(ctx, str(p.userId), p.patch as svc.UpdateProfileInput),
  'profile.stats': (ctx, p) => svc.userStats(ctx, str(p.userId)),

  // bills
  'bill.create': (ctx, p) => svc.createBill(ctx, str(p.userId), p.input as svc.CreateBillInput),
  'bill.update': (ctx, p) => svc.updateBill(ctx, str(p.userId), str(p.billId), p.input as svc.UpdateBillInput),
  'bill.close': (ctx, p) => svc.closeBill(ctx, str(p.userId), str(p.billId)),
  'bill.get': (ctx, p) => svc.getBill(ctx, str(p.billId), (p.viewerId as string | null) ?? null, bool(p.isAdmin)),
  'bill.list': (ctx, p) => svc.myBills(ctx, str(p.userId)),
  'bill.update.post': (ctx, p) => svc.billUpdates(ctx, str(p.billId), str(p.userId), str(p.body)),
  'bill.discover': (ctx, p) =>
    svc.discoverBills(ctx, (p.viewerId as string | null) ?? null, p.input as svc.DiscoverInput),

  // swipes
  'swipe.record': (ctx, p) =>
    svc.recordSwipe(ctx, str(p.userId), str(p.billId), str(p.action) as 'pass' | 'help' | 'super_help'),
  'swipe.undo': (ctx, p) => svc.undoLastSwipe(ctx, str(p.userId)),

  // payments
  'payment.create': (ctx, p) => svc.createPaymentIntent(ctx, str(p.userId), p.input as svc.CreatePaymentInput),
  'payment.settle': (ctx, p) =>
    svc.settlePayment(ctx, str(p.paymentId), {
      providerPaymentId: (p.providerPaymentId as string | null) ?? null,
      source: (p.source as 'sandbox' | 'webhook' | 'admin') ?? 'sandbox',
    }),
  'payment.fail': (ctx, p) => svc.failPayment(ctx, str(p.paymentId), str(p.reason)),
  'payment.refund': (ctx, p) => svc.refundPayment(ctx, str(p.paymentId), str(p.adminId), str(p.note)),
  'payment.get': (ctx, p) => svc.paymentFor(ctx, str(p.paymentId), p.viewer as never),
  'payment.mine': (ctx, p) => svc.myPayments(ctx, str(p.userId)),
  'payment.received': (ctx, p) => svc.receivedHelp(ctx, str(p.userId)),

  // reports / safety
  'report.submit': (ctx, p) => svc.submitReport(ctx, str(p.userId), p.input as never),
  'block.add': (ctx, p) => svc.blockUser(ctx, str(p.userId), str(p.targetId)),
  'block.remove': (ctx, p) => svc.unblockUser(ctx, str(p.userId), str(p.targetId)),
  'block.list': (ctx, p) => svc.blockedUsers(ctx, str(p.userId)),

  // community
  'community.feed': (ctx, p) => svc.communityFeed(ctx, (p.viewerId as string | null) ?? null, num(p.limit) || 20),
  'community.like': (ctx, p) => svc.toggleLike(ctx, str(p.userId), str(p.postId)),
  'community.comment': (ctx, p) => svc.addComment(ctx, str(p.userId), str(p.postId), str(p.body)),
  'community.stats': (ctx) => svc.communityStats(ctx),

  // notifications
  'notifications.list': (ctx, p) => svc.notifications(ctx, str(p.userId)),
  'notifications.read': (ctx, p) => svc.markNotificationsRead(ctx, str(p.userId), p.ids as string[] | undefined),

  // receipts
  'receipt.create': (ctx, p) => svc.createReceipt(ctx, p as never),
  'receipt.get': (ctx, p) => svc.receptForAdmin(ctx, str(p.receiptId)),

  // admin
  'admin.overview': (ctx) => svc.adminOverview(ctx),
  'admin.bills': (ctx, p) => svc.adminBills(ctx, p.filters as { status?: string; q?: string; limit?: number }),
  'admin.bill.review': (ctx, p) =>
    svc.reviewBill(ctx, str(p.adminId), str(p.billId), str(p.action) as never, str(p.note)),
  'admin.users': (ctx, p) => svc.adminUsers(ctx, p.filters as { q?: string; limit?: number }),
  'admin.user.status': (ctx, p) =>
    svc.adminSetUserStatus(ctx, str(p.adminId), str(p.userId), str(p.status) as never, str(p.reason)),
  'admin.payments': (ctx, p) => svc.adminPayments(ctx, num(p.limit) || 60),
  'admin.reports': (ctx) => svc.adminReports(ctx),
  'admin.report.resolve': (ctx, p) =>
    svc.adminResolveReport(ctx, str(p.adminId), str(p.reportId), str(p.status) as never, str(p.resolution)),
  'admin.audit': (ctx, p) => svc.adminAuditLogs(ctx, num(p.limit) || 50),
};
