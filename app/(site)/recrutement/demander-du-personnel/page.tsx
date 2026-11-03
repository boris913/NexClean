// MVP1-03 : formulaire public « Demander du personnel » (RG-01, RG-02).
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { listesLieux } from '@/lib/geo/service';
import { lireParametre } from '@/lib/parametres';
import FormulairePersonnel from './FormulairePersonnel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Demander du personnel — Recrutement & placement au Cameroun',
  description:
    'Décrivez le personnel dont vous avez besoin (agents d’entretien, serveurs, cuisiniers, gardiens, nounous…) : NEXCLEAN recrute et place des candidats sélectionnés à Douala et Yaoundé. Estimation immédiate.',
  path: '/recrutement/demander-du-personnel',
});

export default async function PageDemanderPersonnel() {
  const [listes, commission, metiers] = await Promise.all([listesLieux(), lireParametre('commission_par_personne'), lireParametre('metiers')]);
  return (
    <section className="bg-slate-50 min-h-[70vh] pt-24 sm:pt-28 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Recrutement &amp; placement</p>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-ink-900 mb-2">Demander du personnel</h1>
        <p className="text-slate-600 mb-6">
          Décrivez votre besoin en quelques minutes. Nous sélectionnons les candidats et un conseiller vous rappelle avec une proposition.
        </p>
        <FormulairePersonnel listes={listes} commission={commission} metiers={metiers} />
      </div>
    </section>
  );
}
