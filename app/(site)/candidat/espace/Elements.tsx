'use client';
// Éléments interactifs du tableau de bord candidat.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, LogOut, Trash2, Upload } from 'lucide-react';
import { MAX_JUSTIFICATIFS } from '@/lib/candidats/domaine';
import { definirRecherche, deconnecter, supprimerDocument, televerser } from '../actions';

const Message = ({ r }: { r: { ok: boolean; texte: string } | null }) =>
  r ? (
    <p role={r.ok ? 'status' : 'alert'} className={`text-sm ${r.ok ? 'text-green-800' : 'text-red-700'}`}>
      {r.texte}
    </p>
  ) : null;

/** « Je suis toujours en recherche » / « Je ne cherche plus » (RG-10). */
export function BasculeRecherche({ enRecherche }: { enRecherche: boolean }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  const [r, setR] = useState<{ ok: boolean; texte: string } | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={envoi}
        onClick={async () => {
          setEnvoi(true);
          const res = await definirRecherche(!enRecherche).catch(() => ({ ok: false as const, erreur: 'Connexion au serveur impossible.' }));
          setR(res.ok ? { ok: true, texte: res.message ?? '' } : { ok: false, texte: res.erreur });
          setEnvoi(false);
          router.refresh();
        }}
        className={`flex w-full items-center justify-center gap-2 min-h-12 px-5 rounded-full font-semibold disabled:opacity-60 ${enRecherche ? 'border border-slate-200 text-slate-800' : 'bg-primary text-white'}`}
      >
        {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
        {enRecherche ? 'Je ne cherche plus' : 'Je suis toujours en recherche'}
      </button>
      <Message r={r} />
    </div>
  );
}

const ko = (octets: number) => `${Math.max(1, Math.round(octets / 1024))} Ko`;

/** CV (remplaçable) et justificatifs (5 au plus) : liste, téléchargement, ajout, suppression. */
export function Documents({ documents }: { documents: { id: number; categorie: 'cv' | 'justificatif'; nom: string; taille: number }[] }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [r, setR] = useState<{ ok: boolean; texte: string } | null>(null);
  const cv = documents.find((d) => d.categorie === 'cv');
  const justificatifs = documents.filter((d) => d.categorie === 'justificatif');

  const envoyer = async (categorie: 'cv' | 'justificatif', fichier: File | undefined) => {
    if (!fichier) return;
    if (fichier.size > 5 * 1024 * 1024) return setR({ ok: false, texte: 'Fichier trop lourd : 5 Mo maximum.' });
    setEnvoi(categorie);
    setR(null);
    const fd = new FormData();
    fd.set('fichier', fichier);
    fd.set('categorie', categorie);
    const res = await televerser(fd).catch(() => ({ ok: false as const, erreur: 'Envoi impossible. Vérifiez votre connexion.' }));
    setR(res.ok ? { ok: true, texte: res.message ?? 'Enregistré.' } : { ok: false, texte: res.erreur });
    setEnvoi(null);
    router.refresh();
  };

  const ligne = (d: (typeof documents)[number]) => (
    <li key={d.id} className="flex items-center justify-between gap-2 py-1">
      <a href={`/candidat/espace/documents/${d.id}`} className="flex items-center gap-2 min-w-0 min-h-11 text-sm text-ink-900 underline">
        <Download className="w-4 h-4 shrink-0" /> <span className="truncate">{d.nom}</span> <span className="text-slate-500 shrink-0">({ko(d.taille)})</span>
      </a>
      <button
        type="button"
        aria-label={`Supprimer ${d.nom}`}
        onClick={async () => {
          if (!window.confirm(`Supprimer « ${d.nom} » ?`)) return;
          const res = await supprimerDocument(d.id).catch(() => ({ ok: false as const, erreur: 'Suppression impossible.' }));
          setR(res.ok ? { ok: true, texte: res.message ?? '' } : { ok: false, texte: res.erreur });
          router.refresh();
        }}
        className="w-11 h-11 inline-flex items-center justify-center text-red-700 shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  );

  const champFichier = (categorie: 'cv' | 'justificatif', libelle: string) => (
    <label className="flex items-center justify-center gap-2 min-h-12 px-4 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-700 cursor-pointer">
      {envoi === categorie ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {libelle}
      <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,image/*" className="sr-only" disabled={!!envoi} onChange={(e) => envoyer(categorie, e.target.files?.[0])} />
    </label>
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-1">CV</p>
        {cv ? <ul>{ligne(cv)}</ul> : <p className="text-sm text-slate-500 mb-2">Aucun CV : une photo nette de votre CV papier convient.</p>}
        {champFichier('cv', cv ? 'Remplacer mon CV' : 'Ajouter mon CV')}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700 mb-1">
          Justificatifs ({justificatifs.length}/{MAX_JUSTIFICATIFS})
        </p>
        {justificatifs.length > 0 && <ul>{justificatifs.map(ligne)}</ul>}
        {justificatifs.length < MAX_JUSTIFICATIFS && champFichier('justificatif', 'Ajouter un justificatif')}
      </div>
      <Message r={r} />
    </div>
  );
}

export function BoutonDeconnexion() {
  return (
    <form action={deconnecter}>
      <button type="submit" className="flex w-full items-center justify-center gap-2 min-h-12 px-5 rounded-full border border-slate-200 font-semibold text-slate-800">
        <LogOut className="w-4 h-4" /> Se déconnecter
      </button>
    </form>
  );
}
