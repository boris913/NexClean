// MVP2-03 : onglet « Propositions » d'un dossier de recrutement — par ligne de poste, décompte
// « X placés / Y demandés », propositions, placements, liens temporaires et clôture de la recherche.
import Link from 'next/link';
import type { Demandeur } from '@/lib/dossiers/acces';
import { formatHorodatage } from '@/lib/audit-lecture';
import { MODES_ACCORD, MODES_CONFIRMATION, STATUTS_PROPOSITION, estTransmise, transitionsReferent, type StatutProposition } from '@/lib/propositions/domaine';
import { formaterDateHeure, formaterJour, lienAttestation, lienPreuveAccord, lienPreuvePlacement, lirePropositionsDossier, listerModelesProposition, type VueProposition } from '@/lib/propositions/service';
import { Alerte, Carte, Pastille } from '@/components/backoffice/ui';
import * as P from './Propositions';

const dateCourte = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'medium' }).format(d);
/** datetime-local (heure de Douala) pour préremplir le formulaire d'entretien. */
const versChampDateHeure = (d: Date) => new Date(d.getTime() + 3_600_000).toISOString().slice(0, 16);

const TON_PROPOSITION: Record<StatutProposition, 'neutre' | 'vert' | 'rouge' | 'orange'> = {
  en_attente_accord: 'orange',
  proposee: 'neutre',
  entretien: 'neutre',
  retenue: 'vert',
  placee: 'vert',
  refusee: 'rouge',
  refusee_candidat: 'rouge',
  retiree: 'rouge',
};

export default async function SectionPropositions({ dossierId, demandeur, traiter }: { dossierId: number; demandeur: Demandeur; traiter: boolean }) {
  const vue = await lirePropositionsDossier(dossierId, demandeur);
  if (!vue) return null;
  const { etat } = vue;
  const modeles = traiter ? await listerModelesProposition() : [];
  const rechercheOuverte = etat.enRecherche && !etat.clotureLe;
  const peutProposer = traiter && (rechercheOuverte || vue.remplacementsAPourvoir.length > 0);
  const motifRequis = !etat.tousPourvus && !etat.echue;

  return (
    <div id="propositions" className="space-y-4 scroll-mt-4">
      <Carte titre="Clôture de la recherche">
        <dl className="text-sm grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
          <dt className="text-ink-500">Acompte reçu</dt>
          <dd>{etat.acompteLe ? dateCourte(etat.acompteLe) : '—'}</dd>
          <dt className="text-ink-500">Délai</dt>
          <dd>{etat.delaiJours} jours</dd>
          <dt className="text-ink-500">Échéance</dt>
          <dd>{etat.echeance ? <>{dateCourte(etat.echeance)} {etat.echue && !etat.clotureLe && <Pastille ton="orange">atteinte</Pastille>}</> : '—'}</dd>
          <dt className="text-ink-500">Postes</dt>
          <dd>{etat.tousPourvus ? 'tous pourvus' : `${etat.lignes.reduce((s, l) => s + Math.min(l.places, l.nombre), 0)} / ${etat.lignes.reduce((s, l) => s + l.nombre, 0)} pourvus`}</dd>
          <dt className="text-ink-500">Retenus</dt>
          <dd>{etat.clotureLe ? etat.placementsRetenus : etat.retenus} placement(s) (hors remplacements)</dd>
        </dl>
        {etat.avertissements.map((a) => <div key={a} className="mt-2"><Alerte type="info">{a}</Alerte></div>)}
        {etat.clotureLe ? (
          <p className="text-sm mt-3">
            Recherche clôturée le {formatHorodatage(etat.clotureLe)}{etat.clotureMotif ? ` (${etat.clotureMotif})` : ''} : <strong>{etat.placementsRetenus} placement(s) retenu(s)</strong> pour le montant final.
            {/* Montant final (commission figée × placements retenus) : calculé par MVP2-05. */}
          </p>
        ) : (
          rechercheOuverte && (
            <>
              {etat.annonces.length > 0 && (
                <div className="mt-3">
                  <Alerte>
                    Confirmez ou abandonnez d’abord les placements encore annoncés :
                    <ul className="list-disc pl-5 mt-1">{etat.annonces.map((a) => <li key={a.id}>{a.libelle}</li>)}</ul>
                  </Alerte>
                </div>
              )}
              {traiter && <P.ClotureRecherche dossierId={dossierId} motifRequis={motifRequis} bloquee={etat.annonces.length > 0} />}
            </>
          )
        )}
      </Carte>

      {peutProposer && (
        <Carte titre="Proposer un candidat">
          <P.ProposerCandidat dossierId={dossierId} lignes={rechercheOuverte ? vue.lignes.map((l) => ({ id: l.id, intitule: l.intitule })) : []} remplacements={vue.remplacementsAPourvoir} />
        </Carte>
      )}

      {vue.lignes.map((l) => (
        <Carte key={l.id} titre={l.intitule} actions={<Pastille ton={l.depassement ? 'orange' : l.places >= l.nombre ? 'vert' : 'neutre'}>{l.places} placé{l.places > 1 ? 's' : ''} / {l.nombre} demandé{l.nombre > 1 ? 's' : ''}</Pastille>}>
          {l.propositions.length === 0 ? (
            <p className="text-sm text-ink-600">Aucune proposition.</p>
          ) : (
            <ul className="space-y-3">
              {l.propositions.map((p) => (
                <LignePropositionVue key={p.id} p={p} dossierId={dossierId} traiter={traiter} intitule={l.intitule} modeles={modeles} voirSalaire={vue.voirSalaire} rechercheOuverte={rechercheOuverte} />
              ))}
            </ul>
          )}
        </Carte>
      ))}
    </div>
  );
}

