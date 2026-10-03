import Link from 'next/link';
import { Home, Building2, ArrowRight, Check } from 'lucide-react';

const paths = [
  {
    href: '/particuliers',
    icon: Home,
    title: 'Particuliers',
    text: 'Maisons, appartements, studios : entretien, grand nettoyage, emménagement, vitres.',
    points: ['Devis rapide avec photos sur WhatsApp', 'Ponctuel ou abonnement', 'Matériel et produits fournis'],
    cta: 'Espace particuliers',
  },
  {
    href: '/professionnels',
    icon: Building2,
    title: 'Professionnels',
    text: 'Bureaux, commerces, hôtels, restaurants, résidences, administrations, chantiers.',
    points: ['Visite technique avant devis', 'Horaires adaptés à votre activité', 'Contrats d\'entretien réguliers'],
    cta: 'Espace professionnels',
  },
];

export default function AudienceSection() {
  return (
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-10 text-center">Vous êtes…</h2>
        <div className="grid md:grid-cols-2 gap-5">
          {paths.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-primary-light/40 p-6 sm:p-8 shadow-card hover:shadow-card-hover transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center mb-5">
                <p.icon className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">{p.title}</h3>
              <p className="text-slate-600 mb-5">{p.text}</p>
              <ul className="space-y-2 mb-6">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-success flex-shrink-0" strokeWidth={2.5} />
                    {pt}
                  </li>
                ))}
              </ul>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                {p.cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
