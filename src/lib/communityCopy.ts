import { useI18n } from './i18n';
import { useDemoTitle } from './demoContent';
import type { CommunityPost } from '@shared/types';

/**
 * Localised rendering of community posts.
 *
 * Headlines and stock fixture copy are generated on the server in English, so the
 * client recomposes them from structured fields when Chinese is active. Real
 * member-written text is shown exactly as written.
 */
export function usePostCopy() {
  const { t, lang } = useI18n();
  const demoTtitle = useDemoTitle();

  const headline = (post: CommunityPost): string => {
    if (lang !== 'zh') return post.headline;
    if (post.kind === 'help' && post.billTitle) {
      const actor = post.actor?.isAnonymous ? t('Someone kind') : t(post.actor?.displayName ?? 'A helper');
      return t('{actor} helped someone with {bill}', { actor, bill: demoTtitle(post.billTitle) });
    }
    return t(post.headline);
  };

  const detail = (post: CommunityPost): string => t(post.detail);

  return { headline, detail };
}
