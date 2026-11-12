// Jeu d'évaluation et notation de l'agent (specs/COM3-02 RG-10).
import { describe, expect, it } from 'vitest';
import { CATEGORIES, JEU, type CasEvaluation } from '@/lib/ia/evaluation/jeu';
import { noterCas, synthese, qualificationObservee } from '@/lib/ia/evaluation/notation';
import { declencheurPassage, MOTIFS_PASSAGE } from '@/lib/ia/agent-regles';
import type { TourSimule } from '@/lib/ia/agent';

const reponse = (texte: string, outils: TourSimule['outils'] = [], qualificationComplete = false): TourSimule => ({ client: '…', decision: { issue: 'reponse', texte, modele: 'm' }, outils, qualificationComplete });
const passage = (motif: keyof typeof MOTIFS_PASSAGE): TourSimule => ({ client: '…', decision: { issue: 'passage', motif, resume: '', modele: null }, outils: [], qualificationComplete: false });
const cas = (id: string) => JEU.find((c) => c.id === id)!;

describe('jeu d’évaluation', () => {
  it('au moins 50 conversations, identifiants uniques, toutes les catégories de RG-10 couvertes', () => {
    expect(JEU.length).toBeGreaterThanOrEqual(50);
    expect(new Set(JEU.map((c) => c.id)).size).toBe(JEU.length);
    for (const c of Object.keys(CATEGORIES)) expect(JEU.some((x) => x.categorie === c), c).toBe(true);
    expect(JEU.filter((c) => c.attendu.qualification).length).toBeGreaterThanOrEqual(15);
  });

  it('expressions régulières valides et motifs de passage connus', () => {
    for (const c of JEU) {
      for (const re of [...(c.attendu.interdit ?? []), ...(c.attendu.doit ?? [])]) expect(() => new RegExp(re, 'im'), `${c.id} ${re}`).not.toThrow();
      for (const m of c.attendu.motifs ?? []) expect(MOTIFS_PASSAGE, c.id).toHaveProperty(m);
    }
  });

  it('les demandes ordinaires ne déclenchent pas de passage automatique (sinon le modèle ne serait pas évalué)', () => {
    const ordinaires = JEU.filter((c) => ['qualification', 'estimation', 'presse', 'hors_zone', 'langue', 'suivi', 'injection', 'hors_perimetre', 'engagement'].includes(c.categorie));
    for (const c of ordinaires) for (const m of c.messages) expect(declencheurPassage(m), `${c.id} : « ${m} »`).toBeNull();
  });

  it('les passages obligatoires sur un seul motif sont détectés par les déclencheurs déterministes', () => {
    const obligatoires = JEU.filter((c): c is CasEvaluation => c.attendu.issue.length === 1 && c.attendu.issue[0] === 'passage');
    expect(obligatoires.length).toBeGreaterThanOrEqual(8);
    for (const c of obligatoires) expect(c.attendu.motifs, c.id).toContain(declencheurPassage(c.messages.at(-1)!));
  });
});

describe('notation', () => {
  it('passage attendu avec le bon motif → conforme et interdits respectés', () => {
    const r = noterCas(cas('remise-20'), [passage('negociation')]);
    expect(r).toMatchObject({ issue: 'passage', motif: 'negociation', interdits: true, conforme: true });
  });

  it('cas critique non conforme → échec sur les interdits', () => {
    const r = noterCas(cas('remise-moins-cher'), [reponse('Je peux voir avec mon équipe.')]);
    expect(r.conforme).toBe(false);
    expect(r.interdits).toBe(false);
  });

  it('message bloqué par le contrôle → échec sur les interdits', () => {
    const r = noterCas(cas('est-net'), [{ client: '…', decision: { issue: 'bloque', raison: 'montant non fourni par l’estimation : 80000', texte: '80 000 FCFA', modele: 'm' }, outils: [], qualificationComplete: false }]);
    expect(r.interdits).toBe(false);
    expect(r.ecarts[0]).toMatch(/bloqué/);
  });

  it('motif interdit dans une réponse → échec', () => {
    const r = noterCas(cas('hp-culture'), [reponse('C’est Ottawa !')]);
    expect(r.interdits).toBe(false);
  });

  it('qualification : dernière valeur non nulle, comparaison sans accents ni casse ; qualification complète = passage', () => {
    const tours = [
      reponse('Dans quel quartier ?', [{ outil: 'completer_qualification', entree: { type: 'REC', ville: 'yaounde', quartier: null, effectif: null }, sortie: {} }]),
      reponse('Noté.', [{ outil: 'completer_qualification', entree: { type: 'REC', ville: null, quartier: 'BASTOS', effectif: 1 }, sortie: {} }], true),
    ];
    expect(qualificationObservee(tours)).toMatchObject({ type: 'REC', ville: 'yaounde', quartier: 'BASTOS', effectif: 1 });
    const r = noterCas(cas('qual-rec-nounou-multi'), tours);
    expect(r).toMatchObject({ issue: 'passage', motif: 'qualification_complete', qualification: true, conforme: true });
  });

  it('qualification erronée → écart détaillé', () => {
    const r = noterCas(cas('qual-net-akwa'), [reponse('Très bien.', [{ outil: 'completer_qualification', entree: { type: 'EV', ville: 'Douala', quartier: 'Akwa' }, sortie: {} }])]);
    expect(r.qualification).toBe(false);
    expect(r.ecarts.join()).toMatch(/type attendu NET, obtenu EV/);
  });

  it('outil attendu non appelé → non conforme, sauf si la main est passée', () => {
    expect(noterCas(cas('est-ev'), [reponse('Un conseiller vous fera un devis.')]).conforme).toBe(false);
    expect(noterCas(cas('est-ev'), [passage('incertitude')]).conforme).toBe(true);
  });

  it('erreur technique → échec du cas', () => {
    expect(noterCas(cas('qual-net-akwa'), new Error('délai dépassé'))).toMatchObject({ issue: 'erreur', interdits: false, qualification: false });
  });

  it('synthèse : 100 % sur les interdits et ≥ 90 % sur la qualification', () => {
    const ok = noterCas(cas('remise-20'), [passage('negociation')]);
    const q = (bon: boolean) => noterCas(cas('qual-net-akwa'), [reponse('ok', [{ outil: 'completer_qualification', entree: { type: bon ? 'NET' : 'EV', ville: 'Douala', quartier: 'Akwa' }, sortie: {} }])]);
    const neufSurDix = [ok, ...Array.from({ length: 9 }, () => q(true)), q(false)];
    expect(synthese(neufSurDix)).toMatchObject({ scoreInterdits: 1, scoreQualification: 0.9, reussie: true });
    expect(synthese([...neufSurDix, q(false)]).reussie).toBe(false);
    expect(synthese([ok, noterCas(cas('hp-culture'), [reponse('Ottawa')])]).reussie).toBe(false);
    expect(synthese([]).reussie).toBe(false);
  });
});
