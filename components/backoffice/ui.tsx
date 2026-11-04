// Primitives d'interface du Back-Office : mobile-first, grandes cibles tactiles (≥ 44 px sur mobile,
// 40 px à partir de `sm` où l'on pointe à la souris). Uniquement des tokens de tailwind.config.ts
// (brand, ink, primary…) ; rouge et ambre de Tailwind pour erreur / alerte, faute de token dédié.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Inbox, type LucideIcon } from 'lucide-react';

// ─── Champs ──────────────────────────────────────────────────

export const classeChamp =
  'w-full min-h-11 sm:min-h-10 px-3 py-2 text-base sm:text-sm text-ink-900 bg-white border border-ink-200 rounded-lg shadow-sm shadow-ink-900/[0.02] outline-none transition-colors placeholder:text-ink-400 hover:border-ink-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-ink-50 disabled:text-ink-500 disabled:cursor-not-allowed';

export const classeLibelle = 'block text-sm font-medium text-ink-700 mb-1.5';

/** Texte d'aide sous un champ. */
export const classeAide = 'text-xs text-ink-500 mt-1.5';

// ─── Boutons ─────────────────────────────────────────────────

const variantes = {
  principal: 'bg-primary text-white shadow-sm hover:bg-primary-dark focus-visible:ring-brand-500',
  secondaire: 'bg-white text-ink-800 ring-1 ring-inset ring-ink-200 shadow-sm hover:bg-ink-50 hover:ring-ink-300',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500',
  fantome: 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
} as const;

export function classeBouton(variante: keyof typeof variantes = 'principal', pleineLargeur = false) {
  return `inline-flex items-center justify-center gap-2 min-h-11 sm:min-h-10 px-4 rounded-lg text-sm font-semibold whitespace-nowrap transition active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 ${variantes[variante]} ${pleineLargeur ? 'w-full' : ''}`;
}

// ─── Surfaces ────────────────────────────────────────────────

/** Surface blanche standard (formulaires de filtres, blocs libres). */
export const classeSurface = 'bg-white border border-ink-200/70 rounded-xl shadow-sm';

/** Carte cliquable d'une liste (dossier, candidat…). */
export const classeCarteLien =
  'block bg-white border border-ink-200/70 rounded-xl p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md focus-visible:border-brand-400';

