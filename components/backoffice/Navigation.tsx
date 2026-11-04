'use client';
// Navigation du Back-Office : liens groupés avec page active (barre latérale ≥ lg) et tiroir sur mobile.
// Purement présentationnel : la liste des liens et leur visibilité sont calculées côté serveur
// (layout), et chaque page revérifie l'accès. Les icônes sont désignées par une clé, car un
// composant ne peut pas être transmis du serveur au client.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Banknote, Bell, Briefcase, ClipboardList, FolderOpen, LayoutDashboard, MapPin, Menu, MessageSquare, ScrollText, Settings, ShieldCheck, Shuffle, UserCog, Users, X, type LucideIcon } from 'lucide-react';

export const ICONES = {
  accueil: LayoutDashboard,
  notifications: Bell,
  dossiers: FolderOpen,
  attribution: Shuffle,
  candidats: Users,
  candidatures: Briefcase,
  finances: Banknote,
  collaborateurs: UserCog,
  referentiel: MapPin,
  modeles: MessageSquare,
  parametres: Settings,
  journal: ScrollText,
  securite: ShieldCheck,
  saisie: ClipboardList,
} satisfies Record<string, LucideIcon>;

export type CleIcone = keyof typeof ICONES;
export interface LienNav {
  href: string;
  libelle: string;
  icone: CleIcone;
  badge?: number;
}
export interface GroupeNav {
  titre?: string;
  liens: LienNav[];
}

function estActif(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

export function LiensNav({ groupes, onNavigue }: { groupes: GroupeNav[]; onNavigue?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="space-y-6">
      {groupes.map((g, i) => (
        <div key={g.titre ?? i}>
          {g.titre && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{g.titre}</p>}
          <ul className="space-y-0.5">
            {g.liens.map((l) => {
              const actif = estActif(pathname, l.href);
              const Icone = ICONES[l.icone];
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={onNavigue}
                    aria-current={actif ? 'page' : undefined}
                    className={`group flex min-h-11 lg:min-h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${actif ? 'bg-brand-50 text-brand-900' : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900'}`}
                  >
                    <Icone aria-hidden className={`h-[18px] w-[18px] shrink-0 ${actif ? 'text-primary' : 'text-ink-400 group-hover:text-ink-600'}`} />
                    <span className="truncate">{l.libelle}</span>
                    {!!l.badge && (
                      <span className="ml-auto min-w-5 rounded-full bg-red-600 px-1.5 text-center text-[11px] font-bold leading-5 text-white tabular-nums">
                        <span className="sr-only">, </span>
                        {l.badge > 99 ? '99+' : l.badge}
                        <span className="sr-only"> non lue{l.badge > 1 ? 's' : ''}</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Bouton « Menu » et tiroir de navigation (< lg). */
export function MenuMobile({ groupes, entete, pied }: { groupes: GroupeNav[]; entete: ReactNode; pied: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Fermeture à chaque changement de page.
  useEffect(() => setOuvert(false), [pathname]);

  useEffect(() => {
    if (!ouvert) return;
    const precedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panneau.current?.querySelector<HTMLElement>('a, button')?.focus();
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
      if (e.key !== 'Tab' || !panneau.current) return;
      // Le focus reste dans le tiroir tant qu'il est ouvert.
      const focusables = panneau.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      const premier = focusables[0];
      const dernier = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier?.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier?.focus();
      }
    };
    document.addEventListener('keydown', clavier);
    return () => {
      document.body.style.overflow = precedent;
      document.removeEventListener('keydown', clavier);
      bouton.current?.focus();
    };
  }, [ouvert]);

  return (
    <>
      <button
        ref={bouton}
        type="button"
        onClick={() => setOuvert(true)}
        aria-expanded={ouvert}
        aria-controls="menu-mobile"
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100"
      >
        <Menu aria-hidden className="h-5 w-5" />
        <span className="sr-only">Menu</span>
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div aria-hidden className="absolute inset-0 bg-ink-900/40 animate-fade-in" onClick={() => setOuvert(false)} />
          <div
            ref={panneau}
            id="menu-mobile"
            role="dialog"
            aria-modal="true"
            aria-label="Menu du Back-Office"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-white shadow-2xl animate-[tiroir_0.22s_cubic-bezier(0.22,1,0.36,1)]"
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-ink-100 px-4">
              {entete}
              <button type="button" onClick={() => setOuvert(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100">
                <X aria-hidden className="h-5 w-5" />
                <span className="sr-only">Fermer le menu</span>
              </button>
            </div>
            <nav aria-label="Navigation du Back-Office" className="flex-1 overflow-y-auto px-3 py-4">
              <LiensNav groupes={groupes} onNavigue={() => setOuvert(false)} />
            </nav>
            <div className="shrink-0 border-t border-ink-100 p-3">{pied}</div>
          </div>
        </div>
      )}
    </>
  );
}
