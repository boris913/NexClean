// MVP2-04 : onglet « Devis » d'un dossier de recrutement — devis courant (lignes, totaux, mention TVA,
// acompte, délai, garantie, validité, conditions), édition du brouillon, « Valider et envoyer »,
// réponse du client, avenants et historique des versions (PDF archivés).
import type { Statut } from '@/lib/dossiers/statuts';
import { formatHorodatage } from '@/lib/audit-lecture';
import { estModifiable, formaterMontant, MESSAGE_A_COMPLETER, MODES_ACCEPTATION, mentionTva, STATUTS_DEVIS, TYPES_DEVIS, type StatutDevis } from '@/lib/devis/domaine';
import { libelleDevis, lienPreuveAcceptation, lireDevisDossier, type ActeurDevis, type MessageEnvoi, type VueDevisDossier } from '@/lib/devis/service';
import { FileText } from 'lucide-react';
import { Alerte, Carte, EtatVide, Pastille } from '@/components/backoffice/ui';
import * as D from './Devis';

type Devis = VueDevisDossier['devis'][number];

const TON_DEVIS: Record<StatutDevis, 'neutre' | 'vert' | 'rouge' | 'orange' | 'bleu'> = {
  brouillon: 'neutre',
  attente_direction: 'orange',
  valide: 'bleu',
  envoye: 'bleu',
  accepte: 'vert',
  refuse: 'rouge',
  expire: 'rouge',
  remplace: 'neutre',
};

const dateCourte = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'medium' }).format(d);
const classeGrille = 'text-sm grid grid-cols-[9rem,1fr] gap-x-4 gap-y-2.5 [&>dt]:text-ink-500 [&>dd]:min-w-0 [&>dd]:text-ink-900';

