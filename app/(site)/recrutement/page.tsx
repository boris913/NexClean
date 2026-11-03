import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Briefcase, Users, ShieldCheck, Clock, Heart, ArrowRight, Building2, UserPlus } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import { jobs, openJobs } from '@/content/jobs-data';
import { pageMetadata } from '@/lib/seo';
import { MENTION_GRATUITE } from '@/lib/candidats/domaine';

export const metadata: Metadata = pageMetadata({
  title: 'Recrutement — Rejoignez-nous au Cameroun',
  description:
    "NexClean recrute à Douala : agents de nettoyage, chefs d'équipe, agents espaces verts, commerciaux, community managers, agents de caisse, stages. Créez votre profil candidat et postulez en ligne, gratuitement.",
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
        <Button href="/candidat/inscription" variant="primary" size="lg">
          Créer mon profil candidat
        </Button>
        <Button href="/candidat/connexion" variant="secondary" size="lg">
          Espace candidat
        </Button>
      </PageHero>

      <section id="placement" className="py-12 bg-brand-50 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white border border-brand-100 shadow-card p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-6">
            <Building2 className="w-10 h-10 text-primary flex-shrink-0" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Recrutement &amp; placement de personnel</p>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-ink-900 mb-2">Vous cherchez du personnel ?</h2>
              <p className="text-slate-600">
                Entreprises, hôtels, restaurants, commerces ou particuliers : décrivez votre besoin, nous sélectionnons et vous présentons des candidats.
                Estimation immédiate, paiement selon les placements réalisés.
              </p>
            </div>
            <Button href="/recrutement/demander-du-personnel" variant="primary" size="lg" icon={ArrowRight} iconPosition="right">
              Demander du personnel
            </Button>
          </div>
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink-900 mb-8">
            Ce que nous attendons
          </h2>
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
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink-900 mb-2">
            Offres
          </h2>
          <p className="text-slate-500 mb-8">
            {openJobs.length > 0
              ? `${openJobs.length} offre(s) ouverte(s). Cliquez sur une offre pour en voir le détail complet.`
              : 'Aucune offre ouverte pour le moment : créez votre profil candidat pour être contacté(e) dès qu’une offre vous correspond.'}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {sortedJobs.map((job) => (
              <Link
                key={job.slug}
                href={`/recrutement/${job.slug}`}
                className={`group flex flex-col rounded-2xl border bg-white p-6 transition-all duration-200 ${
                  job.status === 'open'
                    ? 'border-slate-100 shadow-card hover:shadow-card-hover hover:border-brand-200 hover:-translate-y-0.5'
                    : 'border-slate-100 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                    {job.title}
                  </h3>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                      job.status === 'open'
                        ? 'bg-green-50 text-green-700 border border-green-100'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {job.status === 'open' ? 'Ouvert' : 'Pourvue'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-3">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {job.location}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    {job.contract}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-3">{job.description}</p>
                <ul className="text-sm text-slate-500 list-disc pl-5 space-y-1">
                  {job.requirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-4">
                  {job.status === 'open' ? 'Voir l’offre et postuler' : 'Voir l’offre'}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="candidature" className="py-16 sm:py-20 bg-white scroll-mt-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-6 sm:p-8 text-center">
            <UserPlus className="w-10 h-10 text-primary mx-auto mb-3" strokeWidth={1.5} />
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink-900 mb-2">Créer mon profil candidat</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Pas d’offre qui vous correspond ? Inscrivez-vous une fois : nos conseillers vous contactent dès qu’un poste correspond à votre profil.
            </p>
            <p className="text-sm font-semibold text-ink-900 mt-3">{MENTION_GRATUITE}</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button href="/candidat/inscription" variant="primary" size="lg">
                Créer mon profil candidat
              </Button>
              <Button href="/candidat/connexion" variant="secondary" size="lg">
                Se connecter
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}