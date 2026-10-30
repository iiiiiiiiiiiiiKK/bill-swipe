/**
 * Relational schema for the BILL SWIPE core database.
 *
 * Runs inside a SQLite-backed Durable Object (single-writer, serialized
 * transactions) which gives us the same relational guarantees as Postgres for
 * this workload while staying inside Cloudflare's free tier.
 *
 * Money columns are INTEGER minor units (cents). Never floats.
 */

export const SCHEMA_VERSION = 1;

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS meta (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL,
     email_verified INTEGER NOT NULL DEFAULT 0,
     password_hash TEXT NOT NULL,
     username TEXT NOT NULL,
     display_name TEXT NOT NULL,
     avatar_url TEXT,
     avatar_seed TEXT NOT NULL,
     bio TEXT NOT NULL DEFAULT '',
     country TEXT NOT NULL DEFAULT 'US',
     region TEXT NOT NULL DEFAULT '',
     role TEXT NOT NULL DEFAULT 'user',
     account_status TEXT NOT NULL DEFAULT 'active',
     anonymous_by_default INTEGER NOT NULL DEFAULT 0,
     public_profile INTEGER NOT NULL DEFAULT 1,
     notify_email INTEGER NOT NULL DEFAULT 1,
     notify_in_app INTEGER NOT NULL DEFAULT 1,
     locale TEXT NOT NULL DEFAULT 'en',
     is_demo INTEGER NOT NULL DEFAULT 0,
     risk_score INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     last_seen_at TEXT
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(lower(email))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(lower(username))`,

  `CREATE TABLE IF NOT EXISTS sessions (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     token_hash TEXT NOT NULL,
     created_at TEXT NOT NULL,
     expires_at TEXT NOT NULL,
     user_agent TEXT,
     ip_hash TEXT
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,

  `CREATE TABLE IF NOT EXISTS bills (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     description TEXT NOT NULL,
     category TEXT NOT NULL,
     target_amount INTEGER NOT NULL,
     raised_amount INTEGER NOT NULL DEFAULT 0,
     paid_amount INTEGER NOT NULL DEFAULT 0,
     currency TEXT NOT NULL DEFAULT 'USD',
     due_date TEXT,
     settlement_handle TEXT,
     receipt_id TEXT,
     receipt_private_path TEXT,
     receipt_public_path TEXT,
     verification_status TEXT NOT NULL DEFAULT 'pending',
     bill_status TEXT NOT NULL DEFAULT 'draft',
     review_note TEXT,
     reviewed_by TEXT,
     reviewed_at TEXT,
     risk_flags TEXT NOT NULL DEFAULT '[]',
     is_demo INTEGER NOT NULL DEFAULT 0,
     fundraise_key TEXT NOT NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(bill_status)`,
  `CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bills_fundraise_key ON bills(fundraise_key)`,
  `CREATE INDEX IF NOT EXISTS idx_bills_created ON bills(created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS receipts (
     id TEXT PRIMARY KEY,
     bill_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     private_key TEXT NOT NULL,
     public_key TEXT,
     file_name TEXT NOT NULL,
     mime_type TEXT NOT NULL,
     size INTEGER NOT NULL,
     sha256 TEXT NOT NULL,
     width INTEGER,
     height INTEGER,
     scan_status TEXT NOT NULL DEFAULT 'pending',
     created_at TEXT NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_sha ON receipts(sha256)`,
  `CREATE INDEX IF NOT EXISTS idx_receipts_bill ON receipts(bill_id)`,

  `CREATE TABLE IF NOT EXISTS swipes (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
     action TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_swipes_user_bill ON swipes(user_id, bill_id)`,
  `CREATE INDEX IF NOT EXISTS idx_swipes_user ON swipes(user_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS payments (
     id TEXT PRIMARY KEY,
     payer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
     amount INTEGER NOT NULL,
     fee INTEGER NOT NULL DEFAULT 0,
     currency TEXT NOT NULL,
     platform_fee_bps INTEGER NOT NULL DEFAULT 0,
     payment_provider TEXT NOT NULL,
     provider_payment_id TEXT,
     client_idempotency_key TEXT,
     payment_status TEXT NOT NULL DEFAULT 'pending',
     failure_reason TEXT,
     is_anonymous INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_within_bill ON payments(id, bill_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idem ON payments(payer_id, client_idempotency_key)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider ON payments(payment_provider, provider_payment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS help_records (
     id TEXT PRIMARY KEY,
     bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
     payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
     payer_id TEXT NOT NULL,
     amount INTEGER NOT NULL,
     currency TEXT NOT NULL,
     is_anonymous INTEGER NOT NULL DEFAULT 0,
     message TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_help_payment ON help_records(payment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_help_bill ON help_records(bill_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS payment_events (
     id TEXT PRIMARY KEY,
     payment_id TEXT NOT NULL,
     bill_id TEXT NOT NULL,
     type TEXT NOT NULL,
     amount INTEGER NOT NULL,
     note TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_events(payment_id)`,

  `CREATE TABLE IF NOT EXISTS notifications (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     type TEXT NOT NULL,
     title TEXT NOT NULL,
     body TEXT NOT NULL,
     href TEXT,
     is_read INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS reports (
     id TEXT PRIMARY KEY,
     reporter_id TEXT NOT NULL,
     target_type TEXT NOT NULL,
     target_id TEXT NOT NULL,
     reason TEXT NOT NULL,
     details TEXT NOT NULL DEFAULT '',
     status TEXT NOT NULL DEFAULT 'open',
     resolution TEXT,
     handled_by TEXT,
     handled_at TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS blocked_users (
     user_id TEXT NOT NULL,
     blocked_user_id TEXT NOT NULL,
     created_at TEXT NOT NULL,
     PRIMARY KEY (user_id, blocked_user_id)
   )`,

  `CREATE TABLE IF NOT EXISTS audit_logs (
     id TEXT PRIMARY KEY,
     admin_id TEXT NOT NULL,
     action TEXT NOT NULL,
     target_type TEXT NOT NULL,
     target_id TEXT NOT NULL,
     metadata TEXT NOT NULL DEFAULT '{}',
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS community_posts (
     id TEXT PRIMARY KEY,
     bill_id TEXT,
     payment_id TEXT,
     actor_id TEXT,
     kind TEXT NOT NULL,
     headline TEXT NOT NULL,
     detail TEXT NOT NULL DEFAULT '',
     amount INTEGER,
     currency TEXT NOT NULL DEFAULT 'USD',
     created_at TEXT NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_payment ON community_posts(payment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_posts_created ON community_posts(created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS community_likes (
     post_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     created_at TEXT NOT NULL,
     PRIMARY KEY (post_id, user_id)
   )`,

  `CREATE TABLE IF NOT EXISTS community_comments (
     id TEXT PRIMARY KEY,
     post_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     body TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'visible',
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_comments_post ON community_comments(post_id, created_at)`,

  `CREATE TABLE IF NOT EXISTS bill_updates (
     id TEXT PRIMARY KEY,
     bill_id TEXT NOT NULL,
     body TEXT NOT NULL,
     author TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_bill_updates_bill ON bill_updates(bill_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS rate_limits (
     bucket TEXT PRIMARY KEY,
     count INTEGER NOT NULL,
     window_start INTEGER NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS email_outbox (
     id TEXT PRIMARY KEY,
     to_email TEXT NOT NULL,
     subject TEXT NOT NULL,
     body TEXT NOT NULL,
     created_at TEXT NOT NULL,
     sent_at TEXT,
     error TEXT
   )`,
];

export const SEED_DEMO_KEY = 'demo_seeded';
