import Image from 'next/image';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import SectionLabel from '@/components/ui/SectionLabel';
import { WHY_US } from '@/lib/constants';

export default function WhyUsSection() {
  const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

  return (
    <section id="pourquoi-nexclean" className="py-20 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
          <Image
            src="/images/team/equipe-nexclean.jpg"
            alt="L'équipe NexClean"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute top-4 left-4 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            Équipe NexClean
          </div>
        </div>

        <div>
          <SectionLabel className="mb-4">Pourquoi NexClean</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-4">Une organisation pensée pour la qualité</h2>
          <p className="text-slate-500 mb-8">
            Chaque intervention suit la même méthode : état des lieux, devis clair, planification, intervention et contrôle.
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {WHY_US.map((item) => {
              const Icon = Icons[item.icon] || LucideIcons.Sparkles;
              return (
                <div key={item.title} className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
