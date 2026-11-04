import { cx } from '@/components/ui/cx';

/**
 * Décor « étincelles » et blobs.
 * RÉSERVÉ À LA PAGE PROPRETÉ (D-06) : ces motifs signalent « ménage » et ne doivent
 * pas apparaître sur l'accueil, le recrutement, l'emploi, les espaces verts ni la boutique.
 * Purement décoratif (aria-hidden), animations coupées par prefers-reduced-motion.
 */

const SPARKLE_PATH = 'M12 0l3.1 8.9L24 12l-8.9 3.1L12 24l-3.1-8.9L0 12l8.9-3.1z';

export function SparkleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" focusable="false">
      <path d={SPARKLE_PATH} />
    </svg>
  );
}

interface PropreteDecorProps {
  /** `blobs` (taches floues), `sparkles` (étincelles), `both`. */
  variant?: 'blobs' | 'sparkles' | 'both';
  /** Fond clair ou sombre. */
  tone?: 'light' | 'dark';
  className?: string;
}

/** Calque décoratif à placer dans un parent `relative overflow-hidden`. */
export default function PropreteDecor({ variant = 'both', tone = 'light', className }: PropreteDecorProps) {
  const showBlobs = variant !== 'sparkles';
  const showSparkles = variant !== 'blobs';
  return (
    <div aria-hidden="true" className={cx('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {showBlobs && (
        <>
          <div
            className={cx(
              'absolute -top-28 right-[-10%] w-[420px] h-[420px] rounded-full blur-3xl animate-blob',
              tone === 'dark' ? 'bg-brand-500/30' : 'bg-brand-200/80',
            )}
          />
          <div className="absolute inset-0 bg-dots opacity-30 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_65%)]" />
        </>
      )}
      {showSparkles && (
        <>
          <SparkleGlyph className="absolute top-10 right-[12%] w-8 h-8 text-brand-400 animate-sparkle" />
          <SparkleGlyph
            className={cx(
              'absolute bottom-12 left-[10%] w-5 h-5 animate-sparkle [animation-delay:-1.2s]',
              tone === 'dark' ? 'text-white/70' : 'text-brand-300',
            )}
          />
        </>
      )}
    </div>
  );
}
