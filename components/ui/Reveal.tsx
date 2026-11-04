'use client';

import { motion, MotionConfig, useReducedMotion, type Variants } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Respecte le réglage « réduire les animations » du système. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Direction d'entrée. */
  from?: 'up' | 'left' | 'right' | 'scale';
  as?: 'div' | 'li' | 'section' | 'article';
}

const offsets = {
  up: { y: 28 },
  left: { x: -32 },
  right: { x: 32 },
  scale: { scale: 0.94 },
};

/**
 * Apparition au défilement (une seule fois).
 * Avec prefers-reduced-motion : aucun déplacement ni délai, apparition immédiate
 * (indépendamment de la présence de <MotionProvider>).
 */
export default function Reveal({ children, className, delay = 0, from = 'up', as = 'div' }: RevealProps) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, ...(reduce ? {} : offsets[from]) }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};
const containerReduced: Variants = { hidden: {}, show: {} };
const itemReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
};

/** Grille dont les enfants (StaggerItem) apparaissent en cascade. */
export function Stagger({ children, className, as = 'div' }: { children: React.ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' }) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      variants={reduce ? containerReduced : container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = 'div' }: { children: React.ReactNode; className?: string; as?: 'div' | 'li' }) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp className={className} variants={reduce ? itemReduced : item}>
      {children}
    </Comp>
  );
}
