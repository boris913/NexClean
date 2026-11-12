// Rapport commercial hebdomadaire (specs/COM1-02 RG-09..11).
import { describe, expect, it } from 'vitest';
import { lignesIndicateurs, semaineDue, texteRapport, titreRapport, type ContenuRapport } from '@/lib/commercial/rapport';
import type { Totaux } from '@/lib/commercial/indicateurs';

const t = (iso: string) => new Date(`${iso}+01:00`);

describe('semaine due (RG-09)', () => {
  it('critère d’acceptation : le lundi à 7 h, la semaine du lundi au dimanche précédents', () => {
    const s = semaineDue(t('2026-11-16T07:00:00'))!;
    expect(s.semaine).toBe('2026-11-09');
    expect([s.du, s.au]).toEqual([t('2026-11-09T00:00:00'), t('2026-11-16T00:00:00')]);
    expect(s.precedente).toEqual({ du: t('2026-11-02T00:00:00'), au: t('2026-11-09T00:00:00') });
    expect(s.suivante).toEqual({ du: t('2026-11-16T00:00:00'), au: t('2026-11-23T00:00:00') });
  });
  it('rien le lundi avant 7 h', () => {
    expect(semaineDue(t('2026-11-16T06:59:00'))).toBeNull();
  });
  it('rattrapage dans la semaine (tâche interrompue) : toujours la semaine écoulée', () => {
    expect(semaineDue(t('2026-11-19T15:00:00'))!.semaine).toBe('2026-11-09');
    expect(semaineDue(t('2026-11-22T23:59:00'))!.semaine).toBe('2026-11-09');
  });
});

const tot = (x: Partial<Totaux> = {}): Totaux => ({ nouveaux: 0, enAttente: 0, sansReponse: 0, devisEnvoyes: 0, devisAcceptes: 0, tauxTransformation: null, prestationsRealisees: 0, facture: 0, encaisse: 0, delaiPremiereReponseMin: null, ...x });
const contenu: ContenuRapport = {
  semaine: '2026-11-09',
  fin: '2026-11-15',
  portee: 'direction',
  actuel: tot({ nouveaux: 12, devisAcceptes: 3, tauxTransformation: 25, encaisse: 150_000, delaiPremiereReponseMin: 95, sansReponse: 1 }),
  precedent: tot({ nouveaux: 10, devisAcceptes: 3, tauxTransformation: 30, encaisse: 0, delaiPremiereReponseMin: 120 }),
  topSources: [{ libelle: 'Facebook', nouveaux: 7, acceptes: 2 }],
  enSouffrance: [{ dossierId: 4, numero: 'NET-2026-00004', ancienneteH: 30 }],
  sansAction: [],
  joursSansAction: 3,
  aCloturer: [],
  aVenir: [{ dossierId: 9, numero: 'NET-2026-00009', type: 'visite_site', debut: t('2026-11-17T10:00:00').toISOString(), ville: 'Douala' }],
};

describe('contenu (RG-10)', () => {
  it('titre', () => {
    expect(titreRapport(contenu)).toBe('Rapport commercial du 9 novembre au 15 novembre');
  });
  it('écarts par rapport à la semaine précédente', () => {
    const l = Object.fromEntries(lignesIndicateurs(contenu));
    expect(l['Nouveaux prospects']).toBe('12 (+20 %)');
    expect(l['Devis acceptés']).toBe('3 (=)');
    expect(l['CA encaissé']).toBe('150 000 FCFA (nouveau)');
    expect(l['Taux de transformation']).toBe('25 % (30 % la semaine précédente)');
    expect(l['Délai moyen de 1re réponse']).toBe('1 h 35 (2 h la semaine précédente)');
  });
  it('texte de l’e-mail : sections non vides seulement', () => {
    const txt = texteRapport(contenu);
    expect(txt).toContain('Meilleures sources :\n- Facebook : 7 prospect(s), 2 accepté(s)');
    expect(txt).toContain('- NET-2026-00004 (1 j 6 h)');
    expect(txt).toContain('mardi 17 novembre à 10:00 — Visite sur site NET-2026-00009 (Douala)');
    expect(txt).not.toContain('Rendez-vous à clôturer');
    expect(txt).not.toContain('Commentaire');
  });
  it('RG-11 : aucun nom de client dans l’e-mail', () => {
    expect(Object.keys(contenu.enSouffrance[0]!)).not.toContain('client');
    expect(texteRapport({ ...contenu, portee: 'referent' }).split('\n')[0]).toMatch(/— vos dossiers$/);
  });
});
