'use client';
// COM2-01 RG-08 : rafraîchissement automatique (≤ 15 s) sans recharger la page ; suspendu onglet masqué.
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Rafraichir({ secondes = 10 }: { secondes?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, secondes * 1000);
    return () => clearInterval(t);
  }, [router, secondes]);
  return null;
}
