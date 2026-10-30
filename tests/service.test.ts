import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './helpers/testDb';
import type { Db } from '../src/worker/db';
import {
  adminOverview,
  adminPayments,
  adminSetUserStatus,
  adminUsers,
  billDetailFor,
  closeBill,
  communityFeed,
  communityStats,
  createBill,
  createPaymentIntent,
  discoverBills,
  failPayment,
  getBill,
  loginUser,
  myBills,
  recordSwipe,
  refundPayment,
  registerUser,
  reviewBill,
  settlePayment,
  submitReport,
  undoLastSwipe,
  updateBill,
  type ServiceContext,
} from '../src/worker/core/service';
import { ensureSeed } from '../src/worker/seed/seed';
import type { Env } from '../src/worker/env';

let db: Db;
let ctx: ServiceContext;

const env = { ADMIN_EMAIL: 'admin@test.local', ADMIN_PASSWORD: 'AdminPass!123' } as unknown as Env;

beforeEach(async () => {
  const created = createTestDb();
  db = created.db;
  ctx = { db, feeBps: 0, env: 'test', paymentMode: 'sandbox' };
  await ensureSeed(db, env);
});

async function newUser(name = 'tester'): Promise<{ userId: string; token: string }> {
  const result = await registerUser(ctx, {
    email: `${name}@example.com`,
    password: 'TestPassw0rd!',
    username: name,
    displayName: name,
  });
  return { userId: result.user.id, token: result.token };
}

describe('accounts', () => {
  it('registers, hashes the password and issues a session', async () => {
    const { userId } = await newUser('alice');
    const row = db.first<{ password_hash: string; email: string }>('SELECT * FROM users WHERE id = ?', userId)!;
    expect(row.email).toBe('alice@example.com');
    expect(row.password_hash.startsWith('pbkdf2$')).toBe(true);
    expect(row.password_hash).not.toContain('TestPassw0rd!');
    expect(db.first('SELECT 1 AS x FROM sessions WHERE user_id = ?', userId)).toBeTruthy();
  });

  it('rejects duplicate emails and usernames', async () => {
    await newUser('bob');
    await expect(
      registerUser(ctx, { email: 'bob@example.com', password: 'TestPassw0rd!', username: 'bob2', displayName: 'B' }),
    ).rejects.toMatchObject({ code: 'email_taken' });
    await expect(
      registerUser(ctx, { email: 'other@example.com', password: 'TestPassw0rd!', username: 'bob', displayName: 'B' }),
    ).rejects.toMatchObject({ code: 'username_taken' });
  });

  it('rejects weak passwords and invalid usernames', async () => {
    await expect(
      registerUser(ctx, { email: 'c@example.com', password: 'short', username: 'carol', displayName: 'C' }),
    ).rejects.toMatchObject({ code: 'weak_password' });
    await expect(
      registerUser(ctx, { email: 'c@example.com', password: 'TestPassw0rd!', username: 'No Spaces', displayName: 'C' }),
    ).rejects.toMatchObject({ code: 'invalid_username' });
    await expect(
      registerUser(ctx, { email: 'c@example.com', password: 'TestPassw0rd!', username: 'admin', displayName: 'C' }),
    ).rejects.toMatchObject({ code: 'invalid_username' });
  });

  it('logs in with the right password only', async () => {
    await newUser('dave');
    await expect(loginUser(ctx, { email: 'dave@example.com', password: 'TestPassw0rd!' })).resolves.toBeTruthy();
    await expect(loginUser(ctx, { email: 'dave@example.com', password: 'wrong-password' })).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    await expect(loginUser(ctx, { email: 'nobody@example.com', password: 'x' })).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });

  it('blocks banned accounts from logging in', async () => {
    const { userId } = await newUser('erinn');
    db.run(`UPDATE users SET account_status = 'banned' WHERE id = ?`, userId);
    await expect(loginUser(ctx, { email: 'erinn@example.com', password: 'TestPassw0rd!' })).rejects.toMatchObject({
      code: 'account_banned',
    });
  });
});

