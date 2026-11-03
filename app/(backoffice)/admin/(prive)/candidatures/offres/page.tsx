// MVP2-02 RG-10 : la Direction désigne le(s) responsable(s) de chaque offre (référent qui suit
// l'offre, ou collaborateurs d'un recrutement interne). Sans responsable : attribution par ville.
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { collaborateursEligiblesOffre, lireResponsablesOffres } from '@/lib/candidats/candidatures';
import { jobs } from '@/content/jobs-data';
import { Carte, Pastille, TitrePage } from '@/components/backoffice/ui';
import { ResponsablesOffre } from '../Elements';

export const metadata = { title: 'Responsables des offres' };

export default async function PageResponsablesOffres() {
  await exigerAccesVivier('offre.responsables');
  const [collaborateurs, responsables] = await Promise.all([collaborateursEligiblesOffre(), lireResponsablesOffres()]);

  return (
    <>
      <TitrePage titre="Responsables des offres" retour={{ href: '/admin/candidatures', libelle: 'Candidatures' }} />
      <p className="text-sm text-ink-600 mb-4">
        Chaque nouvelle candidature est attribuée au responsable de l’offre (s’il y en a plusieurs : le moins chargé en candidatures reçues, puis le premier désigné). Sans responsable : le référent du candidat, ou l’attribution par ville.
      </p>
      <div className="space-y-3">
        {jobs.map((j) => {
          const actuels = responsables[j.slug] ?? [];
          // Un responsable devenu inéligible reste affiché pour pouvoir être retiré.
          const options = [...collaborateurs, ...actuels.filter((a) => !collaborateurs.some((u) => u.id === a.id)).map((a) => ({ id: a.id, nom: `${a.nom} (inéligible)` }))];
          return (
            <Carte key={j.slug} titre={j.title} actions={<Pastille ton={j.status === 'open' ? 'vert' : 'neutre'}>{j.status === 'open' ? 'Ouverte' : 'Pourvue'}</Pastille>}>
              <ResponsablesOffre slug={j.slug} titre={j.title} collaborateurs={options} initial={actuels.map((a) => a.id)} />
            </Carte>
          );
        })}
      </div>
    </>
  );
}
