import Image from 'next/image';
import { ClipboardCheck, FileText, MessageCircle, UserCheck, type LucideIcon } from 'lucide-react';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
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
          <div className="relative aspect-[3/4] overflow-hidden rounded-card">
            <Image
              src="/images/team/equipe-nexclean.jpg"
              alt="L'équipe NEXCLEAN SARL"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 50vw, 220px"
            />
          </div>
          <div className="relative aspect-[3/4] overflow-hidden rounded-card">
            <Image
              src="/images/team/equipe-nexclean4.jpeg"
              alt="Matériel NEXCLEAN en intervention"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 50vw, 220px"
            />
          </div>
        </div>

        <div>
          <SectionHeader
            id="pourquoi-nexclean-titre"
            eyebrow="Pourquoi NEXCLEAN"
            title="Notre méthode"
            intro="Propreté, recrutement ou espaces verts : chaque demande a un référent, un devis écrit et un suivi en ligne."
            className="!mb-8"
          />
          <Stagger className="grid gap-4 sm:grid-cols-2">
            {WHY_US.map((item) => (
              <StaggerItem key={item.title}>
                <Card padding="sm" className="h-full">
                  <IconBadge icon={ICONES[item.icon] ?? ClipboardCheck} className="mb-4" />
                  <h3 className="mb-1 text-h3 text-ink-900">{item.title}</h3>
                  <p className="text-small text-ink-600">{item.description}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </Section>
  );
}
