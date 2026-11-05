'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, Phone, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Container, { containerClasses } from '@/components/ui/Container';
import Logo from '@/components/ui/Logo';
import { cx } from '@/components/ui/cx';
import { BRAND, TEL_LINK } from '@/lib/constants';
import { CTA_DEMANDE, LIENS_NAV, MENUS_NAV, estLienActif, type MenuNav } from '@/components/navigation/nav-data';

const LARGEUR_LG = '(min-width: 1024px)';

const itemClasses = (actif: boolean) =>
  cx(
    'inline-flex min-h-tap items-center gap-1 whitespace-nowrap rounded-full px-2 xl:px-3 text-sm font-medium transition-colors',
    actif ? 'bg-brand-50 text-primary' : 'text-ink-700 hover:bg-brand-50 hover:text-primary',
  );

const lienMobileClasses =
  'flex min-h-tap items-center rounded-lg px-3 text-base font-medium text-ink-900 hover:bg-brand-50 hover:text-primary';

/**
 * Sous-menu desktop : bouton de divulgation + liste de liens.
 * Entrée/Espace ouvre, flèches haut/bas parcourent les liens, Échap ferme et rend le focus au bouton,
 * et le menu se ferme quand le focus en sort.
 */
function SousMenu({
  menu,
  ouvert,
  actif,
  onChange,
}: {
  menu: MenuNav;
  ouvert: boolean;
  actif: boolean;
  onChange: (ouvert: boolean) => void;
}) {
  const bouton = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const focusEnAttente = useRef<'premier' | 'dernier' | null>(null);
  const idListe = `sous-menu-${menu.id}`;

  const liens = () => Array.from(liste.current?.querySelectorAll('a') ?? []);

  // La liste n'est focalisable qu'une fois affichée.
  useEffect(() => {
    if (!ouvert || !focusEnAttente.current) return;
    const tous = liens();
    tous[focusEnAttente.current === 'premier' ? 0 : tous.length - 1]?.focus();
    focusEnAttente.current = null;
  }, [ouvert]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && ouvert) {
      e.preventDefault();
      onChange(false);
      bouton.current?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (!ouvert) {
      focusEnAttente.current = e.key === 'ArrowDown' ? 'premier' : 'dernier';
      onChange(true);
      return;
    }
    const tous = liens();
    const position = tous.indexOf(document.activeElement as HTMLAnchorElement);
    const pas = e.key === 'ArrowDown' ? 1 : -1;
    const suivant = position === -1 ? (pas === 1 ? 0 : tous.length - 1) : (position + pas + tous.length) % tous.length;
    tous[suivant]?.focus();
  };

  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // relatedTarget vaut null lors d'un clic sur un élément non focalisable : le clic extérieur s'en charge.
    if (ouvert && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) onChange(false);
  };

  return (
    <div className="relative" onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={bouton}
        type="button"
        onClick={() => onChange(!ouvert)}
        aria-expanded={ouvert}
        aria-controls={idListe}
        className={itemClasses(actif)}
      >
        {menu.label}
        <ChevronDown className={cx('w-3.5 h-3.5 transition-transform', ouvert && 'rotate-180')} aria-hidden="true" />
      </button>
      <ul
        ref={liste}
        id={idListe}
        hidden={!ouvert}
        className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-ink-100 bg-white p-2 shadow-card-hover animate-slide-down"
      >
        {menu.liens.map((lien) => (
          <li key={lien.href}>
            <Link
              href={lien.href}
              onClick={() => onChange(false)}
              className="flex min-h-tap items-center rounded-xl px-3 text-sm font-medium text-ink-900 transition-colors hover:bg-brand-50 hover:text-primary"
            >
              {lien.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Header() {
  const pathname = usePathname() || '/';
  const [scrolled, setScrolled] = useState(false);
  const [menuMobile, setMenuMobile] = useState(false);
  const [sousMenu, setSousMenu] = useState<string | null>(null);
  const navDesktop = useRef<HTMLElement>(null);
  const boutonMobile = useRef<HTMLButtonElement>(null);

  const fermerTout = useCallback(() => {
    setMenuMobile(false);
    setSousMenu(null);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuMobile ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuMobile]);

  // Le menu mobile n'existe plus à partir de lg : sans cela, le défilement resterait bloqué.
  useEffect(() => {
    const media = window.matchMedia(LARGEUR_LG);
    const onChange = () => {
      if (media.matches) setMenuMobile(false);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(fermerTout, [pathname, fermerTout]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (navDesktop.current && !navDesktop.current.contains(e.target as Node)) setSousMenu(null);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const onKeyDownMobile = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && menuMobile) {
      setMenuMobile(false);
      boutonMobile.current?.focus();
    }
  };

  const onBlurMobile = (e: React.FocusEvent<HTMLElement>) => {
    // Le menu recouvre la page : on le ferme plutôt que de laisser le focus passer dessous.
    if (menuMobile && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setMenuMobile(false);
  };

  return (
    <header
      onKeyDown={onKeyDownMobile}
      onBlur={onBlurMobile}
      className={cx(
        'fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-b transition-[border-color,box-shadow] duration-300',
        scrolled ? 'border-ink-100 shadow-card' : 'border-transparent',
      )}
    >
      <Container className="flex h-20 items-center justify-between gap-3">
        <Link href="/" aria-label={`${BRAND.name} — Accueil`} className="flex-shrink-0">
          <Logo height={42} priority className="h-9 w-auto" />
        </Link>

        <nav ref={navDesktop} className="hidden lg:flex items-center gap-0.5" aria-label="Navigation principale">
          {MENUS_NAV.map((menu) => (
            <SousMenu
              key={menu.id}
              menu={menu}
              ouvert={sousMenu === menu.id}
              actif={menu.actif(pathname)}
              onChange={(ouvert) => setSousMenu(ouvert ? menu.id : null)}
            />
          ))}
          {LIENS_NAV.map((lien) => {
            const actif = estLienActif(pathname, lien.href);
            return (
              <Link key={lien.href} href={lien.href} aria-current={actif ? 'page' : undefined} className={itemClasses(actif)}>
                {lien.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            href={TEL_LINK}
            variant="outline"
            size="sm"
            icon={Phone}
            aria-label={`Appeler ${BRAND.name}`}
            className="hidden md:inline-flex w-11 !px-0"
          >
            {null}
          </Button>
          <Button href={CTA_DEMANDE.href} size="sm" className="hidden md:inline-flex whitespace-nowrap">
            {CTA_DEMANDE.label}
          </Button>
          <button
            ref={boutonMobile}
            type="button"
            onClick={() => setMenuMobile(!menuMobile)}
            aria-label={menuMobile ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuMobile}
            aria-controls="menu-mobile"
            className="lg:hidden -mr-2 inline-flex min-h-tap min-w-tap items-center justify-center rounded-lg text-ink-900 transition-colors hover:bg-ink-100"
          >
            {menuMobile ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
          </button>
        </div>
      </Container>

      <div
        id="menu-mobile"
        hidden={!menuMobile}
        className="lg:hidden max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-ink-100 bg-white animate-slide-down"
      >
        <nav aria-label="Navigation mobile" className={cx(containerClasses.default, 'pt-4 pb-28')}>
          {MENUS_NAV.map((menu) => (
            <div key={menu.id} className="mb-4">
              <p id={`groupe-${menu.id}`} className="px-3 pb-1 text-eyebrow uppercase text-muted">
                {menu.label}
              </p>
              <ul aria-labelledby={`groupe-${menu.id}`}>
                {menu.liens.map((lien) => (
                  <li key={lien.href}>
                    <Link href={lien.href} onClick={fermerTout} className={lienMobileClasses}>
                      {lien.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <ul className="mb-4 border-t border-ink-100 pt-3">
            {LIENS_NAV.map((lien) => (
              <li key={lien.href}>
                <Link href={lien.href} onClick={fermerTout} className={lienMobileClasses}>
                  {lien.label}
                </Link>
              </li>
            ))}
          </ul>
          <Button href={CTA_DEMANDE.href} fullWidth onClick={fermerTout}>
            {CTA_DEMANDE.label}
          </Button>
        </nav>
      </div>
    </header>
  );
}
