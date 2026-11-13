import type { BillRow, UserRow } from '../db/rows';
import type { BillSummary, PublicUser } from '@shared/types';
import { categoryOf } from '@shared/categories';

export function toPublicUser(row: UserRow): PublicUser {
  return {
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
  };
}

export function excerpt(text: string, max = 150): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max).trimEnd()}…`;
}

export interface BillSummaryExtras {
  /** Already-resolved public identity (see queries.publicIdentity). */
  owner: PublicUser | UserRow;
  helperCount: number;
  viewerAction?: string | null;
}

export function toBillSummary(row: BillRow, extras: BillSummaryExtras): BillSummary {
  const remaining = Math.max(0, row.target_amount - row.raised_amount);
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    targetAmount: row.target_amount,
    raisedAmount: row.raised_amount,
    remainingAmount: remaining,
    currency: row.currency,
    story: row.description,
    excerpt: excerpt(row.description),
    imageUrl: row.receipt_public_path ? `/api/media/public/${row.receipt_public_path}` : null,
    dueDate: row.due_date,
    status: row.bill_status as BillSummary['status'],
    verificationStatus: row.verification_status as BillSummary['verificationStatus'],
    createdAt: row.created_at,
    helperCount: extras.helperCount,
    isDemo: row.is_demo === 1,
    owner: 'display_name' in extras.owner ? toPublicUser(extras.owner) : extras.owner,
    viewerAction: (extras.viewerAction as BillSummary['viewerAction']) ?? null,
  };
}

export function categoryLabel(category: string): string {
  return categoryOf(category).label;
}

/** Basic public-output sanitiser: strips control chars and clamps length. */
export function cleanText(value: string, max: number): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}