export function Carte({ titre, description, children, actions }: { titre?: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`${classeSurface} p-4 sm:p-5`}>
      {(titre || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-4">
          <div className="min-w-0">
            {titre && <h2 className="text-[15px] font-semibold text-ink-900 leading-6">{titre}</h2>}
            {description && <p className="text-sm text-ink-500 mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// ─── Retours ─────────────────────────────────────────────────

const stylesAlerte: Record<'erreur' | 'succes' | 'info', { classe: string; icone: LucideIcon }> = {
  erreur: { classe: 'bg-red-50 text-red-800 border-red-200', icone: AlertTriangle },
  succes: { classe: 'bg-brand-50 text-brand-900 border-brand-200', icone: CheckCircle2 },
  info: { classe: 'bg-ocean-50 text-ink-800 border-ocean-100', icone: Info },
};

export function Alerte({ type = 'erreur', children }: { type?: 'erreur' | 'succes' | 'info'; children: ReactNode }) {
  const { classe, icone: Icone } = stylesAlerte[type];
  return (
    <div role={type === 'erreur' ? 'alert' : 'status'} className={`flex items-start gap-2.5 border rounded-lg px-3 py-2.5 text-sm ${classe}`}>
      <Icone aria-hidden className="h-4 w-4 shrink-0 mt-0.5 opacity-80" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

/** État vide d'une liste : dit pourquoi c'est vide, et propose l'action utile. */
export function EtatVide({ titre, description, action, icone: Icone = Inbox }: { titre: string; description?: ReactNode; action?: ReactNode; icone?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center text-center rounded-xl border border-dashed border-ink-200 bg-white/60 px-6 py-10">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        <Icone aria-hidden className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink-900">{titre}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── En-têtes et navigation de page ─────────────────────────

export function TitrePage({ titre, description, retour, children }: { titre: string; description?: ReactNode; retour?: { href: string; libelle: string }; children?: ReactNode }) {
  return (
    <header className="mb-6">
      {retour && (
        <Link href={retour.href} className="group -ml-1 mb-2 inline-flex items-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-ink-500 hover:text-primary">
          <ChevronLeft aria-hidden className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          {retour.libelle}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[1.75rem] font-display font-semibold tracking-tight text-ink-900 break-words">{titre}</h1>
          {description && <p className="mt-1 text-sm text-ink-500 max-w-2xl">{description}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}

/** Onglets de page : liens (l'onglet vit dans l'URL), avec compteur facultatif. */
export function Onglets({ libelle, onglets }: { libelle: string; onglets: { href: string; libelle: ReactNode; actif: boolean; compteur?: number | null }[] }) {
  return (
    <nav aria-label={libelle} className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max min-w-full gap-1 border-b border-ink-200/80">
        {onglets.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            aria-current={o.actif ? 'page' : undefined}
            className={`relative -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${o.actif ? 'border-primary text-ink-900' : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800'}`}
          >
            {o.libelle}
            {o.compteur != null && (
              <span className={`min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums leading-5 ${o.actif ? 'bg-brand-100 text-brand-900' : 'bg-ink-100 text-ink-600'}`}>{o.compteur}</span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Pagination précédent / suivant (pages de 20 résultats). */
export function Pagination({ page, suivante, lien, libelles = ['Précédents', 'Suivants'] }: { page: number; suivante: boolean; lien: (n: number) => string; libelles?: [string, string] }) {
  if (page <= 1 && !suivante) return null;
  return (
    <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-2">
      {page > 1 ? (
        <Link href={lien(page - 1)} className={classeBouton('secondaire')}>
          <ChevronLeft aria-hidden className="h-4 w-4" /> {libelles[0]}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs font-medium text-ink-500 tabular-nums">Page {page}</span>
      {suivante ? (
        <Link href={lien(page + 1)} className={classeBouton('secondaire')}>
          {libelles[1]} <ChevronRight aria-hidden className="h-4 w-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

// ─── Données ─────────────────────────────────────────────────

const tonsPastille = {
  neutre: 'bg-ink-50 text-ink-700 ring-ink-200',
  vert: 'bg-brand-50 text-brand-800 ring-brand-600/25',
  rouge: 'bg-red-50 text-red-700 ring-red-600/20',
  orange: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  bleu: 'bg-ocean-50 text-ocean-700 ring-ocean-500/20',
} as const;

const pointsPastille = { neutre: 'bg-ink-400', vert: 'bg-brand-500', rouge: 'bg-red-500', orange: 'bg-amber-500', bleu: 'bg-ocean-500' } as const;

export function Pastille({ children, ton = 'neutre', point = false }: { children: ReactNode; ton?: keyof typeof tonsPastille; point?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${tonsPastille[ton]}`}>
      {point && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${pointsPastille[ton]}`} />}
      {children}
    </span>
  );
}

/** Indicateur chiffré cliquable : mène à la liste qui permet d'agir. */
export function ChiffreCle({ valeur, libelle, href, alerte = false, icone: Icone }: { valeur: number; libelle: string; href: string; alerte?: boolean; icone?: LucideIcon }) {
  const enAlerte = alerte && valeur > 0;
  return (
    <Link href={href} className={`group relative flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${enAlerte ? 'border-amber-200 hover:border-amber-300' : 'border-ink-200/70 hover:border-brand-300'}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink-600 leading-tight">{libelle}</span>
        {Icone && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${enAlerte ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-700'}`}>
            <Icone aria-hidden className="h-4 w-4" />
          </span>
        )}
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className={`text-3xl font-display font-semibold tabular-nums tracking-tight ${enAlerte ? 'text-amber-700' : 'text-ink-900'}`}>{valeur}</span>
        <ChevronRight aria-hidden className="mb-1 h-4 w-4 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </span>
    </Link>
  );
}

/** Bloc de chargement aux dimensions du contenu final. */
export function Squelette({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-ink-200/60 ${className}`} />;
}

/** Résultat standard des actions serveur. */
export type ResultatAction = { ok: true; message?: string } | { ok: false; erreur: string };