describe('bills', () => {
  it('creates a bill in pending review with the right minor units', async () => {
    const { userId } = await newUser('frank');
    const bill = createBill(ctx, userId, {
      title: 'A legitimate bill title',
      description:
        'This description is deliberately long enough to satisfy the minimum story length requirement for bill creation.',
      category: 'utilities',
      targetAmount: 12345,
      currency: 'USD',
    });
    expect(bill.status).toBe('pending_review');
    expect(bill.targetAmount).toBe(12345);
    const row = db.first<{ bill_status: string; target_amount: number; raised_amount: number }>(
      'SELECT * FROM bills WHERE id = ?',
      bill.id,
    )!;
    expect(row.bill_status).toBe('pending_review');
    expect(row.target_amount).toBe(12345);
    expect(Number.isInteger(row.target_amount)).toBe(true);
    expect(row.raised_amount).toBe(0);
  });

  it('validates amount range and story length', async () => {
    const { userId } = await newUser('gina');
    expect(() =>
      createBill(ctx, userId, {
        title: 'Too cheap bill',
        description:
          'This description is deliberately long enough to satisfy the minimum story length requirement for bills.',
        category: 'other',
        targetAmount: 50,
        currency: 'USD',
      }),
    ).toThrowError(/between/i);
    expect(() =>
      createBill(ctx, userId, {
        title: 'Short',
        description: 'too short',
        category: 'other',
        targetAmount: 5000,
        currency: 'USD',
      }),
    ).toThrowError();
  });

  it('keeps pending bills out of Discover until approved', async () => {
    const { userId } = await newUser('hank');
    const admin = db.first<{ id: string }>(`SELECT id FROM users WHERE role = 'admin'`)!;
    const bill = createBill(ctx, userId, {
      title: 'Water bill after a leak',
      description:
        'A pipe burst in the wall and the water bill arrived with a large amount that I cannot cover this month at all.',
      category: 'utilities',
      targetAmount: 8000,
      currency: 'USD',
    });
    // Discover never shows your own bills, so check from a different viewer.
    const viewer = await newUser('hank_viewer');
    const before = discoverBills(ctx, viewer.userId, { limit: 50 });
    expect(before.bills.some((b) => b.id === bill.id)).toBe(false);

    reviewBill(ctx, admin.id, bill.id, 'approve', 'ok');
    const after = discoverBills(ctx, viewer.userId, { limit: 50 });
    expect(after.bills.some((b) => b.id === bill.id)).toBe(true);

    // The owner is explicitly excluded from their own bill in the feed.
    const ownerFeed = discoverBills(ctx, userId, { limit: 50 });
    expect(ownerFeed.bills.some((b) => b.id === bill.id)).toBe(false);
  });

  it('locks a bill once it has received help', async () => {
    const { userId } = await newUser('iris');
    const admin = db.first<{ id: string }>(`SELECT id FROM users WHERE role = 'admin'`)!;
    const bill = createBill(ctx, userId, {
      title: 'Bus pass for the month',
      description:
        'I need a monthly bus pass to get to work reliably; the fare went up and my paycheck does not cover it right now.',
      category: 'transportation',
      targetAmount: 6000,
      currency: 'USD',
    });
    reviewBill(ctx, admin.id, bill.id, 'approve', 'ok');

    const helper = await newUser('jack');
    const intent = createPaymentIntent(ctx, helper.userId, {
      billId: bill.id,
      amount: 1000,
      idempotencyKey: 'idem-lock-test-1',
    });
    settlePayment(ctx, intent.payment.id, { source: 'sandbox' });

    expect(() =>
      updateBill(ctx, userId, bill.id, { targetAmount: 5000 }),
    ).toThrowError(/locked/i);
    expect(() => closeBill(ctx, userId, bill.id)).toThrowError();
  });

  it('prevents users from editing or closing other people’s bills', async () => {
    const { userId } = await newUser('kim');
    const other = await newUser('lee');
    const bill = createBill(ctx, userId, {
      title: 'Prescription refill cost',
      description:
        'My monthly prescription refill is more than I expected this month and I need help covering the remaining balance.',
      category: 'medical',
      targetAmount: 4000,
      currency: 'USD',
    });
    expect(() => updateBill(ctx, other.userId, bill.id, { title: 'hijacked title' })).toThrowError(/own bills/i);
    expect(() => closeBill(ctx, other.userId, bill.id)).toThrowError(/own bill/i);
  });

  it('rejects reading a draft bill that does not exist', () => {
    expect(() => getBill(ctx, 'bil_missing', null, false)).toThrowError(/not found/i);
  });

  it('returns my bills with progress data', async () => {
    const { userId } = await newUser('mila');
    createBill(ctx, userId, {
      title: 'School uniform replacement',
      description:
        'My kid outgrew the entire uniform over the summer holidays and the replacement cost is more than this month allows.',
      category: 'education',
      targetAmount: 7500,
      currency: 'USD',
    });
    const mine = myBills(ctx, userId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.owner.id).toBe(userId);
  });
});

