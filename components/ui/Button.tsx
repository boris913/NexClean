import React from 'react';
import Link from 'next/link';
import { Loader2, type LucideIcon } from 'lucide-react';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { cx } from '@/components/ui/cx';

/**
 * Variantes :
 * - `primary`   : lime + texte encre (9,04:1) — action principale.
 * - `secondary` : vert profond + texte blanc (9,87:1) — action forte secondaire.
 * - `outline`   : contour, texte vert profond — action tertiaire sur fond clair.
 * - `ghost`     : texte seul (brand-700, 5,94:1).
 * - `whatsapp`  : canal secondaire, fond blanc + icône vert WhatsApp foncé (7,67:1).
 * - `inverse`   : contour blanc sur fond sombre (Section `dark`, PageHero `dark`).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'whatsapp' | 'inverse';

/** Anciens noms, conservés pour compatibilité : `dark` → `secondary`, `outline-light` → `inverse`. */
export type LegacyButtonVariant = 'dark' | 'outline-light';

export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant | LegacyButtonVariant;
  /** Toutes les tailles respectent la cible tactile de 44 px minimum. */
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  /** Lien interne (`/…`) → next/link ; ancre ou tel: → <a> ; externe (`http…`) → nouvel onglet. */
  href?: string;
  className?: string;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  /** Affiche un indicateur de chargement et bloque l'action. */
  loading?: boolean;
  /** Texte lu par les lecteurs d'écran pendant le chargement. */
  loadingLabel?: string;
  /** Ajoute automatiquement l'icône WhatsApp à gauche (variante `whatsapp`). */
  whatsappIcon?: boolean;
  'aria-label'?: string;
  id?: string;
  name?: string;
  value?: string;
  form?: string;
}

const LEGACY: Record<LegacyButtonVariant, ButtonVariant> = {
  dark: 'secondary',
  'outline-light': 'inverse',
};

export function resolveButtonVariant(variant: ButtonVariant | LegacyButtonVariant): ButtonVariant {
  return (LEGACY as Record<string, ButtonVariant>)[variant] ?? (variant as ButtonVariant);
}

const base =
  'group/btn relative inline-flex items-center justify-center font-semibold rounded-full select-none ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-300 ease-out-expo ' +
  'motion-safe:active:scale-[0.97] ' +
  'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-cta text-ink-900 shadow-btn hover:bg-cta-hover hover:shadow-btn-hover active:bg-brand-500 motion-safe:hover:-translate-y-0.5',
  secondary:
    'bg-forest text-white shadow-btn hover:bg-forest-deep active:bg-forest-deep motion-safe:hover:-translate-y-0.5',
  outline:
    'border border-ink-300 bg-white text-forest hover:border-forest hover:bg-brand-50 active:bg-brand-100',
  ghost: 'text-primary hover:text-primary-dark hover:bg-brand-50 active:bg-brand-100',
  // Canal secondaire : fond clair, icône aux couleurs de WhatsApp. Quand WhatsApp est l'action
  // principale d'un bloc, utiliser `primary` + `whatsappIcon` (un seul bouton plein par bloc).
  whatsapp:
    'border border-ink-200 bg-white text-ink-900 shadow-btn hover:border-whatsapp-dark hover:bg-ink-50 active:bg-ink-100',
  inverse: 'border border-white/60 text-white hover:bg-white/10 hover:border-white active:bg-white/20',
};

export const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-tap px-4 py-2 text-sm gap-1.5',
  md: 'min-h-12 px-6 py-2.5 text-sm gap-2',
  lg: 'min-h-14 px-7 py-3.5 text-base gap-2',
};

/** Classes d'un bouton, pour styler un élément qui ne peut pas utiliser <Button> (ex. <summary>). */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant | LegacyButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cx(base, buttonVariantClasses[resolveButtonVariant(variant)], buttonSizeClasses[size], fullWidth && 'w-full', className);
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  onClick,
  href,
  className,
  fullWidth = false,
  type = 'button',
  disabled = false,
  loading = false,
  loadingLabel = 'Chargement…',
  whatsappIcon = false,
  'aria-label': ariaLabel,
  id,
  name,
  value,
  form,
}: ButtonProps) {
  const classes = buttonClasses({ variant, size, fullWidth, className });
  const inactive = disabled || loading;
  const iconClass = size === 'lg' ? 'w-5 h-5 flex-shrink-0' : 'w-4 h-4 flex-shrink-0';

  const inner = (
    <>
      {loading ? (
        <Loader2 className={cx(iconClass, 'animate-spin')} aria-hidden="true" />
      ) : (
        <>
          {whatsappIcon && (
            <WhatsAppIcon className={cx(iconClass, resolveButtonVariant(variant) === 'whatsapp' && 'text-whatsapp-dark')} />
          )}
          {Icon && iconPosition === 'left' && <Icon className={iconClass} aria-hidden="true" />}
        </>
      )}
      {children}
      {loading && <span className="sr-only">{loadingLabel}</span>}
      {Icon && iconPosition === 'right' && !loading && (
        <Icon
          className={cx(iconClass, 'transition-transform motion-safe:group-hover/btn:translate-x-0.5')}
          aria-hidden="true"
        />
      )}
    </>
  );

  if (href) {
    const linkProps = {
      id,
      className: classes,
      'aria-label': ariaLabel,
      'aria-disabled': inactive || undefined,
      'aria-busy': loading || undefined,
      tabIndex: inactive ? -1 : undefined,
      onClick: inactive
        ? (e: React.MouseEvent<HTMLAnchorElement>) => e.preventDefault()
        : (onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined),
    };

    if (href.startsWith('/')) {
      return (
        <Link href={href} {...linkProps}>
          {inner}
        </Link>
      );
    }

    const external = href.startsWith('http');
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        {...linkProps}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type={type}
      id={id}
      name={name}
      value={value}
      form={form}
      onClick={onClick as React.MouseEventHandler<HTMLButtonElement> | undefined}
      className={classes}
      disabled={inactive}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
    >
      {inner}
    </button>
  );
}
