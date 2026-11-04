// MVP2-05 RG-14 : onglet « Finances » d'un dossier de recrutement (référent du Dossier, Responsable
// finances, Direction) — résumé (devis, acompte, montant final, reste à payer / trop-perçu, échéance
// de la recherche, crédit client), devis et avenants, factures et avoirs, Encaissements (reçus,
// annulations, justificatifs internes), enregistrement d'un paiement, puis régularisation (lot B).
import Link from 'next/link';
import type { Demandeur } from '@/lib/dossiers/acces';
import { estFinal, type Statut } from '@/lib/dossiers/statuts';
import { formatHorodatage } from '@/lib/audit-lecture';
import { formaterMontant, STATUTS_DEVIS, TYPES_FACTURE, type StatutDevis, type TypeFacture } from '@/lib/devis/domaine';
import { lienDevisDossier } from '@/lib/devis/effets';
import { listerFactures } from '@/lib/devis/facturation';
import { MOYENS_PAIEMENT, NATURES_ENCAISSEMENT, TYPES_ECRITURE } from '@/lib/encaissements/domaine';
import { situationFinanciere } from '@/lib/encaissements/lecture';
import { lireEncaissementsDossier, listerDevisFinances, peutAnnulerEncaissement, peutEnregistrerEncaissement } from '@/lib/encaissements/service';
import { etatRecherche } from '@/lib/propositions/service';
import { Banknote } from 'lucide-react';
import { Alerte, Carte, EtatVide, Pastille } from '@/components/backoffice/ui';
import BlocRegularisation from './finances/BlocRegularisation';
import * as E from './finances/Encaissements';

const dateCourte = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'medium' }).format(d);
const jourCourt = (j: string) => dateCourte(new Date(`${j}T12:00:00+01:00`));
const classeGrille = 'text-sm grid grid-cols-[10rem,1fr] gap-x-4 gap-y-2.5 [&>dt]:text-ink-500 [&>dd]:min-w-0 [&>dd]:text-ink-900 [&>dd]:tabular-nums';
const TON_DEVIS: Partial<Record<StatutDevis, 'vert' | 'bleu' | 'rouge' | 'orange'>> = { accepte: 'vert', envoye: 'bleu', refuse: 'rouge', expire: 'rouge', attente_direction: 'orange' };
const TON_FACTURE: Record<TypeFacture, 'vert' | 'bleu' | 'orange'> = { acompte: 'bleu', solde: 'vert', avoir: 'orange' };

