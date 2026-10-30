import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context, Next } from 'hono';
import { Core, ipHash, type Env } from './env';
import { sha256Hex } from './auth/crypto';
import { z } from 'zod';
import type { MeProfile } from '@shared/types';

export const SESSION_COOKIE = 'billswipe_session';

type Variables = {
  user: MeProfile | null;
  core: Core;
  ip: string;
  sid: string;
};

export interface AppEnv {
  Bindings: Env;
  Variables: Variables;
}

export const api = new Hono<AppEnv>().basePath('/api');

function fail(c: Context<AppEnv>, status: number, code: string, message: string, fields?: Record<string, string>) {
  return c.json({ error: { code, message, fields } }, status as never);
}

/** Resolve the session cookie to a user (never trusts client-supplied ids). */
async function loadUser(c: Context<AppEnv>): Promise<MeProfile | null> {
  const token = getCookie(c, SESSION_COOKIE) ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return null;
  try {
    const user = await c.get('core').call<MeProfile | null>('auth.session', { token });
    return user ?? null;
  } catch {
    return null;
  }
}

api.use('*', async (c, next) => {
  const core = new Core(c.env);
  c.set('core', core);
  c.set('sid', crypto.randomUUID());
  c.set('ip', await ipHash(c.req.raw, c.env.SESSION_SECRET ?? 'billswipe-ip'));
  c.set('user', null);
  await next();
  c.header('x-request-id', c.get('sid'));
  c.header('x-content-type-options', 'nosniff');
  c.header('referrer-policy', 'strict-origin-when-cross-origin');
});

/** Attach the current user where routes need it. */
const withUser = async (c: Context<AppEnv>, next: Next) => {
  c.set('user', await loadUser(c));
  await next();
};

function requireUser(c: Context<AppEnv>): MeProfile {
  const user = c.get('user');
  if (!user) throw new HttpError(401, 'unauthorized', 'Please sign in to continue.');
  return user;
}

function requireAdmin(c: Context<AppEnv>): MeProfile {
  const user = requireUser(c);
  if (user.role !== 'admin') throw new HttpError(403, 'forbidden', 'Admin access required.');
  return user;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

function callOptions(c: Context<AppEnv>) {
  return { __ip: c.get('ip'), __userAgent: c.req.header('user-agent') ?? '' };
}

/** Uniform error mapping for DomainError codes bubbling out of the core. */
api.onError((err, c) => {
  if (err instanceof HttpError) return fail(c, err.status, err.code, err.message, err.fields);
  const anyErr = err as Error & { code?: string; fields?: Record<string, string> };
  if (anyErr.code && typeof anyErr.code === 'string') {
    const status =
      anyErr.code === 'not_found'
        ? 404
        : anyErr.code === 'forbidden' || anyErr.code === 'own_bill' || anyErr.code === 'account_banned'
          ? 403
          : anyErr.code === 'unauthorized'
            ? 401
            : anyErr.code === 'internal_error'
              ? 500
              : 400;
    return fail(c, status, anyErr.code, anyErr.message || 'Request failed.', anyErr.fields);
  }
  console.error('api_error', err);
  if (c.env.DEBUG_ERRORS === 'true') {
    const e = err as Error;
    return fail(c, 500, 'internal_error', `${e.message}\n${e.stack ?? ''}`);
  }
  return fail(c, 500, 'internal_error', 'Something went wrong on our side. Please try again.');
});

/**
 * Rate limits are environment-tunable so a shared demo deployment can allow
 * more sign-ups than a tight production configuration would. Defaults here are
 * the production-safe values.
 */
function limitFor(c: Context<AppEnv>, name: string, fallback: number): number {
  const raw = (c.env as unknown as Record<string, unknown>)[`RL_${name.toUpperCase()}`];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function guard(c: Context<AppEnv>, bucket: string, limit: number, windowMs: number) {
  const user = c.get('user');
  const key = `${bucket}:${user?.id ?? c.get('ip')}`;
  const core = c.get('core');
  // Rate limiting uses the same single-writer store for a consistent view.
  const result = await core.call<{ allowed: boolean; retryAfter: number }>('system.ratelimit', {
    bucket: key,
    limit,
    windowMs,
  });
  if (!result.allowed) {
    c.header('retry-after', String(result.retryAfter));
    throw new HttpError(429, 'rate_limited', 'Too many requests 閳?please slow down a moment.');
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().min(3).max(200),
  password: z.string().min(8).max(200),
  username: z.string().min(3).max(20),
  displayName: z.string().min(1).max(40).optional(),
  country: z.string().max(2).optional(),
  region: z.string().max(40).optional(),
});

api.post('/auth/register', withUser, async (c) => {
  await guard(c, 'register', limitFor(c, 'register', 10), 60 * 60 * 1000);
  const parsed = registerSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, 'invalid_request', 'Please check the form.', fieldErrors(parsed.error));
  const result = await c.get('core').call<{ user: MeProfile; token: string }>('auth.register', {
    ...parsed.data,
    ...callOptions(c),
  });
  setSessionCookie(c, result.token);
  return c.json({ user: result.user });
});

api.post('/auth/login', withUser, async (c) => {
  await guard(c, 'login', limitFor(c, 'login', 20), 15 * 60 * 1000);
  const parsed = z
    .object({ email: z.string().min(3), password: z.string().min(1) })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, 'invalid_request', 'Enter your email and password.');
  const result = await c.get('core').call<{ user: MeProfile; token: string }>('auth.login', {
    ...parsed.data,
    ...callOptions(c),
  });
  setSessionCookie(c, result.token);
  return c.json({ user: result.user });
});

