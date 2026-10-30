export type BillCategoryId =
  | 'rent'
  | 'medical'
  | 'education'
  | 'groceries'
  | 'utilities'
  | 'transportation'
  | 'emergency'
  | 'other';

export interface BillCategory {
  id: BillCategoryId;
  label: string;
  short: string;
  /** Tailwind-friendly hex tints used across cards and chips. */
  tint: string;
  ink: string;
  blurb: string;
}

export const BILL_CATEGORIES: BillCategory[] = [
  {
    id: 'rent',
    label: 'Rent & Housing',
    short: 'Rent',
    tint: '#EDE7FF',
    ink: '#4A2EC4',
    blurb: 'Keeping a roof overhead.',
  },
  {
    id: 'medical',
    label: 'Medical',
    short: 'Medical',
    tint: '#FFE6EB',
    ink: '#AC2045',
    blurb: 'Treatment, meds, recovery.',
  },
  {
    id: 'education',
    label: 'Education',
    short: 'Education',
    tint: '#E4F1FF',
    ink: '#17569F',
    blurb: 'Books, tuition, a fresh start.',
  },
  {
    id: 'groceries',
    label: 'Food & Groceries',
    short: 'Groceries',
    tint: '#E6F7EE',
    ink: '#0A6440',
    blurb: 'Putting food on the table.',
  },
  {
    id: 'utilities',
    label: 'Utilities',
    short: 'Utilities',
    tint: '#FFF2DC',
    ink: '#7C4A00',
    blurb: 'Power, water, heat.',
  },
  {
    id: 'transportation',
    label: 'Transportation',
    short: 'Transport',
    tint: '#E7F6FA',
    ink: '#095B71',
    blurb: 'Getting where you need to be.',
  },
  {
    id: 'emergency',
    label: 'Emergency',
    short: 'Emergency',
    tint: '#FFE9E1',
    ink: '#96340C',
    blurb: 'The unplanned, uninvited.',
  },
  {
    id: 'other',
    label: 'Other',
    short: 'Other',
    tint: '#F0EEEC',
    ink: '#44403C',
    blurb: 'Life, in all its shapes.',
  },
];

export const CATEGORY_MAP: Record<string, BillCategory> = Object.fromEntries(
  BILL_CATEGORIES.map((c) => [c.id, c]),
);

export function categoryOf(id: string): BillCategory {
  return CATEGORY_MAP[id] ?? CATEGORY_MAP.other;
}
