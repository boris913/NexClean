'use client';
// Recherche rapide du Back-Office (Ctrl+K / ⌘K) : aller à une page du menu ou à un dossier
// (numéro, client, contact, téléphone). Feuille client légère : la recherche de dossiers passe
// par une action serveur qui applique les droits (un Référent ne trouve que ses dossiers).
// Modèle d'accessibilité : boîte de dialogue + combobox (aria-activedescendant) + listbox.
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, FolderOpen, Loader2, Search, X } from 'lucide-react';
import { rechercherDossiers, type ResultatRechercheDossier } from '@/app/(backoffice)/admin/(prive)/recherche/actions';
import { ICONES, type GroupeNav } from './Navigation';

type Option = { cle: string; href: string; libelle: string; detail?: string } & ({ genre: 'page'; icone: keyof typeof ICONES } | { genre: 'dossier' });

const normaliser = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Bouton d'ouverture + raccourci clavier global + palette. */
export function RechercheRapide({ groupes, variante = 'barre' }: { groupes: GroupeNav[]; variante?: 'barre' | 'icone' }) {
  const [ouvert, setOuvert] = useState(false);
  const declencheur = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Un seul écouteur actif : la variante « barre » (≥ lg) et « icone » (< lg) sont toutes
    // deux montées ; seule la variante visible réagit au raccourci.
    const surTouche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (!declencheur.current || declencheur.current.offsetParent === null) return;
        e.preventDefault();
        setOuvert((o) => !o);
      }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, []);

  const fermer = useCallback(() => {
    setOuvert(false);
    declencheur.current?.focus();
  }, []);

  return (
    <>
      {variante === 'barre' ? (
        <button
          ref={declencheur}
          type="button"
          onClick={() => setOuvert(true)}
          aria-haspopup="dialog"
          aria-keyshortcuts="Control+K Meta+K"
          className="flex w-full items-center gap-2 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2 text-sm text-ink-500 transition-colors hover:border-ink-300 hover:bg-white hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Search aria-hidden className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Rechercher…</span>
          <kbd className="rounded border border-ink-200 bg-white px-1.5 font-sans text-[11px] font-medium text-ink-500">Ctrl K</kbd>
        </button>
      ) : (
        <button
          ref={declencheur}
          type="button"
          onClick={() => setOuvert(true)}
          aria-haspopup="dialog"
          aria-label="Rechercher un dossier ou une page"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100"
        >
          <Search aria-hidden className="h-5 w-5" />
        </button>
      )}
      {ouvert && <Palette groupes={groupes} onFermer={fermer} />}
    </>
  );
}

