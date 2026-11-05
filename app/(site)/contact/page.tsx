import type { Metadata } from 'next';
import Link from 'next/link';
import { Briefcase, ClipboardCheck, SprayCan, Users, type LucideIcon } from 'lucide-react';
import { lireCouverture } from '@/lib/geo/couverture';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import PageHero from '@/components/ui/PageHero';
import Section from '@/components/ui/Section';
import type { PillarKey } from '@/components/ui/pillars';
import ContactSection from '@/components/sections/ContactSection';
import CoverageSection from '@/components/sections/CoverageSection';
import FAQSection from '@/components/sections/FAQSection';
import { WHATSAPP_MESSAGE_SUIVI, getWhatsAppLink } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: 'Faire une demande — service, recrutement, emploi ou suivi',
    description: `Contactez NEXCLEAN à ${villes} : devis de propreté ou d'espaces verts, demande de personnel, question sur une candidature ou suivi de dossier.`,
    path: '/contact',
  });
}

interface Orientation {
  titre: string;
  texte: string;
  icon: LucideIcon;
  pillar?: PillarKey;
  cta: { label: string; href: string; whatsapp?: boolean };
  secondaire?: { label: string; href: string };
}

const ORIENTATIONS: Orientation[] = [
  {
    titre: "Un service de propreté ou d'espaces verts",
    texte: 'Ménage, bureaux, fin de chantier, jardin, abonnement.',
    icon: SprayCan,
    pillar: 'proprete',
    cta: { label: 'Demander un devis', href: '#contact' },
    secondaire: { label: 'Espaces verts', href: '/espaces-verts#devis-espaces-verts' },
  },
  {
    titre: 'Recruter du personnel',
    texte: 'Décrivez vos postes, obtenez une estimation immédiate.',
    icon: Users,
    pillar: 'recrutement',
    cta: { label: 'Demander du personnel', href: '/recrutement/demander-du-personnel' },
  },
  {
    titre: 'Je cherche un emploi',
    texte: 'Offres en cours et profil candidat gratuit.',
    icon: Briefcase,
    pillar: 'emploi',
    cta: { label: 'Voir les offres', href: '/recrutement' },
    secondaire: { label: 'Créer mon profil', href: '/candidat/inscription' },
  },
  {
    titre: 'Suivre un dossier',
    texte: 'Votre lien de suivi vous a été envoyé par WhatsApp. Vous ne le retrouvez pas ? Écrivez-nous avec votre numéro de dossier.',
    icon: ClipboardCheck,
    cta: { label: 'Nous écrire', href: getWhatsAppLink(WHATSAPP_MESSAGE_SUIVI), whatsapp: true },
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        label="Faire une demande"
        title="Quelle est votre demande ?"
        subtitle="Choisissez votre besoin : nous vous dirigeons vers le bon formulaire ou le bon interlocuteur."
        breadcrumb={[{ name: 'Contact' }]}
      />

      <Section tone="muted" spacing="sm">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ORIENTATIONS.map((o) => (
            <Card key={o.titre} variant={o.pillar ? 'pillar' : 'default'} pillar={o.pillar} padding="sm">
              <IconBadge icon={o.icon} tone={o.pillar ?? 'neutral'} className="mb-4" />
              <h2 className="mb-2 text-h3 text-ink-900">{o.titre}</h2>
              <p className="mb-5 text-small text-ink-600">{o.texte}</p>
              <div className="mt-auto flex flex-col items-start gap-1">
                <Button
                  href={o.cta.href}
                  variant={o.cta.whatsapp ? 'whatsapp' : 'primary'}
                  whatsappIcon={o.cta.whatsapp}
                  size="sm"
                  fullWidth
                >
                  {o.cta.label}
                </Button>
                {o.secondaire && (
                  <Link
                    href={o.secondaire.href}
                    className="inline-flex min-h-tap items-center text-small font-medium text-primary hover:underline"
                  >
                    {o.secondaire.label}
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <ContactSection />
      <CoverageSection />
      <FAQSection />
    </>
  );
}
