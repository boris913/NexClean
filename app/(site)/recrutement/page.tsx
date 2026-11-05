import type { Metadata } from 'next';
import { MapPin, Briefcase, Users, ShieldCheck, Clock, Heart, ArrowRight, Building2, UserPlus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import PageHero from '@/components/ui/PageHero';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { jobs, openJobs } from '@/content/jobs-data';
import { lireCouverture } from '@/lib/geo/couverture';
import { pageMetadata } from '@/lib/seo';
import { MENTION_GRATUITE } from '@/lib/candidats/domaine';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: `Offres d'emploi à ${villes} — Recrutement`,
    description: `Offres d'emploi NEXCLEAN à ${villes} : postes chez nos clients et chez NEXCLEAN. Créez votre profil candidat et postulez en ligne, gratuitement.`,
    path: '/recrutement',
  });
}

const values = [
  { icon: Clock, title: 'Ponctualité', text: 'Vos futurs employeurs comptent sur vous à l’heure prévue.' },
  { icon: ShieldCheck, title: 'Honnêteté & discrétion', text: 'Vous travaillerez chez des particuliers et des entreprises.' },
  { icon: Users, title: 'Esprit d’équipe', text: 'Vous rejoindrez une équipe en place.' },
  { icon: Heart, title: 'Soin du détail', text: 'La qualité de votre travail fait votre réputation.' },
];

export default function RecrutementPage() {
  const sortedJobs = [...openJobs, ...jobs.filter((j) => j.status === 'closed')];

  return (
    <>
      <PageHero
        label="Emploi"
        pillar="emploi"
        title="Offres d'emploi et candidature"
        subtitle="Consultez les offres en cours, postulez en ligne et créez votre profil candidat. L'inscription, la candidature et la mise en relation sont gratuites."
        breadcrumb={[{ name: 'Recrutement' }]}
      >
        <Button href="/candidat/inscription" size="lg">
          Créer mon profil candidat
        </Button>
        <Button href="/candidat/connexion" variant="outline" size="lg">
          Se connecter
        </Button>
        <Button href="/recrutement/demander-du-personnel" variant="ghost" size="lg" icon={ArrowRight} iconPosition="right">
          Demander du personnel
        </Button>
      </PageHero>

      <Section tone="muted" labelledBy="offres-titre">
        <SectionHeader
          id="offres-titre"
          title="Les offres en cours"
          intro={
            openJobs.length > 0
              ? `${openJobs.length} offre(s) ouverte(s). Cliquez sur une offre pour en voir le détail complet.`
              : 'Aucune offre ouverte pour le moment : créez votre profil candidat pour être contacté(e) dès qu’une offre vous correspond.'
          }
          className="!mb-8"
        />
        <div className="grid gap-6 md:grid-cols-2">
          {sortedJobs.map((job) => (
            <Card key={job.slug} href={`/recrutement/${job.slug}`} variant={job.status === 'open' ? 'interactive' : 'default'} padding="sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-display text-h3 text-ink-900 transition-colors group-hover:text-primary">{job.title}</h3>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                    job.status === 'open' ? 'bg-success-soft text-success border border-success-border' : 'bg-ink-100 text-ink-600'
                  }`}
                >
                  {job.status === 'open' ? 'Ouvert' : 'Pourvue'}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted mb-3">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                  {job.location}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />
                  {job.contract}
                </span>
              </div>
              <p className="text-small text-ink-600 mb-3">{job.description}</p>
              <ul className="text-small text-muted list-disc pl-5 space-y-1">
                {job.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-auto pt-4">
                {job.status === 'open' ? 'Voir l’offre et postuler' : 'Voir l’offre'}
                <ArrowRight className="w-4 h-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Card>
          ))}
        </div>
      </Section>

      <Section labelledBy="attentes-titre">
        <SectionHeader id="attentes-titre" title="Ce que nous attendons des candidats" className="!mb-8" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => (
            <Card key={v.title} padding="sm">
              <IconBadge icon={v.icon} tone="emploi" className="mb-3" />
              <h3 className="font-display text-h3 text-ink-900 mb-1">{v.title}</h3>
              <p className="text-small text-ink-600">{v.text}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="candidature" tone="brand" container="narrow" labelledBy="candidature-titre" className="scroll-mt-24 text-center">
        <IconBadge icon={UserPlus} tone="emploi" size="lg" className="mb-4" />
        <SectionHeader
          id="candidature-titre"
          align="center"
          title="Créer mon profil candidat"
          intro="Pas d’offre qui vous correspond ? Inscrivez-vous une fois : nos conseillers vous contactent dès qu’un poste correspond à votre profil."
          className="!mb-4"
        />
        <p className="text-sm font-semibold text-ink-900">{MENTION_GRATUITE}</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button href="/candidat/inscription" size="lg">
            Créer mon profil candidat
          </Button>
          <Button href="/candidat/connexion" variant="outline" size="lg">
            Se connecter
          </Button>
        </div>
      </Section>

      <Section id="placement" tone="dark" labelledBy="placement-titre" className="scroll-mt-20">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <IconBadge icon={Building2} tone="dark" size="lg" />
          <SectionHeader
            id="placement-titre"
            tone="dark"
            eyebrow="Recrutement & placement"
            title="Vous cherchez du personnel ?"
            intro="Entreprises et particuliers : décrivez vos postes, nous recherchons et présélectionnons des candidats. Une commission par personne, facturée sur les seuls placements confirmés."
            actions={
              <Button href="/recrutement/demander-du-personnel" size="lg" icon={ArrowRight} iconPosition="right">
                Demander du personnel
              </Button>
            }
            className="!mb-0"
          />
        </div>
      </Section>
    </>
  );
}
