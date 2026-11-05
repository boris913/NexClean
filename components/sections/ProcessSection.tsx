import { Search, FileText, Calendar, SprayCan, ClipboardCheck, Repeat } from 'lucide-react';
import Button from '@/components/ui/Button';
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
        pillar="proprete"
        eyebrow="Comment ça marche"
        title="Comment se déroule une intervention"
        intro="De la première demande au suivi après intervention."
      />

      <Stagger as="ol" className="mb-10 grid gap-x-8 sm:mb-14 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => (
          <StaggerItem as="li" key={step.title} className="border-t border-ink-200 py-6">
            <div className="flex items-center justify-between">
              <span aria-hidden="true" className="font-mono text-h3 tabular-nums text-pillar-proprete">
                {String(index + 1).padStart(2, '0')}
              </span>
              <step.icon className="h-5 w-5 text-pillar-proprete" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-h3 text-ink-900">{step.title}</h3>
            <p className="mt-2 text-small text-ink-600">{step.description}</p>
          </StaggerItem>
        ))}
      </Stagger>

      <Button href={getWhatsAppLink(whatsappMessage)} size="lg" whatsappIcon>
        Démarrer ma demande
      </Button>
    </Section>
  );
}
