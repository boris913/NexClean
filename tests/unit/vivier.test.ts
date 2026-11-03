// Règles pures du vivier (MVP2-02) : filtres d'URL, rayon, zones, expérience, texte, lien
// « Trouver des candidats » (RG-16), jours ouvrés de l'alerte « non traités » (RG-03).
import { describe, expect, it } from 'vitest';
import { HEURES_OUVREES_PAR_DEFAUT as H } from '@/lib/parametres';
import {
  ACCENTS,
  SANS_ACCENTS,
  anneesDepuisDuree,
  criteresProfil,
  distanceKm,
  echapperLike,
  experienceMinimale,
  lienTrouverCandidats,
  lireFiltres,
  motsRecherche,
  normaliserTexte,
  parametresFiltres,
  statutsExclus,
  zonesCouvrent,
} from '@/lib/candidats/recherche';
import { ajouterJoursOuvres, echeanceAlerteNonTraite } from '@/lib/candidats/escalade';

const douala = (s: string) => new Date(`${s}+01:00`);

// Centroïdes approximatifs (Douala), comme ceux saisis dans le référentiel.
const AKWA = { latitude: 4.0511, longitude: 9.7 };
const BONAPRISO = { latitude: 4.035, longitude: 9.69 };
const BONABERI = { latitude: 4.07, longitude: 9.63 };

describe('Rayon (RG-14)', () => {
  it('Akwa 0 km, Bonapriso ≈ 2 km, Bonabéri ≈ 8 km : seuls les deux premiers à 5 km d’Akwa', () => {
    expect(distanceKm(AKWA, AKWA)).toBe(0);
    expect(distanceKm(AKWA, BONAPRISO)).toBeGreaterThan(1.5);
    expect(distanceKm(AKWA, BONAPRISO)).toBeLessThan(2.5);
    expect(distanceKm(AKWA, BONABERI)).toBeGreaterThan(7.5);
    expect(distanceKm(AKWA, BONABERI)).toBeLessThan(8.5);
    const dans5 = Object.entries({ Akwa: AKWA, Bonapriso: BONAPRISO, Bonabéri: BONABERI })
      .filter(([, p]) => distanceKm(AKWA, p) <= 5)
      .map(([n]) => n);
    expect(dans5).toEqual(['Akwa', 'Bonapriso']);
  });
  it('est symétrique', () => {
    expect(distanceKm(AKWA, BONABERI)).toBeCloseTo(distanceKm(BONABERI, AKWA), 9);
  });
});

describe('Zones de travail acceptées', () => {
  const lieu = { villeId: 1, arrondissementId: 10, quartierId: 100 };
  it('« toute la ville » couvre tout lieu de cette ville, pas d’une autre', () => {
    expect(zonesCouvrent({ villeId: 1, zonesTouteVille: true, zonesArrondissementIds: [], zonesQuartierIds: [] }, lieu)).toBe(true);
    expect(zonesCouvrent({ villeId: 2, zonesTouteVille: true, zonesArrondissementIds: [], zonesQuartierIds: [] }, lieu)).toBe(false);
  });
  it('un quartier ou l’arrondissement du lieu', () => {
    expect(zonesCouvrent({ villeId: 1, zonesTouteVille: false, zonesArrondissementIds: [], zonesQuartierIds: [100] }, lieu)).toBe(true);
    expect(zonesCouvrent({ villeId: 1, zonesTouteVille: false, zonesArrondissementIds: [10], zonesQuartierIds: [] }, lieu)).toBe(true);
    expect(zonesCouvrent({ villeId: 1, zonesTouteVille: false, zonesArrondissementIds: [11], zonesQuartierIds: [101] }, lieu)).toBe(false);
    expect(zonesCouvrent({ villeId: 1, zonesTouteVille: false, zonesArrondissementIds: [10], zonesQuartierIds: [] }, { ...lieu, arrondissementId: null })).toBe(false);
  });
});

describe('Expérience', () => {
  it('lit les durées saisies librement', () => {
    expect(anneesDepuisDuree('2 ans')).toBe(2);
    expect(anneesDepuisDuree('1 an')).toBe(1);
    expect(anneesDepuisDuree('18 mois')).toBe(1.5);
    expect(anneesDepuisDuree('1 an et 6 mois')).toBe(1.5);
    expect(anneesDepuisDuree(' 3 ')).toBe(3);
    expect(anneesDepuisDuree('quelques semaines')).toBe(0);
    expect(anneesDepuisDuree(null)).toBe(0);
  });
  it('expérience minimale d’une ligne de poste', () => {
    expect(experienceMinimale('Débutant accepté')).toBeUndefined();
    expect(experienceMinimale('Moins d’1 an')).toBeUndefined();
    expect(experienceMinimale('1 à 3 ans')).toBe(1);
    expect(experienceMinimale('3 à 5 ans')).toBe(3);
    expect(experienceMinimale('Plus de 5 ans')).toBe(5);
    expect(experienceMinimale('2 ans minimum')).toBe(2);
    expect(experienceMinimale(null)).toBeUndefined();
  });
});

