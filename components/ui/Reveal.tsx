'use client';

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';

/**
 * Apparition au défilement, en CSS (globals.css, `[data-reveal]`).
 * - Le contenu est visible par défaut (rendu serveur, sans JavaScript, captures, robots) :
 *   seuls les blocs encore hors de l'écran au chargement sont masqués, puis révélés une fois.
 * - Avec prefers-reduced-motion : aucune animation (règle CSS), contenu immédiatement visible.
 */
function useReveal() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Déjà à l'écran : on n'y touche pas (pas de clignotement au chargement).
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.dataset.reveal = 'pending';
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.reveal = 'done';
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -60px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Délai en secondes. */
  delay?: number;
  /** Direction d'entrée. */
  from?: 'up' | 'left' | 'right' | 'scale';
  as?: 'div' | 'li' | 'section' | 'article';
}

export default function Reveal({ children, className, delay = 0, from = 'up', as = 'div' }: RevealProps) {
  const ref = useReveal();
  const Comp = as as ElementType;
  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}s` } : undefined;
  return (
    <Comp ref={ref} className={className} data-reveal-from={from} style={style}>
      {children}
    </Comp>
  );
}

/** Grille dont les enfants (StaggerItem) apparaissent en cascade (délais en CSS, `[data-stagger]`). */
export function Stagger({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' }) {
  const Comp = as as ElementType;
  return (
    <Comp className={className} data-stagger="">
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const ref = useReveal();
  const Comp = as as ElementType;
  return (
    <Comp ref={ref} className={className} data-reveal-from="up">
      {children}
    </Comp>
  );
}
