import { ClipboardCheck, FileText, MessageCircle, UserCheck, type LucideIcon } from 'lucide-react';
import PhotoTraitee from '@/components/ui/PhotoTraitee';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { Stagger, StaggerItem } from '@/components/ui/Reveal';
import { WHY_US } from '@/lib/constants';

/** `WHY_US` nomme ses icônes par des chaînes : table explicite, pour garder des imports nommés. */
const ICONES: Record<string, LucideIcon> = { ClipboardCheck, FileText, MessageCircle, UserCheck };

/** La méthode commune à toutes les demandes : propreté, recrutement, espaces verts. */
export default function WhyUsSection() {
  return (
    <Section id="pourquoi-nexclean" labelledBy="pourquoi-nexclean-titre" className="scroll-mt-20">
      <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="grid grid-cols-2 gap-3">
          <PhotoTraitee
            src="/images/team/equipe-nexclean.jpg"
            alt="L'équipe NEXCLEAN SARL"
            traitement="douce"
            cadrage="object-top"
            sizes="(max-width: 1024px) 50vw, 220px"
            className="aspect-[3/4]"
          />
          <PhotoTraitee
            src="/images/team/equipe-nexclean4.jpeg"
            alt="Matériel NEXCLEAN en intervention"
            legende="Sur le terrain"
            sizes="(max-width: 1024px) 50vw, 220px"
            className="aspect-[3/4]"
          />
        </div>

        <div>
          <SectionHeader
            id="pourquoi-nexclean-titre"
            eyebrow="Pourquoi NEXCLEAN"
            title="Notre méthode"
            intro="Propreté, recrutement ou espaces verts : chaque demande a un référent, un devis écrit et un suivi en ligne."
            className="!mb-8"
          />
          <Stagger as="ol" className="grid gap-x-8 sm:grid-cols-2">
            {WHY_US.map((item) => {
              const Icone = ICONES[item.icon] ?? ClipboardCheck;
              return (
                <StaggerItem as="li" key={item.title} className="border-t border-ink-200 py-5">
                  <Icone className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
                  <h3 className="mb-1 text-h3 text-ink-900">{item.title}</h3>
                  <p className="text-small text-ink-600">{item.description}</p>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </div>
    </Section>
  );
}
