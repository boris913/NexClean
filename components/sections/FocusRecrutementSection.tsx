import { ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { CTA_FINAL, FOCUS_RECRUTEMENT } from '@/content/home-data';
import { getWhatsAppLink } from '@/lib/constants';

/** Focus recrutement : commission par personne, facturée sur les seuls placements confirmés. */
export default function FocusRecrutementSection() {
  return (
    <Section id="focus-recrutement" tone="dark" labelledBy="focus-recrutement-titre" className="scroll-mt-20">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeader
            id="focus-recrutement-titre"
            tone="dark"
            eyebrow={FOCUS_RECRUTEMENT.surtitre}
            title={FOCUS_RECRUTEMENT.titre}
            intro={FOCUS_RECRUTEMENT.texte}
            className="!mb-8"
          />
          <div className="flex flex-wrap gap-3">
            <Button href={FOCUS_RECRUTEMENT.cta.href} icon={ArrowRight} iconPosition="right">
              {FOCUS_RECRUTEMENT.cta.label}
            </Button>
            <Button href={FOCUS_RECRUTEMENT.lienSecondaire.href} variant="inverse">
              {FOCUS_RECRUTEMENT.lienSecondaire.label}
            </Button>
          </div>
          <a
            href={getWhatsAppLink(FOCUS_RECRUTEMENT.whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-tap items-center gap-2 text-sm font-semibold text-brand-100 underline underline-offset-2 hover:text-white"
          >
            <WhatsAppIcon className="h-4 w-4" />
            {CTA_FINAL.whatsapp.label}
          </a>
        </div>
        <ol className="divide-y divide-white/15 border-y border-white/15 lg:mt-14">
          {FOCUS_RECRUTEMENT.points.map((point, i) => (
            <li key={point.titre} className="grid grid-cols-[3rem_1fr] gap-x-2 py-5">
              <span aria-hidden="true" className="font-mono text-h3 tabular-nums text-cta">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="text-h3 text-white">{point.titre}</h3>
                <p className="mt-1 text-small text-brand-100">{point.texte}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
