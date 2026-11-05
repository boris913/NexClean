// Sections « Votre devis » et « Documents » de la page de suivi (specs/MVP2-04 RG-12..14, RG-19).
// Rendues côté serveur, uniquement après vérification des 4 chiffres (contrôlée par la page).
import { FileText } from 'lucide-react';
import { cardClasses } from '@/components/ui/Card';
import { formaterMontant } from '@/lib/devis/domaine';
import { devisPourSuivi, documentsPourSuivi, MESSAGE_REMPLACE, type DevisClient } from '@/lib/devis/client';
import type { Contexte } from '@/lib/propositions/client';
import { FUSEAU } from '@/lib/domain/referentiels';
import { ReponseDevis } from './InteractionsDevis';

const date = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'long' }).format(d);
const dateHeure = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'long', timeStyle: 'short' }).format(d);
const jours = (n: number) => `${n} jour${n > 1 ? 's' : ''}`;
const lien = 'inline-flex min-h-11 items-center gap-2 text-primary font-semibold underline';

const tonsEtat: Record<DevisClient['etat'], string> = {
  a_accepter: 'bg-cta/30 text-ink-900',
  accepte: 'bg-success-soft text-success',
  refuse: 'bg-ink-100 text-ink-700',
  expire: 'bg-ink-100 text-ink-700',
  remplace: 'bg-ink-100 text-ink-700',
};