api.post('/auth/logout', withUser, async (c) => {
  const token = getCookie(c, SESSION_COOKIE) ?? '';
  if (token) await c.get('core').call('auth.logout', { token });
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

api.get('/auth/session', withUser, (c) => {
  const user = c.get('user');
  return c.json({ user });
});

api.post('/auth/password', withUser, async (c) => {
  const user = requireUser(c);
  const parsed = z
    .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(200) })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, 'invalid_request', 'Check the password fields.');
  await c.get('core').call('auth.changePassword', { userId: user.id, ...parsed.data });
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

function setSessionCookie(c: Context<AppEnv>, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== 'development',
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

api.get('/me', withUser, async (c) => {
  const user = requireUser(c);
  const profile = await c.get('core').call('profile.get', { userId: user.id });
  return c.json({ user: profile });
});

api.patch('/me', withUser, async (c) => {
  const user = requireUser(c);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = z
    .object({
      displayName: z.string().min(1).max(40).optional(),
      bio: z.string().max(300).optional(),
      country: z.string().length(2).optional(),
      region: z.string().max(40).optional(),
      anonymousByDefault: z.boolean().optional(),
      publicProfile: z.boolean().optional(),
      notifyEmail: z.boolean().optional(),
      notifyInApp: z.boolean().optional(),
      locale: z.enum(['en', 'zh']).optional(),
      avatarUrl: z.string().max(500).nullable().optional(),
    })
    .safeParse(body);
  if (!parsed.success) throw new HttpError(400, 'invalid_request', 'Check the fields.', fieldErrors(parsed.error));
  const updated = await c.get('core').call('profile.update', { userId: user.id, patch: parsed.data });
  return c.json({ user: updated });
});

api.get('/me/notifications', withUser, async (c) => {
  const user = requireUser(c);
  return c.json(await c.get('core').call('notifications.list', { userId: user.id }));
});

api.post('/me/notifications/read', withUser, async (c) => {
  const user = requireUser(c);
  const body = (await c.req.json().catch(() => ({}))) as { ids?: string[] };
  return c.json(await c.get('core').call('notifications.read', { userId: user.id, ids: body.ids }));
});

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

api.get('/bills/discover', withUser, async (c) => {
  const user = c.get('user');
  const q = c.req.query();
  const feed = await c.get('core').call<{ bills: unknown[]; remaining: number }>('bill.discover', {
    viewerId: user?.id ?? null,
    input: {
      cursor: q.cursor ?? null,
      limit: Number(q.limit ?? 10),
      category: q.category ?? null,
      minAmount: q.minAmount ? Number(q.minAmount) : null,
      maxAmount: q.maxAmount ? Number(q.maxAmount) : null,
      sort: (q.sort as 'recent' | 'urgent' | 'small') ?? 'recent',
    },
  });
  return c.json(feed, 200, { 'cache-control': 'private, no-store' });
});

api.get('/bills/mine', withUser, async (c) => {
  const user = requireUser(c);
  return c.json({ bills: await c.get('core').call('bill.list', { userId: user.id }) });
});

api.get('/bills/:id', withUser, async (c) => {
  const user = c.get('user');
  const bill = await c.get('core').call('bill.get', {
    billId: c.req.param('id'),
    viewerId: user?.id ?? null,
    isAdmin: user?.role === 'admin',
  });
  return c.json({ bill });
});

const billSchema = z.object({
  title: z.string().min(6).max(90),
  description: z.string().min(60).max(2000),
  category: z.string().min(2).max(30),
  targetAmount: z.number().int().min(100).max(5_000_000),
  currency: z.string().length(3).default('USD'),
  dueDate: z.string().max(40).nullable().optional(),
  paidAmount: z.number().int().min(0).optional(),
  settlementHandle: z.string().max(80).optional(),
  receiptId: z.string().max(60).nullable().optional(),
});

api.post('/bills', withUser, async (c) => {
  const user = requireUser(c);
  await guard(c, 'bill-create', limitFor(c, 'bill-create', 10), 24 * 60 * 60 * 1000);
  const parsed = billSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, 'invalid_request', 'Check the bill details.', fieldErrors(parsed.error));
  const bill = await c.get('core').call('bill.create', { userId: user.id, input: parsed.data });
  return c.json({ bill }, 201);
});

api.patch('/bills/:id', withUser, async (c) => {
  const user = requireUser(c);
  const parsed = billSchema.partial().extend({ resubmit: z.boolean().optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, 'invalid_request', 'Check the bill details.', fieldErrors(parsed.error));
  const bill = await c.get('core').call('bill.update', {
    userId: user.id,
    billId: c.req.param('id'),
    input: parsed.data,
  });
  return c.json({ bill });
});

api.post('/bills/:id/close', withUser, async (c) => {
  const user = requireUser(c);
  return c.json(await c.get('core').call('bill.close', { userId: user.id, billId: c.req.param('id') }));
});

api.post('/bills/:id/updates', withUser, async (c) => {
  const user = requireUser(c);
  const body = (await c.req.json().catch(() => ({}))) as { body?: string };
  return c.json(
    await c.get('core').call('bill.update.post', { userId: user.id, billId: c.req.param('id'), body: body.body ?? '' }),
  );
});

api.post('/bills/:id/swipe', withUser, async (c) => {
  const user = requireUser(c);
  const body = (await c.req.json().catch(() => ({}))) as { action?: string };
  const action = body.action === 'pass' ? 'pass' : body.action === 'super_help' ? 'super_help' : 'help';
  const result = await c.get('core').call('swipe.record', { userId: user.id, billId: c.req.param('id'), action });
  return c.json(result);
});

api.post('/swipes/undo', withUser, async (c) => {
  const user = requireUser(c);
  return c.json(await c.get('core').call('swipe.undo', { userId: user.id }));
});

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  billId: z.string().min(4),
  amount: z.number().int().min(100).max(500_000),
  isAnonymous: z.boolean().optional(),
  message: z.string().max(280).optional(),
  idempotencyKey: z.string().min(8).max(80),
});