function Palette({ groupes, onFermer }: { groupes: GroupeNav[]; onFermer: () => void }) {
  const router = useRouter();
  const id = useId();
  const champ = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [dossiers, setDossiers] = useState<ResultatRechercheDossier[]>([]);
  const [recherche, setRecherche] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [actif, setActif] = useState(0);
  const derniere = useRef(0);

  useEffect(() => {
    champ.current?.focus();
    const corps = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = corps;
    };
  }, []);

  // Recherche de dossiers avec un délai (~250 ms) ; une réponse périmée est ignorée.
  useEffect(() => {
    const texte = q.trim();
    if (texte.length < 2) {
      setDossiers([]);
      setRecherche(false);
      return;
    }
    setRecherche(true);
    const n = ++derniere.current;
    const minuterie = setTimeout(async () => {
      try {
        const r = await rechercherDossiers(texte);
        if (n !== derniere.current) return;
        setDossiers(r);
        setErreur(false);
      } catch {
        if (n === derniere.current) setErreur(true);
      } finally {
        if (n === derniere.current) setRecherche(false);
      }
    }, 250);
    return () => clearTimeout(minuterie);
  }, [q]);

  const pages = useMemo(() => {
    const t = normaliser(q.trim());
    return groupes
      .flatMap((g) => g.liens)
      .filter((l) => !t || normaliser(l.libelle).includes(t))
      .map<Option>((l) => ({ cle: `page:${l.href}`, genre: 'page', href: l.href, libelle: l.libelle, icone: l.icone }));
  }, [groupes, q]);

  const options: Option[] = useMemo(
    () => [
      ...dossiers.map<Option>((d) => ({ cle: `dossier:${d.id}`, genre: 'dossier', href: `/admin/dossiers/${d.id}`, libelle: `${d.numero} — ${d.client}`, detail: [d.type, d.statut, d.ville].filter(Boolean).join(' · ') })),
      ...pages,
    ],
    [dossiers, pages],
  );

  useEffect(() => setActif(0), [options.length, q]);

  const aller = (o: Option | undefined) => {
    if (!o) return;
    onFermer();
    router.push(o.href);
  };

  const surTouche = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onFermer();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActif((i) => (options.length ? (i + 1) % options.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => (options.length ? (i - 1 + options.length) % options.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      aller(options[actif]);
    } else if (e.key === 'Tab') {
      // Le focus reste dans la palette (champ unique : navigation par les flèches).
      e.preventDefault();
    }
  };

  const listeId = `${id}-liste`;
  const optionId = (i: number) => `${id}-option-${i}`;
  const texte = q.trim();
  const dossiersAffiches = options.filter((o) => o.genre === 'dossier').length;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-ink-900/40 px-3 pt-[12vh] sm:px-6" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div role="dialog" aria-modal="true" aria-label="Recherche rapide" className="w-full max-w-xl overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card" onKeyDown={surTouche}>
        <div className="flex items-center gap-2 border-b border-ink-100 px-4">
          <Search aria-hidden className="h-4 w-4 shrink-0 text-ink-400" />
          <input
            ref={champ}
            role="combobox"
            aria-expanded="true"
            aria-controls={listeId}
            aria-activedescendant={options.length ? optionId(actif) : undefined}
            aria-autocomplete="list"
            aria-label="Rechercher un dossier (numéro, client, téléphone) ou une page"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="N° de dossier, client, téléphone ou page…"
            className="h-14 min-w-0 flex-1 border-0 bg-transparent text-base text-ink-900 shadow-none placeholder:text-ink-400 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {recherche && <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-ink-400 motion-reduce:animate-none" />}
          <button type="button" onClick={onFermer} aria-label="Fermer la recherche" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <ul id={listeId} role="listbox" aria-label="Résultats" className="max-h-[55vh] overflow-y-auto p-2">
          {options.map((o, i) => {
            const Icone = o.genre === 'page' ? ICONES[o.icone] : FolderOpen;
            const titreGroupe = i === 0 && o.genre === 'dossier' ? 'Dossiers' : o.genre === 'page' && (i === 0 || options[i - 1]!.genre !== 'page') ? 'Pages' : null;
            return (
              <li key={o.cle} role="presentation">
                {titreGroupe && <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{titreGroupe}</p>}
                <div
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === actif}
                  onMouseMove={() => setActif(i)}
                  onClick={() => aller(o)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm ${i === actif ? 'bg-brand-50 text-brand-900' : 'text-ink-700'}`}
                >
                  <Icone aria-hidden className={`h-4 w-4 shrink-0 ${i === actif ? 'text-primary' : 'text-ink-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${o.genre === 'dossier' ? 'font-medium text-ink-900' : ''}`}>{o.libelle}</span>
                    {o.detail && <span className="block truncate text-xs text-ink-500">{o.detail}</span>}
                  </span>
                  {i === actif && <CornerDownLeft aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-400" />}
                </div>
              </li>
            );
          })}
        </ul>

        <p aria-live="polite" className="border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500">
          {erreur
            ? 'La recherche n’a pas abouti. Vérifiez la connexion puis réessayez.'
            : texte.length >= 2 && !recherche && dossiersAffiches === 0
              ? `Aucun dossier ne correspond à « ${texte} ».`
              : texte.length < 2
                ? 'Tapez au moins 2 caractères pour chercher un dossier. ↑ ↓ pour choisir, Entrée pour ouvrir, Échap pour fermer.'
                : `${dossiersAffiches} dossier${dossiersAffiches > 1 ? 's' : ''} trouvé${dossiersAffiches > 1 ? 's' : ''} (8 au plus, les plus récemment actifs).`}
        </p>
      </div>
    </div>
  );
}
