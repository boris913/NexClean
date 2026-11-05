import Image from 'next/image';
import { cx } from '@/components/ui/cx';

interface PhotoTraiteeProps {
  src: string;
  alt: string;
  /**
   * `duotone` : niveaux de gris + teinte bleue de la marque (unifie des photos de qualité inégale).
   * `douce` : couleurs conservées, légère désaturation et dégradé bleu nuit en bas (portraits, équipes).
   */
  traitement?: 'duotone' | 'douce';
  /** Légende courte en mono, posée sur le dégradé (facultative). */
  legende?: string;
  sizes: string;
  priority?: boolean;
  /** Cadrage `object-position` (ex. `object-top`). */
  cadrage?: string;
  className?: string;
}

/** Photo existante mise en valeur sans retouche (audit design M4) : cadre, traitement et légende homogènes. */
export default function PhotoTraitee({ src, alt, traitement = 'duotone', legende, sizes, priority, cadrage = 'object-center', className }: PhotoTraiteeProps) {
  const duotone = traitement === 'duotone';
  return (
    <figure className={cx('relative isolate overflow-hidden rounded-card bg-navy', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cx('object-cover', cadrage, duotone ? 'grayscale contrast-125' : 'saturate-[0.85]')}
      />
      {duotone && <div aria-hidden="true" className="absolute inset-0 bg-brand-600 mix-blend-multiply" />}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy/70 via-navy/0 to-navy/0" />
      {legende && (
        <figcaption className="absolute bottom-3 left-4 right-4 font-mono text-eyebrow uppercase text-white">{legende}</figcaption>
      )}
    </figure>
  );
}
