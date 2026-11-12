// Réponses WhatsApp (specs/COM2-02 RG-02, RG-06..10).
import { describe, expect, it } from 'vitest';
import { automateSuspendu, contientPrix, doitAccuser, estStop, fenetreOuverte, libelleHoraires, libelleOuverture, marketingAutorise, ouverture, remplir, reponseRapide } from '@/lib/whatsapp/automate';
import { HEURES_OUVREES_PAR_DEFAUT, WA_REPONSES_RAPIDES } from '@/lib/parametres';

const t = (iso: string) => new Date(`${iso}+01:00`);

describe('fenêtre de service (RG-02)', () => {
  it('critère : dernier message client vieux de 30 h → fenêtre fermée', () => {
    const maintenant = t('2026-11-12T16:00:00');
    expect(fenetreOuverte(t('2026-11-11T10:00:00'), maintenant)).toBe(false);
    expect(fenetreOuverte(t('2026-11-11T16:30:00'), maintenant)).toBe(true);
    expect(fenetreOuverte(null, maintenant)).toBe(false);
  });
});

describe('reprise manuelle (RG-08)', () => {
  it('critère : réponse de Stéphanie à 10 h, le client réécrit à 10 h 05 → automate suspendu', () => {
    expect(automateSuspendu({ automate: 'actif', dernierSortantLe: t('2026-11-12T10:00:00') }, t('2026-11-12T10:05:00'), 12)).toBe(true);
  });
  it('suspension levée après 12 h ; « reprendre la main » suspend sans limite', () => {
    expect(automateSuspendu({ automate: 'actif', dernierSortantLe: t('2026-11-12T10:00:00') }, t('2026-11-12T22:01:00'), 12)).toBe(false);
    expect(automateSuspendu({ automate: 'actif', dernierSortantLe: null }, t('2026-11-12T10:00:00'), 12)).toBe(false);
    expect(automateSuspendu({ automate: 'manuel', dernierSortantLe: null }, t('2026-11-20T10:00:00'), 12)).toBe(true);
  });
});

describe('STOP (RG-09)', () => {
  it('mots-clés reconnus, phrases ignorées', () => {
    for (const x of ['STOP', 'stop', ' Arrêt ', 'ARRET', 'Stop pub', 'désinscription']) expect(estStop(x), x).toBe(true);
    for (const x of ['Ne vous arrêtez pas', 'stop le ménage demain ?', 'Bonjour']) expect(estStop(x), x).toBe(false);
  });
});

describe('accusé de réception (RG-06)', () => {
  it('premier message ou après 7 jours de silence', () => {
    const maintenant = t('2026-11-12T10:00:00');
    expect(doitAccuser(null, maintenant)).toBe(true);
    expect(doitAccuser(t('2026-11-12T09:00:00'), maintenant)).toBe(false);
    expect(doitAccuser(t('2026-11-05T10:00:00'), maintenant)).toBe(true);
  });
  it('heures ouvrées et prochaine ouverture', () => {
    const h = HEURES_OUVREES_PAR_DEFAUT;
    expect(ouverture(t('2026-11-12T10:00:00'), h).ouvert).toBe(true); // jeudi
    const nuit = t('2026-11-12T22:00:00');
    const o = ouverture(nuit, h);
    expect(o.ouvert).toBe(false);
    expect(libelleOuverture(o.prochaine, nuit)).toBe('demain à 07:00');
    const samediSoir = t('2026-11-14T18:00:00');
    expect(libelleOuverture(ouverture(samediSoir, h).prochaine, samediSoir)).toBe('lundi à 07:00');
    expect(libelleHoraires(h)).toBe('du lundi au vendredi de 7 h à 19 h, le samedi de 8 h à 17 h');
  });
});

describe('réponses rapides (RG-07)', () => {
  it('mot-clé → règle ; variables remplies', () => {
    expect(reponseRapide('Bonjour, quels sont vos horaires ?', WA_REPONSES_RAPIDES)?.reponse).toBe('Nos horaires : {horaires}.');
    expect(reponseRapide('Où en est mon dossier ?', WA_REPONSES_RAPIDES)?.reponse).toMatch(/\{suivi\}/);
    expect(reponseRapide('Bonjour', WA_REPONSES_RAPIDES)).toBeNull();
    expect(remplir('Dossier {numero} : {suivi}', { numero: 'NET-2026-00001', suivi: null })).toBe('Dossier NET-2026-00001 :');
  });
  it('aucune réponse automatique avec un prix', () => {
    expect(contientPrix('À partir de 8 000 FCFA')).toBe(true);
    expect(contientPrix('15000 francs')).toBe(true);
    expect(contientPrix('Nos horaires : du lundi au vendredi de 7 h à 19 h')).toBe(false);
  });
});

describe('marketing (RG-09, RG-10)', () => {
  const base = { accordLe: t('2026-11-01T10:00:00'), retireLe: null, envoisSemaine: 0, plafond: 1, qualite: 'GREEN' };
  it('accord, STOP, plafond, note de qualité', () => {
    expect(marketingAutorise(base).ok).toBe(true);
    expect(marketingAutorise({ ...base, accordLe: null }).ok).toBe(false);
    expect(marketingAutorise({ ...base, retireLe: t('2026-11-05T10:00:00') })).toMatchObject({ ok: false, raison: expect.stringMatching(/STOP/) });
    expect(marketingAutorise({ ...base, retireLe: t('2026-10-01T10:00:00') }).ok).toBe(true); // accord redonné après le STOP
    expect(marketingAutorise({ ...base, envoisSemaine: 1 }).ok).toBe(false);
    expect(marketingAutorise({ ...base, qualite: 'RED' }).ok).toBe(false);
  });
});
