import type { Db } from '../db';
import type { BillRow, HelpRecordRow, PaymentRow, UserRow } from '../db/rows';
import type { BillDetail, BillSummary, HelpRecord, Payment, PublicUser } from '@shared/types';
import { toBillSummary, toPublicUser, cleanText } from '../lib/serialize';
import { computeFee } from '@shared/money';

const HELP_VISIBLE_STATUSES = ['succeeded', 'refunded', 'disputed'];

export function helperCountFor(db: Db, billId: string): number {
  const row = db.first<{ c: number }>(
    `SELECT COUNT(DISTINCT payer_id) AS c FROM help_records WHERE bill_id = ?`,
    billId,
  );
  return row?.c ?? 0;
}

export function ownerOf(db: Db, bill: BillRow): UserRow {
  const owner = db.first<UserRow>('SELECT * FROM users WHERE id = ?', bill.user_id);
  if (!owner) {
    // Should never happen thanks to FK cascade; fail loud rather than silently.
    throw Object.assign(new Error('bill_owner_missing'), { code: 'not_found' });
  }
  return owner;
}

export function summarize(db: Db, bill: BillRow, viewerId: string | null): BillSummary {
  const viewerAction = viewerId
    ? db.first<{ action: string }>('SELECT action FROM swipes WHERE user_id = ? AND bill_id = ?', viewerId, bill.id)?.action ?? null
    : null;
  return toBillSummary(bill, {
    owner: ownerOf(db, bill),
    helperCount: helperCountFor(db, bill.id),
    viewerAction,
  });
}

export function helperIdentity(
  db: Db,
  row: HelpRecordRow,
  viewerId: string | null,
): HelpRecord['helper'] {
  const anonymous = row.is_anonymous === 1;
  const isOwnerOrAdmin = (() => {
    if (!viewerId) return false;
    const bill = db.first<BillRow>('SELECT * FROM bills WHERE id = ?', row.bill_id);
    if (bill && bill.user_id === viewerId) return true;
    const viewer = db.first<UserRow>('SELECT * FROM users WHERE id = ?', viewerId);
    return viewer?.role === 'admin';
  })();
  if (anonymous && !isOwnerOrAdmin) return null;
  const user = db.first<UserRow>('SELECT * FROM users WHERE id = ?', row.payer_id);
  if (!user) return null;
  return {
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    avatarSeed: user.avatar_seed,
    isDemo: user.is_demo === 1,
  };
}

export function helpRecordsFor(db: Db, billId: string, viewerId: string | null, limit = 20): HelpRecord[] {
  const rows = db.all<HelpRecordRow & { payment_status: string }>(
    `SELECT h.*, p.payment_status
       FROM help_records h
       JOIN payments p ON p.id = h.payment_id
      WHERE h.bill_id = ?
      ORDER BY h.created_at DESC
      LIMIT ?`,
    billId,
    limit,
  );
  return rows
    .filter((row) => HELP_VISIBLE_STATUSES.includes(row.payment_status))
    .map((row) => ({
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      isAnonymous: row.is_anonymous === 1,
      createdAt: row.created_at,
      paymentStatus: row.payment_status as HelpRecord['paymentStatus'],
      message: row.message,
      helper: helperIdentity(db, row, viewerId),
    }));
}

export function billDetail(db: Db, bill: BillRow, viewer: UserRow | null): BillDetail {
  const isOwner = viewer?.id === bill.user_id;
  const isAdmin = viewer?.role === 'admin';
  const summary = summarize(db, bill, viewer?.id ?? null);
  const viewerHelped = viewer
    ? db.first<{ total: number | null }>(
        `SELECT SUM(h.amount) AS total
           FROM help_records h JOIN payments p ON p.id = h.payment_id
          WHERE h.bill_id = ? AND h.payer_id = ? AND p.payment_status = 'succeeded'`,
        bill.id,
        viewer.id,
      )?.total ?? 0
    : 0;
  const receipt = bill.receipt_id
    ? db.first<{
        id: string;
        file_name: string;
        mime_type: string;
        size: number;
        created_at: string;
        private_key: string;
        public_key: string | null;
      }>('SELECT * FROM receipts WHERE id = ?', bill.receipt_id)
    : null;

  const canHelp =
    !!viewer &&
    !isOwner &&
    bill.bill_status === 'active' &&
    bill.raised_amount < bill.target_amount &&
    viewer.account_status === 'active';
  const hasPaidHelp = viewerHelped > 0;
  const canEdit =
    isOwner &&
    ['draft', 'pending_review', 'rejected', 'approved'].includes(bill.bill_status) &&
    bill.raised_amount === 0;

  const updates = db
    .all<{ id: string; body: string; author: string; created_at: string }>(
      'SELECT id, body, author, created_at FROM bill_updates WHERE bill_id = ? ORDER BY created_at DESC LIMIT 10',
      bill.id,
    )
    .map((u) => ({ id: u.id, body: u.body, createdAt: u.created_at, author: u.author }));

  return {
    ...summary,
    paidAmount: bill.paid_amount,
    reviewNote: isOwner || isAdmin ? bill.review_note : null,
    receipt: receipt
      ? {
          id: receipt.id,
          fileName: receipt.file_name,
          mimeType: receipt.mime_type,
          size: receipt.size,
          uploadedAt: receipt.created_at,
          publicPath: receipt.public_key,
        }
      : null,
    helpers: helpRecordsFor(db, bill.id, viewer?.id ?? null),
    updates,
    viewer: {
      isOwner,
      canEdit,
      canHelp,
      hasHelped: hasPaidHelp,
      helpedAmount: viewerHelped,
    },
    admin: isAdmin
      ? {
          receiptPrivateUrl: receipt ? `/api/admin/receipts/${receipt.id}` : null,
          riskFlags: parseRiskFlags(bill.risk_flags),
        }
      : undefined,
  };
}

export function parseRiskFlags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((f): f is string => typeof f === 'string') : [];
  } catch {
    return [];
  }
}

export function paymentToDto(row: PaymentRow, billTitle: string, billOwner?: string): Payment {
  return {
    id: row.id,
    billId: row.bill_id,
    billTitle,
    amount: row.amount,
    fee: row.fee,
    total: row.amount + row.fee,
    currency: row.currency,
    status: row.payment_status as Payment['status'],
    provider: row.payment_provider,
    providerPaymentId: row.provider_payment_id,
    isAnonymous: row.is_anonymous === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sandbox: row.payment_provider === 'sandbox',
    billOwner,
  };
}

export function feeFor(amount: number, bps: number): number {
  return computeFee(amount, bps);
}

export { cleanText, toPublicUser };
export type { PublicUser };