function CarteDevis({ ctx, d }: { ctx: Contexte; d: DevisClient }) {
  const nature = d.type === 'avenant' ? 'avenant' : 'devis';
  const titre = `${d.type === 'avenant' ? 'Avenant' : 'Devis'} ${d.numero} — version ${d.version}`;
  const titreId = `devis-${d.id}`;
  return (
    <article aria-labelledby={titreId} className={cardClasses({ padding: 'sm', className: 'space-y-4' })}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titreId} className="font-display text-h3 text-ink-900 break-words">
            {titre}
          </h3>
          <p className="text-sm text-ink-600">Envoyé le {date(d.envoyeLe)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${tonsEtat[d.etat]}`}>{d.statut}</span>
      </div>

      {d.etat === 'remplace' && <p className="rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-800">{MESSAGE_REMPLACE} Votre référent NEXCLEAN vous transmet la nouvelle version.</p>}
      {d.etat === 'expire' && <p className="rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-800">Ce {nature} a expiré{d.expireLe ? ` le ${date(d.expireLe)}` : ''}. Contactez votre référent NEXCLEAN pour en recevoir un nouveau.</p>}
      {d.etat === 'refuse' && <p className="rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-800">Vous avez refusé ce {nature}{d.refuseLe ? ` le ${date(d.refuseLe)}` : ''}. Votre référent NEXCLEAN peut vous proposer un nouveau devis.</p>}
      {d.etat === 'accepte' && d.acceptation && (
        <p className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-ink-800">
          {d.type === 'avenant' ? 'Avenant accepté' : 'Devis accepté'} le {dateHeure(d.acceptation.le)} par <strong>{d.acceptation.signataireNom}</strong>
          {d.acceptation.signataireFonction ? `, ${d.acceptation.signataireFonction}` : ''}.
        </p>
      )}

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm">
          <caption className="sr-only">Détail du {nature}</caption>
          <thead>
            <tr className="text-left text-muted border-b border-ink-100">
              <th scope="col" className="py-2 pr-2 font-medium">Poste</th>
              <th scope="col" className="py-2 px-2 font-medium text-right">Nb</th>
              <th scope="col" className="py-2 pl-2 font-medium text-right">Montant HT</th>
            </tr>
          </thead>
          <tbody>
            {d.lignes.map((l, i) => (
              <tr key={i} className="border-b border-ink-50 align-top">
                <td className="py-2 pr-2">
                  {l.intitule}
                  <span className="block text-xs text-muted">{formaterMontant(l.commission)} / personne</span>
                </td>
                <td className="py-2 px-2 text-right tabular-nums">{l.nombre}</td>
                <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">{formaterMontant(l.montantHt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-600">Total HT</dt>
          <dd className="tabular-nums">{formaterMontant(d.totalHt)}</dd>
        </div>
        {d.tauxTva > 0 ? (
          <>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-600">{d.mentionTva}</dt>
              <dd className="tabular-nums">{formaterMontant(d.montantTva)}</dd>
            </div>
            <div className="flex justify-between gap-3 font-semibold">
              <dt>Total TTC</dt>
              <dd className="tabular-nums">{formaterMontant(d.totalTtc)}</dd>
            </div>
          </>
        ) : (
          <div className="flex justify-between gap-3 font-semibold">
            <dt>
              Total <span className="font-normal text-ink-600">({d.mentionTva})</span>
            </dt>
            <dd className="tabular-nums">{formaterMontant(d.totalTtc)}</dd>
          </div>
        )}
        {d.acompte > 0 && (
          <div className="flex justify-between gap-3 rounded-2xl bg-ink-50 px-3 py-2 mt-2">
            <dt>Acompte à la signature ({d.tauxAcompte} %)</dt>
            <dd className="tabular-nums font-semibold">{formaterMontant(d.acompte)}</dd>
          </div>
        )}
      </dl>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {d.type === 'avenant' && d.prolongationJours ? (
          <div>
            <dt className="text-muted">Prolongation de la recherche</dt>
            <dd>{jours(d.prolongationJours)}</dd>
          </div>
        ) : (
          <div>
            <dt className="text-muted">Délai de recherche</dt>
            <dd>{jours(d.delaiRechercheJours)} après l’acompte</dd>
          </div>
        )}
        <div>
          <dt className="text-muted">Garantie de remplacement</dt>
          <dd>{jours(d.garantieJours)}</dd>
        </div>
        {d.etat === 'a_accepter' && (
          <div>
            <dt className="text-muted">Valable jusqu’au</dt>
            <dd>{d.expireLe ? date(d.expireLe) : `${jours(d.validiteJours)} après l’envoi`}</dd>
          </div>
        )}
      </dl>

      <details className="rounded-2xl border border-ink-100 px-4 py-2 text-sm">
        <summary className="min-h-11 flex items-center cursor-pointer font-medium">Conditions du {nature}</summary>
        <div className="pb-2 space-y-3">
          <p className="whitespace-pre-line text-ink-700">{d.conditions}</p>
          {d.conditionsParticulieres && (
            <div>
              <p className="font-medium">Conditions particulières</p>
              <p className="whitespace-pre-line text-ink-700">{d.conditionsParticulieres}</p>
            </div>
          )}
        </div>
      </details>

      {d.aPdf && (
        <a href={`${ctx.chemin}/documents/devis/${d.id}`} target="_blank" rel="noopener noreferrer" className={lien}>
          <FileText className="w-4 h-4" aria-hidden /> Voir le {nature} (PDF)
        </a>
      )}

      {d.etat === 'a_accepter' && <ReponseDevis jeton={ctx.jeton} devisId={d.id} libelle={nature} montantAcompte={d.type === 'devis' && d.acompte > 0 ? formaterMontant(d.acompte) : null} />}
    </article>
  );
}

export async function SectionDevis({ ctx }: { ctx: Contexte }) {
  const { devis, avenant } = await devisPourSuivi(ctx);
  if (!devis && !avenant) return null;
  return (
    <section aria-labelledby="section-devis" className="mb-8 space-y-4">
      <h2 id="section-devis" className="font-display text-h3 text-ink-900">
        Votre devis
      </h2>
      {avenant && <CarteDevis ctx={ctx} d={avenant} />}
      {devis && <CarteDevis ctx={ctx} d={devis} />}
    </section>
  );
}

export async function SectionDocuments({ ctx }: { ctx: Contexte }) {
  const docs = await documentsPourSuivi(ctx);
  if (!docs.accuseReception && !docs.devis.length && !docs.factures.length) return null;
  return (
    <section aria-labelledby="section-documents" className={cardClasses({ padding: 'sm', className: 'mb-8' })}>
      <h2 id="section-documents" className="font-display text-h3 text-ink-900 mb-2">
        Documents
      </h2>
      <ul className="divide-y divide-ink-100">
        {docs.accuseReception && (
          <li>
            <a href={`${ctx.chemin}/documents/accuse-reception`} target="_blank" rel="noopener noreferrer" className={lien}>
              <FileText className="w-4 h-4 shrink-0" aria-hidden /> Accusé de réception
            </a>
          </li>
        )}
        {docs.devis.map((d) => (
          <li key={`d${d.id}`}>
            <a href={`${ctx.chemin}/documents/devis/${d.id}`} target="_blank" rel="noopener noreferrer" className={lien}>
              <FileText className="w-4 h-4 shrink-0" aria-hidden /> {d.libelle}
              {d.etat === 'remplace' && <span className="font-normal no-underline text-muted"> (remplacé)</span>}
            </a>
          </li>
        ))}
        {docs.factures.map((f) => (
          <li key={`f${f.id}`}>
            <a href={`${ctx.chemin}/documents/factures/${f.id}`} target="_blank" rel="noopener noreferrer" className={lien}>
              <FileText className="w-4 h-4 shrink-0" aria-hidden /> {f.libelle}
              <span className="font-normal text-ink-600"> — {formaterMontant(f.totalTtc)}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Les documents s’ouvrent dans un nouvel onglet (PDF).</p>
    </section>
  );
}