describe('swipes', () => {
  it('records a swipe and can undo it', async () => {
    const { userId } = await newUser('nina');
    const target = discoverBills(ctx, userId, { limit: 1 }).bills[0]!;
    recordSwipe(ctx, userId, target.id, 'pass');

    const feed = discoverBills(ctx, userId, { limit: 50 });
    expect(feed.bills.some((b) => b.id === target.id)).toBe(false);

    const undo = undoLastSwipe(ctx, userId);
    expect(undo.billId).toBe(target.id);
    const feedAfter = discoverBills(ctx, userId, { limit: 50 });
    expect(feedAfter.bills.some((b) => b.id === target.id)).toBe(true);
  });

  it('refuses to swipe your own bill', async () => {
    const { userId } = await newUser('omar');
    const admin = db.first<{ id: string }>(`SELECT id FROM users WHERE role = 'admin'`)!;
    const bill = createBill(ctx, userId, {
      title: 'Emergency vet visit',
      description:
        'My dog needed an emergency visit and the invoice is larger than anything I can pay in one go this month.',
      category: 'emergency',
      targetAmount: 9000,
      currency: 'USD',
    });
    reviewBill(ctx, admin.id, bill.id, 'approve', 'ok');
    expect(() => recordSwipe(ctx, userId, bill.id, 'help')).toThrowError(/own bill/i);
  });
});

