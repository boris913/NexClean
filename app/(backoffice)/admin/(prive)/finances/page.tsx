// MVP2-05 : vue Responsable finances (permission `finances.tableau_de_bord` : Finances, Direction).
// Vue de pilotage, sans écriture : chaque ligne renvoie vers l'onglet Finances du Dossier, où se
// font les actions (annuler, valider, effectuer). Filtres simples dans l'URL (période, moyen).
import Link from 'next/link';
import { AlertTriangle, Ban, CircleDollarSign, Coins, Hourglass, PiggyBank, Wallet } from 'lucide-react';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { formaterMontant } from '@/lib/devis/domaine';
import { MOYENS_PAIEMENT, MOYENS_SAISIE, NATURES_ENCAISSEMENT, TYPES_ECRITURE } from '@/lib/encaissements/domaine';
import { lienFinancesDossier, normaliserFiltres, vueFinances, type LigneEncaissementFinances } from '@/lib/encaissements/vue-finances';
import { FUSEAU } from '@/lib/domain/referentiels';
import { lireParametre } from '@/lib/parametres';
import { Carte, ChiffreCle, classeBouton, classeChamp, classeLibelle, EtatVide, Pastille, TitrePage } from '@/components/backoffice/ui';

export const metadata = { title: 'Finances' };
export const dynamic = 'force-dynamic';

type Params = Record<string, string | undefined>;

const jour = (j: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'medium' }).format(new Date(`${j}T12:00:00+01:00`));
const date = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'medium' }).format(d);
const classeLigne = 'flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-3 sm:px-4 text-sm hover:bg-ink-50/60 focus-visible:bg-ink-50';
const classeListe = 'overflow-hidden rounded-lg border border-ink-100 divide-y divide-ink-100 -mx-1 sm:mx-0';
/** RG-09 : délai indicatif (jours après émission) au-delà duquel un solde est signalé en rouge. */

function Dossier({ numero, client }: { numero: string; client: string }) {
  return (
    <span className="min-w-0">
      <span className="font-mono text-xs font-semibold text-ink-800">{numero}</span>
      <span className="text-ink-600"> · {client}</span>
    </span>
  );
}

