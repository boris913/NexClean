import Link from 'next/link';
import { Home, Building2, ArrowRight, Check } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';

const paths = [
  {
    href: '/particuliers',
    icon: Home,
    title: 'Particuliers',
    text: 'Maisons, appartements, studios : entretien, grand nettoyage, emménagement, vitres.',
    points: ['Devis rapide avec photos sur WhatsApp', 'Ponctuel ou abonnement', 'Matériel et produits fournis'],
    cta: 'Espace particuliers',
    dark: false,
  },
  {
    href: '/professionnels',
    icon: Building2,
    title: 'Professionnels',
    text: 'Bureaux, commerces, hôtels, restaurants, résidences, administrations, chantiers.',
    points: ['Visite technique avant devis', 'Horaires adaptés à votre activité', "Contrats d'entretien réguliers"],
    cta: 'Espace professionnels',
    dark: true,
  },
];

export default function AudienceSection() {
  return (
    <section className="py-20 sm:py-28 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-ink-900 mb-12 text-center">
            Vous êtes <span className="highlight">particulier</span> ou <span className="highlight">professionnel</span>&nbsp;?
          </h2>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-5">
          {paths.map((p, i) => (
            <Reveal key={p.href} delay={i * 0.12} from={i === 0 ? 'left' : 'right'}>
              <Link
                href={p.href}
                className={`group relative flex h-full flex-col overflow-hidden rounded-[2rem] p-7 sm:p-10 transition-all duration-500 hover:-translate-y-1 ${
                  p.dark ? 'bg-ink-900 text-white hover:shadow-[0_30px_60px_-20px_rgba(19,26,18,0.6)]' : 'bg-brand-100 text-ink-900 hover:shadow-card-hover'
                }`}
              >
                <div
                  aria-hidden="true"
                  className={`absolute -right-16 -bottom-16 w-64 h-64 rounded-full blur-2xl transition-transform duration-700 group-hover:scale-125 ${
                    p.dark ? 'bg-brand-500/30' : 'bg-brand-300/70'
                  }`}
                />
                <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${p.dark ? 'bg-cta text-ink-900' : 'bg-white text-brand-700'}`}>
                  <p.icon className="w-7 h-7" strokeWidth={1.75} />
                </div>
                <h3 className="relative font-display text-2xl sm:text-3xl font-bold mb-3">{p.title}</h3>
                <p className={`relative mb-6 ${p.dark ? 'text-ink-300' : 'text-ink-700'}`}>{p.text}</p>
                <ul className="relative space-y-2.5 mb-8">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-center gap-2.5 text-sm font-medium">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center ${p.dark ? 'bg-brand-400' : 'bg-white'}`}>
                        <Check className={`w-3 h-3 ${p.dark ? 'text-ink-900' : 'text-brand-700'}`} strokeWidth={3} />
                      </span>
                      {pt}
                    </li>
                  ))}
                </ul>
                <span
                  className={`relative mt-auto inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-colors ${
                    p.dark ? 'bg-cta text-ink-900 group-hover:bg-brand-300' : 'bg-ink-900 text-white group-hover:bg-brand-800'
                  }`}
                >
                  {p.cta}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
