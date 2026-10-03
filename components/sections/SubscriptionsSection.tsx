import { CalendarCheck, Home, Building2, Trees, Check, ArrowRight } from 'lucide-react';
import SectionLabel from '@/components/ui/SectionLabel';
import Button from '@/components/ui/Button';
import { getWhatsAppLink, PAYMENT_TERMS } from '@/lib/constants';

export const subscriptionPlans = [
  {
    icon: Home,
    name: 'Particuliers',
    price: 'À partir de 30 000 FCFA/mois',
    points: ['4 ou 8 passages par mois', 'Même équipe autant que possible', 'Tarif préférentiel'],
    message: "Bonjour NexClean, je souhaite un abonnement d'entretien pour mon logement.",
  },
  {
    icon: Building2,
    name: 'Professionnels',
    price: 'À partir de 50 000 FCFA/mois',
    points: ['Fréquence adaptée à votre activité', 'Horaires hors affluence possibles', 'Contrat sur mesure multi-sites'],
    message: "Bonjour NexClean, je souhaite un contrat d'entretien régulier pour mes locaux.",
  },
  {
    icon: Trees,
    name: 'Espaces verts',
    price: 'Sur devis après état des lieux',
    points: ['Tonte et désherbage réguliers', 'Taille de haies planifiée', 'Ramassage des déchets verts'],
    message: "Bonjour NexClean, je souhaite un contrat d'entretien régulier de mon espace vert.",
  },
];

export default function SubscriptionsSection({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <section id="abonnements" className="py-20 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {withHeader && (
          <div className="mb-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <SectionLabel className="mb-4">Abonnements</SectionLabel>
              <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-3">L&apos;entretien régulier, sans y penser</h2>
              <p className="text-slate-500 max-w-lg">Des passages planifiés à l&apos;avance, à un tarif préférentiel.</p>
            </div>
            <Button href="/abonnements" variant="secondary" size="md" icon={ArrowRight} iconPosition="right">
              Détail des formules
            </Button>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-5">
          {subscriptionPlans.map((plan) => (
            <div key={plan.name} className="flex flex-col rounded-2xl border border-slate-100 p-6 shadow-card">
              <div className="w-11 h-11 rounded-xl bg-primary-light flex items-center justify-center mb-4">
                <plan.icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
              <p className="text-success font-semibold mb-4">{plan.price}</p>
              <ul className="space-y-2 mb-6">
                {plan.points.map((pt) => (
                  <li key={pt} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-3.5 h-3.5 text-success flex-shrink-0" strokeWidth={2.5} />
                    {pt}
                  </li>
                ))}
              </ul>
              <Button href={getWhatsAppLink(plan.message)} variant="secondary" size="md" fullWidth className="mt-auto">
                Demander cette formule
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-5">
          <CalendarCheck className="w-5 h-5 text-primary flex-shrink-0" />
          <p className="text-sm text-slate-600 flex-1">
            Besoin d&apos;une formule personnalisée ? Nous construisons le planning avec vous. Tarifs indicatifs : le prix final dépend de la surface, de l&apos;état et de la fréquence. {PAYMENT_TERMS.abonnement}
          </p>
          <Button
            href={getWhatsAppLink('Bonjour NexClean, je souhaite une formule d\'abonnement personnalisée.')}
            variant="ghost"
            size="sm"
            icon={ArrowRight}
            iconPosition="right"
          >
            Formule sur mesure
          </Button>
        </div>
      </div>
    </section>
  );
}
