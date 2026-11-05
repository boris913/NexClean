// MVP1-03 : formulaire public « Demander du personnel » (RG-01, RG-02).
// [À CONFIRMER : garantie de remplacement (15 jours proposés)] : ne pas afficher avant validation.
import type { Metadata } from 'next';
import Card from '@/components/ui/Card';
import JsonLd from '@/components/ui/JsonLd';
import PageHero from '@/components/ui/PageHero';
import Section from '@/components/ui/Section';
import { lireCouverture } from '@/lib/geo/couverture';
import { pageMetadata, recrutementServiceSchema } from '@/lib/seo';
import { listesLieux } from '@/lib/geo/service';
import { lireParametre } from '@/lib/parametres';
import FormulairePersonnel from './FormulairePersonnel';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: `Demander du personnel — Recrutement & placement à ${villes}`,
    description: `Agents d'entretien, serveurs, cuisiniers, gardiens, nounous… Décrivez vos postes : NEXCLEAN recrute et place des candidats présélectionnés à ${villes}. Estimation immédiate.`,
    path: '/recrutement/demander-du-personnel',
  });
}

const ETAPES = [
  'Vous décrivez vos postes.',
  'Un conseiller précise le besoin et vous envoie un devis.',
  'Après l’acompte, nous recherchons et vous présentons des candidats sur votre page de suivi.',
  'Vous ne payez au final que les placements confirmés à la prise de poste.',
];

export default async function PageDemanderPersonnel() {
  const [listes, commission, metiers, couverture] = await Promise.all([listesLieux(), lireParametre('commission_par_personne'), lireParametre('metiers'), lireCouverture()]);
  return (
    <>
      <JsonLd data={recrutementServiceSchema(couverture.villes)} />
      <PageHero
        label="Recrutement & placement"
        pillar="recrutement"
        title="Demander du personnel"
        subtitle="Décrivez votre besoin en quelques minutes. Vous obtenez une estimation immédiate, puis un conseiller vous rappelle avec un devis."
        breadcrumb={[{ name: 'Recrutement', href: '/recrutement' }, { name: 'Demander du personnel' }]}
      />
      <Section tone="muted" spacing="sm" container="narrow" className="min-h-[70vh]">
        <Card variant="pillar" pillar="recrutement" padding="sm" className="mb-8">
          <h2 className="font-display text-h3 text-ink-900 mb-3">Comment ça marche</h2>
          <ol className="space-y-2 text-small text-ink-700">
            {ETAPES.map((etape, i) => (
              <li key={etape} className="flex gap-3">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pillar-recrutement-soft text-xs font-bold text-pillar-recrutement">
                  {i + 1}
                </span>
                <span>{etape}</span>
              </li>
            ))}
          </ol>
        </Card>
        <FormulairePersonnel listes={listes} commission={commission} metiers={metiers} />
      </Section>
    </>
  );
}
