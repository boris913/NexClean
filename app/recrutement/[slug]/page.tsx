import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  Briefcase,
  Banknote,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import ApplicationForm from '../ApplicationForm';
import { jobs, getJobBySlug, openJobs } from '@/content/jobs-data';
import { pageMetadata } from '@/lib/seo';

export function generateStaticParams() {
  return jobs.map((j) => ({ slug: j.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = getJobBySlug(slug);
  if (!job) return {};
  const meta = pageMetadata({
    title: `${job.title} — Recrutement`,
    description: job.description.slice(0, 160),
    path: `/recrutement/${slug}`,
  });
  return job.status === 'closed'
    ? { ...meta, robots: { index: false, follow: false } }
    : meta;
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = getJobBySlug(slug);
  if (!job) notFound();

  const otherOpenJobs = openJobs.filter((j) => j.slug !== job.slug).slice(0, 3);
  const profileItems = job.profile ?? job.requirements;

  return (
    <>
      <PageHero
        label={job.status === 'open' ? 'Offre ouverte' : 'Offre fermée'}
        title={job.title}
        subtitle={job.description}
        breadcrumb={[
          { name: 'Recrutement', href: '/recrutement' },
          { name: job.title },
        ]}
      >
        {job.status === 'open' && (
          <Button href="#candidature" variant="primary" size="lg">
            Postuler à cette offre
          </Button>
        )}
        <Button href="/recrutement" variant="secondary" size="lg">
          Toutes les offres
        </Button>
      </PageHero>

      {/* Barre meta */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
              {job.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-primary flex-shrink-0" />
              {job.contract}
            </span>
            {job.sector && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-primary flex-shrink-0" />
                {job.sector}
              </span>
            )}
            {job.positions && job.positions > 1 && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary flex-shrink-0" />
                {job.positions} postes à pourvoir
              </span>
            )}
            {job.salary?.base && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink-900">
                <Banknote className="w-4 h-4 text-primary flex-shrink-0" />
                {job.salary.base}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Bandeau offre fermée */}
      {job.status === 'closed' && (
        <section className="bg-amber-50 border-b border-amber-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900">
              Cette offre est actuellement fermée. Vous pouvez néanmoins déposer une{' '}
              <Link href="/recrutement#candidature" className="font-semibold underline">
                candidature spontanée
              </Link>
              .
            </p>
          </div>
        </section>
      )}

      {/* Contenu principal + salaire */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_320px] gap-10">
          <div className="space-y-10">
            {job.intro && (
              <p className="text-slate-700 leading-relaxed text-lg">{job.intro}</p>
            )}

            {job.missions && job.missions.length > 0 && (
              <div>
                <h2 className="font-display font-bold text-2xl text-ink-900 mb-4">
                  Vos missions
                </h2>
                <ul className="space-y-2.5">
                  {job.missions.map((m, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-slate-700">
                      <CheckCircle2
                        className="w-4 h-4 text-success flex-shrink-0 mt-1"
                        strokeWidth={2.5}
                      />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profileItems.length > 0 && (
              <div>
                <h2 className="font-display font-bold text-2xl text-ink-900 mb-4">
                  Profil recherché
                </h2>
                <ul className="space-y-2.5">
                  {profileItems.map((p, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-slate-700">
                      <CheckCircle2
                        className="w-4 h-4 text-primary flex-shrink-0 mt-1"
                        strokeWidth={2.5}
                      />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {job.schedule && job.schedule.length > 0 && (
              <div>
                <h2 className="font-display font-bold text-2xl text-ink-900 mb-4">
                  Horaires
                </h2>
                <ul className="space-y-2 text-slate-700">
                  {job.schedule.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sidebar rémunération */}
          {job.salary && (
            <aside className="lg:sticky lg:top-24 self-start">
              <div className="rounded-2xl border border-brand-100 bg-brand-50 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Banknote className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-ink-900">Rémunération</h2>
                </div>
                {job.salary.base && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-500">
                      {job.salary.fixed ? 'Salaire fixe' : 'Salaire de base'}
                    </p>
                    <p className="text-lg font-bold text-ink-900">{job.salary.base}</p>
                  </div>
                )}
                {job.salary.bonus && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-500">Prime sur objectifs</p>
                    <p className="text-sm font-semibold text-success">{job.salary.bonus}</p>
                  </div>
                )}
                {job.salary.target && (
                  <div className="pt-4 border-t border-brand-200">
                    <p className="text-xs text-slate-500">Rémunération cible</p>
                    <p className="text-xl font-extrabold text-primary">{job.salary.target}</p>
                  </div>
                )}
                {job.salary.note && (
                  <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                    {job.salary.note}
                  </p>
                )}
              </div>
            </aside>
          )}
        </div>
      </section>

      {/* Formulaire de candidature (offres ouvertes uniquement) */}
      {job.status === 'open' && (
        <section
          id="candidature"
          className="py-16 sm:py-20 bg-slate-50 scroll-mt-24"
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink-900 mb-2">
                Postuler à cette offre
              </h2>
              <p className="text-slate-500">
                Quelques minutes suffisent. Vos données ne sont jamais publiées.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 lg:p-8">
              <ApplicationForm defaultPosition={job.category} />
            </div>
          </div>
        </section>
      )}

      {/* Autres offres ouvertes */}
      {otherOpenJobs.length > 0 && (
        <section className="py-12 sm:py-16 bg-white border-t border-slate-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display font-bold text-2xl text-ink-900 mb-6">
              Autres offres
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {otherOpenJobs.map((j) => (
                <Link
                  key={j.slug}
                  href={`/recrutement/${j.slug}`}
                  className="group block rounded-2xl border border-slate-100 bg-white p-5 hover:shadow-card-hover hover:border-brand-200 hover:-translate-y-0.5 transition-all"
                >
                  <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-primary transition-colors">
                    {j.title}
                  </h3>
                  <p className="text-xs text-slate-500 mb-3 inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {j.location}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Voir l&apos;offre
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}