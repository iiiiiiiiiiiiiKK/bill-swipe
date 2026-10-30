import type { Db } from '../db';
import type { BillRow, NotificationRow, UserRow } from '../db/rows';
import type { NotificationItem } from '@shared/types';
import { nowIso } from '../db';
import { randomId, sha256Hex } from '../auth/crypto';

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string | null;
  email?: boolean;
}

/** Insert in-app notifications and queue the matching email (best effort). */
export function notify(db: Db, input: NotifyInput): void {
  const user = db.first<UserRow>('SELECT * FROM users WHERE id = ?', input.userId);
  if (!user) return;
  if (user.notify_in_app === 1) {
    db.run(
      `INSERT INTO notifications (id, user_id, type, title, body, href, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      randomId('ntf'),
      input.userId,
      input.type,
      input.title.slice(0, 160),
      input.body.slice(0, 600),
      input.href ?? null,
      nowIso(),
    );
  }
  if (input.email !== false && user.notify_email === 1) {
    queueEmail(db, user.email, input.title, input.body);
  }
}

export function queueEmail(db: Db, to: string, subject: string, body: string): void {
  db.run(
    `INSERT INTO email_outbox (id, to_email, subject, body, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    randomId('eml'),
    to,
    subject.slice(0, 200),
    body.slice(0, 4000),
    nowIso(),
  );
}

export function listNotifications(db: Db, userId: string, limit = 30): NotificationItem[] {
  return db
    .all<NotificationRow>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      userId,
      limit,
    )
    .map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      href: row.href,
      isRead: row.is_read === 1,
      createdAt: row.created_at,
    }));
}

export function unreadCount(db: Db, userId: string): number {
  return db.first<{ c: number }>('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0', userId)?.c ?? 0;
}

export interface AuditInput {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export function audit(db: Db, input: AuditInput): void {
  db.run(
    `INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    randomId('aud'),
    input.adminId,
    input.action,
    input.targetType,
    input.targetId,
    JSON.stringify(input.metadata ?? {}),
    nowIso(),
  );
}

export interface RiskContext {
  title: string;
  description: string;
  targetAmount: number;
  category: string;
  userId: string;
  receiptSha: string;
}

/**
 * Heuristic pre-moderation signals. These are advisory only — a human admin
 * still approves every bill before it becomes visible in Discover.
 */
export function detectRiskFlags(db: Db, ctx: RiskContext): string[] {
  const flags: string[] = [];
  if (ctx.targetAmount > 1_000_000) flags.push('amount_above_10k');
  if (ctx.targetAmount < 300) flags.push('amount_below_3');

  const duplicateReceipt = db.first<{ id: string }>('SELECT id FROM receipts WHERE sha256 = ?', ctx.receiptSha);
  if (duplicateReceipt) flags.push('duplicate_receipt');

  const recent = db.first<{ c: number }>(
    `SELECT COUNT(*) AS c FROM bills WHERE user_id = ? AND created_at > ?`,
    ctx.userId,
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );
  if ((recent?.c ?? 0) >= 3) flags.push('high_post_frequency');

  const openBills = db.first<{ c: number }>(
    `SELECT COUNT(*) AS c FROM bills WHERE user_id = ? AND bill_status IN ('active','approved','pending_review')`,
    ctx.userId,
  );
  if ((openBills?.c ?? 0) >= 4) flags.push('many_open_bills');

  const text = `${ctx.title} ${ctx.description}`.toLowerCase();
  const sensitive = [
    /\b\d{3}-\d{2}-\d{4}\b/, // US SSN
    /\b(?:\d[ -]*?){13,19}\b/, // card-like numbers
    /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/,
    /\bibn\b/i,
  ];
  if (sensitive.some((re) => re.test(text))) flags.push('possible_sensitive_data');
  if (/\b(whatsapp|telegram|t\.me|@[a-z0-9_]{4,})\b/i.test(text)) flags.push('offsite_contact_request');
  if (ctx.description.trim().length < 80) flags.push('short_story');

  return flags;
}

export async function fingerprintReceipt(bytes: ArrayBuffer): Promise<string> {
  return sha256Hex(bytes);
}

export function billNotificationHref(bill: BillRow): string {
  return `/bills/${bill.id}`;
}
