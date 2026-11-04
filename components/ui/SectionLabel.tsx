import { SparkleGlyph } from '@/components/ui/Decor';
import { cx } from '@/components/ui/cx';
import { PILLARS, type PillarKey } from '@/components/ui/pillars';

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
  /** `light` sur fond clair (brand-800 sur brand-100), `dark` sur fond sombre. */
  tone?: 'light' | 'dark';
  /** Colore le surtitre aux couleurs d'un pilier (fond clair uniquement). */
  pillar?: PillarKey;
  /**
   * Étincelle décorative : réservée à la page Propreté (D-06). Désactivée par défaut.
   */
  sparkle?: boolean;
}

/** Surtitre (« eyebrow ») de section. */
export default function SectionLabel({ children, className, tone = 'light', pillar, sparkle = false }: SectionLabelProps) {
  const colors =
    tone === 'dark'
      ? 'text-brand-200 bg-white/10'
      : pillar
        ? cx(PILLARS[pillar].text, PILLARS[pillar].soft)
        : 'text-brand-800 bg-brand-100';

  return (
    <span className={cx('inline-flex items-center gap-2 text-eyebrow uppercase px-3.5 py-1.5 rounded-full', colors, className)}>
      {sparkle && <SparkleGlyph className="w-3 h-3 text-brand-600 animate-sparkle" />}
      {children}
    </span>
  );
}
