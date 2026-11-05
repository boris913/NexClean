// MVP2-01 RG-09..14 : tableau de bord du candidat. N'affiche jamais : notes internes, statut
// interne détaillé, autres candidats, budgets des clients (le salaire d'un poste seulement si le
// client l'a autorisé), retours des clients sur les profils.
import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, FileText, User } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cardClasses } from '@/components/ui/Card';
import { lireEspace } from '@/lib/candidats/service';
import { lireCandidaturesCandidat } from '@/lib/candidats/candidatures';
import { STATUTS_CANDIDATURE_CANDIDAT } from '@/lib/candidats/formulaire-candidature';
import { exigerCandidat } from '@/lib/candidats/session';
import { listerNotificationsCandidat, listerPropositionsCandidat, type PropositionCandidat } from '@/lib/propositions/candidat';
import { FUSEAU } from '@/lib/domain/referentiels';
import Coque from '../Coque';
import { BasculeRecherche, BoutonDeconnexion, Documents } from './Elements';
import { CarteProposition, Notifications, type PropositionAffichee } from './Propositions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mon espace candidat', robots: { index: false, follow: false } };

const date = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' }).format(d);
const dateJour = (iso: string) => date(new Date(`${iso}T12:00:00Z`));

/** Champs RG-13 de la carte (le salaire n'arrive ici que s'il est communicable). */
function versAffichage(p: PropositionCandidat): PropositionAffichee {
  const lieu = [p.quartier, p.ville].filter(Boolean).join(', ');
  const contrat = [p.typeContrat, p.duree].filter(Boolean).join(' — ');
  const details = [
    { libelle: 'Secteur', valeur: p.secteur },
    { libelle: 'Lieu', valeur: lieu },
    { libelle: 'Contrat', valeur: contrat },
    { libelle: 'Horaires', valeur: p.horaires },
    { libelle: 'Salaire', valeur: p.salaire },
  ].filter((d): d is { libelle: string; valeur: string } => !!d.valeur);
  return { id: p.id, poste: p.poste, client: p.client, details, recueLe: date(p.creeLe) };
}

const TONS: Partial<Record<PropositionCandidat['statut'], string>> = {
  proposee: 'bg-info-soft text-info',
  entretien: 'bg-warning-soft text-warning',
  retenue: 'bg-success-soft text-success',
  placee: 'bg-success-soft text-success',
};

const carte = cardClasses({ padding: 'sm', className: 'space-y-3' });
const titreCarte = 'font-display text-h3 text-ink-900';