api.post('/payments/intent', withUser, async (c) => {
  const user = requireUser(c);
  await guard(c, 'payment-intent', limitFor(c, 'payment-intent', 30), 10 * 60 * 1000);
  const parsed = paymentSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, 'invalid_request', 'Check the payment details.', fieldErrors(parsed.error));
  const result = await c.get('core').call('payment.create', { userId: user.id, input: parsed.data });
  return c.json(result, 201);
});

/**
 * Sandbox settlement. Server-side authoritative: the client never decides the
 * outcome; it only requests that the sandbox provider settle an existing intent.
 * Disabled when a real payment provider is configured.
 */
api.post('/payments/:id/sandbox/settle', withUser, async (c) => {
  const user = requireUser(c);
  if (c.env.PAYMENT_MODE !== 'sandbox') {
    throw new HttpError(400, 'sandbox_disabled', 'Sandbox payments are disabled on this deployment.');
  }
  await guard(c, 'payment-settle', limitFor(c, 'payment-settle', 30), 10 * 60 * 1000);
  const payment = await c.get('core').call<{ id: string; status: string }>('payment.get', {
    paymentId: c.req.param('id'),
    viewer: user,
  });
  if (payment.status === 'succeeded') {
    return c.json({ payment, alreadySettled: true });
  }
  const result = await c.get('core').call('payment.settle', {
    paymentId: c.req.param('id'),
    source: 'sandbox',
    providerPaymentId: `sandbox_${c.req.param('id')}`,
  });
  return c.json(result);
});

