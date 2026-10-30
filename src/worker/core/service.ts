import type { Db } from '../db';
import { nowIso } from '../db';
import type { BillRow, CommunityPostRow, HelpRecordRow, PaymentRow, ReportRow, SessionRow, SwipeRow, UserRow } from '../db/rows';
import { avatarSeedFor, hashPassword, randomId, randomToken, sha256Hex, verifyPassword } from '../auth/crypto';
import {
  billDetail,
  helperCountFor,
  helpRecordsFor,
  ownerOf,
  parseRiskFlags,
  paymentToDto,
  summarize,
} from './queries';
import { audit, detectRiskFlags, listNotifications, notify, queueEmail, unreadCount } from './notifications';
import { cleanText } from '../lib/serialize';
import type {
  Achievement,
  AdminBillRow,
  AdminOverview,
  AdminPaymentRow,
  AdminUserRow,
  AuditLog,
  BillDetail,
  BillSummary,
  CommunityPost,
  CommunityStats,
  MeProfile,
  NotificationItem,
  Paginated,
  Payment,
  PublicUser,
  Report,
  UserStats,
} from '@shared/types';
import { computeFee } from '@shared/money';
import { BILL_CATEGORIES } from '@shared/categories';

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MIN_HELP_AMOUNT = 100;
const MAX_HELP_AMOUNT = 500_000;

export interface ServiceContext {
  db: Db;
  feeBps: number;
  env: string;
  paymentMode: string;
  ip?: string;
  userAgent?: string;
}

type PublicUserLike = PublicUser;

function dtoProfile(user: UserRow, db: Db): MeProfile {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    avatarSeed: user.avatar_seed,
    bio: user.bio,
    country: user.country,
    region: user.region,
    createdAt: user.created_at,
    isDemo: user.is_demo === 1,
    email: user.email,
    emailVerified: user.email_verified === 1,
    role: user.role,
    accountStatus: user.account_status,
    anonymousByDefault: user.anonymous_by_default === 1,
    publicProfile: user.public_profile === 1,
    notifyEmail: user.notify_email === 1,
    notifyInApp: user.notify_in_app === 1,
    locale: user.locale,
    stats: statsFor(db, user.id),
    achievements: achievementsFor(db, user.id),
  };
}

function statsFor(db: Db, userId: string): UserStats {
  const helped = db.first<{ c: number; total: number | null }>(
    `SELECT COUNT(*) AS c, COALESCE(SUM(h.amount), 0) AS total
       FROM help_records h JOIN payments p ON p.id = h.payment_id
      WHERE h.payer_id = ? AND p.payment_status = 'succeeded'`,
    userId,
  );
  const posted = db.first<{ c: number }>('SELECT COUNT(*) AS c FROM bills WHERE user_id = ? AND bill_status <> ?', userId, 'draft');
  const completed = db.first<{ c: number }>(
    `SELECT COUNT(*) AS c FROM bills WHERE user_id = ? AND bill_status IN ('fully_funded','closed')`,
    userId,
  );
  return {
    helpedCount: helped?.c ?? 0,
    helpedAmount: helped?.total ?? 0,
    billsPosted: posted?.c ?? 0,
    billsCompleted: completed?.c ?? 0,
  };
}

function achievementsFor(db: Db, userId: string): Achievement[] {
  const stats = statsFor(db, userId);
  const hasHelped = stats.helpedCount > 0;
  const distinctCategories = db.first<{ c: number }>(
    `SELECT COUNT(DISTINCT b.category) AS c
       FROM help_records h
       JOIN payments p ON p.id = h.payment_id
       JOIN bills b ON b.id = h.bill_id
      WHERE h.payer_id = ? AND p.payment_status = 'succeeded'`,
    userId,
  )?.c ?? 0;
  const list: Achievement[] = [
    {
      id: 'first_helper',
      label: 'First Helper',
      description: 'You helped someone for the first time.',
      earned: hasHelped,
      progress: Math.min(1, stats.helpedCount / 1),
    },
    {
      id: 'kindness_starter',
      label: 'Kindness Starter',
      description: 'Help 3 different bills.',
      earned: stats.helpedCount >= 3,
      progress: Math.min(1, stats.helpedCount / 3),
    },
    {
      id: 'helping_hand',
      label: 'Helping Hand',
      description: 'Help 10 bills on your way.',
      earned: stats.helpedCount >= 10,
      progress: Math.min(1, stats.helpedCount / 10),
    },
    {
      id: 'good_samaritan',
      label: 'Good Samaritan',
      description: 'Spread help across 4 different bill categories.',
      earned: distinctCategories >= 4,
      progress: Math.min(1, distinctCategories / 4),
    },
    {
      id: 'community_hero',
      label: 'Community Hero',
      description: 'Reach 25 helps — no money ranking, just presence.',
      earned: stats.helpedCount >= 25,
      progress: Math.min(1, stats.helpedCount / 25),
    },
  ];
  return list;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
  displayName: string;
  country?: string;
  region?: string;
}

function assertUsername(username: string): void {
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new DomainError('invalid_username', 'Username must be 3–20 characters: letters, numbers or underscore.', {
      username: 'Use 3–20 lowercase letters, numbers or underscores.',
    });
  }
  const reserved = ['admin', 'billswipe', 'support', 'root', 'system', 'bills', 'api'];
  if (reserved.includes(username)) {
    throw new DomainError('invalid_username', 'That username is reserved.', { username: 'Pick a different username.' });
  }
}

export async function registerUser(ctx: ServiceContext, input: RegisterInput): Promise<{ user: MeProfile; token: string }> {
  const { db } = ctx;
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
    throw new DomainError('invalid_email', 'Enter a valid email address.', { email: 'That email looks incomplete.' });
  }
  if (input.password.length < 8) {
    throw new DomainError('weak_password', 'Password must be at least 8 characters.', {
      password: 'Use at least 8 characters.',
    });
  }
  const username = input.username.trim().toLowerCase();
  assertUsername(username);

  const existingEmail = db.first<{ id: string }>('SELECT id FROM users WHERE lower(email) = ?', email);
  if (existingEmail) throw new DomainError('email_taken', 'That email is already registered.', { email: 'Already registered — try signing in.' });
  const existingName = db.first<{ id: string }>('SELECT id FROM users WHERE lower(username) = ?', username);
  if (existingName) throw new DomainError('username_taken', 'That username is taken.', { username: 'Pick another one.' });

  const passwordHash = await hashPassword(input.password);
  const now = nowIso();
  const id = randomId('usr');
  const displayName = cleanText(input.displayName || username, 40) || username;

  db.run(
    `INSERT INTO users (id, email, email_verified, password_hash, username, display_name, avatar_url, avatar_seed,
       bio, country, region, role, account_status, created_at, updated_at, last_seen_at)
     VALUES (?, ?, 0, ?, ?, ?, NULL, ?, '', ?, ?, 'user', 'active', ?, ?, ?)`,
    id,
    email,
    passwordHash,
    username,
    displayName,
    avatarSeedFor(`${username}:${id}`),
    (input.country || 'US').slice(0, 2),
    cleanText(input.region || '', 40),
    now,
    now,
    now,
  );

  const token = await createSession(ctx, id);
  const user = db.first<UserRow>('SELECT * FROM users WHERE id = ?', id)!;
  queueEmail(
    db,
    email,
    'Verify your BILL SWIPE email',
    `Welcome to BILL SWIPE. Confirm your email to unlock posting bills from this address.`,
  );
  notify(db, {
    userId: id,
    type: 'welcome',
    title: 'Welcome to BILL SWIPE',
    body: 'Start swiping to see bills from people nearby — or post your own whenever you are ready.',
    href: '/discover',
    email: false,
  });
  return { user: dtoProfile(user, db), token };
}

