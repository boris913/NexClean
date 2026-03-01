import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'whatsapp';
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
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<string, string> = {
    primary:
      'bg-primary text-white shadow-btn hover:bg-primary-dark hover:shadow-btn-hover focus-visible:ring-primary active:scale-[0.98]',
    secondary:
      'border border-slate-200 text-slate-800 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-btn focus-visible:ring-slate-400 active:scale-[0.98]',
    ghost:
      'text-primary hover:text-primary-dark hover:bg-primary-light focus-visible:ring-primary active:scale-[0.98]',
    whatsapp:
      'bg-[#25D366] text-white hover:bg-[#20B858] shadow-btn focus-visible:ring-[#25D366] active:scale-[0.98]',
  };

  const sizes: Record<string, string> = {
    sm: 'px-4 py-2 text-sm gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
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
      {Icon && iconPosition === 'right' && <Icon className={iconClass} />}
    </>
  );

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
