// Copilote IA (specs/COM3-01) : contrôles purs, sans appel au fournisseur.
import { describe, expect, it } from 'vitest';
import { contientMontant, lireRelance, nombresCites, nombresInventes } from '@/lib/ia/controle';
import { rapprocherLieu, texteDemande } from '@/lib/ia/copilote';

describe('contrôle des nombres du commentaire (RG-11)', () => {
  const agregats = { indicateurs: { 'Devis envoyés': '12 (+20 %)', 'CA encaissé': '150 000 FCFA (nouveau)' }, rendez_vous_semaine_a_venir: 3, semaine: '2026-11-09' };
  it('critère : « 18 devis » alors que les agrégats en donnent 12 → rejeté', () => {
    expect(nombresInventes('Belle semaine avec 18 devis envoyés.', agregats)).toEqual(['18']);
  });
  it('nombres présents (formats français, pourcentages, dates) → accepté', () => {
    expect(nombresInventes('12 devis envoyés (+20 %), 150 000 FCFA encaissés, 3 rendez-vous à venir dès le 9 novembre.', agregats)).toEqual([]);
  });
  it('extraction des nombres', () => {
    expect(nombresCites('150 000 FCFA, 2,5 h, 07 h et 40 %')).toEqual(['150000', '2.5', '7', '40']);
  });
});

describe('garde-fous des textes proposés', () => {
  it('aucun montant dans un brouillon', () => {
    expect(contientMontant('Le ménage coûte 15 000 FCFA')).toBe(true);
    expect(contientMontant('Nous pouvons passer lundi à 9 h')).toBe(false);
  });
  it('relance : moment conseillé séparé du message', () => {
    expect(lireRelance('MOMENT : demain vers 10 h\n\nBonjour Madame, avez-vous pu…')).toEqual({ moment: 'demain vers 10 h', message: 'Bonjour Madame, avez-vous pu…' });
    expect(lireRelance('Bonjour, avez-vous pu…')).toEqual({ moment: null, message: 'Bonjour, avez-vous pu…' });
  });
});

describe('minimisation et rapprochement (RG-04, RG-06)', () => {
  it('le texte envoyé ne contient ni coordonnées ni identité', () => {
    const t = texteDemande({ description: 'Entretien des bureaux', donnees: { valeurs: { company: 'ACME SARL', contact: 'M. Talla', phone: '690 22 33 44', email: 'a@b.cm', need: 'Entretien des bureaux', frequence: 'Deux fois par semaine' } } });
    expect(t).toBe('Entretien des bureaux\nneed : Entretien des bureaux\nfrequence : Deux fois par semaine');
    expect(t).not.toMatch(/ACME|Talla|690|a@b/);
    expect(t).toContain('Deux fois par semaine');
  });
  it('message WhatsApp inclus', () => {
    expect(texteDemande({ description: null, donnees: { whatsapp: { texte: 'Il me faut 2 agents à Akwa' } } })).toBe('Il me faut 2 agents à Akwa');
  });
  const lieux = [
    { id: 1, nom: 'Douala', quartiers: [{ id: 10, nom: 'Akwa' }, { id: 12, nom: 'Centre' }] },
    { id: 2, nom: 'Yaoundé', quartiers: [{ id: 21, nom: 'Centre' }, { id: 22, nom: 'Bastos' }] },
  ];
  it('critère RG-06 : « Akwa » → Douala / Akwa ; quartier ambigu sans ville → ville seule', () => {
    expect(rapprocherLieu({ ville: null, quartier: 'Akwa' }, lieux)).toEqual({ villeId: 1, quartierId: 10 });
    expect(rapprocherLieu({ ville: 'Yaounde', quartier: 'centre' }, lieux)).toEqual({ villeId: 2, quartierId: 21 });
    expect(rapprocherLieu({ ville: null, quartier: 'Centre' }, lieux)).toEqual({ villeId: null, quartierId: null });
    expect(rapprocherLieu({ ville: 'Kribi', quartier: null }, lieux)).toEqual({ villeId: null, quartierId: null });
  });
});
