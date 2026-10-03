import SectionLabel from '@/components/ui/SectionLabel';
import Button from '@/components/ui/Button';
import { getWhatsAppLink } from '@/lib/constants';
import { Search, FileText, Calendar, Sparkles, ClipboardCheck, Repeat, ArrowRight } from 'lucide-react';

const steps = [
  { icon: Search, title: 'État des lieux', description: 'Photos sur WhatsApp ou visite sur place pour comprendre votre besoin.' },
  { icon: FileText, title: 'Devis', description: 'Un devis clair, adapté à la surface, à l\'état et à la fréquence.' },
  { icon: Calendar, title: 'Planification', description: 'Nous fixons ensemble la date et l\'heure de l\'intervention.' },
  { icon: Sparkles, title: 'Intervention', description: 'Notre équipe intervient avec le matériel et les produits adaptés.' },
  { icon: ClipboardCheck, title: 'Contrôle', description: 'Vérification du résultat en fin d\'intervention, avec vous si possible.' },
  { icon: Repeat, title: 'Suivi', description: 'Retour sur votre satisfaction et proposition d\'entretien régulier.' },
];

export default function ProcessSection() {
  return (
    <section id="processus" className="py-20 sm:py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <SectionLabel className="mb-4">Comment ça marche</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-3">Une méthode en 6 étapes</h2>
          <p className="text-slate-500 max-w-md mx-auto">De la première demande au suivi après intervention.</p>
        </div>

        <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {steps.map((step, index) => (
            <li key={step.title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-card">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold text-slate-300 font-mono tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                </div>
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>
            </li>
          ))}
        </ol>

        <div className="text-center">
          <Button href={getWhatsAppLink()} variant="primary" size="lg" icon={ArrowRight} iconPosition="right">
            Démarrer ma demande
          </Button>
        </div>
      </div>
    </section>
  );
}
