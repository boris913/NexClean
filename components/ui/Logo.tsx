import Image from 'next/image';

const VARIANTS = {
  couleur: '/images/brand/logo-horizontal.svg',
  blanc: '/images/brand/logo-horizontal-blanc.svg',
  mono: '/images/brand/logo-horizontal-mono.svg',
};

/** Logo officiel NEXCLEAN SARL (fichiers générés depuis Figma). */
export default function Logo({
  variant = 'couleur',
  height = 40,
  priority = false,
  className = '',
}: {
  variant?: keyof typeof VARIANTS;
  height?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={VARIANTS[variant]}
      alt="NEXCLEAN SARL"
      width={Math.round((height * 449) / 128)}
      height={height}
      priority={priority}
      unoptimized
      className={className}
    />
  );
}