export async function loginUser(
  ctx: ServiceContext,
  input: { email: string; password: string },
): Promise<{ user: MeProfile; token: string }> {
  const { db } = ctx;
  const email = input.email.trim().toLowerCase();
  const user = db.first<UserRow>('SELECT * FROM users WHERE lower(email) = ?', email);
  if (!user) throw new DomainError('invalid_credentials', 'Email or password is incorrect.');
  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) throw new DomainError('invalid_credentials', 'Email or password is incorrect.');
  if (user.account_status === 'banned') {
    throw new DomainError('account_banned', 'This account has been suspended. Contact support.');
  }
  db.run('UPDATE users SET last_seen_at = ?, updated_at = ? WHERE id = ?', nowIso(), nowIso(), user.id);
  const token = await createSession(ctx, user.id);
  return { user: dtoProfile(user, db), token };
}

async function createSession(ctx: ServiceContext, userId: string): Promise<string> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  ctx.db.run(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, user_agent, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    randomId('ses'),
    userId,
    tokenHash,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString(),
    ctx.userAgent?.slice(0, 200) ?? null,
    ctx.ip ?? null,
  );
  return token;
}

export async function resolveSession(ctx: ServiceContext, token: string): Promise<MeProfile | null> {
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const session = ctx.db.first<SessionRow>('SELECT * FROM sessions WHERE token_hash = ?', tokenHash);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    ctx.db.run('DELETE FROM sessions WHERE id = ?', session.id);
    return null;
  }
  const user = ctx.db.first<UserRow>('SELECT * FROM users WHERE id = ?', session.user_id);
  if (!user || user.account_status === 'banned') return null;
  return dtoProfile(user, ctx.db);
}

export async function logout(ctx: ServiceContext, token: string): Promise<{ ok: true }> {
  if (token) {
    const tokenHash = await sha256Hex(token);
    ctx.db.run('DELETE FROM sessions WHERE token_hash = ?', tokenHash);
  }
  return { ok: true };
}

export function userStats(ctx: ServiceContext, userId: string): UserStats {
  return statsFor(ctx.db, userId);
}

export function profileFor(ctx: ServiceContext, userId: string): MeProfile {
  const user = ctx.db.first<UserRow>('SELECT * FROM users WHERE id = ?', userId);
  if (!user) throw new DomainError('not_found', 'Account not found.');
  return dtoProfile(user, ctx.db);
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  country?: string;
  region?: string;
  anonymousByDefault?: boolean;
  publicProfile?: boolean;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
  locale?: 'en' | 'zh';
  avatarUrl?: string | null;
}

export function updateProfile(ctx: ServiceContext, userId: string, input: UpdateProfileInput): MeProfile {
  const { db } = ctx;
  const user = db.first<UserRow>('SELECT * FROM users WHERE id = ?', userId);
  if (!user) throw new DomainError('not_found', 'Account not found.');
  db.run(
    `UPDATE users SET display_name = ?, bio = ?, country = ?, region = ?, anonymous_by_default = ?,
       public_profile = ?, notify_email = ?, notify_in_app = ?, locale = ?, avatar_url = ?, updated_at = ?
     WHERE id = ?`,
    input.displayName !== undefined ? cleanText(input.displayName, 40) || user.display_name : user.display_name,
    input.bio !== undefined ? cleanText(input.bio, 300) : user.bio,
    input.country !== undefined ? input.country.slice(0, 2).toUpperCase() : user.country,
    input.region !== undefined ? cleanText(input.region, 40) : user.region,
    input.anonymousByDefault !== undefined ? Number(input.anonymousByDefault) : user.anonymous_by_default,
    input.publicProfile !== undefined ? Number(input.publicProfile) : user.public_profile,
    input.notifyEmail !== undefined ? Number(input.notifyEmail) : user.notify_email,
    input.notifyInApp !== undefined ? Number(input.notifyInApp) : user.notify_in_app,
    input.locale ?? user.locale,
    input.avatarUrl !== undefined ? input.avatarUrl : user.avatar_url,
    nowIso(),
    userId,
  );
  return dtoProfile(db.first<UserRow>('SELECT * FROM users WHERE id = ?', userId)!, db);
}

export function changePassword(
  ctx: ServiceContext,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true }> {
  return (async () => {
    const user = ctx.db.first<UserRow>('SELECT * FROM users WHERE id = ?', userId);
    if (!user) throw new DomainError('not_found', 'Account not found.');
    if (!(await verifyPassword(currentPassword, user.password_hash))) {
      throw new DomainError('invalid_password', 'Your current password is incorrect.', {
        currentPassword: 'Incorrect password.',
      });
    }
    if (newPassword.length < 8) {
      throw new DomainError('weak_password', 'Password must be at least 8 characters.', {
        newPassword: 'Use at least 8 characters.',
      });
    }
    const hash = await hashPassword(newPassword);
    ctx.db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hash, nowIso(), userId);
    ctx.db.run('DELETE FROM sessions WHERE user_id = ?', userId);
    return { ok: true as const };
  })();
}

