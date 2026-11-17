// POST-04 (ADR 0017 §4, §6) : règles pures de conservation et contenu de l'export « Mes données ».
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  anonymisationPrevueLe,
  construireExport,
  decisionConservation,
  derniereActivite,
  estFormatExport,
  limiteInactivite,
  MODELE_RELANCE_INACTIVITE,
  nomFichierExport,
  TEXTES_CONSERVATION,
  type EtatConservation,
  type LignesExport,
} from '@/lib/candidats/donnees';
import { pdfMesDonnees } from '@/lib/candidats/donnees-pdf';
import { CONSENTEMENTS } from '@/lib/candidats/domaine';
import { estModeleCandidat } from '@/lib/modeles/variables';

const MAINTENANT = new Date('2026-11-17T10:00:00Z');
const JOUR = 86_400_000;
const etat = (e: Partial<EtatConservation>): EtatConservation => ({ derniereActivite: MAINTENANT, relanceLe: null, processusActif: false, suppressionDemandee: false, supprime: false, ...e });

describe('Conservation — dates (RG-01, RG-02, RG-05)', () => {
  it('24 mois calendaires avant maintenant', () => {
    expect(limiteInactivite(MAINTENANT).toISOString()).toBe('2024-11-17T10:00:00.000Z');
  });

  it('anonymisation 30 jours après la relance', () => {
    expect(anonymisationPrevueLe(MAINTENANT).toISOString()).toBe('2026-12-17T10:00:00.000Z');
  });

  it('la dernière activité est la plus récente des dates connues', () => {
    const a = {
      creeLe: new Date('2022-01-01T00:00:00Z'),
      profilMisAJourLe: new Date('2022-01-01T00:00:00Z'),
      derniereConnexionLe: null,
      conservationConfirmeeLe: null,
      derniereCandidatureLe: new Date('2023-05-01T00:00:00Z'),
      derniereReponsePropositionLe: null,
      dernierPlacementConfirmeLe: null,
    };
    expect(derniereActivite(a).toISOString()).toBe('2023-05-01T00:00:00.000Z');
    expect(derniereActivite({ ...a, derniereConnexionLe: new Date('2024-02-02T00:00:00Z') }).toISOString()).toBe('2024-02-02T00:00:00.000Z');
    expect(derniereActivite({ ...a, conservationConfirmeeLe: new Date('2025-03-03T00:00:00Z') }).toISOString()).toBe('2025-03-03T00:00:00.000Z');
    expect(derniereActivite({ ...a, dernierPlacementConfirmeLe: new Date('2025-06-01T00:00:00Z') }).toISOString()).toBe('2025-06-01T00:00:00.000Z');
  });
});

describe('Conservation — décision (RG-02..07)', () => {
  const inactif = new Date(limiteInactivite(MAINTENANT).getTime() - JOUR);

  it('profil actif : rien', () => {
    expect(decisionConservation(etat({ derniereActivite: new Date(MAINTENANT.getTime() - 300 * JOUR) }), MAINTENANT)).toBe('aucune');
  });

  it('inactif depuis 24 mois (limite incluse) : relance', () => {
    expect(decisionConservation(etat({ derniereActivite: inactif }), MAINTENANT)).toBe('relancer');
    expect(decisionConservation(etat({ derniereActivite: limiteInactivite(MAINTENANT) }), MAINTENANT)).toBe('relancer');
    expect(decisionConservation(etat({ derniereActivite: new Date(limiteInactivite(MAINTENANT).getTime() + 1000) }), MAINTENANT)).toBe('aucune');
  });

  it('RG-06 : processus actif, ni relance ni anonymisation', () => {
    expect(decisionConservation(etat({ derniereActivite: inactif, processusActif: true }), MAINTENANT)).toBe('aucune');
  });

  it('RG-07 : suppression demandée ou données déjà supprimées : rien', () => {
    expect(decisionConservation(etat({ derniereActivite: inactif, suppressionDemandee: true }), MAINTENANT)).toBe('aucune');
    expect(decisionConservation(etat({ derniereActivite: inactif, relanceLe: new Date(MAINTENANT.getTime() - 40 * JOUR), supprime: true }), MAINTENANT)).toBe('aucune');
  });

  it('relance en cours : attendre 30 jours, puis anonymiser', () => {
    const relanceLe = new Date(MAINTENANT.getTime() - 29 * JOUR);
    expect(decisionConservation(etat({ derniereActivite: inactif, relanceLe }), MAINTENANT)).toBe('attendre');
    expect(decisionConservation(etat({ derniereActivite: inactif, relanceLe: new Date(MAINTENANT.getTime() - 30 * JOUR) }), MAINTENANT)).toBe('anonymiser');
  });

  it('RG-04 : une activité après la relance l’annule, même après 30 jours', () => {
    const relanceLe = new Date(MAINTENANT.getTime() - 45 * JOUR);
    expect(decisionConservation(etat({ derniereActivite: new Date(relanceLe.getTime() + 1000), relanceLe }), MAINTENANT)).toBe('annuler_relance');
    // Activité égale à la relance (posée au même instant) : ce n'est pas une réponse.
    expect(decisionConservation(etat({ derniereActivite: relanceLe, relanceLe }), MAINTENANT)).toBe('anonymiser');
  });

  it('RG-06 : un processus ouvert pendant la relance l’annule', () => {
    expect(decisionConservation(etat({ derniereActivite: inactif, relanceLe: new Date(MAINTENANT.getTime() - 40 * JOUR), processusActif: true }), MAINTENANT)).toBe('annuler_relance');
  });
});