api.post('/payments/:id/fail', withUser, async (c) => {
  const user = requireUser(c);
  const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
  await c.get('core').call('payment.get', { paymentId: c.req.param('id'), viewer: user });
  return c.json(await c.get('core').call('payment.fail', { paymentId: c.req.param('id'), reason: body.reason ?? 'declined' }));
});

api.get('/payments/mine', withUser, async (c) => {
  const user = requireUser(c);
  return c.json({ payments: await c.get('core').call('payment.mine', { userId: user.id }) });
});

api.get('/payments/received', withUser, async (c) => {
  const user = requireUser(c);
  return c.json(await c.get('core').call('payment.received', { userId: user.id }));
});

api.get('/payments/:id', withUser, async (c) => {
  const user = requireUser(c);
  const payment = await c.get('core').call('payment.get', { paymentId: c.req.param('id'), viewer: user });
  return c.json({ payment });
});

// ---------------------------------------------------------------------------
// Community
// ---------------------------------------------------------------------------

api.get('/community', withUser, async (c) => {
  const user = c.get('user');
  const [feed, stats] = await Promise.all([
    c.get('core').call('community.feed', { viewerId: user?.id ?? null, limit: Number(c.req.query('limit') ?? 20) }),
    c.get('core').call('community.stats', {}),
  ]);
  return c.json({ posts: feed, stats });
});

api.post('/community/:id/like', withUser, async (c) => {
  const user = requireUser(c);
  await guard(c, 'like', limitFor(c, 'like', 120), 60 * 60 * 1000);
  return c.json(await c.get('core').call('community.like', { userId: user.id, postId: c.req.param('id') }));
});

api.post('/community/:id/comments', withUser, async (c) => {
  const user = requireUser(c);
  await guard(c, 'comment', limitFor(c, 'comment', 20), 60 * 60 * 1000);
  const body = (await c.req.json().catch(() => ({}))) as { body?: string };
  return c.json(await c.get('core').call('community.comment', { userId: user.id, postId: c.req.param('id'), body: body.body ?? '' }));
});

// ---------------------------------------------------------------------------
// Receipt upload (private storage, admin-only originals)
// ---------------------------------------------------------------------------

const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

