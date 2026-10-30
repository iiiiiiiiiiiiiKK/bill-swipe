import { Globe } from 'lucide-react';
import { useI18n, type Lang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Language switcher.
 *
 * `variant="segmented"` renders both options (desktop header, settings);
 * `variant="compact"` is a single toggle button for tight mobile headers.
 */
export function LanguageSwitcher({
  variant = 'segmented',
  className,
}: {
  variant?: 'segmented' | 'compact';
  className?: string;
}) {
  const { lang, setLang, t } = useI18n();

  if (variant === 'compact') {
    const next: Lang = lang === 'en' ? 'zh' : 'en';
    return (
      <button
        type="button"
        onClick={() => setLang(next)}
        aria-label={next === 'zh' ? t('Change language to Chinese') : t('Change language to English')}
        data-lang-switcher={next}
        className={cn(
          'inline-flex h-8 items-center justify-center gap-1 rounded-xl px-1.5 text-[12px] font-semibold text-[#57534E] transition active:bg-black/[0.06] min-[360px]:px-2',
          className,
        )}
      >
        <Globe className="size-[15px]" aria-hidden="true" />
        <span className={cn('hidden tabular-nums min-[360px]:inline', lang === 'zh' && 'text-brand-ink')}>
          {lang === 'en' ? 'EN' : '中文'}
        </span>
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t('Switch language')}
      className={cn('inline-flex items-center gap-0.5 rounded-xl bg-[#F3F1EE] p-0.5', className)}
    >
      <Globe className="ml-1.5 size-3.5 text-[#736E66]" aria-hidden="true" />
      {(['en', 'zh'] as Lang[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          data-lang-switcher={code}
          lang={code === 'zh' ? 'zh-CN' : 'en'}
          className={cn(
            'h-7 min-w-[34px] rounded-[10px] px-2 text-[12px] font-semibold transition',
            lang === code ? 'bg-white text-ink shadow-soft' : 'text-[#57534E] hover:text-ink',
          )}
        >
          {code === 'en' ? 'EN' : '中文'}
        </button>
      ))}
    </div>
  );
}