function LignePropositionVue({
  p,
  dossierId,
  traiter,
  intitule,
  modeles,
  voirSalaire,
  rechercheOuverte,
}: {
  p: VueProposition;
  dossierId: number;
  traiter: boolean;
  intitule: string;
  modeles: { nom: string; destinataire: 'candidat' | 'client'; lien: 'profil' | 'attestation' | null }[];
  voirSalaire: boolean;
  rechercheOuverte: boolean;
}) {
  const placementActif = p.placements.some((pl) => pl.statut !== 'abandonne');
  const attestationPossible = p.placements.some((pl) => pl.statut === 'annonce' || pl.statut === 'confirme');
  const ouverte = rechercheOuverte || p.remplacePlacementId !== null;
  const transmise = estTransmise(p.statut) && !p.accesRevoqueLe;
  const modelesDisponibles = modeles.filter((m) =>
    m.destinataire === 'candidat' ? !p.candidatSupprime && (p.statut === 'en_attente_accord' || p.statut === 'entretien') : transmise && (m.lien !== 'attestation' || attestationPossible),
  );
  return (
    <li className="border border-ink-100 rounded-lg p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {p.candidatSupprime ? <span className="font-medium">{p.candidat}</span> : <Link href={`/admin/candidats/${p.candidatId}`} className="font-medium text-primary">{p.candidat}</Link>}
        <Pastille ton={TON_PROPOSITION[p.statut]}>{STATUTS_PROPOSITION[p.statut]}</Pastille>
      </div>
      <ul className="text-xs text-ink-600 mt-1 space-y-0.5">
        <li>Proposé le {formatHorodatage(p.creeLe)}{p.remplacePlacementId ? ' · remplacement (garantie)' : ''}</li>
        {p.accordMode && (
          <li>
            Accord : {MODES_ACCORD[p.accordMode]}{p.accordLe ? ` le ${dateCourte(p.accordLe)}` : ''}
            {p.accordPreuve && traiter && <> · <a href={lienPreuveAccord(dossierId, p.id)} target="_blank" rel="noopener" className="text-primary">voir la capture</a></>}
            {p.numeroCommunicable ? ' · numéro communicable au client' : ''}
          </li>
        )}
        {p.statut === 'en_attente_accord' && p.relanceAccordLe && <li className="text-amber-700">Sans réponse du candidat depuis plus de 72 h.</li>}
        {p.entretienLe || p.entretienLieu ? <li>Entretien : {[p.entretienLe ? formaterDateHeure(p.entretienLe) : null, p.entretienLieu].filter(Boolean).join(', ')}</li> : null}
        {p.motif && <li>Motif : {p.motif}</li>}
        {p.retourClient && (
          <li className="text-ink-800">
            Retour du client : {p.retourClient === 'rencontrer' ? 'souhaite le / la rencontrer' : 'ne correspond pas'}
            {p.retourClientMotif ? ` (${p.retourClientMotif})` : ''}
            {p.retourClientLe ? ` — ${formatHorodatage(p.retourClientLe)}` : ''}
          </li>
        )}
        {p.accesRevoqueLe && <li>Accès du client révoqué le {dateCourte(p.accesRevoqueLe)}</li>}
      </ul>

      {p.placements.length > 0 && (
        <ul className="mt-2 space-y-2">
          {p.placements.map((pl) => (
            <li key={pl.id} className="bg-ink-50 rounded p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">Placement : {pl.poste}{pl.remplacement ? ' (remplacement, sans commission)' : ''}</span>
                <Pastille ton={pl.statut === 'confirme' ? 'vert' : pl.statut === 'annonce' ? 'orange' : pl.statut === 'abandonne' || pl.statut === 'rompu_garantie' ? 'rouge' : 'neutre'}>{pl.libelleStatut}</Pastille>
              </div>
              <p className="text-xs text-ink-600">
                Prévu le {formaterJour(pl.datePrevue)}
                {pl.datePriseDePoste ? ` · pris le ${formaterJour(pl.datePriseDePoste)}` : ''}
                {pl.confirmationMode ? ` · ${MODES_CONFIRMATION[pl.confirmationMode]}` : ''}
                {pl.signataire ? ` (${pl.signataire})` : ''}
                {pl.salaire ? ` · salaire : ${pl.salaire}` : ''}
                {pl.finLe ? ` · fin le ${formaterJour(pl.finLe)}${pl.finMotif ? ` (${pl.finMotif})` : ''}` : ''}
              </p>
              {traiter && (
                <p className="text-xs mt-1 flex flex-wrap gap-x-3">
                  {(pl.statut === 'annonce' || pl.statut === 'confirme') && <a href={lienAttestation(dossierId, pl.id)} target="_blank" rel="noopener" className="text-primary">Attestation (PDF)</a>}
                  {pl.preuve && <a href={lienPreuvePlacement(dossierId, pl.id)} target="_blank" rel="noopener" className="text-primary">Voir la preuve</a>}
                </p>
              )}
              {traiter && <P.ActionsPlacement dossierId={dossierId} placementId={pl.id} statut={pl.statut} />}
            </li>
          ))}
        </ul>
      )}

      {p.liens.length > 0 && (
        <ul className="mt-2 text-xs text-ink-600">
          {p.liens.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <span>Lien {l.objet === 'attestation' ? 'attestation' : 'profil'} créé le {formatHorodatage(l.creeLe)}, expire le {dateCourte(l.expireLe)}</span>
              {traiter && <P.RevoquerLien dossierId={dossierId} accesId={l.id} />}
            </li>
          ))}
        </ul>
      )}

      {traiter && (
        <P.ActionsProposition
          dossierId={dossierId}
          propositionId={p.id}
          statut={p.statut}
          transitions={ouverte ? transitionsReferent(p.statut).map((code) => ({ code, libelle: STATUTS_PROPOSITION[code] })) : []}
          intitule={intitule}
          peutAnnoncer={ouverte && p.statut === 'retenue' && !placementActif}
          peutPlacementDirect={ouverte && transmise && p.statut !== 'placee' && !placementActif}
          peutLien={transmise && p.statut !== 'placee'}
          entretien={p.statut === 'entretien' ? { le: p.entretienLe ? versChampDateHeure(p.entretienLe) : '', lieu: p.entretienLieu ?? '' } : null}
          modeles={modelesDisponibles.map(({ nom, destinataire }) => ({ nom, destinataire }))}
          voirSalaire={voirSalaire}
        />
      )}
    </li>
  );
}
