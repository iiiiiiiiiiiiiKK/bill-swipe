/** Domain types shared by the Cloudflare Worker API and the React client. */

export type BillStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'fully_funded'
  | 'closed'
  | 'suspended';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'disputed';

export type SwipeAction = 'pass' | 'help' | 'super_help';

export type AccountStatus = 'active' | 'restricted' | 'banned';

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarSeed: string;
  bio: string;
  country: string;
  region: string;
  createdAt: string;
  isDemo: boolean;
}

export interface MeProfile extends PublicUser {
  email: string;
  emailVerified: boolean;
  role: 'user' | 'admin';
  accountStatus: AccountStatus;
  anonymousByDefault: boolean;
  publicProfile: boolean;
  notifyEmail: boolean;
  notifyInApp: boolean;
  locale: 'en' | 'zh';
  stats: UserStats;
  achievements: Achievement[];
}

export interface UserStats {
  helpedCount: number;
  helpedAmount: number;
  billsPosted: number;
  billsCompleted: number;
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  /** Progress toward earning, 0..1 */
  progress: number;
}

export interface BillSummary {
  id: string;
  title: string;
  category: string;
  targetAmount: number;
  raisedAmount: number;
  remainingAmount: number;
  currency: string;
  story: string;
  excerpt: string;
  imageUrl: string | null;
  dueDate: string | null;
  status: BillStatus;
  verificationStatus: VerificationStatus;
  createdAt: string;
  helperCount: number;
  isDemo: boolean;
  owner: PublicUser;
  /** Swipe state for the requesting viewer, when known. */
  viewerAction?: SwipeAction | null;
}

export interface BillDetail extends BillSummary {
  paidAmount: number;
  reviewNote: string | null;
  receipt: {
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
    publicPath: string | null;
  } | null;
  helpers: HelpRecord[];
  updates: BillUpdate[];
  viewer: {
    isOwner: boolean;
    canEdit: boolean;
    canHelp: boolean;
    hasHelped: boolean;
    helpedAmount: number;
  };
  admin?: {
    receiptPrivateUrl: string | null;
    riskFlags: string[];
  };
}

export interface HelpRecord {
  id: string;
  amount: number;
  currency: string;
  isAnonymous: boolean;
  createdAt: string;
  paymentStatus: PaymentStatus;
  message: string | null;
  helper: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    avatarSeed: string;
    isDemo: boolean;
  } | null;
}

export interface BillUpdate {
  id: string;
  body: string;
  createdAt: string;
  author: string;
}

export interface Payment {
  id: string;
  billId: string;
  billTitle: string;
  amount: number;
  fee: number;
  total: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerPaymentId: string | null;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  sandbox: boolean;
  billOwner?: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  kind: 'help' | 'milestone' | 'story';
  headline: string;
  detail: string;
  amount: number | null;
  currency: string;
  createdAt: string;
  billId: string | null;
  billTitle: string | null;
  actor: {
    displayName: string;
    username: string;
    avatarUrl: string | null;
    avatarSeed: string;
    isAnonymous: boolean;
  } | null;
  likes: number;
  liked: boolean;
  comments: CommunityComment[];
}

export interface CommunityComment {
  id: string;
  body: string;
  createdAt: string;
  author: {
    displayName: string;
    username: string;
    avatarUrl: string | null;
    avatarSeed: string;
  };
}

export interface CommunityStats {
  billsHelped: number;
  amountGiven: number;
  peopleSupported: number;
  connections: number;
  currency: string;
  demoIncluded: boolean;
}

export interface DiscoverFeed {
  bills: BillSummary[];
  viewer: {
    id: string | null;
    isAdmin: boolean;
  };
  remaining: number;
}

export interface AdminOverview {
  users: number;
  bills: number;
  pendingReview: number;
  activeBills: number;
  fullyFunded: number;
  amountSucceeded: number;
  openReports: number;
  paymentAnomalies: number;
  demoBills: number;
}

export interface AdminBillRow extends BillSummary {
  ownerEmail: string;
  ownerStatus: AccountStatus;
  receiptPresent: boolean;
  reportCount: number;
  riskFlags: string[];
}

export interface AdminUserRow extends PublicUser {
  email: string;
  role: 'user' | 'admin';
  accountStatus: AccountStatus;
  billsPosted: number;
  helpedAmount: number;
  lastSeenAt: string | null;
}

export interface AdminPaymentRow {
  id: string;
  billId: string;
  billTitle: string;
  payer: string;
  amount: number;
  fee: number;
  total: number;
  status: PaymentStatus;
  provider: string;
  createdAt: string;
  anomaly: string | null;
}

export interface Report {
  id: string;
  targetType: 'bill' | 'user' | 'comment';
  targetId: string;
  targetLabel: string;
  reason: string;
  details: string;
  status: ReportStatus;
  createdAt: string;
  reporter: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
