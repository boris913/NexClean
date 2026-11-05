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

      <ol className="mb-10 grid gap-x-8 border-b border-ink-200 sm:mb-14 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-baseline gap-4 border-t border-ink-200 py-3 text-body text-ink-900">
            <span aria-hidden="true" className="font-mono text-small tabular-nums text-primary">
              {String(i + 1).padStart(2, '0')}
            </span>
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
      <p className="mt-6 text-small text-muted">Moyens de paiement acceptés : {PAYMENT_TERMS.methods.join(' · ')}</p>
    </Section>
  );
}
