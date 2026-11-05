import { Search, FileText, Calendar, SprayCan, ClipboardCheck, Repeat } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import { Stagger, StaggerItem } from '@/components/ui/Reveal';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { WHATSAPP_MESSAGE_SERVICE, getWhatsAppLink } from '@/lib/constants';

const steps = [
  { icon: Search, title: 'État des lieux', description: 'Photos sur WhatsApp ou visite sur place pour comprendre votre besoin.' },
  { icon: FileText, title: 'Devis', description: "Un devis clair, adapté à la surface, à l'état et à la fréquence." },
  { icon: Calendar, title: 'Planification', description: "Nous fixons ensemble la date et l'heure de l'intervention." },
  { icon: SprayCan, title: 'Intervention', description: "Notre équipe intervient avec le matériel et les produits adaptés." },
  { icon: ClipboardCheck, title: 'Contrôle', description: "Vérification du résultat en fin d'intervention, avec vous si possible." },
  { icon: Repeat, title: 'Suivi', description: "Retour sur votre satisfaction et proposition d'entretien régulier." },
];

interface ProcessSectionProps {
  /** Message WhatsApp du bouton ; par défaut, le message « service ». */
  whatsappMessage?: string;
}

/** Déroulé d'une intervention de propreté, en 6 étapes. */
export default function ProcessSection({ whatsappMessage = WHATSAPP_MESSAGE_SERVICE }: ProcessSectionProps) {
  return (
    <Section id="processus" tone="muted" labelledBy="processus-titre" className="scroll-mt-20">
      <SectionHeader
        id="processus-titre"
        align="center"
        pillar="proprete"
        eyebrow="Comment ça marche"
        title="Comment se déroule une intervention"
        intro="De la première demande au suivi après intervention."
      />

      <Stagger as="ol" className="mb-10 grid gap-6 sm:mb-14 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => (
          <StaggerItem as="li" key={step.title}>
            <Card className="h-full overflow-hidden">
              <span aria-hidden="true" className="absolute right-5 top-3 font-display text-display text-brand-100">
                {index + 1}
              </span>
              <IconBadge icon={step.icon} tone="proprete" className="relative mb-5 self-start" />
              <h3 className="relative font-display text-h3 text-ink-900">{step.title}</h3>
              <p className="relative mt-2 text-small text-ink-600">{step.description}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="text-center">
        <Button href={getWhatsAppLink(whatsappMessage)} size="lg" whatsappIcon>
          Démarrer ma demande
        </Button>
      </div>
    </Section>
  );
}