export async function deleteSessions(ctx: ServiceContext, userId: string): Promise<{ ok: true }> {
  ctx.db.run('DELETE FROM sessions WHERE user_id = ?', userId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

export interface CreateBillInput {
  title: string;
  description: string;
  category: string;
  targetAmount: number;
  currency: string;
  dueDate?: string | null;
  paidAmount?: number;
  settlementHandle?: string;
  receiptId?: string | null;
}

const ALLOWED_CATEGORIES = BILL_CATEGORIES.map((c) => c.id);

export function createBill(ctx: ServiceContext, userId: string, input: CreateBillInput): BillSummary {
  const { db } = ctx;
  const user = db.first<UserRow>('SELECT * FROM users WHERE id = ?', userId);
  if (!user) throw new DomainError('not_found', 'Account not found.');
  if (user.account_status !== 'active') {
    throw new DomainError('account_restricted', 'Your account cannot post bills right now.');
  }
  const title = cleanText(input.title, 90);
  const description = cleanText(input.description, 2000);
  if (title.length < 6) throw new DomainError('invalid_title', 'Give your bill a clear title.', { title: 'At least 6 characters.' });
  if (description.length < 60) {
    throw new DomainError('invalid_story', 'Tell a bit more of your story.', { description: 'At least 60 characters.' });
  }
  if (!ALLOWED_CATEGORIES.includes(input.category as (typeof ALLOWED_CATEGORIES)[number])) {
    throw new DomainError('invalid_category', 'Choose a bill category.');
  }
  if (!Number.isInteger(input.targetAmount) || input.targetAmount < 100 || input.targetAmount > 5_000_000) {
    throw new DomainError('invalid_amount', 'Amount must be between 1.00 and 50,000.00.', {
      targetAmount: 'Between $1 and $50,000.',
    });
  }
  const paidAmount = Math.min(Math.max(0, input.paidAmount ?? 0), input.targetAmount);
  const receipt = input.receiptId
    ? db.first<{ id: string; private_key: string; public_key: string | null; sha256: string }>(
        'SELECT id, private_key, public_key, sha256 FROM receipts WHERE id = ? AND user_id = ?',
        input.receiptId,
        userId,
      )
    : null;

  const riskFlags = detectRiskFlags(db, {
    title,
    description,
    targetAmount: input.targetAmount,
    category: input.category,
    userId,
    receiptSha: receipt?.sha256 ?? '',
  });

  const now = nowIso();
  const id = randomId('bil');
  const fundraiseKey = randomId('fnd');
  db.transaction(() => {
    db.run(
      `INSERT INTO bills (id, user_id, title, description, category, target_amount, raised_amount, paid_amount, currency,
         due_date, settlement_handle, receipt_id, receipt_private_path, receipt_public_path, verification_status,
         bill_status, review_note, risk_flags, is_demo, fundraise_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending_review', NULL, ?, 0, ?, ?, ?)`,
      id,
      userId,
      title,
      description,
      input.category,
      input.targetAmount,
      paidAmount,
      input.currency || 'USD',
      input.dueDate ?? null,
      cleanText(input.settlementHandle ?? '', 80) || null,
      receipt?.id ?? null,
      receipt?.private_key ?? null,
      receipt?.public_key ?? null,
      JSON.stringify(riskFlags),
      fundraiseKey,
      now,
      now,
    );
    if (receipt) db.run('UPDATE receipts SET bill_id = ? WHERE id = ?', id, receipt.id);
    db.run(
      `INSERT INTO bill_updates (id, bill_id, body, author, created_at) VALUES (?, ?, ?, ?, ?)`,
      randomId('upd'),
      id,
      'Bill submitted for review.',
      'BILL SWIPE',
      now,
    );
    const admins = db.all<UserRow>(`SELECT * FROM users WHERE role = 'admin'`);
    for (const admin of admins) {
      notify(db, {
        userId: admin.id,
        type: 'admin_review',
        title: 'New bill awaiting review',
        body: `${title} — ${(input.targetAmount / 100).toFixed(2)} ${input.currency}`,
        href: `/admin/bills`,
        email: false,
      });
    }
  });

  const bill = db.first<BillRow>('SELECT * FROM bills WHERE id = ?', id)!;
  return summarize(db, bill, userId);
}

export interface UpdateBillInput {
  title?: string;
  description?: string;
  category?: string;
  targetAmount?: number;
  dueDate?: string | null;
  paidAmount?: number;
  settlementHandle?: string;
  receiptId?: string | null;
  resubmit?: boolean;
}

export function updateBill(ctx: ServiceContext, userId: string, billId: string, input: UpdateBillInput): BillSummary {
  const { db } = ctx;
  const bill = db.first<BillRow>('SELECT * FROM bills WHERE id = ?', billId);
  if (!bill) throw new DomainError('not_found', 'Bill not found.');
  if (bill.user_id !== userId) throw new DomainError('forbidden', 'You can only edit your own bills.');
  const locked = bill.raised_amount > 0 || ['active', 'fully_funded', 'closed', 'suspended'].includes(bill.bill_status);
  if (locked) {
    throw new DomainError(
      'bill_locked',
      'This bill already received help, so its amount and recipient are locked. Contact support for changes.',
    );
  }
  const title = input.title !== undefined ? cleanText(input.title, 90) : bill.title;
  const description = input.description !== undefined ? cleanText(input.description, 2000) : bill.description;
  if (title.length < 6) throw new DomainError('invalid_title', 'Title is too short.');
  if (description.length < 60) throw new DomainError('invalid_story', 'Story is too short.');
  const target = input.targetAmount ?? bill.target_amount;
  if (!Number.isInteger(target) || target < 100 || target > 5_000_000) {
    throw new DomainError('invalid_amount', 'Amount must be between 1.00 and 50,000.00.');
  }
  const receipt = input.receiptId
    ? db.first<{ id: string; private_key: string; public_key: string }>(
        'SELECT id, private_key, public_key FROM receipts WHERE id = ? AND user_id = ?',
        input.receiptId,
        userId,
      )
    : null;
  const nextStatus = input.resubmit && ['draft', 'rejected'].includes(bill.bill_status) ? 'pending_review' : bill.bill_status;
  const now = nowIso();
  db.run(
    `UPDATE bills SET title = ?, description = ?, category = ?, target_amount = ?, due_date = ?, paid_amount = ?,
       settlement_handle = ?, receipt_id = ?, receipt_private_path = ?, receipt_public_path = ?, bill_status = ?,
       verification_status = ?, updated_at = ?
     WHERE id = ?`,
    title,
    description,
    input.category ?? bill.category,
    target,
    input.dueDate !== undefined ? input.dueDate : bill.due_date,
    input.paidAmount !== undefined ? Math.min(Math.max(0, input.paidAmount), target) : bill.paid_amount,
    input.settlementHandle !== undefined ? cleanText(input.settlementHandle, 80) || null : bill.settlement_handle,
    receipt ? receipt.id : bill.receipt_id,
    receipt ? receipt.private_key : bill.receipt_private_path,
    receipt ? receipt.public_key : bill.receipt_public_path,
    nextStatus,
    nextStatus === 'pending_review' ? 'pending' : bill.verification_status,
    now,
    billId,
  );
  return summarize(db, db.first<BillRow>('SELECT * FROM bills WHERE id = ?', billId)!, userId);
}

export function closeBill(ctx: ServiceContext, userId: string, billId: string): { ok: true } {
  const { db } = ctx;
  const bill = db.first<BillRow>('SELECT * FROM bills WHERE id = ?', billId);
  if (!bill) throw new DomainError('not_found', 'Bill not found.');
  if (bill.user_id !== userId) throw new DomainError('forbidden', 'You can only close your own bill.');
  if (bill.bill_status === 'closed') return { ok: true };
  if (bill.raised_amount > 0) {
    throw new DomainError(
      'has_contributions',
      'Bills that received help cannot be closed from the app. Please contact support so we can handle refunds correctly.',
    );
  }
  db.run(`UPDATE bills SET bill_status = 'closed', updated_at = ? WHERE id = ?`, nowIso(), billId);
  return { ok: true };
}

export function getBill(ctx: ServiceContext, billId: string, viewerId: string | null, isAdmin: boolean): BillDetail {
  const { db } = ctx;
  const bill = db.first<BillRow>('SELECT * FROM bills WHERE id = ?', billId);
  if (!bill) throw new DomainError('not_found', 'Bill not found.');
  const viewer = viewerId ? db.first<UserRow>('SELECT * FROM users WHERE id = ?', viewerId) : null;
  const visible =
    isAdmin ||
    bill.user_id === viewerId ||
    ['active', 'fully_funded', 'closed', 'approved', 'rejected', 'pending_review', 'suspended'].includes(bill.bill_status);
  if (!visible) throw new DomainError('not_found', 'Bill not found.');
  return billDetail(db, bill, viewer);
}

export interface DiscoverInput {
  cursor?: string | null;
  limit?: number;
  category?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  sort?: 'recent' | 'urgent' | 'small';
  excludeSwiped?: boolean;
}

export function discoverBills(
  ctx: ServiceContext,
  viewerId: string | null,
  input: DiscoverInput,
): { bills: BillSummary[]; remaining: number } {
  const { db } = ctx;
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 30);
  const params: unknown[] = ['active', 'approved', 'fully_funded'];
  let where = `b.bill_status IN (?, ?, ?)`;

  if (input.category) {
    where += ` AND b.category = ?`;
    params.push(input.category);
  }
  if (input.minAmount ?? null) {
    where += ` AND b.target_amount >= ?`;
    params.push(input.minAmount);
  }
  if (input.maxAmount ?? null) {
    where += ` AND b.target_amount <= ?`;
    params.push(input.maxAmount);
  }
  if (viewerId && input.excludeSwiped !== false) {
    where += ` AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.bill_id = b.id AND s.user_id = ?)`;
    params.push(viewerId);
  }
  if (viewerId) {
    where += ` AND b.user_id <> ?`;
    params.push(viewerId);
    where += ` AND NOT EXISTS (SELECT 1 FROM blocked_users bu WHERE bu.user_id = ? AND bu.blocked_user_id = b.user_id)`;
    params.push(viewerId);
  }
  // Fully funded bills still surface so people can see the win, but only if recently funded.
  where += ` AND (b.bill_status = 'active' OR b.updated_at > ?)`;
  params.push(new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString());

  if (input.cursor) {
    where += ` AND b.created_at < ?`;
    params.push(input.cursor);
  }

  const order =
    input.sort === 'small'
      ? 'b.target_amount ASC, b.created_at DESC'
      : input.sort === 'urgent'
        ? '(b.due_date IS NULL) ASC, b.due_date ASC, b.created_at DESC'
        : 'b.created_at DESC';

  const rows = db.all<BillRow>(
    `SELECT b.* FROM bills b
       LEFT JOIN users u ON u.id = b.user_id
      WHERE b.verification_status = 'verified' AND ${where}
      ORDER BY ${order}
      LIMIT ?`,
    ...params,
    limit,
  );

  const bills = rows.map((row) => summarize(db, row, viewerId));
  const remainingRow = db.first<{ c: number }>(
    `SELECT COUNT(*) AS c FROM bills b WHERE b.verification_status = 'verified' AND ${where}`,
    ...params,
  );
  return { bills, remaining: remainingRow?.c ?? 0 };
}

export function myBills(ctx: ServiceContext, userId: string): BillSummary[] {
  const rows = ctx.db.all<BillRow>(
    `SELECT * FROM bills WHERE user_id = ? AND bill_status <> 'draft' ORDER BY created_at DESC LIMIT 100`,
    userId,
  );
  return rows.map((row) => summarize(ctx.db, row, userId));
}

export function recordSwipe(
  ctx: ServiceContext,
  userId: string,
  billId: string,
  action: 'pass' | 'help' | 'super_help',
): { ok: true; bill: BillSummary } {
  const { db } = ctx;
  const bill = db.first<BillRow>('SELECT * FROM bills WHERE id = ?', billId);
  if (!bill) throw new DomainError('not_found', 'Bill not found.');
  if (bill.user_id === userId) throw new DomainError('own_bill', 'You cannot swipe your own bill.');
  db.run(
    `INSERT INTO swipes (id, user_id, bill_id, action, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, bill_id) DO UPDATE SET action = excluded.action, created_at = excluded.created_at`,
    randomId('swp'),
    userId,
    billId,
    action,
    nowIso(),
  );
  // A swipe is an expression of intent only — never a payment authorisation.
  return { ok: true, bill: summarize(db, bill, userId) };
}

export function undoLastSwipe(ctx: ServiceContext, userId: string): { ok: true; billId: string | null } {
  const last = ctx.db.first<SwipeRow>(
    'SELECT * FROM swipes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    userId,
  );
  if (!last) return { ok: true, billId: null };
  ctx.db.run('DELETE FROM swipes WHERE id = ?', last.id);
  return { ok: true, billId: last.bill_id };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface CreatePaymentInput {
  billId: string;
  amount: number;
  isAnonymous?: boolean;
  message?: string;
  idempotencyKey: string;
}

export interface PaymentIntentResult {
  payment: Payment;
  sandbox: boolean;
  clientSecret: string | null;
}

export function createPaymentIntent(ctx: ServiceContext, userId: string, input: CreatePaymentInput): PaymentIntentResult {
  const { db } = ctx;
  const payer = db.first<UserRow>('SELECT * FROM users WHERE id = ?', userId);
  if (!payer) throw new DomainError('not_found', 'Account not found.');
  if (payer.account_status !== 'active') throw new DomainError('account_restricted', 'Your account cannot send payments.');

  const bill = db.first<BillRow>('SELECT * FROM bills WHERE id = ?', input.billId);
  if (!bill) throw new DomainError('not_found', 'Bill not found.');
  if (bill.user_id === userId) throw new DomainError('own_bill', 'You cannot help your own bill.');
  if (bill.bill_status !== 'active') {
    throw new DomainError('bill_unavailable', 'This bill is not accepting new help right now.');
  }
  if (!Number.isInteger(input.amount) || input.amount < MIN_HELP_AMOUNT || input.amount > MAX_HELP_AMOUNT) {
    throw new DomainError('invalid_amount', 'Choose an amount between 1.00 and 5,000.00.', {
      amount: 'Between $1 and $5,000.',
    });
  }
  const remaining = bill.target_amount - bill.raised_amount;
  if (remaining <= 0) throw new DomainError('bill_unavailable', 'This bill is already fully funded.');
  const amount = Math.min(input.amount, remaining);

  if (!input.idempotencyKey || input.idempotencyKey.length < 8) {
    throw new DomainError('invalid_request', 'Missing idempotency key.');
  }
  const existing = db.first<PaymentRow>(
    'SELECT * FROM payments WHERE payer_id = ? AND client_idempotency_key = ?',
    userId,
    input.idempotencyKey,
  );
  if (existing) {
    return {
      payment: paymentToDto(existing, bill.title),
      sandbox: existing.payment_provider === 'sandbox',
      clientSecret: existing.provider_payment_id,
    };
  }

  const fee = computeFee(amount, ctx.feeBps);
  const now = nowIso();
  const id = randomId('pay');
  const provider = ctx.paymentMode === 'stripe' ? 'stripe' : 'sandbox';
  db.transaction(() => {
    db.run(
      `INSERT INTO payments (id, payer_id, bill_id, amount, fee, currency, platform_fee_bps, payment_provider,
         provider_payment_id, client_idempotency_key, payment_status, is_anonymous, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      id,
      userId,
      bill.id,
      amount,
      fee,
      bill.currency,
      ctx.feeBps,
      provider,
      null,
      input.idempotencyKey,
      Number(!!input.isAnonymous),
      now,
      now,
    );
    db.run(
      `INSERT INTO payment_events (id, payment_id, bill_id, type, amount, note, created_at)
       VALUES (?, ?, ?, 'created', ?, ?, ?)`,
      randomId('pev'),
      id,
      bill.id,
      amount,
      provider === 'sandbox' ? 'sandbox intent' : 'stripe intent',
      now,
    );
  });

  const payment = db.first<PaymentRow>('SELECT * FROM payments WHERE id = ?', id)!;
  return {
    payment: paymentToDto(payment, bill.title),
    sandbox: provider === 'sandbox',
    clientSecret: provider === 'stripe' ? null : `sandbox_${id}`,
  };
}

/**
 * Marks a payment succeeded. Called ONLY by server-side verification paths:
 * the sandbox settlement endpoint or a verified provider webhook.
 * Idempotent: replaying the same payment id is a no-op.
 */
export function settlePayment(
  ctx: ServiceContext,
  paymentId: string,
  opts: { providerPaymentId?: string | null; source: 'sandbox' | 'webhook' | 'admin' },
): { payment: Payment; alreadySettled: boolean; bill: BillSummary } {
  const { db } = ctx;
  return db.transaction(() => {
    const payment = db.first<PaymentRow>('SELECT * FROM payments WHERE id = ?', paymentId);
    if (!payment) throw new DomainError('not_found', 'Payment not found.');
    const bill = db.first<BillRow>('SELECT * FROM bills WHERE id = ?', payment.bill_id);
    if (!bill) throw new DomainError('not_found', 'Bill not found.');

    if (payment.payment_status === 'succeeded') {
      return {
        payment: paymentToDto(payment, bill.title),
        alreadySettled: true,
        bill: summarize(db, bill, payment.payer_id),
      };
    }
    if (['failed', 'refunded'].includes(payment.payment_status)) {
      throw new DomainError('invalid_state', `Payment is already ${payment.payment_status}.`);
    }
    if (payment.payment_provider === 'stripe' && opts.source === 'sandbox') {
      throw new DomainError('invalid_source', 'Stripe payments must be settled by webhook.');
    }

    const now = nowIso();
    const remaining = Math.max(0, bill.target_amount - bill.raised_amount);
    const applied = Math.min(payment.amount, remaining);
    const newRaised = Math.min(bill.target_amount, bill.raised_amount + applied);
    const fullyFunded = newRaised >= bill.target_amount;
    const nextStatus = fullyFunded ? 'fully_funded' : bill.bill_status;

    db.run(
      `UPDATE payments SET payment_status = 'succeeded', provider_payment_id = COALESCE(?, provider_payment_id),
         updated_at = ? WHERE id = ?`,
      opts.providerPaymentId ?? null,
      now,
      payment.id,
    );
    db.run(
      `UPDATE bills SET raised_amount = ?, bill_status = ?, updated_at = ? WHERE id = ?`,
      newRaised,
      nextStatus,
      now,
      bill.id,
    );
    const helpId = randomId('hlp');
    db.run(
      `INSERT INTO help_records (id, bill_id, payment_id, payer_id, amount, currency, is_anonymous, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(payment_id) DO NOTHING`,
      helpId,
      bill.id,
      payment.id,
      payment.payer_id,
      applied,
      payment.currency,
      payment.is_anonymous,
      null,
      now,
    );
    db.run(
      `INSERT INTO payment_events (id, payment_id, bill_id, type, amount, note, created_at)
       VALUES (?, ?, ?, 'succeeded', ?, ?, ?)`,
      randomId('pev'),
      payment.id,
      bill.id,
      applied,
      `${opts.source} settlement`,
      now,
    );

    const payer = db.first<UserRow>('SELECT * FROM users WHERE id = ?', payment.payer_id);
    const owner = db.first<UserRow>('SELECT * FROM users WHERE id = ?', bill.user_id);
    const payerLabel = payment.is_anonymous === 1 ? 'Someone kind' : payer?.display_name ?? 'Someone kind';

    // Community feed posting (only for non-demo, non-anonymous-if-requested entries)
    db.run(
      `INSERT INTO community_posts (id, bill_id, payment_id, actor_id, kind, headline, detail, amount, currency, created_at)
       VALUES (?, ?, ?, ?, 'help', ?, ?, ?, ?, ?) ON CONFLICT(payment_id) DO NOTHING`,
      randomId('pst'),
      bill.id,
      payment.id,
      payment.payer_id,
      `${payerLabel} helped ${owner?.display_name ?? 'someone'} with ${bill.title}`,
      payment.is_anonymous === 1 ? 'An anonymous helper stepped in.' : 'A new act of kindness just landed.',
      applied,
      bill.currency,
      now,
    );

    if (payer) {
      notify(db, {
        userId: payer.id,
        type: 'payment_succeeded',
        title: 'Thank you — your help is confirmed',
        body: `You helped "${bill.title}" with ${(applied / 100).toFixed(2)} ${bill.currency}.`,
        href: `/activity`,
      });
    }
    if (owner) {
      notify(db, {
        userId: owner.id,
        type: 'bill_helped',
        title: `${payerLabel} helped your bill`,
        body: `${(applied / 100).toFixed(2)} ${bill.currency} was added to "${bill.title}".`,
        href: `/bills/${bill.id}`,
      });
      if (fullyFunded) {
        notify(db, {
          userId: owner.id,
          type: 'bill_funded',
          title: 'Your bill is fully funded',
          body: `"${bill.title}" reached its goal. New payments are now closed.`,
          href: `/bills/${bill.id}`,
        });
      }
    }

    const updated = db.first<PaymentRow>('SELECT * FROM payments WHERE id = ?', payment.id)!;
    const updatedBill = db.first<BillRow>('SELECT * FROM bills WHERE id = ?', bill.id)!;
    return {
      payment: paymentToDto(updated, bill.title),
      alreadySettled: false,
      bill: summarize(db, updatedBill, payment.payer_id),
    };
  });
}

export function failPayment(ctx: ServiceContext, paymentId: string, reason: string): { ok: true } {
  const { db } = ctx;
  const payment = db.first<PaymentRow>('SELECT * FROM payments WHERE id = ?', paymentId);
  if (!payment) throw new DomainError('not_found', 'Payment not found.');
  if (payment.payment_status === 'succeeded') throw new DomainError('invalid_state', 'Cannot fail a succeeded payment.');
  if (payment.payment_status === 'failed') return { ok: true };
  const now = nowIso();
  db.run(
    `UPDATE payments SET payment_status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?`,
    reason.slice(0, 200),
    now,
    payment.id,
  );
  db.run(
    `INSERT INTO payment_events (id, payment_id, bill_id, type, amount, note, created_at)
     VALUES (?, ?, ?, 'failed', ?, ?, ?)`,
    randomId('pev'),
    payment.id,
    payment.bill_id,
    payment.amount,
    reason.slice(0, 200),
    now,
  );
  return { ok: true };
}

export function refundPayment(ctx: ServiceContext, paymentId: string, adminId: string, note: string): { ok: true } {
  const { db } = ctx;
  const payment = db.first<PaymentRow>('SELECT * FROM payments WHERE id = ?', paymentId);
  if (!payment) throw new DomainError('not_found', 'Payment not found.');
  if (payment.payment_status !== 'succeeded') {
    throw new DomainError('invalid_state', 'Only succeeded payments can be refunded.');
  }
  const bill = db.first<BillRow>('SELECT * FROM bills WHERE id = ?', payment.bill_id);
  if (!bill) throw new DomainError('not_found', 'Bill not found.');
  const help = db.first<HelpRecordRow>('SELECT * FROM help_records WHERE payment_id = ?', payment.id);
  const now = nowIso();
  db.transaction(() => {
    db.run(
      `UPDATE payments SET payment_status = 'refunded', updated_at = ? WHERE id = ?`,
      now,
      payment.id,
    );
    if (help) {
      const newRaised = Math.max(0, bill.raised_amount - help.amount);
      const reopened = bill.bill_status === 'fully_funded' && newRaised < bill.target_amount ? 'active' : bill.bill_status;
      db.run('UPDATE bills SET raised_amount = ?, bill_status = ?, updated_at = ? WHERE id = ?', newRaised, reopened, now, bill.id);
    }
    db.run(
      `INSERT INTO payment_events (id, payment_id, bill_id, type, amount, note, created_at)
       VALUES (?, ?, ?, 'refunded', ?, ?, ?)`,
      randomId('pev'),
      payment.id,
      bill.id,
      payment.amount,
      note.slice(0, 200),
      now,
    );
    db.run(
      `INSERT INTO community_posts (id, bill_id, payment_id, actor_id, kind, headline, detail, amount, currency, created_at)
       VALUES (?, ?, NULL, NULL, 'milestone', ?, ?, NULL, ?, ?)`,
      randomId('pst'),
      bill.id,
      'A contribution was refunded',
      note.slice(0, 200),
      bill.currency,
      now,
    );
    audit(db, {
      adminId,
      action: 'payment.refund',
      targetType: 'payment',
      targetId: payment.id,
      metadata: { amount: payment.amount, billId: bill.id, note },
    });
  });
  notify(db, {
    userId: payment.payer_id,
    type: 'payment_refunded',
    title: 'Your help was refunded',
    body: note || 'A refund was issued for your contribution.',
    href: '/activity',
  });
  return { ok: true };
}

export function paymentFor(ctx: ServiceContext, paymentId: string, viewer: UserRow): Payment {
  const { db } = ctx;
  const payment = db.first<PaymentRow>('SELECT * FROM payments WHERE id = ?', paymentId);
  if (!payment) throw new DomainError('not_found', 'Payment not found.');
  if (payment.payer_id !== viewer.id && viewer.role !== 'admin') {
    throw new DomainError('forbidden', 'You cannot view this payment.');
  }
  const bill = db.first<BillRow>('SELECT * FROM bills WHERE id = ?', payment.bill_id);
  return paymentToDto(payment, bill?.title ?? '');
}

export function myPayments(ctx: ServiceContext, userId: string): (Payment & { helpMessage: string | null })[] {
  const rows = ctx.db.all<PaymentRow & { help_message: string | null }>(
    `SELECT p.*, h.message AS help_message
       FROM payments p
       LEFT JOIN help_records h ON h.payment_id = p.id
      WHERE p.payer_id = ?
      ORDER BY p.created_at DESC
      LIMIT 100`,
    userId,
  );
  return rows.map((row) => {
    const bill = ctx.db.first<BillRow>('SELECT * FROM bills WHERE id = ?', row.bill_id);
    return { ...paymentToDto(row, bill?.title ?? ''), helpMessage: row.help_message ?? null };
  });
}

export function receivedHelp(ctx: ServiceContext, userId: string): {
  total: number;
  currency: string;
  entries: { id: string; billId: string; billTitle: string; amount: number; from: string | null; anonymous: boolean; createdAt: string; status: string }[];
} {
  const rows = ctx.db.all<HelpRecordRow & { bill_title: string; payment_status: string }>(
    `SELECT h.*, b.title AS bill_title, p.payment_status
       FROM help_records h
       JOIN bills b ON b.id = h.bill_id
       JOIN payments p ON p.id = h.payment_id
      WHERE b.user_id = ? AND p.payment_status = 'succeeded'
      ORDER BY h.created_at DESC
      LIMIT 100`,
    userId,
  );
  let total = 0;
  const entries = rows.map((row) => {
    total += row.amount;
    const payer = ctx.db.first<UserRow>('SELECT * FROM users WHERE id = ?', row.payer_id);
    return {
      id: row.id,
      billId: row.bill_id,
      billTitle: row.bill_title,
      amount: row.amount,
      from: row.is_anonymous === 1 ? null : payer?.display_name ?? null,
      anonymous: row.is_anonymous === 1,
      createdAt: row.created_at,
      status: row.payment_status,
    };
  });
  return { total, currency: rows[0]?.currency ?? 'USD', entries };
}

// ---------------------------------------------------------------------------
// Reports / safety
// ---------------------------------------------------------------------------

export function submitReport(
  ctx: ServiceContext,
  reporterId: string,
  input: { targetType: 'bill' | 'user' | 'comment'; targetId: string; reason: string; details?: string },
): { ok: true } {
  const { db } = ctx;
  const reason = cleanText(input.reason, 80);
  if (!reason) throw new DomainError('invalid_reason', 'Choose a reason for the report.');
  const exists = db.first<{ id: string }>(
    'SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = ?',
    reporterId,
    input.targetType,
    input.targetId,
    'open',
  );
  if (exists) throw new DomainError('duplicate_report', 'You already reported this — our team is on it.');
  db.run(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
    randomId('rpt'),
    reporterId,
    input.targetType,
    input.targetId,
    reason,
    cleanText(input.details ?? '', 1000),
    nowIso(),
  );
  return { ok: true };
}

export function blockUser(ctx: ServiceContext, userId: string, targetId: string): { ok: true } {
  if (userId === targetId) throw new DomainError('invalid_request', 'You cannot block yourself.');
  ctx.db.run(
    `INSERT INTO blocked_users (user_id, blocked_user_id, created_at) VALUES (?, ?, ?)
     ON CONFLICT DO NOTHING`,
    userId,
    targetId,
    nowIso(),
  );
  return { ok: true };
}

export function unblockUser(ctx: ServiceContext, userId: string, targetId: string): { ok: true } {
  ctx.db.run('DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?', userId, targetId);
  return { ok: true };
}

export function blockedUsers(ctx: ServiceContext, userId: string): PublicUserLike[] {
  return ctx.db
    .all<UserRow>(
      `SELECT u.* FROM blocked_users b JOIN users u ON u.id = b.blocked_user_id WHERE b.user_id = ?`,
      userId,
    )
    .map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      avatarSeed: row.avatar_seed,
      bio: row.bio,
      country: row.country,
      region: row.region,
      createdAt: row.created_at,
      isDemo: row.is_demo === 1,
    }));
}

// ---------------------------------------------------------------------------
// Community
// ---------------------------------------------------------------------------

export function communityFeed(ctx: ServiceContext, viewerId: string | null, limit = 20): CommunityPost[] {
  const { db } = ctx;
  const rows = db.all<CommunityPostRow & { bill_title: string | null }>(
    `SELECT p.*, b.title AS bill_title FROM community_posts p
       LEFT JOIN bills b ON b.id = p.bill_id
      ORDER BY p.created_at DESC LIMIT ?`,
    limit,
  );
  return rows.map((row) => {
    const actor = row.actor_id ? db.first<UserRow>('SELECT * FROM users WHERE id = ?', row.actor_id) : null;
    const likes = db.first<{ c: number }>('SELECT COUNT(*) AS c FROM community_likes WHERE post_id = ?', row.id)?.c ?? 0;
    const liked = viewerId
      ? !!db.first('SELECT 1 AS x FROM community_likes WHERE post_id = ? AND user_id = ?', row.id, viewerId)
      : false;
    const comments = db
      .all<{ id: string; body: string; created_at: string; user_id: string; status: string }>(
        `SELECT * FROM community_comments WHERE post_id = ? AND status = 'visible' ORDER BY created_at ASC LIMIT 20`,
        row.id,
      )
      .map((c) => {
        const author = db.first<UserRow>('SELECT * FROM users WHERE id = ?', c.user_id);
        return {
          id: c.id,
          body: c.body,
          createdAt: c.created_at,
          author: {
            displayName: author?.display_name ?? 'Someone',
            username: author?.username ?? 'unknown',
            avatarUrl: author?.avatar_url ?? null,
            avatarSeed: author?.avatar_seed ?? '0',
          },
        };
      });
    return {
      id: row.id,
      kind: row.kind as CommunityPost['kind'],
      headline: row.headline,
      detail: row.detail,
      amount: row.amount,
      currency: row.currency,
      createdAt: row.created_at,
      billId: row.bill_id,
      billTitle: row.bill_title,
      actor: actor
        ? {
            displayName: actor.display_name,
            username: actor.username,
            avatarUrl: actor.avatar_url,
            avatarSeed: actor.avatar_seed,
            isAnonymous: false,
          }
        : null,
      likes,
      liked,
      comments,
    };
  });
}

export function toggleLike(ctx: ServiceContext, userId: string, postId: string): { liked: boolean; likes: number } {
  const { db } = ctx;
  const existing = db.first('SELECT 1 AS x FROM community_likes WHERE post_id = ? AND user_id = ?', postId, userId);
  if (existing) {
    db.run('DELETE FROM community_likes WHERE post_id = ? AND user_id = ?', postId, userId);
  } else {
    db.run('INSERT INTO community_likes (post_id, user_id, created_at) VALUES (?, ?, ?)', postId, userId, nowIso());
  }
  const likes = db.first<{ c: number }>('SELECT COUNT(*) AS c FROM community_likes WHERE post_id = ?', postId)?.c ?? 0;
  return { liked: !existing, likes };
}

export function addComment(ctx: ServiceContext, userId: string, postId: string, body: string): { ok: true } {
  const text = cleanText(body, 500);
  if (text.length < 2) throw new DomainError('invalid_comment', 'Write a slightly longer message.');
  const post = ctx.db.first('SELECT 1 AS x FROM community_posts WHERE id = ?', postId);
  if (!post) throw new DomainError('not_found', 'Post not found.');
  ctx.db.run(
    `INSERT INTO community_comments (id, post_id, user_id, body, status, created_at) VALUES (?, ?, ?, ?, 'visible', ?)`,
    randomId('cmt'),
    postId,
    userId,
    text,
    nowIso(),
  );
  return { ok: true };
}

export function communityStats(ctx: ServiceContext): CommunityStats {
  const { db } = ctx;
  const help = db.first<{ c: number; total: number | null }>(
    `SELECT COUNT(*) AS c, COALESCE(SUM(h.amount), 0) AS total
       FROM help_records h JOIN payments p ON p.id = h.payment_id WHERE p.payment_status = 'succeeded'`,
  );
  const people = db.first<{ c: number }>(
    `SELECT COUNT(DISTINCT h.payer_id) AS c FROM help_records h JOIN payments p ON p.id = h.payment_id WHERE p.payment_status = 'succeeded'`,
  )?.c ?? 0;
  const connections = db.first<{ c: number }>(
    `SELECT COUNT(DISTINCT h.bill_id) AS c FROM help_records h JOIN payments p ON p.id = h.payment_id WHERE p.payment_status = 'succeeded'`,
  )?.c ?? 0;
  const demo = db.first<{ c: number }>('SELECT COUNT(*) AS c FROM bills WHERE is_demo = 1')?.c ?? 0;
  return {
    billsHelped: help?.c ?? 0,
    amountGiven: help?.total ?? 0,
    peopleSupported: people,
    connections,
    currency: 'USD',
    demoIncluded: demo > 0,
  };
}

export function communityStatsForHelpers(ctx: ServiceContext): number {
  return ctx.db.first<{ c: number }>('SELECT COUNT(DISTINCT payer_id) AS c FROM help_records')?.c ?? 0;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function adminOverview(ctx: ServiceContext): AdminOverview {
  const { db } = ctx;
  const count = (q: string, ...p: unknown[]) => db.first<{ c: number }>(q, ...p)?.c ?? 0;
  return {
    users: count('SELECT COUNT(*) AS c FROM users'),
    bills: count('SELECT COUNT(*) AS c FROM bills'),
    pendingReview: count(`SELECT COUNT(*) AS c FROM bills WHERE bill_status = 'pending_review'`),
    activeBills: count(`SELECT COUNT(*) AS c FROM bills WHERE bill_status = 'active'`),
    fullyFunded: count(`SELECT COUNT(*) AS c FROM bills WHERE bill_status = 'fully_funded'`),
    amountSucceeded: db.first<{ t: number | null }>(
      `SELECT COALESCE(SUM(amount), 0) AS t FROM payments WHERE payment_status = 'succeeded'`,
    )?.t ?? 0,
    openReports: count(`SELECT COUNT(*) AS c FROM reports WHERE status IN ('open','reviewing')`),
    paymentAnomalies: count(`SELECT COUNT(*) AS c FROM payments WHERE payment_status IN ('failed','disputed')`),
    demoBills: count('SELECT COUNT(*) AS c FROM bills WHERE is_demo = 1'),
  };
}

export function adminBills(
  ctx: ServiceContext,
  filters: { status?: string; q?: string; limit?: number } = {},
): AdminBillRow[] {
  const { db } = ctx;
  const params: unknown[] = [];
  let where = '1=1';
  if (filters.status && filters.status !== 'all') {
    where += ' AND b.bill_status = ?';
    params.push(filters.status);
  }
  if (filters.q) {
    where += ' AND (b.title LIKE ? OR u.email LIKE ? OR u.username LIKE ?)';
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  const rows = db.all<BillRow & { email: string; owner_status: string }>(
    `SELECT b.*, u.email, u.account_status AS owner_status
       FROM bills b JOIN users u ON u.id = b.user_id
      WHERE ${where}
      ORDER BY CASE b.bill_status WHEN 'pending_review' THEN 0 ELSE 1 END, b.created_at DESC
      LIMIT ?`,
    ...params,
    Math.min(filters.limit ?? 50, 100),
  );
  return rows.map((row) => ({
    ...summarize(db, row, null),
    ownerEmail: row.email,
    ownerStatus: row.owner_status as AdminBillRow['ownerStatus'],
    receiptPresent: !!row.receipt_id,
    reportCount:
      db.first<{ c: number }>(`SELECT COUNT(*) AS c FROM reports WHERE target_type = 'bill' AND target_id = ?`, row.id)?.c ?? 0,
    riskFlags: parseRiskFlags(row.risk_flags),
  }));
}

export function reviewBill(
  ctx: ServiceContext,
  adminId: string,
  billId: string,
  action: 'approve' | 'reject' | 'suspend' | 'close' | 'reopen',
  note: string,
): { ok: true } {
  const { db } = ctx;
  const bill = db.first<BillRow>('SELECT * FROM bills WHERE id = ?', billId);
  if (!bill) throw new DomainError('not_found', 'Bill not found.');
  const now = nowIso();
  let status = bill.bill_status;
  let verification = bill.verification_status;
  switch (action) {
    case 'approve':
      status = 'active';
      verification = 'verified';
      break;
    case 'reject':
      status = 'rejected';
      verification = 'rejected';
      break;
    case 'suspend':
      status = 'suspended';
      break;
    case 'close':
      status = 'closed';
      break;
    case 'reopen':
      status = 'active';
      verification = 'verified';
      break;
  }
  db.transaction(() => {
    db.run(
      `UPDATE bills SET bill_status = ?, verification_status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
       WHERE id = ?`,
      status,
      verification,
      cleanText(note, 500) || null,
      adminId,
      now,
      now,
      billId,
    );
    db.run(
      `INSERT INTO bill_updates (id, bill_id, body, author, created_at) VALUES (?, ?, ?, ?, ?)`,
      randomId('upd'),
      billId,
      action === 'approve'
        ? 'Bill verified and live in Discover.'
        : action === 'reject'
          ? `Review: ${note || 'bill did not meet our guidelines'}`
          : `Bill status changed to ${status}.`,
      'BILL SWIPE Review',
      now,
    );
    audit(db, {
      adminId,
      action: `bill.${action}`,
      targetType: 'bill',
      targetId: billId,
      metadata: { note, from: bill.bill_status, to: status },
    });
    notify(db, {
      userId: bill.user_id,
      type: `bill_${action}`,
      title:
        action === 'approve'
          ? 'Your bill is live'
          : action === 'reject'
            ? 'Your bill needs changes'
            : `Your bill was ${action}d`,
      body:
        action === 'approve'
          ? `"${bill.title}" passed review and is now visible in Discover.`
          : note || `An admin updated "${bill.title}".`,
      href: `/bills/${billId}`,
    });
  });
  return { ok: true };
}

export function adminUsers(ctx: ServiceContext, filters: { q?: string; limit?: number } = {}): AdminUserRow[] {
  const { db } = ctx;
  const params: unknown[] = [];
  let where = '1=1';
  if (filters.q) {
    where += ' AND (email LIKE ? OR username LIKE ? OR display_name LIKE ?)';
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  const rows = db.all<UserRow>(`SELECT * FROM users WHERE ${where} ORDER BY created_at DESC LIMIT ?`, ...params, Math.min(filters.limit ?? 50, 100));
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    avatarSeed: row.avatar_seed,
    bio: row.bio,
    country: row.country,
    region: row.region,
    createdAt: row.created_at,
    isDemo: row.is_demo === 1,
    email: row.email,
    role: row.role,
    accountStatus: row.account_status,
    billsPosted: db.first<{ c: number }>('SELECT COUNT(*) AS c FROM bills WHERE user_id = ?', row.id)?.c ?? 0,
    helpedAmount:
      db.first<{ t: number | null }>(
        `SELECT COALESCE(SUM(h.amount),0) AS t FROM help_records h JOIN payments p ON p.id = h.payment_id
          WHERE h.payer_id = ? AND p.payment_status = 'succeeded'`,
        row.id,
      )?.t ?? 0,
    lastSeenAt: row.last_seen_at,
  }));
}

export function adminSetUserStatus(
  ctx: ServiceContext,
  adminId: string,
  userId: string,
  status: 'active' | 'restricted' | 'banned',
  reason: string,
): { ok: true } {
  const { db } = ctx;
  if (adminId === userId) throw new DomainError('invalid_request', 'You cannot change your own status.');
  const user = db.first<UserRow>('SELECT * FROM users WHERE id = ?', userId);
  if (!user) throw new DomainError('not_found', 'User not found.');
  db.run('UPDATE users SET account_status = ?, updated_at = ? WHERE id = ?', status, nowIso(), userId);
  if (status === 'banned') db.run('DELETE FROM sessions WHERE user_id = ?', userId);
  audit(db, {
    adminId,
    action: `user.${status}`,
    targetType: 'user',
    targetId: userId,
    metadata: { reason },
  });
  notify(db, {
    userId,
    type: 'account_status',
    title: 'Your account status changed',
    body: reason || `Your account is now ${status}.`,
    href: '/profile',
  });
  return { ok: true };
}

export function adminPayments(ctx: ServiceContext, limit = 60): AdminPaymentRow[] {
  const { db } = ctx;
  const rows = db.all<PaymentRow & { bill_title: string; payer_name: string }>(
    `SELECT p.*, b.title AS bill_title, u.display_name AS payer_name
       FROM payments p JOIN bills b ON b.id = p.bill_id JOIN users u ON u.id = p.payer_id
      ORDER BY p.created_at DESC LIMIT ?`,
    Math.min(limit, 200),
  );
  return rows.map((row) => ({
    id: row.id,
    billId: row.bill_id,
    billTitle: row.bill_title,
    payer: row.payer_name,
    amount: row.amount,
    fee: row.fee,
    total: row.amount + row.fee,
    status: row.payment_status as AdminPaymentRow['status'],
    provider: row.payment_provider,
    createdAt: row.created_at,
    anomaly:
      row.payment_status === 'failed'
        ? row.failure_reason ?? 'failed'
        : row.payment_status === 'disputed'
          ? 'disputed'
          : null,
  }));
}

export function adminReports(ctx: ServiceContext): Report[] {
  const { db } = ctx;
  const rows = db.all<ReportRow>('SELECT * FROM reports ORDER BY created_at DESC LIMIT 100');
  return rows.map((row) => {
    const reporter = db.first<UserRow>('SELECT * FROM users WHERE id = ?', row.reporter_id);
    let label = row.target_id;
    if (row.target_type === 'bill') {
      label = db.first<{ title: string }>('SELECT title FROM bills WHERE id = ?', row.target_id)?.title ?? row.target_id;
    } else if (row.target_type === 'user') {
      label = db.first<{ username: string }>('SELECT username FROM users WHERE id = ?', row.target_id)?.username ?? row.target_id;
    }
    return {
      id: row.id,
      targetType: row.target_type as Report['targetType'],
      targetId: row.target_id,
      targetLabel: label,
      reason: row.reason,
      details: row.details,
      status: row.status as Report['status'],
      createdAt: row.created_at,
      reporter: reporter?.username ?? 'unknown',
    };
  });
}

export function adminResolveReport(
  ctx: ServiceContext,
  adminId: string,
  reportId: string,
  status: 'reviewing' | 'resolved' | 'dismissed',
  resolution: string,
): { ok: true } {
  const { db } = ctx;
  const report = db.first<ReportRow>('SELECT * FROM reports WHERE id = ?', reportId);
  if (!report) throw new DomainError('not_found', 'Report not found.');
  db.run(
    `UPDATE reports SET status = ?, resolution = ?, handled_by = ?, handled_at = ? WHERE id = ?`,
    status,
    cleanText(resolution, 500),
    adminId,
    nowIso(),
    reportId,
  );
  audit(db, {
    adminId,
    action: `report.${status}`,
    targetType: 'report',
    targetId: reportId,
    metadata: { resolution },
  });
  return { ok: true };
}

export function adminAuditLogs(ctx: ServiceContext, limit = 50): AuditLog[] {
  const { db } = ctx;
  const rows = db.all<{ id: string; admin_id: string; action: string; target_type: string; target_id: string; metadata: string; created_at: string }>(
    'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?',
    Math.min(limit, 200),
  );
  return rows.map((row) => {
    const admin = db.first<UserRow>('SELECT * FROM users WHERE id = ?', row.admin_id);
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(row.metadata);
    } catch {
      metadata = {};
    }
    return {
      id: row.id,
      adminId: row.admin_id,
      adminName: admin?.display_name ?? 'admin',
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      metadata,
      createdAt: row.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Notifications / misc
// ---------------------------------------------------------------------------

export function notifications(ctx: ServiceContext, userId: string): { items: NotificationItem[]; unread: number } {
  return { items: listNotifications(ctx.db, userId), unread: unreadCount(ctx.db, userId) };
}

export function markNotificationsRead(ctx: ServiceContext, userId: string, ids?: string[]): { ok: true } {
  if (ids && ids.length > 0) {
    for (const id of ids.slice(0, 100)) {
      ctx.db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', id, userId);
    }
  } else {
    ctx.db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', userId);
  }
  return { ok: true };
}

export function billByPublicId(ctx: ServiceContext, billId: string): BillSummary | null {
  const bill = ctx.db.first<BillRow>('SELECT * FROM bills WHERE id = ?', billId);
  if (!bill) return null;
  return summarize(ctx.db, bill, null);
}

export function ownerEmailForBill(ctx: ServiceContext, billId: string): string | null {
  const bill = ctx.db.first<BillRow>('SELECT * FROM bills WHERE id = ?', billId);
  if (!bill) return null;
  return ownerOf(ctx.db, bill).email;
}

export function helperCount(ctx: ServiceContext, billId: string): number {
  return helperCountFor(ctx.db, billId);
}

export function billHelpers(ctx: ServiceContext, billId: string, viewerId: string | null): ReturnType<typeof helpRecordsFor> {
  return helpRecordsFor(ctx.db, billId, viewerId);
}

export function billUpdates(ctx: ServiceContext, billId: string, userId: string, body: string): { ok: true } {
  const bill = ctx.db.first<BillRow>('SELECT * FROM bills WHERE id = ?', billId);
  if (!bill) throw new DomainError('not_found', 'Bill not found.');
  if (bill.user_id !== userId) throw new DomainError('forbidden', 'Only the bill owner can post updates.');
  const text = cleanText(body, 800);
  if (text.length < 5) throw new DomainError('invalid_update', 'Update is too short.');
  ctx.db.run(
    'INSERT INTO bill_updates (id, bill_id, body, author, created_at) VALUES (?, ?, ?, ?, ?)',
    randomId('upd'),
    billId,
    text,
    'Owner',
    nowIso(),
  );
  return { ok: true };
}

export function billDetailFor(ctx: ServiceContext, billId: string, viewerId: string | null): BillDetail {
  const bill = ctx.db.first<BillRow>('SELECT * FROM bills WHERE id = ?', billId);
  if (!bill) throw new DomainError('not_found', 'Bill not found.');
  const viewer = viewerId ? ctx.db.first<UserRow>('SELECT * FROM users WHERE id = ?', viewerId) : null;
  return billDetail(ctx.db, bill, viewer);
}

export function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

export function createReceipt(
  ctx: ServiceContext,
  input: { userId: string; userIdForPath: string; fileName: string; mimeType: string; size: number; sha256: string },
): { id: string; publicPath: string | null } {
  const { db } = ctx;
  const id = randomId('rcp');
  db.run(
    `INSERT INTO receipts (id, bill_id, user_id, private_key, public_key, file_name, mime_type, size, sha256, scan_status, created_at)
     VALUES (?, '', ?, ?, NULL, ?, ?, ?, ?, 'pending', ?)`,
    id,
    input.userId,
    input.userIdForPath,
    cleanText(input.fileName, 120),
    input.mimeType,
    input.size,
    input.sha256,
    nowIso(),
  );
  return { id, publicPath: null };
}

export function receptForAdmin(ctx: ServiceContext, receiptId: string): { privateKey: string; mimeType: string } | null {
  const row = ctx.db.first<{ private_key: string; mime_type: string }>(
    'SELECT private_key, mime_type FROM receipts WHERE id = ?',
    receiptId,
  );
  return row ? { privateKey: row.private_key, mimeType: row.mime_type } : null;
}

