// ADR 0013 : liste des offres d'emploi (brouillons, publiées, fermées), filtrable par statut.
import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { lienCandidaturesOffre } from '@/lib/candidats/candidatures';
import { listerOffres } from '@/lib/offres/service';
import { ORIGINES_OFFRE, STATUTS_OFFRE, STATUTS_OFFRE_CODES, type StatutOffre } from '@/lib/offres/domaine';
import { classeBouton, classeCarteLien, EtatVide, Onglets, Pastille, TitrePage } from '@/components/backoffice/ui';

export const metadata = { title: 'Offres d’emploi' };
export const dynamic = 'force-dynamic';

const TON: Record<StatutOffre, 'neutre' | 'vert' | 'orange'> = { brouillon: 'orange', publiee: 'vert', fermee: 'neutre' };

export default async function PageOffres({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  await exigerAccesVivier('offre.gerer');
  const { statut: s } = await searchParams;
  const statut = STATUTS_OFFRE_CODES.includes(s as StatutOffre) ? (s as StatutOffre) : undefined;
  const toutes = await listerOffres();
  const offres = statut ? toutes.filter((o) => o.statut === statut) : toutes;
  const compte = (x: StatutOffre) => toutes.filter((o) => o.statut === x).length;

  return (
    <>
      <TitrePage titre="Offres d’emploi" description="Annonces publiées sur la page Recrutement du site. Une offre est créée en brouillon, puis publiée à la main.">
        <Link href="/admin/offres/nouvelle" className={classeBouton('principal')}>
          + Nouvelle offre
        </Link>
      </TitrePage>
      <Onglets
        libelle="Statut des offres"
        onglets={[
          { href: '/admin/offres', libelle: 'Toutes', actif: !statut, compteur: toutes.length },
          ...STATUTS_OFFRE_CODES.map((x) => ({ href: `/admin/offres?statut=${x}`, libelle: STATUTS_OFFRE[x], actif: statut === x, compteur: compte(x) })),
        ]}
      />
      {offres.length === 0 && (
        <EtatVide icone={Megaphone} titre="Aucune offre." description="Créez une offre : elle restera en brouillon jusqu’à sa publication." action={<Link href="/admin/offres/nouvelle" className={classeBouton('principal')}>Nouvelle offre</Link>} />
      )}
      <ul className="space-y-3">
        {offres.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/offres/${o.id}`} className={classeCarteLien}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900">{o.titre}</p>
                  <p className="mt-0.5 text-sm text-ink-600">
                    {o.lieu} · {o.contrat} · {ORIGINES_OFFRE[o.origine]}
                    {o.postes > 1 ? ` · ${o.postes} postes` : ''}
                  </p>
                </div>
                <Pastille ton={TON[o.statut]}>{STATUTS_OFFRE[o.statut]}</Pastille>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                {o.candidatures} candidature(s)
                {o.publieeLe ? ` · publiée le ${new Date(`${o.publieeLe}T12:00:00`).toLocaleDateString('fr-FR')}` : ''}
                {o.statut === 'fermee' && o.motifFermeture ? ` · ${o.motifFermeture}` : ''}
              </p>
            </Link>
            {o.candidatures > 0 && (
              <Link href={lienCandidaturesOffre(o.slug)} className="ml-4 mt-1 inline-block text-xs text-primary hover:underline">
                Voir les candidatures
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
