'use client';
// Source d'acquisition (specs/COM1-01 RG-02, RG-05).
// 1. À l'arrivée, déduit la source (UTM, identifiants de clic, referrer) et la conserve 30 jours
//    dans un cookie de première partie, lu par le serveur à l'envoi d'un formulaire.
// 2. Au clic sur un lien wa.me, ajoute la référence courte de la source ([FB], [TT]…) au texte
//    prérempli, pour attribuer aussi les demandes qui arrivent directement sur WhatsApp.
import { useEffect } from 'react';
import { COOKIE_SOURCE, DUREE_COOKIE_S, deduireContact, ecrireAttribution, fusionnerAttribution, lireAttribution, marquerTexte, type Attribution } from '@/lib/acquisition/source';

function lireCookie(): Attribution | null {
  try {
    const ligne = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE_SOURCE}=`));
    return lireAttribution(ligne?.slice(COOKIE_SOURCE.length + 1));
  } catch {
    return null;
  }
}

function ecrireCookie(a: Attribution) {
  try {
    const securise = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_SOURCE}=${ecrireAttribution(a)}; Max-Age=${DUREE_COOKIE_S}; Path=/; SameSite=Lax${securise}`;
  } catch {
    // Cookies bloqués : la demande partira en source « inconnue ».
  }
}

export default function SuiviSource() {
  useEffect(() => {
    const existante = lireCookie();
    const a = fusionnerAttribution(existante, deduireContact(location.href, document.referrer, location.hostname));
    if (a && a !== existante) ecrireCookie(a);

    const auClic = (e: MouseEvent) => {
      const lien = (e.target as HTMLElement | null)?.closest?.('a');
      if (!lien || !lien.href.startsWith('https://wa.me/')) return;
      const source = lireCookie()?.premier.source;
      if (!source) return;
      try {
        const url = new URL(lien.href);
        const texte = url.searchParams.get('text') ?? '';
        const marque = marquerTexte(texte, source);
        if (marque === texte) return;
        url.searchParams.set('text', marque);
        lien.href = url.toString();
      } catch {
        // Lien malformé : on le laisse tel quel.
      }
    };
    document.addEventListener('click', auClic, { capture: true });
    return () => document.removeEventListener('click', auClic, { capture: true });
  }, []);

  return null;
}
