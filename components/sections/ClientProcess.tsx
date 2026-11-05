import Card from '@/components/ui/Card';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { BRAND, PAYMENT_TERMS } from '@/lib/constants';

/** Processus client complet (cahier des charges §12) et conditions de paiement. */
const STEPS = [
  'Demande',
  'État des lieux / analyse',
  'Devis',
  'Validation & acompte si applicable',
  'Planification',
  'Intervention',
  'Contrôle qualité',
  'Solde selon conditions',
  'Satisfaction & fidélisation',
];

interface ClientProcessProps {
  eyebrow?: string;
  title?: string;
}

export default function ClientProcess({ eyebrow = 'Processus & paiement', title = 'De la demande au suivi' }: ClientProcessProps) {
  return (
    <Section id="processus-client" tone="muted" labelledBy="processus-client-titre" className="scroll-mt-20">
      <SectionHeader id="processus-client-titre" eyebrow={eyebrow} title={title} />

      <ol className="mb-10 flex flex-wrap justify-center gap-2 sm:mb-14">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-2 rounded-full border border-ink-200 bg-white py-1.5 pl-1.5 pr-4 text-small text-ink-700">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cta text-xs font-bold text-ink-900">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 md:grid-cols-3">
        {[
          { title: 'Prestation ponctuelle', text: PAYMENT_TERMS.ponctuel },
          { title: 'Abonnement', text: PAYMENT_TERMS.abonnement },
          { title: `Produits ${BRAND.name}`, text: PAYMENT_TERMS.produits },
        ].map((t) => (
          <Card key={t.title}>
            <h3 className="mb-2 font-display text-h3 text-ink-900">{t.title}</h3>
            <p className="text-small text-ink-600">{t.text}</p>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-center text-small text-muted">Moyens de paiement acceptés : {PAYMENT_TERMS.methods.join(' · ')}</p>
    </Section>
  );
}