/** Détail figé d'un devis ou d'un avenant. */
function DetailDevis({ dossierId, d }: { dossierId: number; d: Devis }) {
  const avenant = d.type === 'avenant';
  return (
    <div className="space-y-4">
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-500 border-b border-ink-100">
              <th className="px-1 py-2 font-medium">Poste</th>
              <th className="px-1 py-2 font-medium text-right">{avenant ? 'Écart' : 'Personnes'}</th>
              <th className="px-1 py-2 font-medium text-right">Commission HT</th>
              <th className="px-1 py-2 font-medium text-right">Montant HT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {d.lignes.map((l, i) => (
              <tr key={`${l.lignePosteId ?? l.intitule}-${i}`}>
                <td className="px-1 py-2 text-ink-800">{l.intitule}</td>
                <td className="px-1 py-2 text-right tabular-nums">{avenant && l.nombre > 0 ? `+${l.nombre}` : l.nombre}</td>
                <td className="px-1 py-2 text-right tabular-nums whitespace-nowrap">{formaterMontant(l.commission)}</td>
                <td className="px-1 py-2 text-right tabular-nums whitespace-nowrap">{formaterMontant(l.montantHt)}</td>
              </tr>
            ))}
            {d.lignes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-1 py-2 text-ink-500">Aucun changement de personnes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <dl className={classeGrille}>
        {d.tauxTva > 0 ? (
          <>
            <dt>Total HT</dt>
            <dd className="tabular-nums">{formaterMontant(d.totalHt)}</dd>
            <dt>{mentionTva(d.tauxTva)}</dt>
            <dd className="tabular-nums">{formaterMontant(d.montantTva)}</dd>
            <dt>Total TTC</dt>
            <dd className="tabular-nums font-semibold">{formaterMontant(d.totalTtc)}</dd>
          </>
        ) : (
          <>
            <dt>Total</dt>
            <dd className="tabular-nums">
              <span className="font-semibold">{formaterMontant(d.totalTtc)}</span> <span className="text-ink-500">· {mentionTva(d.tauxTva)}</span>
            </dd>
          </>
        )}
        {!avenant && (
          <>
            <dt>Acompte</dt>
            <dd className="tabular-nums">
              {formaterMontant(d.acompte)} ({d.tauxAcompte} %){d.justificationTaux && <span className="block text-xs text-ink-500">Justification : {d.justificationTaux}</span>}
            </dd>
          </>
        )}
        {!avenant && d.deductionCredit > 0 && (
          <>
            <dt>Crédit client</dt>
            <dd className="tabular-nums">
              − {formaterMontant(d.deductionCredit)} <span className="text-ink-500">· déduction imputée à l’acceptation</span>
            </dd>
          </>
        )}
        <dt>Délai de recherche</dt>
        <dd>
          {d.delaiRechercheJours} jours{avenant && d.prolongationJours ? <strong> + {d.prolongationJours} jours (prolongation)</strong> : null}
        </dd>
        <dt>Garantie</dt>
        <dd>{d.garantieJours} jours de remplacement</dd>
        <dt>Validité</dt>
        <dd>{d.expireLe ? `jusqu’au ${dateCourte(d.expireLe)}` : `${d.validiteJours} jours à compter de l’envoi`}</dd>
        {d.valideLe && (
          <>
            <dt>Validé</dt>
            <dd>
              {formatHorodatage(d.valideLe)}
              {d.valideDirectionLe ? ' · par la Direction' : ''}
            </dd>
          </>
        )}
        {d.envoyeLe && (
          <>
            <dt>Envoyé</dt>
            <dd>{formatHorodatage(d.envoyeLe)}</dd>
          </>
        )}
        {d.accepteLe && (
          <>
            <dt>Accepté</dt>
            <dd>
              {formatHorodatage(d.accepteLe)} · {d.acceptationMode ? MODES_ACCEPTATION[d.acceptationMode] : ''}
              <span className="block text-xs text-ink-500">
                {d.signataireNom}, {d.signataireFonction}
                {d.acceptationIp ? ` · IP ${d.acceptationIp}` : ''}
              </span>
              {d.acceptationPreuveCle && (
                <a href={lienPreuveAcceptation(dossierId, d.id)} target="_blank" rel="noopener" className="text-primary text-sm">
                  Voir la capture
                </a>
              )}
            </dd>
          </>
        )}
        {d.refusLe && (
          <>
            <dt>Refusé</dt>
            <dd>
              {formatHorodatage(d.refusLe)}
              {d.refusMotif ? ` · ${d.refusMotif}` : ''}
            </dd>
          </>
        )}
        {d.documentId && (
          <>
            <dt>PDF</dt>
            <dd>
              <a href={`/admin/documents/${d.documentId}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-primary font-medium">
                <FileText aria-hidden className="h-4 w-4" /> PDF archivé
              </a>
              {d.pdfEmpreinte && <span className="block text-xs text-ink-500 font-mono break-all">SHA-256 {d.pdfEmpreinte.slice(0, 16)}…</span>}
            </dd>
          </>
        )}
      </dl>
      {d.conditionsParticulieres && (
        <div>
          <h3 className="text-sm font-medium text-ink-700 mb-1">Conditions particulières</h3>
          <p className="text-sm whitespace-pre-wrap bg-ink-50 border border-ink-100 rounded-lg p-3 text-ink-800">{d.conditionsParticulieres}</p>
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-sm text-primary py-1">Conditions générales et mentions légales</summary>
        <p className="mt-1 text-xs whitespace-pre-wrap bg-ink-50 border border-ink-100 rounded-lg p-3 text-ink-700">{d.conditions}</p>
        <p className="mt-2 text-xs text-ink-500">{d.mentionsLegales}</p>
      </details>
    </div>
  );
}

/** Carte d'un devis ou d'un avenant avec ses actions selon son statut. */
function CarteDevis({ dossierId, d, vue, traiter, direction, statutDossier, derniere, message }: { dossierId: number; d: Devis; vue: VueDevisDossier; traiter: boolean; direction: boolean; statutDossier: Statut; derniere: boolean; message?: MessageEnvoi }) {
  const avenant = d.type === 'avenant';
  const actif = traiter && derniere && d.statut !== 'accepte' && d.statut !== 'remplace';
  const contrat = Object.fromEntries(vue.contrat.filter((c) => c.lignePosteId !== null).map((c) => [c.lignePosteId!, c.nombre]));
  // Nouvelle version d'un devis refusé : le Dossier doit d'abord être rouvert « En qualification ».
  const versionnable = (['valide', 'envoye', 'expire'] as StatutDevis[]).includes(d.statut) || (d.statut === 'refuse' && (avenant || statutDossier !== 'refuse'));
  return (
    <Carte titre={`${libelleDevis(d)}`} description={avenant ? 'Avenant au devis accepté' : `Créé le ${dateCourte(d.creeLe)}`} actions={<Pastille ton={TON_DEVIS[d.statut]} point>{STATUTS_DEVIS[d.statut]}</Pastille>}>
      <DetailDevis dossierId={dossierId} d={d} />
      {actif && (
        <div className="mt-4 pt-3 border-t border-ink-100 space-y-3">
          {d.statut === 'attente_direction' && (
            <Alerte type="info">
              Acompte de {d.tauxAcompte} % hors bornes ({vue.bornes.min} %–{vue.bornes.max} %) : {direction ? 'votre validation est requise.' : 'la Direction doit valider ce devis (ou ramenez le taux dans les bornes).'}
            </Alerte>
          )}
          {d.statut === 'refuse' && !avenant && statutDossier === 'refuse' && <Alerte type="info">Pour proposer une nouvelle version, rouvrez d’abord le dossier « En qualification » (onglet Résumé).</Alerte>}
          {estModifiable(d.statut) && (
            <D.EditerDevis
              dossierId={dossierId}
              devisId={d.id}
              avenant={avenant}
              lignes={d.lignes}
              tauxTva={d.tauxTva}
              tauxAcompte={d.tauxAcompte}
              justificationTaux={d.justificationTaux}
              delaiRechercheJours={d.delaiRechercheJours}
              prolongationJours={d.prolongationJours}
              conditionsParticulieres={d.conditionsParticulieres}
              tauxAcompteDefaut={vue.tauxAcompteDefaut}
              bornes={vue.bornes}
              contrat={contrat}
              deductionCredit={d.deductionCredit}
              creditClient={vue.creditClient}
            />
          )}
          {d.statut === 'envoye' && message && <D.OuvrirWhatsApp dossierId={dossierId} devisId={d.id} numero={message.numero} texte={message.texte} />}
          {d.statut === 'envoye' && <D.ReponseClient dossierId={dossierId} devisId={d.id} />}
          <D.BoutonsDevis
            dossierId={dossierId}
            devisId={d.id}
            valider={d.statut === 'brouillon'}
            validerDirection={d.statut === 'attente_direction' && direction}
            envoyer={d.statut === 'valide'}
            versionner={versionnable}
          />
        </div>
      )}
    </Carte>
  );
}

export default async function SectionDevis({ dossierId, demandeur, traiter, statutDossier }: { dossierId: number; demandeur: ActeurDevis; traiter: boolean; statutDossier: Statut }) {
  const vue = await lireDevisDossier(dossierId, demandeur);
  if (!vue) return null;
  const direction = demandeur.roles.includes('direction');
  /** Dernière version de chaque numéro (les précédentes sont dans l'historique). */
  const derniereVersion = (d: Devis) => !vue.devis.some((x) => x.numero === d.numero && x.version > d.version);
  const courant = vue.courant;
  // Après acceptation, le devis accepté reste affiché (base des avenants), même si une autre chaîne a suivi.
  const principal = vue.accepte ?? courant;
  const avenantsAffiches = vue.avenants.filter(derniereVersion);
  const postesAvenant = vue.postes.map((p) => {
    const c = vue.contrat.find((x) => x.lignePosteId === p.id);
    return { id: p.id, intitule: p.intitule, contrat: c?.nombre ?? 0, commission: c?.commission ?? null };
  });

  return (
    <div id="devis" className="space-y-4 scroll-mt-4">
      {statutDossier === 'a_completer' && <Alerte type="info">{MESSAGE_A_COMPLETER}</Alerte>}
      {!principal && (
        <Carte titre="Devis">
          {vue.manques.length > 0 && (
            <div className="mb-4">
              <Alerte>
                Impossible de créer le devis, il manque : <strong>{vue.manques.join(', ')}</strong>. Complétez le dossier (onglets Résumé et Postes){statutDossier === 'en_qualification' ? ', ou passez-le « À compléter » pour obtenir ces informations du client.' : '.'}
              </Alerte>
              {traiter && statutDossier === 'en_qualification' && <D.PasserACompleter dossierId={dossierId} manques={vue.manques} />}
            </div>
          )}
          <EtatVide
            icone={FileText}
            titre="Aucun devis."
            description={
              vue.peutCreer
                ? 'Le devis est pré-rempli à partir des postes du dossier et de la grille tarifaire en vigueur.'
                : statutDossier === 'en_qualification' || statutDossier === 'a_completer'
                  ? 'Le devis pourra être créé une fois le dossier complet.'
                  : 'Le devis se crée quand le dossier est « En qualification ».'
            }
            action={vue.peutCreer ? <D.CreerDevis dossierId={dossierId} /> : undefined}
          />
        </Carte>
      )}

      {principal && (
        <CarteDevis dossierId={dossierId} d={principal} vue={vue} traiter={traiter} direction={direction} statutDossier={statutDossier} derniere={derniereVersion(principal)} message={vue.messages[principal.id]} />
      )}
      {principal && !vue.accepte && vue.peutCreer && (
        <Carte titre="Nouveau devis">
          <p className="text-sm text-ink-600 mb-3">Le dernier devis est terminé. Vous pouvez en créer une nouvelle version depuis sa carte, ou un nouveau devis (nouveau numéro).</p>
          <D.CreerDevis dossierId={dossierId} />
        </Carte>
      )}

      {vue.accepte && (
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold text-ink-900">Avenants</h2>
          {avenantsAffiches.length === 0 && !vue.peutCreerAvenant && <p className="text-sm text-ink-500">Aucun avenant.</p>}
          {avenantsAffiches.map((a) => (
            <CarteDevis key={a.id} dossierId={dossierId} d={a} vue={vue} traiter={traiter} direction={direction} statutDossier={statutDossier} derniere message={vue.messages[a.id]} />
          ))}
          {vue.peutCreerAvenant && (
            <Carte titre="Modifier le contrat" description={`Contrat actuel : ${vue.contrat.map((c) => `${c.nombre} × ${c.intitule}`).join(', ')}`}>
              <D.CreerAvenant dossierId={dossierId} devisId={vue.accepte.id} postes={postesAvenant} />
            </Carte>
          )}
        </section>
      )}

      {vue.devis.length > 0 && (
        <Carte titre="Historique des versions">
          <ul className="-my-2 divide-y divide-ink-100">
            {vue.devis.map((d) => (
              <li key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">
                    {TYPES_DEVIS[d.type]} {d.numero} · v{d.version}
                  </p>
                  <p className="text-xs text-ink-500">
                    {formaterMontant(d.totalTtc)} · créé le {dateCourte(d.creeLe)}
                    {d.envoyeLe ? ` · envoyé le ${dateCourte(d.envoyeLe)}` : ''}
                    {d.accepteLe ? ` · accepté le ${dateCourte(d.accepteLe)}` : ''}
                    {d.refusLe ? ` · refusé le ${dateCourte(d.refusLe)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {d.documentId && (
                    <a href={`/admin/documents/${d.documentId}`} target="_blank" rel="noopener" className="text-sm text-primary font-medium">
                      PDF
                    </a>
                  )}
                  <Pastille ton={TON_DEVIS[d.statut]}>{STATUTS_DEVIS[d.statut]}</Pastille>
                </div>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </div>
  );
}
