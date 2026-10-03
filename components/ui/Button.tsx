import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'whatsapp' | 'dark' | 'outline-light';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  onClick?: () => void;
  href?: string;
  className?: string;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  onClick,
  href,
  className = '',
  fullWidth = false,
  type = 'button',
  disabled = false,
}: ButtonProps) {
  const base =
    'group/btn relative inline-flex items-center justify-center font-semibold rounded-full transition-all duration-300 ease-out-expo focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] hover:-translate-y-0.5';

  const variants: Record<string, string> = {
    primary:
      'bg-cta text-ink-900 shadow-btn hover:bg-brand-300 hover:shadow-btn-hover focus-visible:ring-brand-500',
    secondary:
      'border border-ink-200 text-ink-800 bg-white hover:border-brand-400 hover:bg-brand-50 shadow-btn focus-visible:ring-brand-400',
    ghost:
      'text-primary hover:text-primary-dark hover:bg-brand-50 focus-visible:ring-brand-400 hover:translate-y-0',
    whatsapp:
      'bg-[#25D366] text-white hover:bg-[#1FBE5B] shadow-btn hover:shadow-[0_10px_24px_-6px_rgba(37,211,102,0.6)] focus-visible:ring-[#25D366]',
    dark:
      'bg-ink-900 text-white hover:bg-brand-800 shadow-btn focus-visible:ring-ink-700',
    'outline-light':
      'border border-white/30 text-white hover:bg-white/10 hover:border-white/60 focus-visible:ring-white',
  };

  const sizes: Record<string, string> = {
    sm: 'px-4 py-2 text-sm gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-7 py-3.5 text-[15px] gap-2',
  };

  const classes = [
    base,
    variants[variant],
    sizes[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconClass = 'w-4 h-4 flex-shrink-0';

  const inner = (
    <>
      {Icon && iconPosition === 'left' && <Icon className={iconClass} />}
      {children}
      {Icon && iconPosition === 'right' && <Icon className={`${iconClass} transition-transform group-hover/btn:translate-x-0.5`} />}
    </>
  );

  if (href?.startsWith('/')) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {inner}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes} disabled={disabled}>
      {inner}
    </button>
  );
}
