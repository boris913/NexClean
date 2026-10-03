import SectionLabel from '@/components/ui/SectionLabel';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import Reveal, { Stagger, StaggerItem } from '@/components/ui/Reveal';
import { getWhatsAppLink } from '@/lib/constants';
import { Search, FileText, Calendar, Sparkles, ClipboardCheck, Repeat } from 'lucide-react';

const steps = [
  { icon: Search, title: 'État des lieux', description: 'Photos sur WhatsApp ou visite sur place pour comprendre votre besoin.' },
  { icon: FileText, title: 'Devis', description: "Un devis clair, adapté à la surface, à l'état et à la fréquence." },
  { icon: Calendar, title: 'Planification', description: "Nous fixons ensemble la date et l'heure de l'intervention." },
  { icon: Sparkles, title: 'Intervention', description: "Notre équipe intervient avec le matériel et les produits adaptés." },
  { icon: ClipboardCheck, title: 'Contrôle', description: "Vérification du résultat en fin d'intervention, avec vous si possible." },
  { icon: Repeat, title: 'Suivi', description: "Retour sur votre satisfaction et proposition d'entretien régulier." },
];

export default function ProcessSection() {
  return (
    <section id="processus" className="py-20 sm:py-28 bg-ink-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-14">
          <SectionLabel className="mb-5">Comment ça marche</SectionLabel>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-ink-900 mb-4">
            Une méthode en <span className="highlight">6 étapes</span>
          </h2>
          <p className="text-ink-600 text-lg max-w-md mx-auto">De la première demande au suivi après intervention.</p>
        </Reveal>

        <Stagger as="ol" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
          {steps.map((step, index) => (
            <StaggerItem
              as="li"
              key={step.title}
              className="group relative overflow-hidden bg-white rounded-3xl p-7 border border-ink-100 hover:border-brand-300 hover:shadow-card-hover transition-all duration-300"
            >
              <span aria-hidden="true" className="absolute right-5 top-3 font-display text-[5.5rem] font-extrabold leading-none text-brand-100 group-hover:text-brand-200 transition-colors">
                {index + 1}
              </span>
              <div className="relative w-12 h-12 rounded-2xl bg-cta flex items-center justify-center mb-5 group-hover:rotate-6 transition-transform duration-300">
                <step.icon className="w-6 h-6 text-ink-900" strokeWidth={2} />
              </div>
              <h3 className="relative font-display text-xl font-semibold text-ink-900 mb-2">{step.title}</h3>
              <p className="relative text-sm text-ink-600 leading-relaxed">{step.description}</p>
            </StaggerItem>
          ))}
        </Stagger>

        <div className="text-center">
          <Button href={getWhatsAppLink()} variant="whatsapp" size="lg">
            <WhatsAppIcon className="w-5 h-5" />
            Démarrer ma demande
          </Button>
        </div>
      </div>
    </section>
  );
}
