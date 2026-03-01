import SectionLabel from '@/components/ui/SectionLabel';
import { zones, activeZones, upcomingZones } from '@/content/zones-coverage';
import { MapPin, Check, Clock } from 'lucide-react';

export default function CoverageSection() {
  return (
    <section id="zones" className="py-20 bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <SectionLabel className="mb-4">Zone de couverture</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-3">
            Où intervenons-nous ?
          </h2>
          <p className="text-slate-500">Principaux quartiers de Douala couverts.</p>
        </div>

        {/* Active */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Check className="w-4 h-4 text-success" />
            <span className="text-sm font-semibold text-slate-700">Zones actives</span>
            <span className="text-xs text-success bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
              Intervention immédiate
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeZones.map((zone) => (
              <div
                key={zone.name}
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg"
              >
                <MapPin className="w-3.5 h-3.5 text-primary" />
                {zone.name}
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-slate-700">Bientôt disponibles</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingZones.map((zone) => (
              <div
                key={zone.name}
                className="flex items-center gap-1.5 bg-white border border-dashed border-slate-200 text-sm text-slate-500 px-3 py-2 rounded-lg"
              >
                <Clock className="w-3.5 h-3.5 text-slate-300" />
                {zone.name}
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="bg-primary text-white rounded-xl p-6 text-center">
          <p className="font-semibold mb-1">Votre quartier n'est pas listé ?</p>
          <p className="text-sm text-blue-100">
            Contactez-nous — nous étudions toutes les demandes. Des frais de déplacement peuvent s'appliquer.
          </p>
        </div>
      </div>
    </section>
  );
}
