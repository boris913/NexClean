// MVP2-01 RG-09..12 : tableau de bord du candidat. N'affiche jamais : notes internes, statut
// interne détaillé, autres candidats, budgets des clients.
import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, FileText, User } from 'lucide-react';
import { lireEspace } from '@/lib/candidats/service';
import { exigerCandidat } from '@/lib/candidats/session';
import { FUSEAU } from '@/lib/domain/referentiels';
import Coque from '../Coque';
import { BasculeRecherche, BoutonDeconnexion, Documents } from './Elements';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mon espace candidat', robots: { index: false, follow: false } };

const date = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' }).format(d);

export default async function PageEspace() {
  const session = await exigerCandidat();
  const e = await lireEspace(session.id);
  const { pourcentage, manquants } = e.completude;

  return (
    <Coque titre={`Bonjour ${e.candidat.prenom}`} large>
      <div className="space-y-4">
        {e.rappelMiseAJour && (
          <div role="status" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>
              Votre profil n’a pas été mis à jour depuis plus de 6 mois. Vérifiez qu’il est toujours exact :{' '}
              <Link href="/candidat/espace/profil" className="underline font-semibold">
                mettre à jour mon profil
              </Link>
              .
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-ink-900">Mon profil</h2>
            <span className="text-sm font-semibold text-primary">{pourcentage} %</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100" role="progressbar" aria-valuenow={pourcentage} aria-valuemin={0} aria-valuemax={100} aria-label="Complétude du profil">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${pourcentage}%` }} />
          </div>
          {manquants.length > 0 && <p className="text-sm text-slate-600">Pour être mieux repéré(e), ajoutez : {manquants.slice(0, 3).join(', ')}.</p>}
          <p className="text-xs text-slate-500">Dernière mise à jour : {date(e.candidat.profilMisAJourLe)}</p>
          <Link href="/candidat/espace/profil" className="flex items-center justify-between min-h-12 px-4 rounded-xl border border-slate-200 font-semibold text-ink-900">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" /> Modifier mon profil
            </span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-3">
          <h2 className="font-semibold text-ink-900">Ma recherche</h2>
          <p className="text-sm text-slate-600">
            {e.enRecherche ? 'Vous êtes visible pour les offres qui correspondent à votre profil.' : 'Vous n’êtes pas proposé(e) pour des offres en ce moment.'}
          </p>
          <BasculeRecherche enRecherche={e.enRecherche} />
          <p className="text-xs text-slate-500">Métiers : {e.candidat.metiers.join(', ') || '—'}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-3">
          <h2 className="font-semibold text-ink-900 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Mes documents
          </h2>
          <Documents documents={e.documents.map((d) => ({ id: d.id, categorie: d.categorie, nom: d.nomOrigine, taille: d.taille }))} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-2">
          <h2 className="font-semibold text-ink-900">Propositions et candidatures</h2>
          <p className="text-sm text-slate-600">
            Quand un conseiller souhaite présenter votre profil à un employeur, la proposition apparaît ici : vous acceptez ou refusez d’être présenté(e). Rien n’est transmis sans votre accord.
          </p>
          <p className="text-sm text-slate-500">Aucune proposition pour le moment.</p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <BoutonDeconnexion />
          <Link href="/candidat/espace/supprimer" className="text-center text-sm text-slate-500 underline">
            Supprimer mon compte et mes données
          </Link>
        </div>
      </div>
    </Coque>
  );
}
