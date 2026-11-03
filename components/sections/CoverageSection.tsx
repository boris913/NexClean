import SectionLabel from '@/components/ui/SectionLabel';
import { lireCouverture } from '@/lib/geo/couverture';
import { MapPin, Check } from 'lucide-react';

/** « Où intervenons-nous ? » : villes couvertes et quartiers cochés « Afficher sur le site » (M1-GEO-05). */
export default async function CoverageSection() {
  const { libelle, quartiers } = await lireCouverture();
  const plusieursVilles = quartiers.length > 1;

  return (
    <section id="zones" className="py-20 sm:py-24 bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <SectionLabel className="mb-4">Zone de couverture</SectionLabel>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-ink-900 mb-3">
            Où intervenons-nous ?
          </h2>
          <p className="text-slate-500">
            Nous intervenons à {libelle}.{quartiers.length > 0 && ' Principaux quartiers couverts :'}
          </p>
        </div>

        {quartiers.map((groupe) => (
          <div key={groupe.ville} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Check className="w-4 h-4 text-success" />
              <span className="text-sm font-semibold text-slate-700">{plusieursVilles ? groupe.ville : 'Zones actives'}</span>
              <span className="text-xs text-success bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                Couverts régulièrement
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {groupe.noms.map((nom) => (
                <div
                  key={nom}
                  className="flex items-center gap-1.5 bg-white border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg"
                >
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  {nom}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Note */}
        <div className="bg-ink-900 text-white rounded-3xl p-7 text-center">
          <p className="font-semibold mb-1">Votre quartier n'est pas listé ?</p>
          <p className="text-sm text-ink-300">
            Contactez-nous — nous étudions toutes les demandes. Des frais de déplacement peuvent s'appliquer.
          </p>
        </div>
      </div>
    </section>
  );
}
