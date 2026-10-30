import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { Compass, Home } from 'lucide-react';
import { LinkButton } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center px-5 text-center">
      <Logo size={44} />
      <p className="mt-5 text-[64px] font-semibold leading-none tracking-[-0.05em] text-[#E9E4DC]">404</p>
      <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em]">{t('This bill does not exist')}</h1>
      <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">
        {t('The page you were looking for moved, closed, or never existed. There are still plenty of real bills waiting.')}
      </p>
      <div className="mt-6 flex gap-2">
        <LinkButton to="/discover" icon={<Compass className="size-4" aria-hidden="true" />}>
          {t('Go to Discover')}
        </LinkButton>
        <LinkButton to="/" variant="pass" icon={<Home className="size-4" aria-hidden="true" />}>
          {t('Home')}
        </LinkButton>
      </div>
      <Link to="/community" className="mt-4 text-[12.5px] font-semibold text-brand-ink hover:underline">
        {t('Or read what people have been helping with →')}
      </Link>
    </div>
  );
}
