import SectionLabel from '@/components/ui/SectionLabel';
import { PAYMENT_TERMS } from '@/lib/constants';

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

export default function ClientProcess() {
  return (
    <section id="processus-client" className="py-20 sm:py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <SectionLabel className="mb-4">Processus & paiement</SectionLabel>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-ink-900 mb-3">De la demande au suivi</h2>
        </div>

        <ol className="flex flex-wrap justify-center gap-2 mb-12">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-1.5 pr-4 py-1.5 text-sm text-slate-700">
              <span className="w-6 h-6 rounded-full bg-cta text-ink-900 text-xs font-bold flex items-center justify-center">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: 'Prestation ponctuelle', text: PAYMENT_TERMS.ponctuel },
            { title: 'Abonnement', text: PAYMENT_TERMS.abonnement },
            { title: 'Produits NexClean', text: PAYMENT_TERMS.produits },
          ].map((t) => (
            <div key={t.title} className="rounded-2xl bg-white border border-slate-100 p-6 shadow-card">
              <h3 className="font-semibold text-slate-900 mb-2">{t.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{t.text}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-slate-500 mt-6">
          Moyens de paiement acceptés : {PAYMENT_TERMS.methods.join(' · ')}
        </p>
      </div>
    </section>
  );
}
