// Fiche d'une offre (content/jobs-data.ts, ADR 0023) et candidature (MVP2-02 RG-07, RG-12).
// Rendue à la demande : l'encadré « Postuler » dépend de la session candidat.
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
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Container from '@/components/ui/Container';
import JsonLd from '@/components/ui/JsonLd';
import PageHero from '@/components/ui/PageHero';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { getJobBySlug, openJobs } from '@/content/jobs-data';
import { jobPostingSchema, pageMetadata } from '@/lib/seo';
import { listesLieux, type ListesLieux } from '@/lib/geo/service';
import { candidatConnecte } from '@/lib/candidats/session';
import { aDejaPostule } from '@/lib/candidats/candidatures';
import { LIBELLE_OFFRE_POURVUE } from '@/lib/candidats/formulaire-candidature';
import Postuler from './Postuler';

export const dynamic = 'force-dynamic';

/** Base injoignable : la fiche reste lisible, le formulaire passe en saisie libre (et en repli WhatsApp). */
async function contexteCandidature(slug: string): Promise<{ listes: ListesLieux; connecte: { prenom: string } | null; dejaPostule: boolean }> {
  const [listes, session] = await Promise.all([listesLieux().catch(() => [] as ListesLieux), candidatConnecte().catch(() => null)]);
  const dejaPostule = session ? await aDejaPostule(session.id, slug).catch(() => false) : false;
  return { listes, connecte: session ? { prenom: session.prenom } : null, dejaPostule };
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
    title: `${job.title} — Offre d'emploi`,
    description: job.description.slice(0, 160),
    path: `/recrutement/${slug}`,
  });
  return job.status === 'closed'
    ? { ...meta, robots: { index: false, follow: false } }
    : meta;
}

