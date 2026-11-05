import { ArrowRight, Briefcase, MapPin } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { EMPLOI_EN_TETE } from '@/content/home-data';
import { openJobs } from '@/content/jobs-data';

const NOMBRE_OFFRES = 3;

/** Offres récentes : même source que /recrutement (`content/jobs-data.ts`), dans l'ordre de publication du fichier. */
export default function EmploiSection() {
  const offres = openJobs.slice(0, NOMBRE_OFFRES);
  return (
    <Section id="emploi" labelledBy="emploi-titre" className="scroll-mt-20">
      <SectionHeader
        id="emploi-titre"
        pillar="emploi"
        eyebrow={EMPLOI_EN_TETE.surtitre}
        title={EMPLOI_EN_TETE.titre}
        intro={EMPLOI_EN_TETE.sousTitre}
      />
      {offres.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-3">
          {offres.map((offre) => (
            <Card key={offre.slug} variant="pillar" pillar="emploi" padding="sm" href={`/recrutement/${offre.slug}`}>
              <h3 className="font-display text-h3 text-ink-900">{offre.title}</h3>
              <ul className="mt-3 space-y-1 text-small text-ink-600">
                <li className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  {offre.location}
                </li>
                <li className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  {offre.contract}
                </li>
              </ul>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-pillar-emploi">
                {EMPLOI_EN_TETE.voirOffre}
                <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="max-w-2xl">
          <p className="text-ink-600">{EMPLOI_EN_TETE.aucuneOffre}</p>
        </Card>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button href={EMPLOI_EN_TETE.cta.href} icon={ArrowRight} iconPosition="right">
          {EMPLOI_EN_TETE.cta.label}
        </Button>
        <Button href={EMPLOI_EN_TETE.lienSecondaire.href} variant="outline">
          {EMPLOI_EN_TETE.lienSecondaire.label}
        </Button>
      </div>
    </Section>
  );
}
