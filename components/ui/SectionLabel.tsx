import { SparkleGlyph } from '@/components/ui/Decor';
import { cx } from '@/components/ui/cx';
import { PILLARS, type PillarKey } from '@/components/ui/pillars';

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
  /** `light` sur fond clair, `dark` sur fond sombre. */
  tone?: 'light' | 'dark';
  /** Colore le surtitre aux couleurs d'un pilier (fond clair uniquement). */
  pillar?: PillarKey;
  /**
   * Étincelle décorative : réservée à la page Propreté (D-06). Désactivée par défaut.
   */
  sparkle?: boolean;
}

/** Surtitre (« eyebrow ») de section : mono, majuscules, précédé d'un filet court. */
export default function SectionLabel({ children, className, tone = 'light', pillar, sparkle = false }: SectionLabelProps) {
  // Couleurs AA : brand-300 sur navy 8,07:1 ; primary sur blanc 5,81:1 ; pilier ≥ 5,4:1 sur blanc.
  const colors = tone === 'dark' ? 'text-brand-300' : pillar ? PILLARS[pillar].text : 'text-primary';

  return (
    <span className={cx('inline-flex items-center gap-2.5 font-mono text-eyebrow uppercase', colors, className)}>
      {sparkle ? (
        <SparkleGlyph className="w-3 h-3 animate-sparkle" />
      ) : (
        <span aria-hidden="true" className="h-px w-6 bg-current" />
      )}
      {children}
    </span>
  );
}