describe('Conservation — textes (RG-03)', () => {
  it('le modèle WhatsApp est un modèle candidat et la migration le crée à l’identique', () => {
    expect(estModeleCandidat(MODELE_RELANCE_INACTIVITE.texte)).toBe(true);
    const migration = readFileSync('lib/db/migrations/0025_donnees_candidats.sql', 'utf8').replace(/\r\n/g, '\n');
    expect(migration).toContain(`('${MODELE_RELANCE_INACTIVITE.nom}', '{}', '${MODELE_RELANCE_INACTIVITE.texte.replace(/'/g, "''")}')`);
  });

  it('la notification et l’e-mail donnent la date d’anonymisation (heure de Douala)', () => {
    const relanceLe = new Date('2026-11-30T23:30:00Z'); // + 30 j = 30 décembre 23 h 30 UTC = 31 décembre à Douala
    expect(TEXTES_CONSERVATION.notificationRelance(relanceLe).texte).toContain('31 décembre 2026');
    const e = TEXTES_CONSERVATION.emailRelance('Josiane', relanceLe, 'https://nexclean.xyz/candidat/connexion');
    expect(e.text).toContain('Bonjour Josiane');
    expect(e.text).toContain('https://nexclean.xyz/candidat/connexion');
  });
});

// ─── Export (RG-09..14) ───────────────────────────────────────

const lignes = (extra: Partial<LignesExport> = {}): LignesExport => ({
  candidat: {
    id: 12,
    nom: 'Mballa',
    prenom: 'Josiane',
    telephone: '+237690000001',
    whatsapp: '+237690000001',
    email: 'josiane@example.test',
    ville: 'Douala',
    arrondissement: 'Douala 1er',
    quartier: 'Akwa',
    repere: 'Près de la pharmacie',
    zonesTouteVille: false,
    zones: ['Douala 1er', 'Bonapriso'],
    metiers: ['Agent d’entretien'],
    secteurs: [],
    typesContrat: ['CDI'],
    salaireMin: 60000,
    salaireMax: null,
    niveauEtudes: 'BEPC / CAP',
    qualifications: null,
    competences: ['Repassage'],
    disponibilite: 'immediate',
    disponibleLe: null,
    preavis: null,
    horaires: ['jour', 'weekend'],
    enRecherche: true,
    canalInscription: 'site',
    creeLe: new Date('2026-01-10T08:00:00Z'),
    profilMisAJourLe: new Date('2026-02-10T08:00:00Z'),
    derniereConnexionLe: null,
  },
  consentements: [
    { type: 'traitement', version: CONSENTEMENTS.traitement.version, canal: 'site', ip: '10.0.0.1', horodatage: new Date('2026-01-10T08:00:00Z') },
    { type: 'contact', version: '2020-01-01', canal: 'assiste', ip: null, horodatage: new Date('2026-01-10T08:00:00Z') },
  ],
  experiences: [{ poste: 'Femme de ménage', employeur: 'Hôtel X', ville: 'Douala', duree: '2 ans', missions: 'Chambres' }],
  documents: [{ categorie: 'cv', nomOrigine: 'cv-josiane.pdf', taille: 20480, creeLe: new Date('2026-01-10T08:05:00Z') }],
  candidatures: [{ offreTitre: 'Agent de caisse', offreSlug: 'agent-de-caisse', motivation: 'Motivée', statut: 'refusee', creeLe: new Date('2026-03-01T08:00:00Z') }],
  propositions: [
    {
      id: 5,
      poste: 'Agent d’entretien',
      client: 'Hôtel Akwa Palace',
      libelleStatut: 'Placé(e)',
      secteur: 'Hôtellerie',
      ville: 'Akwa, Douala',
      typeContrat: 'CDI',
      salaire: null,
      creeLe: new Date('2026-04-01T08:00:00Z'),
      accordMode: 'whatsapp',
      accordLe: new Date('2026-04-02T08:00:00Z'),
      reponseLe: new Date('2026-04-02T08:00:00Z'),
      numeroCommunicable: true,
      entretienLe: null,
      entretienLieu: null,
    },
  ],
  placements: [{ propositionId: 5, poste: 'Agent d’entretien', client: 'Hôtel Akwa Palace', statut: 'confirme', datePrevue: '2026-04-15', datePriseDePoste: '2026-04-16', finLe: null }],
  notifications: [{ titre: 'Placement confirmé', texte: 'Bonne prise de poste !', creeLe: new Date('2026-04-16T08:00:00Z'), luLe: null }],
  ...extra,
});

