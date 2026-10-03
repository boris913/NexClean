import Image from 'next/image';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import SectionLabel from '@/components/ui/SectionLabel';
import Reveal, { Stagger, StaggerItem } from '@/components/ui/Reveal';
import { WHY_US } from '@/lib/constants';

export default function WhyUsSection() {
  const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

  return (
    <section id="pourquoi-nexclean" className="py-20 sm:py-28 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-16 items-center">
        {/* Photos au format portrait natif (3:4) : rien n'est coupé */}
        <Reveal from="left" className="relative mx-auto w-full max-w-[420px]">
          <div aria-hidden="true" className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-200 via-brand-100 to-transparent rotate-[-4deg]" />
          <div className="relative aspect-[3/4] rounded-[2rem] overflow-hidden shadow-2xl ring-8 ring-white">
            <Image
              src="/images/team/equipe-nexclean.jpg"
              alt="L'équipe NEXCLEAN SARL"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 90vw, 420px"
            />
          </div>
          <div className="absolute -right-4 sm:-right-10 bottom-10 w-[38%] aspect-[3/4] rounded-2xl overflow-hidden shadow-xl ring-[6px] ring-white">
            <Image src="/images/team/equipe-nexclean4.jpeg" alt="Matériel NEXCLEAN en intervention" fill className="object-cover" sizes="180px" />
          </div>
          <div className="absolute -left-3 top-8 rounded-2xl bg-cta px-4 py-2.5 shadow-btn-hover">
            <span className="text-sm font-bold text-ink-900">Équipe NexClean</span>
          </div>
        </Reveal>

        <div>
          <Reveal>
            <SectionLabel className="mb-5">Pourquoi NexClean</SectionLabel>
            <h2 className="font-display font-bold text-3xl sm:text-5xl text-ink-900 mb-5">
              Une organisation pensée pour <span className="highlight">la qualité</span>
            </h2>
            <p className="text-ink-600 text-lg mb-10">
              Chaque intervention suit la même méthode : état des lieux, devis clair, planification, intervention et contrôle.
            </p>
          </Reveal>
          <Stagger className="grid sm:grid-cols-2 gap-4">
            {WHY_US.map((item) => {
              const Icon = Icons[item.icon] || LucideIcons.Sparkles;
              return (
                <StaggerItem
                  key={item.title}
                  className="group rounded-2xl border border-ink-100 bg-ink-50/50 p-5 hover:bg-white hover:border-brand-200 hover:shadow-card-hover transition-all duration-300"
                >
                  <div className="w-11 h-11 rounded-xl bg-brand-100 group-hover:bg-cta flex items-center justify-center mb-4 transition-colors">
                    <Icon className="w-5 h-5 text-brand-700 group-hover:text-ink-900" strokeWidth={2} />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-ink-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-ink-600 leading-relaxed">{item.description}</p>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
