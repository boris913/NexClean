import SectionLabel from '@/components/ui/SectionLabel';
import Button from '@/components/ui/Button';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { getWhatsAppLink } from '@/lib/constants';

const realisations = [
  {
    id: 1,
    label: 'Nettoyage maison',
    location: 'Bonapriso',
    before: 'https://placehold.co/720x480/d1d5db/6b7280?text=Avant+—+Salon',
    after: 'https://placehold.co/720x480/dbeafe/1d4ed8?text=Après+—+Salon+impeccable',
    alt: 'Salon avant et après nettoyage complet NexClean à Bonapriso',
  },
  {
    id: 2,
    label: 'Nettoyage bureau',
    location: 'Akwa',
    before: 'https://placehold.co/720x480/d1d5db/6b7280?text=Avant+—+Bureau',
    after: 'https://placehold.co/720x480/dcfce7/15803d?text=Après+—+Bureau+propre',
    alt: 'Espace de bureau avant et après nettoyage professionnel NexClean à Akwa',
  },
  {
    id: 3,
    label: 'Après travaux',
    location: 'Bonanjo',
    before: 'https://placehold.co/720x480/d1d5db/6b7280?text=Avant+—+Après+travaux',
    after: 'https://placehold.co/720x480/fef3c7/92400e?text=Après+—+Chantier+remis+en+état',
    alt: 'Appartement après travaux remis en état par NexClean à Bonanjo',
  },
  {
    id: 4,
    label: 'Désinfection complète',
    location: 'Bali',
    before: 'https://placehold.co/720x480/d1d5db/6b7280?text=Avant+—+Désinfection',
    after: 'https://placehold.co/720x480/ede9fe/7c3aed?text=Après+—+Désinfection+totale',
    alt: 'Local commercial désinfecté par NexClean à Bali',
  },
];

interface RealisationCardProps {
  item: typeof realisations[0];
}

function RealisationCard({ item }: RealisationCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-card hover:shadow-card-hover transition-all duration-300">
      {/* Images: show "after" on hover using CSS */}
      <div className="relative aspect-[3/2] overflow-hidden">
        {/* Before */}
        <Image
          src={item.before}
          alt={`Avant : ${item.alt}`}
          fill
          className="object-cover group-hover:opacity-0 transition-opacity duration-500"
          unoptimized
        />
        {/* After */}
        <Image
          src={item.after}
          alt={`Après : ${item.alt}`}
          fill
          className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          unoptimized
        />

        {/* Labels */}
        <span className="absolute top-3 left-3 text-xs font-semibold bg-slate-900/70 text-white px-2.5 py-1 rounded-full group-hover:opacity-0 transition-opacity">
          Avant
        </span>
        <span className="absolute top-3 left-3 text-xs font-semibold bg-primary text-white px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          Après
        </span>
      </div>

      {/* Meta */}
      <div className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">{item.label}</p>
          <p className="text-xs text-slate-400">{item.location}</p>
        </div>
        <div className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
          Survolez pour voir
        </div>
      </div>
    </div>
  );
}

export default function RealisationsSection() {
  return (
    <section id="realisations" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14">
          <SectionLabel className="mb-4">Réalisations</SectionLabel>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-3">
                Quelques réalisations
              </h2>
              <p className="text-slate-500 text-base max-w-lg">
                Avant / après nos interventions. Le résultat parle de lui-même.
              </p>
            </div>
            <Button
              href={getWhatsAppLink('Bonjour NexClean, je voudrais en savoir plus sur vos réalisations')}
              variant="secondary"
              size="md"
              icon={ArrowRight}
              iconPosition="right"
            >
              Nous contacter
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 gap-5">
          {realisations.map((item) => (
            <RealisationCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