api.post('/receipts', withUser, async (c) => {
  const user = requireUser(c);
  await guard(c, 'receipt-upload', limitFor(c, 'receipt-upload', 20), 60 * 60 * 1000);
  const parsed = z
    .object({
      fileName: z.string().min(1).max(120),
      mimeType: z.string().min(3).max(80),
      data: z.string().min(16).max(12_000_000),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, 'invalid_request', 'That file could not be read.');

  if (!ALLOWED_RECEIPT_TYPES.includes(parsed.data.mimeType)) {
    throw new HttpError(400, 'invalid_type', 'Use JPG, PNG, WEBP, GIF or PDF.');
  }

  let bytes: Uint8Array;
  try {
    const binary = atob(parsed.data.data);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    throw new HttpError(400, 'invalid_data', 'That file could not be decoded.');
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_RECEIPT_BYTES) {
    throw new HttpError(400, 'invalid_size', 'Receipts must be under 8 MB.');
  }

  // Verify magic bytes so a renamed executable cannot masquerade as an image.
  const magic = detectMagic(bytes);
  if (!magic || magic !== parsed.data.mimeType) {
    throw new HttpError(400, 'invalid_type', 'The file content does not match its type.');
  }

  const digest = await sha256Hex(bytes.buffer.slice(0) as ArrayBuffer);
  const key = `${user.id}/${digest.slice(0, 24)}`;
  const bucket = c.env.RECEIPTS;
  if (!bucket) throw new HttpError(503, 'storage_unavailable', 'Receipt storage is not configured.');

  await bucket.put(`private/${key}`, bytes, {
    httpMetadata: { contentType: parsed.data.mimeType },
    customMetadata: { owner: user.id, fileName: encodeURIComponent(parsed.data.fileName) },
  });

  const receipt = await c.get('core').call<{ id: string; publicPath: string | null }>('receipt.create', {
    userId: user.id,
    userIdForPath: key,
    fileName: parsed.data.fileName,
    mimeType: parsed.data.mimeType,
    size: bytes.byteLength,
    sha256: digest,
  });
  return c.json({ receipt }, 201);
});

function detectMagic(bytes: Uint8Array): string | null {
  const hex = Array.from(bytes.subarray(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e47')) return 'image/png';
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'image/webp';
  if (hex.startsWith('47494638')) return 'image/gif';
  if (hex.startsWith('25504446')) return 'application/pdf';
  return null;
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

api.post('/reports', withUser, async (c) => {
  const user = requireUser(c);
  await guard(c, 'report', limitFor(c, 'report', 10), 60 * 60 * 1000);
  const parsed = z
    .object({
      targetType: z.enum(['bill', 'user', 'comment']),
      targetId: z.string().min(3),
      reason: z.string().min(3).max(80),
      details: z.string().max(1000).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new HttpError(400, 'invalid_request', 'Choose a reason for the report.');
  return c.json(await c.get('core').call('report.submit', { userId: user.id, input: parsed.data }));
});

api.post('/blocks', withUser, async (c) => {
  const user = requireUser(c);
  const body = (await c.req.json().catch(() => ({}))) as { targetId?: string };
  return c.json(await c.get('core').call('block.add', { userId: user.id, targetId: body.targetId ?? '' }));
});

api.get('/blocks', withUser, async (c) => {
  const user = requireUser(c);
  return c.json({ users: await c.get('core').call('block.list', { userId: user.id }) });
});

// ---------------------------------------------------------------------------
// Admin (server-side role check on every route)
// ---------------------------------------------------------------------------

const admin = new Hono<AppEnv>();
admin.use('*', withUser);
admin.use('*', async (c, next) => {
  requireAdmin(c);
  await next();
});

admin.get('/overview', async (c) => c.json(await c.get('core').call('admin.overview', {})));
admin.get('/bills', async (c) =>
  c.json({
    bills: await c.get('core').call('admin.bills', {
      filters: { status: c.req.query('status') ?? 'all', q: c.req.query('q') ?? '', limit: Number(c.req.query('limit') ?? 50) },
    }),
  }),
);
admin.post('/bills/:id/review', async (c) => {
  const user = requireAdmin(c);
  const body = (await c.req.json().catch(() => ({}))) as { action?: string; note?: string };
  const action = body.action;
  if (!['approve', 'reject', 'suspend', 'close', 'reopen'].includes(action ?? '')) {
    throw new HttpError(400, 'invalid_request', 'Unknown review action.');
  }
  return c.json(await c.get('core').call('admin.bill.review', { adminId: user.id, billId: c.req.param('id'), action, note: body.note ?? '' }));
});
admin.get('/users', async (c) =>
  c.json({
    users: await c.get('core').call('admin.users', { filters: { q: c.req.query('q') ?? '', limit: Number(c.req.query('limit') ?? 50) } }),
  }),
);
admin.post('/users/:id/status', async (c) => {
  const user = requireAdmin(c);
  const body = (await c.req.json().catch(() => ({}))) as { status?: string; reason?: string };
  if (!['active', 'restricted', 'banned'].includes(body.status ?? '')) {
    throw new HttpError(400, 'invalid_request', 'Unknown status.');
  }
  return c.json(await c.get('core').call('admin.user.status', { adminId: user.id, userId: c.req.param('id'), status: body.status, reason: body.reason ?? '' }));
});
admin.get('/payments', async (c) => c.json({ payments: await c.get('core').call('admin.payments', { limit: Number(c.req.query('limit') ?? 60) }) }));
admin.post('/payments/:id/refund', async (c) => {
  const user = requireAdmin(c);
  const body = (await c.req.json().catch(() => ({}))) as { note?: string };
  return c.json(await c.get('core').call('payment.refund', { adminId: user.id, paymentId: c.req.param('id'), note: body.note ?? 'Refunded by admin' }));
});
admin.get('/reports', async (c) => c.json({ reports: await c.get('core').call('admin.reports', {}) }));
admin.post('/reports/:id/resolve', async (c) => {
  const user = requireAdmin(c);
  const body = (await c.req.json().catch(() => ({}))) as { status?: string; resolution?: string };
  if (!['reviewing', 'resolved', 'dismissed'].includes(body.status ?? '')) throw new HttpError(400, 'invalid_request', 'Unknown status.');
  return c.json(await c.get('core').call('admin.report.resolve', { adminId: user.id, reportId: c.req.param('id'), status: body.status, resolution: body.resolution ?? '' }));
});
admin.get('/audit', async (c) => c.json({ logs: await c.get('core').call('admin.audit', { limit: Number(c.req.query('limit') ?? 50) }) }));

/** Private receipt originals - admins only, never publicly cached. */
admin.get('/receipts/:id', async (c) => {
  requireAdmin(c);
  const receipt = await c.get('core').call<{ privateKey: string; mimeType: string } | null>('receipt.get', {
    receiptId: c.req.param('id'),
  });
  if (!receipt) return fail(c, 404, 'not_found', 'Receipt not found.');
  const bucket = c.env.RECEIPTS;
  if (!bucket) return fail(c, 404, 'not_found', 'Media not configured.');
  const object = await bucket.get(`private/${receipt.privateKey}`);
  if (!object) return fail(c, 404, 'not_found', 'Receipt file missing.');
  return new Response(object.body, {
    headers: {
      'content-type': receipt.mimeType,
      'cache-control': 'private, no-store',
      'content-disposition': 'inline',
      'x-content-type-options': 'nosniff',
    },
  });
});

api.route('/admin', admin);

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/**
 * Public (redacted) receipt images. Only images the bill owner explicitly
 * published are served; private originals never leave the admin scope.
 */
api.get('/media/public/:key{.+}', async (c) => {
  const key = c.req.param('key');
  if (!key || key.includes('..')) return fail(c, 400, 'invalid_key', 'Bad key.');
  const bucket = c.env.RECEIPTS;
  if (!bucket) return fail(c, 404, 'not_found', 'Media not configured.');
  const object = await bucket.get(`public/${key}`);
  if (!object) return fail(c, 404, 'not_found', 'Image not found.');
  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
});

/** Private originals 閳?admin only. */
api.get('/media/private/:key{.+}', withUser, async (c) => {
  requireAdmin(c);
  const key = c.req.param('key');
  if (!key || key.includes('..')) return fail(c, 400, 'invalid_key', 'Bad key.');
  const bucket = c.env.RECEIPTS;
  if (!bucket) return fail(c, 404, 'not_found', 'Media not configured.');
  const object = await bucket.get(`private/${key}`);
  if (!object) return fail(c, 404, 'not_found', 'Receipt not found.');
  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'private, no-store',
      'content-disposition': 'inline',
      'x-content-type-options': 'nosniff',
    },
  });
});

api.get('/health', (c) => c.json({ ok: true, env: c.env.ENVIRONMENT, paymentMode: c.env.PAYMENT_MODE }));

api.notFound((c) => fail(c, 404, 'not_found', 'Endpoint not found.'));


