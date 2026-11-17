// MVP2-02 RG-10 : la Direction désigne le(s) responsable(s) de chaque offre (référent qui suit
// l'offre, ou collaborateurs d'un recrutement interne). Sans responsable : attribution par ville.
import Link from 'next/link';
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { collaborateursEligiblesOffre, lireResponsablesOffres } from '@/lib/candidats/candidatures';
import { listerOffres } from '@/lib/offres/service';
import { STATUTS_OFFRE } from '@/lib/offres/domaine';
import { Carte, EtatVide, Pastille, TitrePage } from '@/components/backoffice/ui';
import { ResponsablesOffre } from '../Elements';

export const metadata = { title: 'Responsables des offres' };

export default async function PageResponsablesOffres() {
  await exigerAccesVivier('offre.responsables');
  const [collaborateurs, responsables, offres] = await Promise.all([collaborateursEligiblesOffre(), lireResponsablesOffres(), listerOffres()]);

  return (
    <>
      <TitrePage titre="Responsables des offres" retour={{ href: '/admin/candidatures', libelle: 'Candidatures' }} />
      <p className="text-sm text-ink-600 mb-4">
        Chaque nouvelle candidature est attribuée au responsable de l’offre (s’il y en a plusieurs : le moins chargé en candidatures reçues, puis le premier désigné). Sans responsable : le référent du candidat, ou l’attribution par ville.
      </p>
      {offres.length === 0 && <EtatVide titre="Aucune offre." description="Créez une offre depuis l’écran Offres." />}
      <div className="space-y-3">
        {offres.map((o) => {
          const actuels = responsables[o.slug] ?? [];
          // Un responsable devenu inéligible reste affiché pour pouvoir être retiré.
          const options = [...collaborateurs, ...actuels.filter((a) => !collaborateurs.some((u) => u.id === a.id)).map((a) => ({ id: a.id, nom: `${a.nom} (inéligible)` }))];
          return (
            <Carte key={o.slug} titre={o.titre} actions={<Pastille ton={o.statut === 'publiee' ? 'vert' : 'neutre'}>{STATUTS_OFFRE[o.statut]}</Pastille>}>
              <Link href={`/admin/offres/${o.id}`} className="mb-2 inline-block text-sm text-primary hover:underline">Voir l’offre</Link>
              <ResponsablesOffre slug={o.slug} titre={o.titre} collaborateurs={options} initial={actuels.map((a) => a.id)} />
            </Carte>
          );
        })}
      </div>
    </>
  );
}