export default async function PageEspace() {
  const session = await exigerCandidat();
  const [e, { profilIncomplet, candidatures }, propositions, notifications] = await Promise.all([
    lireEspace(session.id),
    lireCandidaturesCandidat(session.id),
    listerPropositionsCandidat(session.id),
    listerNotificationsCandidat(session.id),
  ]);
  const { pourcentage, manquants } = e.completude;

  return (
    <Coque titre={`Bonjour ${e.candidat.prenom}`} large>
      <div className="space-y-4">
        <Notifications notifications={notifications.map((n) => ({ id: n.id, titre: n.titre, texte: n.texte, le: date(n.creeLe), lu: !!n.luLe }))} />
        {profilIncomplet && (
          <div role="status" className="flex gap-3 rounded-2xl border border-warning-border bg-warning-soft p-4 text-sm text-ink-800">
            <AlertTriangle className="w-5 h-5 shrink-0 text-warning" aria-hidden="true" />
            <p>
              <strong>Profil incomplet.</strong> Votre candidature est bien enregistrée. Complétez votre profil (zones de travail, types de contrat, niveau d’études) pour être proposé(e) à d’autres offres :{' '}
              <Link href="/candidat/espace/profil" className="underline font-semibold">
                compléter mon profil
              </Link>
              .
            </p>
          </div>
        )}
        {e.rappelMiseAJour && (
          <div role="status" className="flex gap-3 rounded-2xl border border-warning-border bg-warning-soft p-4 text-sm text-ink-800">
            <AlertTriangle className="w-5 h-5 shrink-0 text-warning" aria-hidden="true" />
            <p>
              Votre profil n’a pas été mis à jour depuis plus de 6 mois. Vérifiez qu’il est toujours exact :{' '}
              <Link href="/candidat/espace/profil" className="underline font-semibold">
                mettre à jour mon profil
              </Link>
              .
            </p>
          </div>
        )}

        <div className={carte}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={titreCarte}>Mon profil</h2>
            <span className="text-sm font-semibold text-primary">{pourcentage} %</span>
          </div>
          <div className="h-2 rounded-full bg-ink-100" role="progressbar" aria-valuenow={pourcentage} aria-valuemin={0} aria-valuemax={100} aria-label="Complétude du profil">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${pourcentage}%` }} />
          </div>
          {manquants.length > 0 && <p className="text-sm text-ink-600">Pour être mieux repéré(e), ajoutez : {manquants.slice(0, 3).join(', ')}.</p>}
          <p className="text-xs text-muted">Dernière mise à jour : {date(e.candidat.profilMisAJourLe)}</p>
          <Button href="/candidat/espace/profil" variant="outline" icon={User} fullWidth>
            Modifier mon profil
          </Button>
        </div>

        <div className={carte}>
          <h2 className={titreCarte}>Ma recherche</h2>
          <p className="text-sm text-ink-600">
            {e.enRecherche
              ? 'Vous êtes visible pour les offres qui correspondent à votre profil.'
              : e.place
                ? 'Vous êtes en poste : vous n’êtes plus proposé(e) pour d’autres offres. Si vous cherchez de nouveau un emploi, signalez-le ici.'
                : 'Vous n’êtes pas proposé(e) pour des offres en ce moment.'}
          </p>
          <BasculeRecherche enRecherche={e.enRecherche} />
          <p className="text-xs text-muted">Métiers : {e.candidat.metiers.join(', ') || '—'}</p>
        </div>

        <div className={carte}>
          <h2 className={`${titreCarte} flex items-center gap-2`}>
            <FileText className="w-4 h-4" /> Mes documents
          </h2>
          <Documents documents={e.documents.map((d) => ({ id: d.id, categorie: d.categorie, nom: d.nomOrigine, taille: d.taille }))} />
        </div>

        <div className={carte}>
          <h2 className={titreCarte}>Propositions et candidatures</h2>
          <p className="text-sm text-ink-600">
            Quand un conseiller souhaite présenter votre profil à un employeur, la proposition apparaît ici : vous acceptez ou refusez d’être présenté(e). Rien n’est transmis sans votre accord.
          </p>
          {propositions.enAttente.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink-900">
                {propositions.enAttente.length === 1 ? '1 proposition attend votre réponse' : `${propositions.enAttente.length} propositions attendent votre réponse`}
              </h3>
              {propositions.enAttente.map((p) => (
                <CarteProposition key={p.id} p={versAffichage(p)} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Aucune proposition en attente de votre réponse.</p>
          )}
          {propositions.historique.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-ink-900 mb-1">Mes propositions</h3>
              <ul className="divide-y divide-ink-100">
                {propositions.historique.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium text-ink-900">{p.poste}</span>
                      <span className="block text-xs text-ink-600">{p.client}</span>
                      {p.reponseLe && <span className="block text-xs text-muted">Votre réponse le {date(p.reponseLe)}</span>}
                      {p.entretienLieu && <span className="block text-xs text-ink-600">Lieu de l’entretien : {p.entretienLieu}</span>}
                      {p.priseDePosteLe && <span className="block text-xs text-ink-600">Prise de poste le {dateJour(p.priseDePosteLe)}</span>}
                    </span>
                    <span className={`shrink-0 max-w-[50%] text-right rounded-2xl px-2.5 py-1 text-xs font-semibold ${TONS[p.statut] ?? 'bg-ink-100 text-ink-700'}`}>{p.libelleStatut}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h3 className="text-sm font-semibold text-ink-900">Mes candidatures</h3>
          {candidatures.length > 0 ? (
            <ul className="divide-y divide-ink-100">
              {candidatures.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <Link href={`/recrutement/${k.offreSlug}`} className="font-medium text-ink-900 underline">
                      {k.offreTitre}
                    </Link>
                    <span className="block text-xs text-muted">Envoyée le {date(k.creeLe)}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700">{STATUTS_CANDIDATURE_CANDIDAT[k.statut]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Aucune candidature.{' '}
              <Link href="/recrutement" className="text-primary underline">
                Voir les offres
              </Link>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <BoutonDeconnexion />
          <Link href="/candidat/espace/supprimer" className="text-center text-sm text-muted underline">
            Supprimer mon compte et mes données
          </Link>
        </div>
      </div>
    </Coque>
  );
}
