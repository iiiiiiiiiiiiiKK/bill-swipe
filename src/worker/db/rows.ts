/** Row shapes as stored in SQLite (snake_case, integers for booleans). */

export interface UserRow {
  id: string;
  email: string;
  email_verified: number;
  password_hash: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_seed: string;
  bio: string;
  country: string;
  region: string;
  role: 'user' | 'admin';
  account_status: 'active' | 'restricted' | 'banned';
  anonymous_by_default: number;
  public_profile: number;
  notify_email: number;
  notify_in_app: number;
  locale: 'en' | 'zh';
  is_demo: number;
  risk_score: number;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  user_agent: string | null;
  ip_hash: string | null;
}

export interface BillRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  target_amount: number;
  raised_amount: number;
  paid_amount: number;
  currency: string;
  due_date: string | null;
  settlement_handle: string | null;
  receipt_id: string | null;
  receipt_private_path: string | null;
  receipt_public_path: string | null;
  verification_status: string;
  bill_status: string;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  risk_flags: string;
  is_demo: number;
  fundraise_key: string;
  created_at: string;
  updated_at: string;
}

export interface ReceiptRow {
  id: string;
  bill_id: string;
  user_id: string;
  private_key: string;
  public_key: string | null;
  file_name: string;
  mime_type: string;
  size: number;
  sha256: string;
  width: number | null;
  height: number | null;
  scan_status: string;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  payer_id: string;
  bill_id: string;
  amount: number;
  fee: number;
  currency: string;
  platform_fee_bps: number;
  payment_provider: string;
  provider_payment_id: string | null;
  client_idempotency_key: string | null;
  payment_status: string;
  failure_reason: string | null;
  is_anonymous: number;
  created_at: string;
  updated_at: string;
}

export interface HelpRecordRow {
  id: string;
  bill_id: string;
  payment_id: string;
  payer_id: string;
  amount: number;
  currency: string;
  is_anonymous: number;
  message: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  is_read: number;
  created_at: string;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string;
  status: string;
  resolution: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
}

export interface AuditRow {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: string;
  created_at: string;
}

export interface CommunityPostRow {
  id: string;
  bill_id: string | null;
  payment_id: string | null;
  actor_id: string | null;
  kind: string;
  headline: string;
  detail: string;
  amount: number | null;
  currency: string;
  created_at: string;
}

export interface SwipeRow {
  id: string;
  user_id: string;
  bill_id: string;
  action: string;
  created_at: string;
}
