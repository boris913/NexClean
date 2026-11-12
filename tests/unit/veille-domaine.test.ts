// Veille prospects (specs/COM4-01) : règles pures.
import { describe, expect, it } from 'vitest';
import { contactsPublies, debutJourDouala, lienWhatsappPiste, messageAvecLien, normaliserUrl, referencePiste, relancePossible, transitionPossible } from '@/lib/veille/domaine';
import { referenceDepuisTexte } from '@/lib/acquisition/source';

describe('veille : règles pures', () => {
  it('RG-01 : référence courte P-xxxx, relue par la réception WhatsApp', () => {
    expect(referencePiste(42)).toBe('P-0042');
    expect(referencePiste(12345)).toBe('P-12345');
    expect(referenceDepuisTexte('Bonjour NEXCLEAN [P-0042]')).toEqual({ source: 'prospection', piste: 'P-0042' });
  });

  it('RG-03 : URL normalisée (protocole, www, m., fragment, paramètres de suivi, barre finale)', () => {
    const a = normaliserUrl('https://www.facebook.com/groups/123/posts/456/?mibextid=abc&utm_source=x#c');
    expect(a).toBe('facebook.com/groups/123/posts/456');
    expect(normaliserUrl('http://m.facebook.com/groups/123/posts/456')).toBe(a);
    expect(normaliserUrl('jumia.cm/annonce?id=9&ref=home')).toBe('jumia.cm/annonce?id=9');
    expect(normaliserUrl('   ')).toBeNull();
    expect(normaliserUrl('http://exa mple')).toBeNull();
  });

  it('RG-01 : seuls les contacts écrits dans la publication sont gardés (pas d’invention)', () => {
    const texte = 'Cherche gardien. Contact : 6 99 88 77 66 ou rh@villa-bastos.cm';
    expect(contactsPublies(texte, { email: 'RH@villa-bastos.cm', telephone: '+237699887766' })).toEqual({ email: 'rh@villa-bastos.cm', telephone: '+237699887766' });
    expect(contactsPublies(texte, { email: 'invente@x.cm', telephone: '690000000' })).toEqual({ email: 'rh@villa-bastos.cm', telephone: '+237699887766' });
    expect(contactsPublies('Cherche ménagère à Akwa, écrire en privé', { email: 'a@b.cm', telephone: '699887766' })).toEqual({ email: null, telephone: null });
  });

  it('RG-07 : lien wa.me portant la référence, ajouté par le code', () => {
    expect(lienWhatsappPiste('P-0007')).toBe('https://wa.me/237696370479?text=Bonjour%20NEXCLEAN%20%5BP-0007%5D');
    const m = messageAvecLien('Bonjour, nous pouvons vous aider.  ', 'P-0007');
    expect(m).toMatch(/^Bonjour, nous pouvons vous aider\.\n\nÉcrivez-nous sur WhatsApp : https:\/\/wa\.me\/237696370479\?text=.*P-0007/);
    expect(referenceDepuisTexte(decodeURIComponent(m.split('text=')[1]!))).toEqual({ source: 'prospection', piste: 'P-0007' });
  });

  it('RG-02 : transitions', () => {
    expect(transitionPossible('nouvelle', 'retenue')).toBe(true);
    expect(transitionPossible('nouvelle', 'contactee')).toBe(false);
    expect(transitionPossible('retenue', 'contactee')).toBe(true);
    expect(transitionPossible('convertie', 'sans_suite')).toBe(false);
    expect(transitionPossible('ecartee', 'nouvelle')).toBe(true);
  });

  it('RG-10 : une seule relance, au moins 5 jours après le premier contact', () => {
    const premier = { type: 'premier' as const, creeLe: new Date('2026-11-02T10:00:00+01:00') };
    expect(relancePossible([], new Date('2026-11-12T10:00:00+01:00')).ok).toBe(false);
    expect(relancePossible([premier], new Date('2026-11-06T10:00:00+01:00'))).toMatchObject({ ok: false, raison: expect.stringMatching(/07\/11\/2026/) });
    expect(relancePossible([premier], new Date('2026-11-07T10:00:00+01:00')).ok).toBe(true);
    expect(relancePossible([premier, { type: 'relance', creeLe: new Date('2026-11-08T10:00:00+01:00') }], new Date('2026-11-20T10:00:00+01:00'))).toMatchObject({ ok: false, raison: expect.stringMatching(/déjà été relancée/) });
  });

  it('début de journée à Douala (UTC+1)', () => {
    expect(debutJourDouala(new Date('2026-11-12T23:30:00Z')).toISOString()).toBe('2026-11-12T23:00:00.000Z');
    expect(debutJourDouala(new Date('2026-11-12T22:30:00Z')).toISOString()).toBe('2026-11-11T23:00:00.000Z');
  });
});
