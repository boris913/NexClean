'use client';

import { useEffect, useRef } from 'react';

/**
 * Custom hook that observes an element and adds the "visible" class
 * when it enters the viewport, enabling CSS-driven fade-up animations.
 */
export function useScrollAnimation(threshold = 0.1) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );

    // Find all fade-up children
    const targets = element.querySelectorAll<HTMLElement>('.fade-up');
    targets.forEach((el) => observer.observe(el));

    // Also observe the element itself if it has the class
    if (element.classList.contains('fade-up')) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
