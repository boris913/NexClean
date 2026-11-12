// Source d'acquisition (specs/COM1-01 RG-02, RG-05).
import { describe, expect, it } from 'vitest';
import {
  deduireContact,
  ecrireAttribution,
  fusionnerAttribution,
  lireAttribution,
  marquerTexte,
  referenceDepuisTexte,
  type Contact,
} from '@/lib/acquisition/source';

const SITE = 'nexclean.xyz';
const t0 = new Date('2026-11-10T08:00:00Z');
const source = (url: string, referrer = '') => deduireContact(url, referrer, SITE, t0)?.source ?? null;

describe('deduireContact (RG-02)', () => {
  it('UTM : conserve source, medium et campagne', () => {
    expect(deduireContact('https://nexclean.xyz/?utm_source=facebook&utm_medium=social&utm_campaign=menage-nov', '', SITE, t0)).toEqual({
      source: 'facebook',
      utmSource: 'facebook',
      utmMedium: 'social',
      utmCampaign: 'menage-nov',
      le: t0.toISOString(),
    });
  });

  it('UTM Google : naturel, payant ou fiche Maps selon le medium', () => {
    expect(source('https://nexclean.xyz/?utm_source=google&utm_medium=organic')).toBe('google_naturel');
    expect(source('https://nexclean.xyz/?utm_source=google&utm_medium=cpc')).toBe('google_ads');
    expect(source('https://nexclean.xyz/?utm_source=google&utm_medium=maps')).toBe('google_maps');
    expect(source('https://nexclean.xyz/?utm_source=gbp')).toBe('google_maps');
  });

  it('codes courts reconnus seulement en entier', () => {
    expect(source('https://nexclean.xyz/?utm_source=tt')).toBe('tiktok');
    expect(source('https://nexclean.xyz/?utm_source=ig')).toBe('instagram');
    expect(source('https://nexclean.xyz/?utm_source=twitter')).toBe('autre');
    expect(source('https://nexclean.xyz/?utm_source=digital-agency')).toBe('autre');
  });

  it("l'UTM prime sur les identifiants de clic et le referrer", () => {
    expect(source('https://nexclean.xyz/?utm_source=tiktok&fbclid=x', 'https://www.google.com/')).toBe('tiktok');
  });

  it('identifiants de clic publicitaires', () => {
    expect(source('https://nexclean.xyz/?gclid=abc')).toBe('google_ads');
    expect(source('https://nexclean.xyz/?fbclid=abc')).toBe('facebook');
    expect(source('https://nexclean.xyz/?ttclid=abc')).toBe('tiktok');
  });

  it('referrer externe', () => {
    expect(source('https://nexclean.xyz/', 'https://www.google.cm/')).toBe('google_naturel');
    expect(source('https://nexclean.xyz/', 'https://l.facebook.com/')).toBe('facebook');
    expect(source('https://nexclean.xyz/', 'https://m.facebook.com/')).toBe('facebook');
    expect(source('https://nexclean.xyz/', 'https://www.tiktok.com/')).toBe('tiktok');
    expect(deduireContact('https://nexclean.xyz/', 'https://annuaire.cm/x', SITE, t0)).toMatchObject({ source: 'autre', referent: 'annuaire.cm' });
  });

  it('visite directe ou interne : rien à retenir', () => {
    expect(source('https://nexclean.xyz/')).toBeNull();
    expect(source('https://nexclean.xyz/tarifs', 'https://www.nexclean.xyz/')).toBeNull();
    expect(source('pas une url')).toBeNull();
  });
});

describe('fusionnerAttribution (RG-02 : premier contact conservé)', () => {
  const fb: Contact = { source: 'facebook', le: '2026-11-01T00:00:00.000Z' };
  const gg: Contact = { source: 'google_naturel', le: '2026-11-03T00:00:00.000Z' };

  it('première visite : premier = dernier', () => {
    expect(fusionnerAttribution(null, fb)).toEqual({ premier: fb, dernier: fb });
  });

  it('visite suivante : seul le dernier contact change', () => {
    expect(fusionnerAttribution({ premier: fb, dernier: fb }, gg)).toEqual({ premier: fb, dernier: gg });
  });

  it('visite directe : attribution inchangée', () => {
    const a = { premier: fb, dernier: gg };
    expect(fusionnerAttribution(a, null)).toBe(a);
    expect(fusionnerAttribution(null, null)).toBeNull();
  });
});

describe('cookie', () => {
  it('aller-retour', () => {
    const a = { premier: { source: 'tiktok' as const, utmCampaign: 'été', le: t0.toISOString() }, dernier: { source: 'tiktok' as const, le: t0.toISOString() } };
    expect(lireAttribution(ecrireAttribution(a))).toEqual(a);
  });

  it('valeur absente, illisible ou falsifiée → null', () => {
    expect(lireAttribution(undefined)).toBeNull();
    expect(lireAttribution('%%%')).toBeNull();
    expect(lireAttribution(encodeURIComponent(JSON.stringify({ premier: { source: 'pirate', le: 'x' }, dernier: {} })))).toBeNull();
  });
});

describe('références WhatsApp (RG-05)', () => {
  it('ajoute la référence une seule fois', () => {
    expect(marquerTexte('Bonjour NEXCLEAN ', 'facebook')).toBe('Bonjour NEXCLEAN [FB]');
    expect(marquerTexte('Bonjour [TT]', 'facebook')).toBe('Bonjour [TT]');
  });

  it('pas de référence pour une source sans étiquette', () => {
    expect(marquerTexte('Bonjour', 'autre')).toBe('Bonjour');
  });

  it('lecture inverse, y compris les pistes de veille', () => {
    expect(referenceDepuisTexte('Bonjour [FB] je cherche une ménagère')).toEqual({ source: 'facebook' });
    expect(referenceDepuisTexte('Bonjour [P-0042]')).toEqual({ source: 'prospection', piste: 'P-0042' });
    expect(referenceDepuisTexte('Bonjour')).toBeNull();
  });
});