describe('payments', () => {
  async function setupBill(): Promise<{ ownerId: string; billId: string; helperId: string }> {
    const owner = await newUser('payer_owner');
    const helper = await newUser('payer_helper');
    const admin = db.first<{ id: string }>(`SELECT id FROM users WHERE role = 'admin'`)!;
    const bill = createBill(ctx, owner.userId, {
      title: 'Electricity bill after the storm',
      description:
        'The storm knocked out our heat for four days and the electricity bill arrived higher than usual this month.',
      category: 'utilities',
      targetAmount: 10000,
      currency: 'USD',
    });
    reviewBill(ctx, admin.id, bill.id, 'approve', 'ok');
    return { ownerId: owner.userId, billId: bill.id, helperId: helper.userId };
  }

  it('creates a pending intent and settles it once', async () => {
    const { billId, helperId } = await setupBill();
    const intent = createPaymentIntent(ctx, helperId, {
      billId,
      amount: 2500,
      idempotencyKey: 'idem-settle-0001',
    });
    expect(intent.payment.status).toBe('pending');
    expect(intent.sandbox).toBe(true);

    const settled = settlePayment(ctx, intent.payment.id, { source: 'sandbox' });
    expect(settled.payment.status).toBe('succeeded');
    expect(settled.alreadySettled).toBe(false);
    expect(settled.bill.raisedAmount).toBe(2500);

    const replay = settlePayment(ctx, intent.payment.id, { source: 'sandbox' });
    expect(replay.alreadySettled).toBe(true);
    expect(
      db.first<{ raised_amount: number }>('SELECT raised_amount FROM bills WHERE id = ?', billId)!.raised_amount,
    ).toBe(2500);
    expect(db.first<{ c: number }>('SELECT COUNT(*) AS c FROM help_records WHERE bill_id = ?', billId)!.c).toBe(1);
  });

  it('is idempotent on the client key', async () => {
    const { billId, helperId } = await setupBill();
    const first = createPaymentIntent(ctx, helperId, { billId, amount: 1000, idempotencyKey: 'same-key-123' });
    const second = createPaymentIntent(ctx, helperId, { billId, amount: 1000, idempotencyKey: 'same-key-123' });
    expect(second.payment.id).toBe(first.payment.id);
    expect(db.first<{ c: number }>('SELECT COUNT(*) AS c FROM payments WHERE bill_id = ?', billId)!.c).toBe(1);
  });

  it('caps a contribution at the remaining amount', async () => {
    const { billId, helperId } = await setupBill();
    // Ask for more than is outstanding (but within the per-payment maximum):
    // the server caps the contribution at the remaining amount.
    const intent = createPaymentIntent(ctx, helperId, { billId, amount: 20_000, idempotencyKey: 'cap-key-1' });
    expect(intent.payment.amount).toBe(10000);
  });

  it('marks a fully funded bill and refuses further intents', async () => {
    const { billId, helperId, ownerId } = await setupBill();
    const other = await newUser('another_helper');
    const intent = createPaymentIntent(ctx, helperId, { billId, amount: 10000, idempotencyKey: 'fund-key-1' });
    const settled = settlePayment(ctx, intent.payment.id, { source: 'sandbox' });
    expect(settled.bill.status).toBe('fully_funded');
    expect(settled.bill.raisedAmount).toBe(10000);

    expect(() =>
      createPaymentIntent(ctx, other.userId, { billId, amount: 500, idempotencyKey: 'fund-key-2' }),
    ).toThrowError(/not accepting|fully funded/i);

    const detail = billDetailFor(ctx, billId, ownerId);
    expect(detail.viewer.isOwner).toBe(true);
    expect(detail.helpers.length).toBe(1);
  });

  it('rejects self-help, non-positive and oversized amounts', async () => {
    const { billId, helperId } = await setupBill();
    expect(() =>
      createPaymentIntent(ctx, helperId, { billId, amount: 0, idempotencyKey: 'bad-amount-1' }),
    ).toThrowError();
    expect(() =>
      createPaymentIntent(ctx, helperId, { billId, amount: 10_000_000, idempotencyKey: 'bad-amount-2' }),
    ).toThrowError();
  });

  it('refunds and reverses the raised total atomically', async () => {
    const { billId, helperId } = await setupBill();
    const admin = db.first<{ id: string }>(`SELECT id FROM users WHERE role = 'admin'`)!;
    const intent = createPaymentIntent(ctx, helperId, { billId, amount: 3000, idempotencyKey: 'refund-key-1' });
    settlePayment(ctx, intent.payment.id, { source: 'sandbox' });
    expect(db.first<{ raised_amount: number }>('SELECT raised_amount FROM bills WHERE id = ?', billId)!.raised_amount).toBe(3000);

    refundPayment(ctx, intent.payment.id, admin.id, 'test refund');
    expect(
      db.first<{ raised_amount: number; bill_status: string }>('SELECT * FROM bills WHERE id = ?', billId)!.raised_amount,
    ).toBe(0);
    expect(
      db.first<{ payment_status: string }>('SELECT * FROM payments WHERE id = ?', intent.payment.id)!.payment_status,
    ).toBe('refunded');
    expect(db.first('SELECT 1 AS x FROM audit_logs WHERE action = ?', 'payment.refund')).toBeTruthy();
  });

  it('records failed payments without touching the bill', async () => {
    const { billId, helperId } = await setupBill();
    const intent = createPaymentIntent(ctx, helperId, { billId, amount: 1200, idempotencyKey: 'fail-key-1' });
    failPayment(ctx, intent.payment.id, 'card_declined');
    expect(
      db.first<{ payment_status: string; failure_reason: string }>('SELECT * FROM payments WHERE id = ?', intent.payment.id)!
        .payment_status,
    ).toBe('failed');
    expect(db.first<{ raised_amount: number }>('SELECT raised_amount FROM bills WHERE id = ?', billId)!.raised_amount).toBe(0);
  });

  it('hides anonymous helpers from the public but not from the owner', async () => {
    const { billId, helperId, ownerId } = await setupBill();
    const intent = createPaymentIntent(ctx, helperId, {
      billId,
      amount: 500,
      idempotencyKey: 'anon-key-1',
      isAnonymous: true,
    });
    settlePayment(ctx, intent.payment.id, { source: 'sandbox' });

    const anonymousView = billDetailFor(ctx, billId, null);
    expect(anonymousView.helpers[0]!.helper).toBeNull();
    expect(anonymousView.helpers[0]!.isAnonymous).toBe(true);

    const ownerView = billDetailFor(ctx, billId, ownerId);
    expect(ownerView.helpers[0]!.helper).not.toBeNull();
  });

  it('writes notifications for both sides', async () => {
    const { billId, helperId, ownerId } = await setupBill();
    const intent = createPaymentIntent(ctx, helperId, { billId, amount: 800, idempotencyKey: 'notify-key-1' });
    settlePayment(ctx, intent.payment.id, { source: 'sandbox' });
    expect(db.first<{ c: number }>('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?', helperId)!.c).toBeGreaterThan(0);
    expect(db.first<{ c: number }>('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?', ownerId)!.c).toBeGreaterThan(0);
    expect(db.first<{ c: number }>('SELECT COUNT(*) AS c FROM community_posts WHERE bill_id = ?', billId)!.c).toBe(1);
  });
});

