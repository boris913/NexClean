// POST-03 RG-03, RG-06, RG-07 : fiche d'une dépense — modification, annulation, justificatif.
import { notFound } from 'next/navigation';
import { Paperclip } from 'lucide-react';
import { exigerCollaborateur } from '@/lib/authz/session';
import { formaterMontant } from '@/lib/devis/domaine';
import { FUSEAU } from '@/lib/domain/referentiels';
import { dateDuJour } from '@/lib/encaissements/domaine';
import { listerCategories, lireDepense, villesActives } from '@/lib/depenses/service';
import { Alerte, Carte, Pastille, TitrePage } from '@/components/backoffice/ui';
import { AnnulerDepense, FormulaireDepense } from '../Formulaire';

export const metadata = { title: 'Dépense' };
export const dynamic = 'force-dynamic';

const horodatage = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'medium', timeStyle: 'short' }).format(d);

export default async function PageDepense({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const c = await exigerCollaborateur({ permission: 'depense.saisir' });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const [d, categories, villes] = await Promise.all([lireDepense(id, { id: c.id, roles: c.roles, ip: c.ip }), listerCategories(), villesActives()]);
  if (!d) notFound();

  return (
    <>
      <TitrePage titre={d.libelle} description={`${formaterMontant(d.montant)} · ${d.categorie}`} retour={{ href: '/admin/depenses', libelle: 'Dépenses' }}>
        {d.annuleeLe ? <Pastille ton="rouge">Annulée</Pastille> : null}
      </TitrePage>

      <div className="space-y-5">
        {sp.cree === '1' && <Alerte type="succes">Dépense enregistrée.</Alerte>}

        <Carte titre="Suivi">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-500">Saisie</dt>
              <dd className="text-ink-900">
                {horodatage(d.creeLe)}
                {d.auteurNom ? ` par ${d.auteurNom}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500">Dernière modification</dt>
              <dd className="text-ink-900">{horodatage(d.majLe)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-500">Justificatif</dt>
              <dd>
                {d.aJustificatif ? (
                  <a href={`/admin/depenses/${d.id}/justificatif`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline">
                    <Paperclip aria-hidden className="h-4 w-4" /> {d.justificatifNom ?? 'Ouvrir'}
                  </a>
                ) : (
                  <span className="text-ink-500">Aucun</span>
                )}
              </dd>
            </div>
            {d.annuleeLe && (
              <div className="sm:col-span-2">
                <dt className="text-ink-500">Annulation</dt>
                <dd className="text-ink-900">
                  {horodatage(d.annuleeLe)} — motif : {d.motifAnnulation}
                </dd>
              </div>
            )}
          </dl>
        </Carte>

        {d.annuleeLe ? (
          <Alerte type="info">Cette dépense est annulée : elle ne compte plus dans les indicateurs ni dans l’export, et ne peut plus être modifiée.</Alerte>
        ) : (
          <>
            <FormulaireDepense
              aujourdhui={dateDuJour()}
              categories={categories}
              villes={villes}
              depense={{
                id: d.id,
                depenseLe: d.depenseLe,
                categorieId: d.categorieId,
                libelle: d.libelle,
                montant: d.montant,
                moyen: d.moyen === 'credit_client' ? 'autre' : d.moyen,
                reference: d.reference,
                villeId: d.villeId,
                dossierNumero: d.numeroDossier,
                service: d.numeroDossier ? null : d.service,
                commentaire: d.commentaire,
                justificatifNom: d.aJustificatif ? (d.justificatifNom ?? 'justificatif') : null,
              }}
            />
            <Carte titre="Annuler" description="Pour une dépense saisie par erreur ou en double. Elle reste visible, barrée, avec son motif ; l’annulation est journalisée.">
              <AnnulerDepense id={d.id} />
            </Carte>
          </>
        )}
      </div>
    </>
  );
}