const RESPONSABLE = { nom: 'NEXCLEAN SARL', contact: 'contact@nexclean.xyz' };

describe('Export « Mes données » — contenu (RG-10, RG-11)', () => {
  const e = construireExport(lignes(), MAINTENANT, RESPONSABLE);

  it('porte le format, la version, la date et le responsable du traitement', () => {
    expect(e).toMatchObject({ format: 'nexclean-mes-donnees', version: 1, genereLe: MAINTENANT.toISOString(), responsableDuTraitement: RESPONSABLE });
  });

  it('reprend le profil, avec des libellés lisibles', () => {
    expect(e.profil).toMatchObject({ nom: 'Mballa', prenom: 'Josiane', email: 'josiane@example.test', telephone: '+237690000001' });
    expect(e.profil.localisation.zonesAcceptees).toEqual(['Douala 1er', 'Bonapriso']);
    expect(e.profil.disponibilite).toMatchObject({ disponibilite: 'Disponible immédiatement', horaires: ['De jour', 'Le week-end'] });
    expect(construireExport(lignes({ candidat: { ...lignes().candidat, zonesTouteVille: true } }), MAINTENANT, RESPONSABLE).profil.localisation.zonesAcceptees).toEqual(['Toute la ville']);
  });

  it('consentements : version et horodatage ; le texte seulement s’il correspond à la version acceptée', () => {
    expect(e.consentements[0]).toEqual({ type: 'traitement', texte: CONSENTEMENTS.traitement.texte, version: CONSENTEMENTS.traitement.version, canal: 'site', ip: '10.0.0.1', horodatage: '2026-01-10T08:00:00.000Z' });
    expect(e.consentements[1]!.texte).toBeNull();
  });

  it('propositions avec l’accord, placements et candidatures avec les libellés montrés au candidat', () => {
    expect(e.propositions[0]).toMatchObject({ client: 'Hôtel Akwa Palace', statut: 'Placé(e)', accord: { mode: 'Par WhatsApp, enregistré par votre conseiller', le: '2026-04-02T08:00:00.000Z', numeroCommunicable: true } });
    expect(e.placements[0]).toMatchObject({ statut: 'Confirmé', datePriseDePoste: '2026-04-16' });
    expect(e.candidatures[0]).toMatchObject({ offre: 'Agent de caisse', statut: 'Non retenue', motivation: 'Motivée', lienOffre: '/recrutement/agent-de-caisse' });
    expect(e.documents[0]).toEqual({ categorie: 'CV', nom: 'cv-josiane.pdf', tailleOctets: 20480, deposeLe: '2026-01-10T08:05:00.000Z' });
  });

  it('ne contient jamais de données internes ni de secrets', () => {
    const json = JSON.stringify(e);
    for (const interdit of ['motDePasse', 'mot_de_passe', 'jeton', 'empreinte', 'referent', '"statut":"place"', '"cle"','retourClient', 'accordPreuve', 'salaireConvenu']) expect(json).not.toContain(interdit);
  });

  it('format et nom de fichier (jour à Douala)', () => {
    expect(estFormatExport('json')).toBe(true);
    expect(estFormatExport('pdf')).toBe(true);
    expect(estFormatExport('csv')).toBe(false);
    expect(estFormatExport(null)).toBe(false);
    expect(nomFichierExport('json', new Date('2026-11-17T23:30:00Z'))).toBe('nexclean-mes-donnees-2026-11-18.json');
  });
});

describe('Export « Mes données » — PDF (RG-10)', () => {
  it('produit un PDF lisible, paginé quand il est long', async () => {
    const court = await pdfMesDonnees(construireExport(lignes(), MAINTENANT, RESPONSABLE), 'NEXCLEAN — Douala');
    expect(new TextDecoder().decode(court.slice(0, 5))).toBe('%PDF-');
    expect((await PDFDocument.load(court)).getPageCount()).toBeGreaterThanOrEqual(1);
    const notifications = Array.from({ length: 80 }, (_, i) => ({ titre: `Notification ${i}`, texte: 'Texte assez long pour occuper une ligne entière du document PDF généré.', creeLe: MAINTENANT, luLe: null }));
    const long = await pdfMesDonnees(construireExport(lignes({ notifications }), MAINTENANT, RESPONSABLE), 'NEXCLEAN — Douala');
    expect((await PDFDocument.load(long)).getPageCount()).toBeGreaterThan(1);
  });

  it('supporte un profil presque vide (compte léger)', async () => {
    const vide = lignes({ consentements: [], experiences: [], documents: [], candidatures: [], propositions: [], placements: [], notifications: [] });
    const pdf = await pdfMesDonnees(construireExport({ ...vide, candidat: { ...vide.candidat, email: null, zones: [], competences: [], horaires: [], disponibilite: null } }, MAINTENANT, RESPONSABLE), 'x'.repeat(20));
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeLessThanOrEqual(2);
  });
});
