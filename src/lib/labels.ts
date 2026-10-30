import { useI18n } from './i18n';
import { categoryOf } from '@shared/categories';

/** Localised bill-status label. Keeps status *values* untouched (logic safety). */
export function useStatusLabel() {
  const { t } = useI18n();
  return (status: string): { label: string; tone: 'brand' | 'mint' | 'coral' | 'amber' | 'neutral' } => {
    switch (status) {
      case 'active':
        return { label: t('Accepting help'), tone: 'brand' };
      case 'approved':
        return { label: t('Approved'), tone: 'mint' };
      case 'fully_funded':
        return { label: t('Fully funded'), tone: 'mint' };
      case 'pending_review':
        return { label: t('In review'), tone: 'amber' };
      case 'rejected':
        return { label: t('Needs changes'), tone: 'coral' };
      case 'suspended':
        return { label: t('Suspended'), tone: 'coral' };
      case 'closed':
        return { label: t('Closed'), tone: 'neutral' };
      case 'draft':
        return { label: t('Draft'), tone: 'neutral' };
      default:
        return { label: status, tone: 'neutral' };
    }
  };
}

/** Localised payment-status label. */
export function usePaymentStatusLabel() {
  const { t } = useI18n();
  return (status: string): { label: string; tone: 'brand' | 'mint' | 'coral' | 'amber' | 'neutral' } => {
    switch (status) {
      case 'succeeded':
        return { label: t('Succeeded'), tone: 'mint' };
      case 'pending':
        return { label: t('Pending'), tone: 'amber' };
      case 'processing':
        return { label: t('Processing'), tone: 'brand' };
      case 'failed':
        return { label: t('Failed'), tone: 'coral' };
      case 'refunded':
        return { label: t('Refunded'), tone: 'neutral' };
      case 'disputed':
        return { label: t('Disputed'), tone: 'coral' };
      default:
        return { label: status, tone: 'neutral' };
    }
  };
}

/** Localised bill category name. */
export function useCategoryLabel() {
  const { lang, t } = useI18n();
  return (category: string): string => {
    const cat = categoryOf(category);
    // Categories are translated by their English labels in the shared table.
    return lang === 'zh' ? t(cat.label) : cat.label;
  };
}

/** Localised achievement copy, falling back to the server-provided strings. */
export function useAchievementLabel() {
  const { t } = useI18n();
  return (id: string, fallbackLabel: string, fallbackDescription: string) => {
    const label = t(idLabelKeys[id] ?? fallbackLabel);
    const description = t(achievementDescriptions[id] ?? fallbackDescription);
    return { label, description };
  };
}

const idLabelKeys: Record<string, string> = {
  first_helper: 'First Helper',
  kindness_starter: 'Kindness Starter',
  helping_hand: 'Helping Hand',
  good_samaritan: 'Good Samaritan',
  community_hero: 'Community Hero',
};

const achievementDescriptions: Record<string, string> = {
  first_helper: 'You helped someone for the first time.',
  kindness_starter: 'Help 3 different bills.',
  helping_hand: 'Help 10 bills on your way.',
  good_samaritan: 'Spread help across 4 different bill categories.',
  community_hero: 'Reach 25 helps — no money ranking, just presence.',
};