describe('Plein texte (RG-15)', () => {
  it('la table de translate() est caractère pour caractère', () => {
    expect([...ACCENTS].length).toBe([...SANS_ACCENTS].length);
  });
  it('insensible aux accents et à la casse', () => {
    expect(normaliserTexte('Pâtissière ÉLECTRICITÉ Çà')).toBe('patissiere electricite ca');
    expect(normaliserTexte('Agent d’entretien')).toBe("agent d'entretien");
    expect(motsRecherche('  Cuisinière, hôtel  a ')).toEqual(['cuisiniere', 'hotel']);
    expect(motsRecherche(undefined)).toEqual([]);
  });
  it('échappe les jokers LIKE', () => {
    expect(echapperLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
  });
});

describe('Filtres dans l’URL', () => {
  it('ignore les valeurs invalides', () => {
    const f = lireFiltres({ ville: 'abc', rayon: '500', contrat: 'Contrat bidon', statut: 'inconnu', du: '2026-13-45', exp: '-2', page: '0', tri: 'nimporte' });
    expect(f).toMatchObject({ villeId: undefined, rayonKm: undefined, contrat: undefined, statut: undefined, inscritDu: undefined, experienceMin: undefined, page: 1, tri: 'recent' });
  });
  it('aller-retour filtres ↔ paramètres', () => {
    const p = { q: 'serveur', ville: '1', quartier: '12', rayon: '5', metier: 'Serveur', contrat: 'CDD', exp: '1', competences: 'caisse, service', dispo: 'immediate', pretention: '80 000', complet: '1', souple: '1', tri: 'pertinence' };
    const f = lireFiltres(p);
    expect(f).toMatchObject({ villeId: 1, quartierId: 12, rayonKm: 5, metier: 'Serveur', contrat: 'CDD', experienceMin: 1, competences: ['caisse', 'service'], disponibleImmediatement: true, pretentionMax: 80000, profilComplet: true, souple: true, tri: 'pertinence' });
    expect(lireFiltres(parametresFiltres(f))).toEqual(f);
    expect(parametresFiltres(lireFiltres({}))).toEqual({});
    expect(criteresProfil(f)).toBe(7);
  });
  it('« placé » et « indisponible » exclus par défaut (RG-06), sauf case cochée ou statut demandé', () => {
    expect(statutsExclus(lireFiltres({}))).toEqual(['place', 'indisponible']);
    expect(statutsExclus(lireFiltres({ inactifs: '1' }))).toEqual([]);
    expect(statutsExclus(lireFiltres({ statut: 'place' }))).toEqual([]);
  });
});

describe('« Trouver des candidats » depuis une ligne de poste (RG-16)', () => {
  it('« Serveur, CDD, Bonamoussadi » : ville, quartier, rayon 5 km, métier, contrat, expérience, tri par pertinence', () => {
    const lien = lienTrouverCandidats({ intitule: 'Serveur', typeContrat: 'CDD', experience: '1 à 3 ans' }, { villeId: 1, quartierId: 42, quartierGeolocalise: true });
    const [chemin, requete] = lien.split('?');
    expect(chemin).toBe('/admin/candidats');
    const p = Object.fromEntries(new URLSearchParams(requete));
    expect(p).toEqual({ onglet: 'vivier', ville: '1', quartier: '42', rayon: '5', metier: 'Serveur', contrat: 'CDD', exp: '1', souple: '1', tri: 'pertinence' });
    // Les filtres sont ceux de la recherche : modifiables dans le formulaire.
    expect(lireFiltres(p)).toMatchObject({ villeId: 1, quartierId: 42, rayonKm: 5, metier: 'Serveur', contrat: 'CDD', experienceMin: 1, souple: true, tri: 'pertinence' });
  });
  it('quartier sans centroïde : pas de rayon ; débutant accepté : pas d’expérience minimale', () => {
    const p = Object.fromEntries(new URLSearchParams(lienTrouverCandidats({ intitule: 'Agent de caisse', typeContrat: null, experience: 'Débutant accepté' }, { villeId: 2, quartierId: 7, quartierGeolocalise: false }).split('?')[1]));
    expect(p).toEqual({ onglet: 'vivier', ville: '2', quartier: '7', metier: 'Agent de caisse', souple: '1', tri: 'pertinence' });
  });
});

describe('Alerte « non traités depuis 5 jours ouvrés » (RG-03)', () => {
  it('lundi–samedi ouvrés : vendredi 10 h + 5 jours ouvrés = jeudi 10 h (dimanche non compté)', () => {
    // 2026-11-06 est un vendredi.
    expect(ajouterJoursOuvres(douala('2026-11-06T10:00:00'), 5, H)).toEqual(douala('2026-11-12T10:00:00'));
  });
  it('compte depuis l’attribution, puis depuis la dernière alerte', () => {
    const creeLe = douala('2026-11-02T09:00:00');
    expect(echeanceAlerteNonTraite({ creeLe, attribueLe: douala('2026-11-02T09:00:00'), alerteNonTraiteLe: null }, H)).toEqual(douala('2026-11-07T09:00:00'));
    expect(echeanceAlerteNonTraite({ creeLe, attribueLe: creeLe, alerteNonTraiteLe: douala('2026-11-07T09:00:00') }, H)).toEqual(douala('2026-11-13T09:00:00'));
  });
});
