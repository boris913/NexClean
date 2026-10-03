import type { Metadata } from 'next';
import { MapPin, Briefcase, Users, ShieldCheck, Clock, Heart } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import ApplicationForm from './ApplicationForm';
import { jobs, openJobs } from '@/content/jobs-data';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Recrutement — Rejoignez-nous au Cameroun',
  description:
    'NexClean recrute à Douala : agents de nettoyage, chefs d\'équipe, agents espaces verts, commerciaux, stages. Déposez votre candidature et votre CV en ligne.',
  path: '/recrutement',
});

const values = [
  { icon: Clock, title: 'Ponctualité', text: 'Nos clients comptent sur nous à l\'heure prévue.' },
  { icon: ShieldCheck, title: 'Honnêteté & discrétion', text: 'Nous intervenons chez des particuliers et des entreprises.' },
  { icon: Users, title: 'Esprit d\'équipe', text: 'Chaque chantier est un travail collectif.' },
  { icon: Heart, title: 'Soin du détail', text: 'La qualité du résultat est notre meilleure publicité.' },
];

export default function RecrutementPage() {
  const sortedJobs = [...openJobs, ...jobs.filter((j) => j.status === 'closed')];

  return (
    <>
      <PageHero
        label="Recrutement"
        title="Rejoignez NexClean SARL"
        subtitle="Nous construisons une équipe sérieuse, formée et fière de son travail. Toutes les candidatures sont centralisées ici : inutile d'envoyer votre CV sur plusieurs numéros."
        breadcrumb={[{ name: 'Recrutement' }]}
      >
        <Button href="#candidature" variant="primary" size="lg">
          Déposer ma candidature
        </Button>
      </PageHero>

      <section className="py-14 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink-900 mb-8">Ce que nous attendons</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {values.map((v) => (
              <div key={v.title} className="rounded-2xl border border-slate-100 p-5 shadow-card">
                <v.icon className="w-6 h-6 text-primary mb-3" strokeWidth={1.75} />
                <h3 className="font-semibold text-slate-900 mb-1">{v.title}</h3>
                <p className="text-sm text-slate-500">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink-900 mb-2">Offres</h2>
          <p className="text-slate-500 mb-8">
            {openJobs.length > 0
              ? `${openJobs.length} offre(s) ouverte(s). Les candidatures spontanées sont toujours les bienvenues.`
              : 'Aucune offre ouverte pour le moment : vous pouvez déposer une candidature spontanée.'}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {sortedJobs.map((job) => (
              <article
                key={job.id}
                className={`rounded-2xl border bg-white p-6 ${job.status === 'open' ? 'border-slate-100 shadow-card' : 'border-slate-100 opacity-70'}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-slate-900">{job.title}</h3>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                      job.status === 'open' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {job.status === 'open' ? 'Ouvert' : 'Fermé'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-3">
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                  <span className="inline-flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{job.contract}</span>
                </div>
                <p className="text-sm text-slate-600 mb-3">{job.description}</p>
                <ul className="text-sm text-slate-500 list-disc pl-5 space-y-1">
                  {job.requirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="candidature" className="py-16 sm:py-20 bg-white scroll-mt-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink-900 mb-2">Déposer ma candidature</h2>
            <p className="text-slate-500">Quelques minutes suffisent. Vos données ne sont jamais publiées.</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 lg:p-8">
            <ApplicationForm />
          </div>
        </div>
      </section>
    </>
  );
}