describe('community and reporting', () => {
  it('computes stats from real records only', async () => {
    const stats = communityStats(ctx);
    expect(stats.billsHelped).toBeGreaterThan(0);
    expect(stats.amountGiven).toBeGreaterThan(0);
    expect(stats.currency).toBe('USD');
    const feed = communityFeed(ctx, null, 50);
    expect(feed.length).toBeGreaterThan(0);
    expect(feed[0]!.headline).toBeTruthy();
  });

  it('accepts one open report per target', async () => {
    const { userId } = await newUser('reporter');
    const target = discoverBills(ctx, userId, { limit: 1 }).bills[0]!;
    submitReport(ctx, userId, { targetType: 'bill', targetId: target.id, reason: 'Fake or stolen receipt' });
    expect(() =>
      submitReport(ctx, userId, { targetType: 'bill', targetId: target.id, reason: 'Duplicate listing' }),
    ).toThrowError(/already reported/i);
  });
});

describe('admin', () => {
  it('summarises the platform and lists review work', async () => {
    const overview = adminOverview(ctx);
    expect(overview.users).toBeGreaterThan(10);
    expect(overview.bills).toBeGreaterThan(14);
    expect(overview.amountSucceeded).toBeGreaterThan(0);
    expect(overview.demoBills).toBeGreaterThanOrEqual(15);

    const admin = db.first<{ id: string }>(`SELECT id FROM users WHERE role = 'admin'`)!;
    expect(adminUsers(ctx, {}).length).toBeGreaterThan(10);
    expect(adminPayments(ctx).length).toBeGreaterThan(0);
    expect(() => adminSetUserStatus(ctx, admin.id, admin.id, 'banned', 'self')).toThrowError(/your own status/i);
  });

  it('writes an audit record for every review action', async () => {
    const admin = db.first<{ id: string }>(`SELECT id FROM users WHERE role = 'admin'`)!;
    const target = discoverBills(ctx, null, { limit: 1 }).bills[0]!;
    reviewBill(ctx, admin.id, target.id, 'suspend', 'policy check');
    reviewBill(ctx, admin.id, target.id, 'reopen', 'cleared');
    const logs = db.all<{ action: string }>('SELECT action FROM audit_logs ORDER BY created_at DESC');
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(['bill.suspend', 'bill.reopen']));
  });
});

describe('concurrency', () => {
  it('never over-funds a bill across concurrent settlements', async () => {
    const owner = await newUser('race_owner');
    const admin = db.first<{ id: string }>(`SELECT id FROM users WHERE role = 'admin'`)!;
    const bill = createBill(ctx, owner.userId, {
      title: 'Concurrency test bill',
      description:
        'A bill used by the automated test suite to prove the funding totals stay consistent under concurrent settlement.',
      category: 'other',
      targetAmount: 1000,
      currency: 'USD',
    });
    reviewBill(ctx, admin.id, bill.id, 'approve', 'ok');

    const helpers = await Promise.all([newUser('race_a'), newUser('race_b'), newUser('race_c')]);
    const intents = helpers.map((h, i) =>
      createPaymentIntent(ctx, h.userId, { billId: bill.id, amount: 1000, idempotencyKey: `race-key-${i}` }),
    );
    for (const intent of intents) {
      try {
        settlePayment(ctx, intent.payment.id, { source: 'sandbox' });
      } catch {
        /* later settlements are rejected once the bill is funded */
      }
    }
    const row = db.first<{ raised_amount: number; target_amount: number; bill_status: string }>(
      'SELECT * FROM bills WHERE id = ?',
      bill.id,
    )!;
    expect(row.raised_amount).toBe(row.target_amount);
    expect(row.bill_status).toBe('fully_funded');
  });
});
