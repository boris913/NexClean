import SectionLabel from '@/components/ui/SectionLabel';
import Button from '@/components/ui/Button';
import { getWhatsAppLink } from '@/lib/constants';
import { MessageCircle, Calendar, Sparkles, CheckCircle, ArrowRight } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: MessageCircle,
    title: 'Contactez-nous',
    description: 'Via WhatsApp, téléphone ou formulaire. Décrivez vos besoins et obtenez un devis immédiat.',
  },
  {
    number: '02',
    icon: Calendar,
    title: 'Planifiez',
    description: "Choisissez la date et l'heure qui vous conviennent. Nous nous adaptons à votre planning.",
  },
  {
    number: '03',
    icon: Sparkles,
    title: 'On intervient',
    description: "Notre équipe arrive à l'heure avec tout le matériel professionnel nécessaire.",
  },
  {
    number: '04',
    icon: CheckCircle,
    title: 'Vous validez',
    description: "Inspection ensemble. Paiement seulement si vous êtes entièrement satisfait.",
  },
];

export default function ProcessSection() {
  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <SectionLabel className="mb-4">Comment ça marche</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-3">
            Simple et efficace
          </h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Un processus en 4 étapes pensé pour votre tranquillité.
          </p>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-14">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Connector line on desktop */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-[calc(100%-12px)] right-[-12px] h-px bg-slate-200 z-0" />
              )}

              <div className="relative z-10">
                {/* Number + Icon */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-slate-300 font-mono tabular-nums">
                    {step.number}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                    <step.icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                  </div>
                </div>

                <h3 className="text-base font-semibold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button
            href={getWhatsAppLink()}
            variant="primary"
            size="lg"
            icon={ArrowRight}
            iconPosition="right"
          >
            Démarrer maintenant
          </Button>
          <p className="text-xs text-slate-400 mt-3">Devis gratuit · Réponse sous 1 heure</p>
        </div>
      </div>
    </section>
  );
}
