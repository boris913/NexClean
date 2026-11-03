// Règles pures des candidatures (specs/MVP2-02 RG-07..12).
import { describe, expect, it } from 'vitest';
import { getJobBySlug } from '@/content/jobs-data';
import { validerProfil } from '@/lib/candidats/domaine';
import {
  MESSAGE_OFFRE_INCONNUE,
  MESSAGE_OFFRE_POURVUE,
  brouillonCandidatureVide,
  choisirResponsable,
  refusOffre,
  transitionCandidaturePermise,
  validerCandidatureCourte,
} from '@/lib/candidats/formulaire-candidature';

const court = () => ({
  ...brouillonCandidatureVide('Agent de caisse'),
  nom: 'Ngo',
  prenom: 'Awa',
  telephone: '6 77 00 00 01',
  villeId: 1,
  quartierId: 2,
  experience: '1 à 3 ans' as const,
  disponibilite: 'immediate' as const,
  consentementTraitement: true,
  consentementContact: true,
  consentementMajorite: true,
});

describe('Formulaire court (compte léger, RG-07)', () => {
  it('accepte un formulaire complet, normalise le téléphone et la motivation vide', () => {
    const r = validerCandidatureCourte(court());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.donnees).toMatchObject({ telephone: '+237677000001', metier: 'Agent de caisse', villeAutre: null, quartierAutre: null, motivation: null, disponibleLe: null, preavis: null });
  });

  it('signale chaque champ obligatoire manquant', () => {
    const r = validerCandidatureCourte(brouillonCandidatureVide());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.erreurs).sort()).toEqual(
      ['consentementContact', 'consentementMajorite', 'consentementTraitement', 'disponibilite', 'experience', 'metier', 'nom', 'prenom', 'quartierId', 'telephone', 'villeId'].sort(),
    );
  });

  it('exige les deux consentements et l’attestation d’âge, chacun signalé (règle MVP2-01)', () => {
    const r = validerCandidatureCourte({ ...court(), consentementContact: false });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.erreurs)).toEqual(['consentementContact']);
    expect(r.erreurs.consentementContact).toMatch(/postuler/);
    expect(validerCandidatureCourte({ ...court(), consentementMajorite: false }).ok).toBe(false);
  });

  it('accepte une ville et un quartier hors référentiel ; date ou préavis selon la disponibilité', () => {
    expect(validerCandidatureCourte({ ...court(), villeId: null, villeAutre: 'Kribi', quartierId: null, quartierAutre: 'Centre' }).ok).toBe(true);
    const sansDate = validerCandidatureCourte({ ...court(), disponibilite: 'a_partir_du' });
    expect(!sansDate.ok && sansDate.erreurs.disponibleLe).toBeTruthy();
    const sansPreavis = validerCandidatureCourte({ ...court(), disponibilite: 'preavis' });
    expect(!sansPreavis.ok && sansPreavis.erreurs.preavis).toBeTruthy();
    expect(validerCandidatureCourte({ ...court(), telephone: '12' }).ok).toBe(false);
    expect(validerCandidatureCourte({ ...court(), motivation: 'x'.repeat(2001) }).ok).toBe(false);
  });

  it('ne passe pas la validation complète de l’inscription : le compte léger reste « profil incomplet »', () => {
    const r = validerCandidatureCourte(court());
    if (!r.ok) throw new Error('formulaire court invalide');
    const d = r.donnees;
    const profil = validerProfil({
      nom: d.nom, prenom: d.prenom, telephone: d.telephone, whatsappIdentique: true, whatsapp: '', email: '',
      villeId: d.villeId, villeAutre: '', arrondissementId: null, quartierId: d.quartierId, quartierAutre: '', repere: '',
      zonesTouteVille: false, zonesArrondissementIds: [], zonesQuartierIds: [], metiers: [d.metier], secteurs: [], typesContrat: [],
      salaireMin: '', salaireMax: '', niveauEtudes: '', qualifications: '', experiences: [], competences: [],
      disponibilite: d.disponibilite, disponibleLe: '', preavis: '', horaires: [],
      consentementTraitement: true, consentementContact: true, consentementMajorite: true,
    });
    expect(profil.ok).toBe(false);
  });
});

describe('Offres (cas limites)', () => {
  it('accepte une offre ouverte, refuse une offre pourvue ou inconnue', () => {
    expect(refusOffre(getJobBySlug('agent-caisse-akwa'))).toBeNull();
    expect(refusOffre(getJobBySlug('agent-nettoyage'))).toBe(MESSAGE_OFFRE_POURVUE);
    expect(refusOffre(getJobBySlug('inexistante'))).toBe(MESSAGE_OFFRE_INCONNUE);
    expect(MESSAGE_OFFRE_POURVUE).toBe('Offre pourvue — inscrivez-vous pour être contacté.');
  });
});

describe('Attribution d’une candidature (RG-10)', () => {
  const t = (s: string) => new Date(`2026-11-0${s}T08:00:00Z`);

  it('responsable unique de l’offre, avant le référent du candidat', () => {
    expect(choisirResponsable([{ id: 'awa', charge: 9, designeLe: t('1') }], 'ben', 'yao')).toEqual({ referentId: 'awa', regle: 'responsable de l’offre' });
  });

  it('plusieurs responsables : le moins chargé, puis le premier désigné', () => {
    const r = [
      { id: 'awa', charge: 3, designeLe: t('1') },
      { id: 'ben', charge: 1, designeLe: t('3') },
      { id: 'cle', charge: 1, designeLe: t('2') },
    ];
    expect(choisirResponsable(r, null, null).referentId).toBe('cle');
  });

  it('sans responsable : référent du candidat, puis attribution par ville, sinon non attribuée', () => {
    expect(choisirResponsable([], 'ben', 'yao')).toEqual({ referentId: 'ben', regle: 'référent du candidat' });
    expect(choisirResponsable([], null, 'yao')).toEqual({ referentId: 'yao', regle: 'ville' });
    expect(choisirResponsable([], null, null)).toEqual({ referentId: null, regle: 'aucune' });
  });
});

describe('Statuts (RG-09)', () => {
  it('reçue → retenue / refusée uniquement', () => {
    expect(transitionCandidaturePermise('recue', 'retenue')).toBe(true);
    expect(transitionCandidaturePermise('recue', 'refusee')).toBe(true);
    expect(transitionCandidaturePermise('recue', 'recue')).toBe(false);
    expect(transitionCandidaturePermise('retenue', 'refusee')).toBe(false);
    expect(transitionCandidaturePermise('refusee', 'retenue')).toBe(false);
  });
});
