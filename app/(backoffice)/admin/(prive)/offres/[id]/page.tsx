// ADR 0013 : fiche d'une offre — statut (publier, fermer, rouvrir), modification, candidatures.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { lienCandidaturesOffre } from '@/lib/candidats/candidatures';
import { listerOffres, lireLigneLiee, lireOffre } from '@/lib/offres/service';
import { ORIGINES_OFFRE, STATUTS_OFFRE, type CategorieOffre, type StatutOffre } from '@/lib/offres/domaine';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Alerte, Carte, Pastille, TitrePage } from '@/components/backoffice/ui';
import { ActionsStatut, FormulaireOffre } from '../Formulaire';

export const metadata = { title: 'Offre d’emploi' };
export const dynamic = 'force-dynamic';

const TON: Record<StatutOffre, 'neutre' | 'vert' | 'orange'> = { brouillon: 'orange', publiee: 'vert', fermee: 'neutre' };

export default async function FicheOffre({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cree?: string }> }) {
  await exigerAccesVivier('offre.gerer');
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const o = await lireOffre(id);
  if (!o) notFound();
  const [{ cree }, ligne, liste] = await Promise.all([searchParams, o.lignePosteId ? lireLigneLiee(o.lignePosteId) : null, listerOffres()]);
  const candidatures = liste.find((x) => x.id === id)?.candidatures ?? 0;

  return (
    <>
      <TitrePage titre={o.titre} retour={{ href: '/admin/offres', libelle: 'Offres d’emploi' }} />
      <div className="space-y-5">
        {cree && <Alerte type="succes">Brouillon créé. Relisez-le, puis publiez-le pour le rendre visible sur le site.</Alerte>}
        <Carte titre="Statut" actions={<Pastille ton={TON[o.statut]}>{STATUTS_OFFRE[o.statut]}</Pastille>}>
          <div className="space-y-3 text-sm">
            <p className="text-ink-600">
              {ORIGINES_OFFRE[o.origine]}
              {ligne && (
                <>
                  {' · '}
                  <Link href={`/admin/dossiers/${ligne.dossierId}`} className="text-primary hover:underline">
                    {ligne.numero} — {ligne.intitule}
                  </Link>
                </>
              )}
            </p>
            {o.publieeLe && <p className="text-ink-600">Publiée le {new Date(`${o.publieeLe}T12:00:00`).toLocaleDateString('fr-FR')}</p>}
            {o.statut === 'fermee' && o.fermeeLe && (
              <p className="text-ink-600">
                Fermée le {formatHorodatage(o.fermeeLe)}
                {o.motifFermeture ? ` — ${o.motifFermeture}` : ''}
              </p>
            )}
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              {o.statut !== 'brouillon' && (
                <a href={`/recrutement/${o.slug}`} target="_blank" rel="noopener" className="text-primary hover:underline">
                  Voir sur le site ↗
                </a>
              )}
              <Link href={lienCandidaturesOffre(o.slug)} className="text-primary hover:underline">
                {candidatures} candidature(s)
              </Link>
            </p>
            <ActionsStatut id={o.id} statut={o.statut} publieeAuMoinsUneFois={!!o.publieeLe} candidatures={candidatures} />
          </div>
        </Carte>
        <FormulaireOffre
          key={o.majLe.getTime()}
          ligne={ligne ? { libelle: `la ligne « ${ligne.intitule} » du dossier ${ligne.numero}` } : null}
          offre={{
            id: o.id,
            statut: o.statut,
            slugFige: !!o.publieeLe || o.statut !== 'brouillon',
            slug: o.slug,
            titre: o.titre,
            categorie: o.categorie as CategorieOffre,
            origine: o.origine,
            lignePosteId: o.lignePosteId,
            lieu: o.lieu,
            contrat: o.contrat,
            secteur: o.secteur,
            postes: o.postes,
            description: o.description,
            exigences: o.exigences,
            intro: o.intro,
            missions: o.missions,
            profil: o.profil,
            horaires: o.horaires,
            salaire: o.salaire ? { base: o.salaire.base ?? null, bonus: o.salaire.bonus ?? null, target: o.salaire.target ?? null, note: o.salaire.note ?? null, fixed: !!o.salaire.fixed } : null,
            valableJusquau: o.valableJusquau,
            accordSalaireClient: o.accordSalaireClient,
          }}
        />
      </div>
    </>
  );
}