function LigneEncaissement({ e }: { e: LigneEncaissementFinances }) {
  return (
    <li>
      <Link href={lienFinancesDossier(e.dossierId)} className={classeLigne}>
        <span className="min-w-0 space-y-0.5">
          <Dossier numero={e.numeroDossier} client={e.clientNom} />
          <span className="block text-xs text-ink-500">
            {jour(e.recuLe)} · {e.type === 'encaissement' ? NATURES_ENCAISSEMENT[e.nature] : TYPES_ECRITURE[e.type]} · {MOYENS_PAIEMENT[e.moyen]}
            {e.reference ? ` · réf. ${e.reference}` : ''}
            {e.recuNumero ? ` · ${e.recuNumero}` : ''}
            {e.auteurNom ? ` · ${e.auteurNom}` : ''}
          </span>
          {e.moyen === 'autre' && e.commentaire && <span className="block text-xs text-amber-800">« {e.commentaire} »</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {e.annule && <Pastille>Annulé</Pastille>}
          {e.moyen === 'autre' && e.type === 'encaissement' && !e.annule && (
            <Pastille ton="orange" point>
              Moyen « Autre »
            </Pastille>
          )}
          <span className={`tabular-nums font-semibold ${e.annule ? 'line-through text-ink-400' : e.montant < 0 ? 'text-red-700' : 'text-ink-900'}`}>{formaterMontant(e.montant)}</span>
        </span>
      </Link>
    </li>
  );
}

export default async function PageFinances({ searchParams }: { searchParams: Promise<Params> }) {
  const c = await exigerCollaborateur({ permission: 'finances.tableau_de_bord' });
  const p = await searchParams;
  const filtres = normaliserFiltres({ du: p.du, au: p.au, moyen: p.moyen });
  const v = await vueFinances(filtres);
  // MVP2-05 RG-09 : un solde impayé passe en alerte au-delà du délai de relance.
  const DELAI_IMPAYE_JOURS = await lireParametre('delai_relance_solde_jours');
  const direction = peut(c.roles, 'remboursement.valider');
  const totalImpayes = v.impayes.reduce((t, l) => t + l.resteAPayer, 0);

  return (
    <>
      <TitrePage titre="Finances" description="Encaissements, annulations, remboursements, soldes impayés et crédits clients. Les actions se font dans l’onglet Finances de chaque dossier." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ChiffreCle valeur={v.impayes.length} libelle="Soldes impayés" href="#impayes" alerte icone={Hourglass} />
        <ChiffreCle valeur={v.remboursementsAValider.length + v.remboursementsAEffectuer.length} libelle="Remboursements en attente" href="#remboursements" alerte icone={Coins} />
        <ChiffreCle valeur={v.demandesAnnulation.length} libelle="Demandes d’annulation" href="#annulations" alerte icone={Ban} />
        <ChiffreCle valeur={v.moyenAutre.length} libelle="Paiements « Autre » à vérifier" href="#moyen-autre" alerte icone={AlertTriangle} />
      </div>

      <div className="space-y-5">
        <div id="impayes" className="scroll-mt-20">
          <Carte titre="Soldes impayés" description={v.impayes.length ? `Facture de solde émise, reste à payer : ${formaterMontant(totalImpayes)} au total. Les plus anciens d’abord.` : 'Facture de solde émise et reste à payer > 0.'}>
            {v.impayes.length === 0 ? (
              <EtatVide icone={Hourglass} titre="Aucun solde impayé." />
            ) : (
              <ul className={classeListe}>
                {v.impayes.map((l) => (
                  <li key={l.dossierId}>
                    <Link href={lienFinancesDossier(l.dossierId)} className={classeLigne}>
                      <span className="min-w-0 space-y-0.5">
                        <Dossier numero={l.numeroDossier} client={l.clientNom} />
                        <span className="block text-xs text-ink-500">
                          {l.factureNumero} émise le {date(l.emiseLe)} · montant final {formaterMontant(l.montantFinalTtc)}
                          {l.referentNom ? ` · référent ${l.referentNom}` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Pastille ton={l.ancienneteJours >= DELAI_IMPAYE_JOURS ? 'rouge' : 'neutre'}>
                          {l.ancienneteJours} j
                        </Pastille>
                        <span className="tabular-nums font-semibold">{formaterMontant(l.resteAPayer)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>

        <div id="remboursements" className="scroll-mt-20 grid gap-5 lg:grid-cols-2">
          <Carte titre="Remboursements à valider" description={direction ? 'Validation par la Direction (onglet Finances du dossier).' : 'En attente de validation par la Direction.'}>
            {v.remboursementsAValider.length === 0 ? (
              <EtatVide icone={Coins} titre="Aucun remboursement à valider." />
            ) : (
              <ul className={classeListe}>
                {v.remboursementsAValider.map((r) => (
                  <li key={r.id}>
                    <Link href={lienFinancesDossier(r.dossierId)} className={classeLigne}>
                      <span className="min-w-0 space-y-0.5">
                        <Dossier numero={r.numeroDossier} client={r.clientNom} />
                        <span className="block text-xs text-ink-500">
                          Préparé le {date(r.prepareLe)}
                          {r.prepareParNom ? ` par ${r.prepareParNom}` : ''}
                        </span>
                      </span>
                      <span className="tabular-nums font-semibold">{formaterMontant(r.montant)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
          <Carte titre="Remboursements à effectuer" description="Validés par la Direction : sortie à enregistrer (moyen, référence, justificatif).">
            {v.remboursementsAEffectuer.length === 0 ? (
              <EtatVide icone={Wallet} titre="Aucun remboursement à effectuer." />
            ) : (
              <ul className={classeListe}>
                {v.remboursementsAEffectuer.map((r) => (
                  <li key={r.id}>
                    <Link href={lienFinancesDossier(r.dossierId)} className={classeLigne}>
                      <span className="min-w-0 space-y-0.5">
                        <Dossier numero={r.numeroDossier} client={r.clientNom} />
                        <span className="block text-xs text-ink-500">{r.valideLe ? `Validé le ${date(r.valideLe)}` : 'Validé'}</span>
                      </span>
                      <span className="tabular-nums font-semibold">{formaterMontant(r.montant)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>

        <div id="annulations" className="scroll-mt-20">
          <Carte titre="Demandes d’annulation en attente" description="Demandées par un référent ; à traiter par le Responsable finances ou la Direction.">
            {v.demandesAnnulation.length === 0 ? (
              <EtatVide icone={Ban} titre="Aucune demande en attente." />
            ) : (
              <ul className={classeListe}>
                {v.demandesAnnulation.map((d) => (
                  <li key={d.id}>
                    <Link href={lienFinancesDossier(d.dossierId)} className={classeLigne}>
                      <span className="min-w-0 space-y-0.5">
                        <Dossier numero={d.numeroDossier} client={d.clientNom} />
                        <span className="block text-xs text-ink-500">
                          {d.recuNumero ?? `Encaissement ${d.encaissementId}`} · {MOYENS_PAIEMENT[d.moyen]} · demandée le {date(d.demandeLe)}
                          {d.demandeParNom ? ` par ${d.demandeParNom}` : ''}
                        </span>
                        <span className="block text-xs text-ink-700">Motif : {d.motif}</span>
                      </span>
                      <span className="tabular-nums font-semibold">{formaterMontant(d.montant)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>

        <div id="moyen-autre" className="scroll-mt-20">
          <Carte titre="Paiements au moyen « Autre »" description="Par exemple un paiement reçu sur le numéro personnel d’un collaborateur : vérifier le commentaire et le reversement.">
            {v.moyenAutre.length === 0 ? (
              <EtatVide icone={AlertTriangle} titre="Aucun paiement « Autre » sur la période." />
            ) : (
              <ul className={classeListe}>
                {v.moyenAutre.map((e) => (
                  <LigneEncaissement key={e.id} e={e} />
                ))}
              </ul>
            )}
          </Carte>
        </div>

        <Carte titre="Encaissements récents" description="Toutes les écritures (encaissements, annulations, remboursements, crédits), par date de réception.">
          <form className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label htmlFor="du" className={classeLibelle}>Du</label>
              <input id="du" name="du" type="date" defaultValue={filtres.du ?? ''} className={classeChamp} />
            </div>
            <div>
              <label htmlFor="au" className={classeLibelle}>Au</label>
              <input id="au" name="au" type="date" defaultValue={filtres.au ?? ''} className={classeChamp} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="moyen" className={classeLibelle}>Moyen</label>
              <select id="moyen" name="moyen" defaultValue={filtres.moyen ?? ''} className={classeChamp}>
                <option value="">Tous</option>
                {[...MOYENS_SAISIE, 'credit_client' as const].map((m) => (
                  <option key={m} value={m}>
                    {MOYENS_PAIEMENT[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
              <button type="submit" className={classeBouton()}>Filtrer</button>
              <Link href="/admin/finances" className={classeBouton('secondaire')}>Réinitialiser</Link>
            </div>
          </form>
          {v.encaissements.length === 0 ? (
            <EtatVide icone={CircleDollarSign} titre="Aucun encaissement." description="Aucune écriture ne correspond à ces filtres." />
          ) : (
            <ul className={classeListe}>
              {v.encaissements.map((e) => (
                <LigneEncaissement key={e.id} e={e} />
              ))}
            </ul>
          )}
          {v.encaissements.length >= filtres.limite && <p className="mt-2 text-xs text-ink-500">Les {filtres.limite} écritures les plus récentes sont affichées : précisez la période pour voir les autres.</p>}
        </Carte>

        <Carte titre="Crédits clients disponibles" description="Trop-perçus versés au crédit du client, proposés en déduction sur son prochain devis.">
          {v.credits.length === 0 ? (
            <EtatVide icone={PiggyBank} titre="Aucun crédit client." />
          ) : (
            <ul className={classeListe}>
              {v.credits.map((cr) => {
                const contenu = (
                  <>
                    <span className="min-w-0">
                      <span className="font-medium text-ink-900">{cr.clientNom}</span>
                      {cr.numeroDossier && <span className="block text-xs text-ink-500">Dernier dossier concerné : {cr.numeroDossier}</span>}
                    </span>
                    <span className="tabular-nums font-semibold">{formaterMontant(cr.credit)}</span>
                  </>
                );
                return (
                  <li key={cr.clientId}>
                    {cr.dossierId ? (
                      <Link href={lienFinancesDossier(cr.dossierId)} className={classeLigne}>
                        {contenu}
                      </Link>
                    ) : (
                      <div className={classeLigne}>{contenu}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>
      </div>
    </>
  );
}
