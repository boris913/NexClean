// Mise en page commune des pages de l'espace candidat (MVP2-01).
import Section from '@/components/ui/Section';
import SectionLabel from '@/components/ui/SectionLabel';
import { cx } from '@/components/ui/cx';

export default function Coque({ surtitre = 'Espace candidat', titre, intro, children, large }: { surtitre?: string; titre: string; intro?: React.ReactNode; children: React.ReactNode; large?: boolean }) {
  return (
    <Section tone="muted" spacing="sm" container="narrow" className="min-h-[70vh]">
      <div className={large ? undefined : 'mx-auto max-w-md'}>
        <SectionLabel pillar="emploi" className="mb-3">
          {surtitre}
        </SectionLabel>
        <h1 className={cx('font-display text-h2 text-ink-900', intro ? 'mb-3' : 'mb-6')}>{titre}</h1>
        {intro && <div className="text-ink-600 mb-6">{intro}</div>}
        {children}
      </div>
    </Section>
  );
}