const titreBloc = 'font-display text-h3 text-ink-900 mb-4';

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
  const schema = jobPostingSchema(job);

  return (
    <>
      {schema && <JsonLd data={schema} />}
      <PageHero
        label={job.status === 'open' ? 'Offre ouverte' : 'Offre fermée'}
        pillar="emploi"
        title={job.title}
        subtitle={job.description}
        breadcrumb={[
          { name: 'Recrutement', href: '/recrutement' },
          { name: job.title },
        ]}
      >
        {job.status === 'open' ? (
          <Button href="#candidature" size="lg">
            Postuler à cette offre
          </Button>
        ) : (
          <Button href="/candidat/inscription" size="lg">
            {LIBELLE_OFFRE_POURVUE}
          </Button>
        )}
        <Button href="/recrutement" variant="outline" size="lg">
          Toutes les offres
        </Button>
      </PageHero>

      {/* Barre meta */}
      <div className="bg-white border-b border-ink-100">
        <Container className="py-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-600">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-pillar-emploi flex-shrink-0" aria-hidden="true" />
              {job.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-pillar-emploi flex-shrink-0" aria-hidden="true" />
              {job.contract}
            </span>
            {job.sector && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-pillar-emploi flex-shrink-0" aria-hidden="true" />
                {job.sector}
              </span>
            )}
            {job.positions && job.positions > 1 && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-4 h-4 text-pillar-emploi flex-shrink-0" aria-hidden="true" />
                {job.positions} postes à pourvoir
              </span>
            )}
            {job.salary?.base && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink-900">
                <Banknote className="w-4 h-4 text-pillar-emploi flex-shrink-0" aria-hidden="true" />
                {job.salary.base}
              </span>
            )}
          </div>
        </Container>
      </div>

      {/* Bandeau offre fermée */}
      {job.status === 'closed' && (
        <div className="bg-warning-soft border-b border-warning-border">
          <Container className="py-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-ink-800">
              Cette offre est pourvue.{' '}
              <Link href="/candidat/inscription" className="font-semibold underline">
                Inscrivez-vous gratuitement
              </Link>{' '}
              pour être contacté(e) dès qu’une offre correspond à votre profil.
            </p>
          </Container>
        </div>
      )}

      {/* Contenu principal + salaire */}
      <Section spacing="sm">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10">
            {job.intro && <p className="text-lead text-ink-700">{job.intro}</p>}

            {job.missions && job.missions.length > 0 && (
              <div>
                <h2 className={titreBloc}>Vos missions</h2>
                <ul className="space-y-2.5">
                  {job.missions.map((m, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-ink-700">
                      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-1" strokeWidth={2.5} aria-hidden="true" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profileItems.length > 0 && (
              <div>
                <h2 className={titreBloc}>Profil recherché</h2>
                <ul className="space-y-2.5">
                  {profileItems.map((p, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-ink-700">
                      <CheckCircle2 className="w-4 h-4 text-pillar-emploi flex-shrink-0 mt-1" strokeWidth={2.5} aria-hidden="true" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {job.schedule && job.schedule.length > 0 && (
              <div>
                <h2 className={titreBloc}>Horaires</h2>
                <ul className="space-y-2 text-ink-700">
                  {job.schedule.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-pillar-emploi flex-shrink-0 mt-1" aria-hidden="true" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sidebar rémunération */}
          {job.salary && (
            <aside className="lg:sticky lg:top-24 self-start w-full">
              <Card variant="pillar" pillar="emploi" padding="sm">
                <div className="flex items-center gap-2 mb-4">
                  <Banknote className="w-5 h-5 text-pillar-emploi" aria-hidden="true" />
                  <h2 className="font-display text-h3 text-ink-900">Rémunération</h2>
                </div>
                {job.salary.base && (
                  <div className="mb-4">
                    <p className="text-xs text-muted">{job.salary.fixed ? 'Salaire fixe' : 'Salaire de base'}</p>
                    <p className="text-lg font-bold text-ink-900">{job.salary.base}</p>
                  </div>
                )}
                {job.salary.bonus && (
                  <div className="mb-4">
                    <p className="text-xs text-muted">Prime sur objectifs</p>
                    <p className="text-sm font-semibold text-success">{job.salary.bonus}</p>
                  </div>
                )}
                {job.salary.target && (
                  <div className="pt-4 border-t border-ink-100">
                    <p className="text-xs text-muted">Rémunération cible</p>
                    <p className="text-xl font-extrabold text-primary">{job.salary.target}</p>
                  </div>
                )}
                {job.salary.note && <p className="text-xs text-muted mt-4 leading-relaxed">{job.salary.note}</p>}
              </Card>
            </aside>
          )}
        </div>
      </Section>

      {/* Candidature (offres ouvertes) ; offre pourvue : inscription au vivier */}
      {job.status === 'open' ? (
        <Section id="candidature" tone="muted" container="narrow" labelledBy="postuler-titre" className="scroll-mt-24">
          <SectionHeader id="postuler-titre" align="center" title="Postuler à cette offre" intro="Quelques minutes suffisent. Vos données ne sont jamais publiées." className="!mb-8" />
          <Postuler offre={{ slug: job.slug, titre: job.title }} metier={job.category === 'Candidature spontanée' ? '' : job.category} {...await contexteCandidature(job.slug)} />
        </Section>
      ) : (
        <Section id="candidature" tone="muted" spacing="sm" container="narrow" labelledBy="pourvue-titre" className="scroll-mt-24 text-center">
          <SectionHeader id="pourvue-titre" align="center" title="Offre pourvue" intro="Créez votre profil candidat : un conseiller vous contacte dès qu’une offre vous correspond. C’est gratuit." className="!mb-6" />
          <Button href="/candidat/inscription" size="lg">
            {LIBELLE_OFFRE_POURVUE}
          </Button>
        </Section>
      )}

      {/* Autres offres ouvertes */}
      {otherOpenJobs.length > 0 && (
        <Section spacing="sm" labelledBy="autres-offres-titre" className="border-t border-ink-100">
          <SectionHeader id="autres-offres-titre" title="Autres offres" className="!mb-6" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {otherOpenJobs.map((j) => (
              <Card key={j.slug} href={`/recrutement/${j.slug}`} variant="interactive" padding="sm">
                <h3 className="font-display text-h3 text-ink-900 mb-1 transition-colors group-hover:text-primary">{j.title}</h3>
                <p className="text-xs text-muted mb-3 inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" aria-hidden="true" /> {j.location}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-auto">
                  Voir l&apos;offre
                  <ArrowRight className="w-3.5 h-3.5 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Card>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
