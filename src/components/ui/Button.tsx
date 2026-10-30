import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'help' | 'pass';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-white shadow-[0_10px_24px_-12px_rgba(121,87,255,0.9)] hover:bg-[#6c48ff] active:translate-y-px',
  secondary: 'bg-ink text-white hover:bg-[#2c2c2c] active:translate-y-px',
  ghost: 'bg-transparent text-ink hover:bg-black/[0.05]',
  soft: 'bg-brand-soft text-brand-ink hover:bg-[#e3daff]',
  danger: 'bg-coral-soft text-[#C02444] hover:bg-[#ffd8e0]',
  help: 'bg-mint text-white hover:bg-[#22b47c] shadow-[0_12px_24px_-14px_rgba(41,197,138,0.9)]',
  pass: 'bg-white text-ink border border-line hover:border-[#dcd7d0] hover:bg-[#fbfaf8]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] rounded-xl gap-1.5',
  md: 'h-11 px-5 text-sm rounded-[14px] gap-2',
  lg: 'h-[52px] px-6 text-[15px] rounded-2xl gap-2',
  xl: 'h-14 px-7 text-base rounded-2xl gap-2.5',
};

const BASE =
  'inline-flex select-none items-center justify-center font-semibold tracking-[-0.01em] transition-all duration-150 disabled:pointer-events-none disabled:opacity-45 whitespace-nowrap';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, icon, trailing, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(BASE, VARIANTS[variant], SIZES[size], block && 'w-full', className)}
      {...rest}
    >
      {icon}
      {children}
      {trailing}
    </button>
  );
});

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  block,
  icon,
  trailing,
  className,
  children,
  external,
  ...rest
}: {
  to: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
  external?: boolean;
  'aria-label'?: string;
}) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], block && 'w-full', className);
  if (external) {
    return (
      <a href={to} target="_blank" rel="noreferrer noopener" className={classes} {...rest}>
        {icon}
        {children}
        {trailing}
      </a>
    );
  }
  return (
    <Link to={to} className={classes} {...rest}>
      {icon}
      {children}
      {trailing}
    </Link>
  );
}