export default async function SectionFinances({ dossierId, demandeur, traiter, referentId, statutDossier }: { dossierId: number; demandeur: Demandeur; traiter: boolean; referentId: string | null; statutDossier: Statut }) {
  const [situation, ecritures, factures, devis, recherche] = await Promise.all([
    situationFinanciere(dossierId),
    lireEncaissementsDossier(dossierId, demandeur),
    listerFactures(dossierId, demandeur),
    listerDevisFinances(dossierId, demandeur),
    etatRecherche(dossierId, demandeur),
  ]);
  if (!situation) return null;
  const s = situation;
  const enregistrer = peutEnregistrerEncaissement(demandeur, referentId) && !estFinal(statutDossier) && !!s.devis;
  const annuler = peutAnnulerEncaissement(demandeur);
  const demander = peutEnregistrerEncaissement(demandeur, referentId);
  const acompte = s.etatAcompte;
  const resteAcompte = acompte.etat === 'non_paye' || acompte.etat === 'partiel';

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
      <div className="space-y-4 lg:col-span-2">
        {s.devis && s.devis.statut !== 'accepte' && s.ecritures.length > 0 && (
          <Alerte type="info">
            Paiement rattaché au devis envoyé {s.devis.numero} v{s.devis.version} : enregistrez l’acceptation du devis (onglet <Link href={lienDevisDossier(dossierId)} className="font-medium underline">Devis</Link>) pour que le dossier avance.
          </Alerte>
        )}

        <Carte titre="Encaissements" description="Un encaissement ne se modifie jamais : une erreur se corrige par une annulation (écriture inverse).">
          {ecritures.length === 0 ? (
            <EtatVide icone={Banknote} titre="Aucun paiement enregistré." description={enregistrer ? 'Enregistrez le premier paiement avec le formulaire ci-dessous.' : undefined} />
          ) : (
            <ul className="-my-2 divide-y divide-ink-100">
              {ecritures.map((e) => (
                <li key={e.id} id={`encaissement-${e.id}`} className="py-3 scroll-mt-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between target:bg-amber-50">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={`font-semibold tabular-nums ${e.montant < 0 ? 'text-red-700' : 'text-ink-900'} ${e.annule ? 'line-through decoration-ink-400' : ''}`}>{formaterMontant(e.montant)}</span>
                      <Pastille ton={e.type === 'encaissement' ? 'bleu' : e.type === 'annulation' ? 'rouge' : 'neutre'}>{e.type === 'encaissement' ? NATURES_ENCAISSEMENT[e.nature] : `${TYPES_ECRITURE[e.type]} · ${NATURES_ENCAISSEMENT[e.nature]}`}</Pastille>
                      {e.annule && <Pastille ton="rouge">Annulé</Pastille>}
                      {e.demandeEnCours && <Pastille ton="orange">Annulation demandée</Pastille>}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      {jourCourt(e.recuLe)} · {MOYENS_PAIEMENT[e.moyen]}
                      {e.reference && <> · réf. <span className="font-mono">{e.reference}</span></>}
                      {e.auteurNom && <> · {e.auteurNom}</>}
                    </p>
                    {e.recuNumero && (
                      <p className="text-xs mt-0.5">
                        Reçu{' '}
                        {e.recuDocumentId ? (
                          <a href={`/admin/documents/${e.recuDocumentId}`} target="_blank" rel="noopener" className="text-primary font-medium tabular-nums">{e.recuNumero}</a>
                        ) : (
                          <span className="tabular-nums text-ink-700">{e.recuNumero} <span className="text-ink-500">(PDF en attente)</span></span>
                        )}
                        {e.annule && <span className="text-red-700"> — annulé</span>}
                      </p>
                    )}
                    {e.justificatifDocumentId && (
                      <p className="text-xs mt-0.5">
                        <a href={`/admin/documents/${e.justificatifDocumentId}`} target="_blank" rel="noopener" className="text-primary">Justificatif</a> <span className="text-ink-500">(interne)</span>
                      </p>
                    )}
                    {e.commentaire && <p className="text-xs text-ink-600 mt-0.5 whitespace-pre-wrap break-words">{e.commentaire}</p>}
                    {e.motif && <p className="text-xs text-ink-600 mt-0.5 break-words">Motif : {e.motif}</p>}
                    {e.demandeEnCours && (
                      <p className="text-xs text-amber-800 mt-1 break-words">
                        Annulation demandée{e.demandeEnCours.demandeParNom ? ` par ${e.demandeEnCours.demandeParNom}` : ''} le {formatHorodatage(e.demandeEnCours.demandeLe)} : {e.demandeEnCours.motif}
                      </p>
                    )}
                  </div>
                  {e.type === 'encaissement' && !e.annule && (
                    <div className="flex shrink-0 flex-col gap-2 sm:w-64">
                      {e.demandeEnCours && annuler ? (
                        <E.TraiterDemande dossierId={dossierId} demandeId={e.demandeEnCours.id} recu={e.recuNumero ?? `n° ${e.id}`} />
                      ) : annuler ? (
                        <E.AnnulerEncaissement dossierId={dossierId} encaissementId={e.id} recu={e.recuNumero ?? `n° ${e.id}`} />
                      ) : demander && !e.demandeEnCours ? (
                        <E.DemanderAnnulation dossierId={dossierId} encaissementId={e.id} />
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Carte>

        {enregistrer && (
          <E.EnregistrerPaiement
            dossierId={dossierId}
            natureParDefaut={resteAcompte ? 'acompte' : s.montantFinalTtc !== null ? 'solde' : 'autre'}
            aide={resteAcompte ? `Acompte restant dû : ${formaterMontant(acompte.du - (acompte.etat === 'partiel' ? acompte.encaisse : 0))}. Un acompte plus élevé est plafonné ; l’excédent est enregistré en « Autre ».` : null}
          />
        )}
        {!s.devis && <Alerte type="info">Aucun devis envoyé ou accepté : les paiements s’enregistrent une fois le devis envoyé (onglet <Link href={lienDevisDossier(dossierId)} className="font-medium underline">Devis</Link>).</Alerte>}

        <BlocRegularisation dossierId={dossierId} demandeur={demandeur} traiter={traiter} situation={s} />
      </div>

      <div className="space-y-4">
        <Carte titre="Résumé financier">
          <dl className={classeGrille}>
            <dt>Montant du devis</dt>
            <dd>{s.devis ? formaterMontant(s.devis.totalTtc) : '—'}</dd>
            {s.devis && s.devis.deductionCredit > 0 && (
              <>
                <dt>Crédit déduit</dt>
                <dd>{formaterMontant(s.devis.deductionCredit)}</dd>
              </>
            )}
            <dt>Acompte</dt>
            <dd>
              {acompte.etat === 'aucun_devis' ? '—' : acompte.etat === 'complet' ? (
                <>{formaterMontant(acompte.encaisse)} / {formaterMontant(acompte.du)} <Pastille ton="vert">Reçu</Pastille></>
              ) : acompte.etat === 'partiel' ? (
                <span className="text-amber-800">{acompte.libelle}</span>
              ) : (
                <>0 / {formaterMontant(acompte.du)}</>
              )}
            </dd>
            <dt>Encaissé (net)</dt>
            <dd>{formaterMontant(s.nets)}</dd>
            <dt>Montant final</dt>
            <dd>{s.montantFinalTtc !== null ? formaterMontant(s.montantFinalTtc) : <span className="text-ink-500">à la clôture de la recherche</span>}</dd>
            {s.tropPercu > 0 ? (
              <>
                <dt>Trop-perçu</dt>
                <dd className="font-semibold text-amber-800">{formaterMontant(s.tropPercu)}</dd>
              </>
            ) : (
              <>
                <dt>Reste à payer{s.montantFinalTtc === null ? ' (sur devis)' : ''}</dt>
                <dd className="font-semibold">{formaterMontant(s.resteAPayer)}</dd>
              </>
            )}
            {recherche?.echeance && !recherche.clotureLe && (
              <>
                <dt>Échéance recherche</dt>
                <dd>{formatHorodatage(recherche.echeance)}{recherche.echue ? ' (échue)' : ''}</dd>
              </>
            )}
            {s.creditClient > 0 && (
              <>
                <dt>Crédit client disponible</dt>
                <dd>{formaterMontant(s.creditClient)}</dd>
              </>
            )}
          </dl>
        </Carte>

        <Carte titre="Devis et avenants" actions={<Link href={lienDevisDossier(dossierId)} className="text-sm font-medium text-primary py-2">Devis →</Link>}>
          {devis.length === 0 ? (
            <p className="text-sm text-ink-500">Aucun devis.</p>
          ) : (
            <ul className="-my-1 divide-y divide-ink-100 text-sm">
              {devis.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 text-ink-800">{d.type === 'avenant' ? 'Avenant' : 'Devis'} {d.numero} v{d.version}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-ink-700">{formaterMontant(d.totalTtc)}</span>
                    <Pastille ton={TON_DEVIS[d.statut] ?? 'neutre'}>{STATUTS_DEVIS[d.statut]}</Pastille>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Factures et avoirs" actions={<Link href={`/admin/dossiers/${dossierId}?onglet=documents`} className="text-sm font-medium text-primary py-2">Documents →</Link>}>
          {factures.length === 0 ? (
            <p className="text-sm text-ink-500">Aucune facture émise.</p>
          ) : (
            <ul className="-my-1 divide-y divide-ink-100 text-sm">
              {factures.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    {f.documentId ? (
                      <a href={`/admin/documents/${f.documentId}`} target="_blank" rel="noopener" className="text-primary font-medium tabular-nums">{f.numero}</a>
                    ) : (
                      <span className="font-medium tabular-nums">{f.numero}</span>
                    )}{' '}
                    <span className="text-xs text-ink-500">{dateCourte(f.emiseLe)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-ink-700">{formaterMontant(f.totalTtc)}</span>
                    <Pastille ton={TON_FACTURE[f.type]}>{TYPES_FACTURE[f.type]}</Pastille>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </div>
  );
}
