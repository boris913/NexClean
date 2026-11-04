import Breadcrumb from '@/components/ui/Breadcrumb';
import Container from '@/components/ui/Container';
import PropreteDecor from '@/components/ui/Decor';
import SectionLabel from '@/components/ui/SectionLabel';
import Reveal from '@/components/ui/Reveal';
import { cx } from '@/components/ui/cx';
import type { PillarKey } from '@/components/ui/pillars';

interface PageHeroProps {
  label?: string;
  title: string;
  subtitle?: string;
  breadcrumb: { name: string; href?: string }[];
  /** Actions (boutons). En `tone="dark"`, utiliser `primary`, `whatsapp` ou `inverse`. */
  children?: React.ReactNode;
  /** `light` (défaut) : fond brand-50 → blanc · `dark` : vert profond, texte blanc. */
  tone?: 'light' | 'dark';
  /** Colore le surtitre aux couleurs du pilier (fond clair). */
  pillar?: PillarKey;
  /** Décor blobs + étincelles : RÉSERVÉ À LA PAGE PROPRETÉ (D-06). */
  decor?: boolean;
}

/** En-tête standard des pages internes. */
export default function PageHero({ label, title, subtitle, breadcrumb, children, tone = 'light', pillar, decor = false }: PageHeroProps) {
  const dark = tone === 'dark';
  return (
    <section
      className={cx(
        'relative overflow-hidden',
        dark ? 'surface-dark bg-forest text-white' : 'bg-gradient-to-b from-brand-50 to-white border-b border-ink-100',
      )}
    >
      {decor && <PropreteDecor variant="blobs" tone={tone} />}
      <Container className="relative pt-10 pb-14 sm:pt-14 sm:pb-20">
        <Breadcrumb tone={tone} items={[{ name: 'Accueil', href: '/' }, ...breadcrumb]} />
        <Reveal>
          {label && (
            <SectionLabel tone={tone} pillar={dark ? undefined : pillar} sparkle={decor} className="mb-5">
              {label}
            </SectionLabel>
          )}
          <h1 className={cx('font-display text-h1 mb-5 max-w-3xl', dark ? 'text-white' : 'text-ink-900')}>{title}</h1>
          {subtitle && <p className={cx('text-lead max-w-2xl', dark ? 'text-brand-100' : 'text-ink-600')}>{subtitle}</p>}
          {children && <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">{children}</div>}
        </Reveal>
      </Container>
    </section>
  );
}
