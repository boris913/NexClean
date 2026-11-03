// Tests d'intégration de l'espace candidat (specs/MVP2-01) sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Espace candidat (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-candidats-'));

  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const collab = await import('@/lib/collaborateurs/service');
  const svc = await import('@/lib/candidats/service');
  const { brouillonCandidatVide, pseudonyme } = await import('@/lib/candidats/domaine');

  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, ...new Array(64).fill(0x20)]);
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)]);
  const MDP = 'motdepasse-1';
  let douala: number;
  let akwa: number;
  let direction: string;

  const brouillon = (telephone: string, extra: Partial<ReturnType<typeof brouillonCandidatVide>> = {}) => ({
    ...brouillonCandidatVide(),
    nom: 'Mballa',
    prenom: 'Josiane',
    telephone,
    villeId: douala,
    quartierId: akwa,
    zonesTouteVille: true,
    metiers: ['Agent d’entretien'],
    typesContrat: ['CDI'],
    niveauEtudes: 'BEPC / CAP',
    experiences: [{ poste: 'Femme de ménage', employeur: 'Hôtel X', ville: 'Douala', duree: '2 ans', missions: 'Chambres' }],
    disponibilite: 'immediate' as const,
    consentementTraitement: true,
    consentementContact: true,
    consentementMajorite: true,
    ...extra,
  });
  const fichierExiste = (cle: string) => fs.access(path.join(process.env.STORAGE_DIR!, cle)).then(() => true, () => false);

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    douala = (await getDb().select().from(schema.ville).where(eq(schema.ville.nom, 'Douala')))[0]!.id;
    akwa = (await getDb().select().from(schema.quartier).where(eq(schema.quartier.nom, 'Akwa')))[0]!.id;
    direction = (await collab.creerCollaborateur({ nom: 'Dir', email: 'dir-candidats@nexclean.test', roles: ['direction'] }, { id: null })).userId;
  });

  describe('Inscription (RG-01..05)', () => {
    it('refuse l’inscription sans le consentement (b) (RG-03)', async () => {
      await expect(svc.inscrireCandidat(brouillon('690000001', { consentementContact: false }), MDP, { ip: null })).rejects.toThrow(/consentements/);
      expect(await getDb().select().from(schema.candidat)).toHaveLength(0);
    });

    it('crée le candidat « nouveau », ses expériences et 3 consentements versionnés', async () => {
      const { candidatId } = await svc.inscrireCandidat(brouillon('690000001'), MDP, { ip: '10.0.0.1' });
      const [c] = await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, candidatId));
      expect(c).toMatchObject({ telephone: '+237690000001', whatsapp: '+237690000001', statut: 'nouveau', referentId: null });
      expect(c!.motDePasse).toMatch(/^\$argon2id\$/);
      expect(await getDb().select().from(schema.candidatExperience).where(eq(schema.candidatExperience.candidatId, candidatId))).toHaveLength(1);
      const consentements = await getDb().select().from(schema.candidatConsentement).where(eq(schema.candidatConsentement.candidatId, candidatId));
      expect(consentements.map((x) => x.type).sort()).toEqual(['contact', 'majorite', 'traitement']);
      expect(consentements.every((x) => x.version && x.canal === 'site' && x.ip === '10.0.0.1')).toBe(true);
    });

    it('refuse un numéro déjà inscrit, quel que soit son format (RG-04)', async () => {
      await expect(svc.inscrireCandidat(brouillon('+237 6 90 00 00 01'), MDP, { ip: null })).rejects.toThrow(svc.MESSAGE_DEJA_INSCRIT);
      await expect(svc.inscrireCandidat(brouillon('690 00 00 01'), MDP, { ip: null })).rejects.toThrow(svc.MESSAGE_DEJA_INSCRIT);
    });

    it('refuse un mot de passe trop court, accepte un code à 6 chiffres', async () => {
      await expect(svc.inscrireCandidat(brouillon('690000002'), '12345', { ip: null })).rejects.toThrow(/8 caractères/);
      await expect(svc.inscrireCandidat(brouillon('690000002'), '135790', { ip: null })).resolves.toBeTruthy();
    });
  });

  describe('Connexion (RG-06)', () => {
    it('connecte avec le téléphone dans n’importe quel format', async () => {
      expect(await svc.verifierConnexion('6 90 00 00 01', MDP, '10.0.0.2')).toBeGreaterThan(0);
    });

    it('bloque après 5 échecs en 15 minutes, même avec le bon mot de passe ensuite', async () => {
      for (let i = 0; i < 5; i++) await expect(svc.verifierConnexion('690000002', 'mauvais-mdp', '10.0.0.3')).rejects.toThrow(svc.MESSAGE_IDENTIFIANTS);
      await expect(svc.verifierConnexion('690000002', '135790', '10.0.0.9')).rejects.toThrow(svc.MESSAGE_BLOQUE);
    });
  });

  describe('Espace et profil (RG-09..11)', () => {
    it('calcule la complétude et liste ce qui manque', async () => {
      const id = await svc.verifierConnexion('690000001', MDP, null);
      const e = await svc.lireEspace(id);
      expect(e.enRecherche).toBe(true);
      expect(e.completude.pourcentage).toBeGreaterThan(40);
      expect(e.completude.manquants).toContain('votre CV');
      expect(e.rappelMiseAJour).toBe(false);
      expect(JSON.stringify(e)).not.toMatch(/motDePasse|referentId|"statut"/);
    });

    it('modifie le profil sans changer le téléphone (RG-08)', async () => {
      const id = await svc.verifierConnexion('690000001', MDP, null);
      const b = svc.versBrouillon(await svc.lireEspace(id));
      await svc.modifierProfil(id, { ...b, telephone: '699999999', metiers: ['Serveur', 'Barman'], experiences: [] }, null);
      const [c] = await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, id));
      expect(c!.telephone).toBe('+237690000001');
      expect(c!.metiers).toEqual(['Serveur', 'Barman']);
      expect(await getDb().select().from(schema.candidatExperience).where(eq(schema.candidatExperience.candidatId, id))).toHaveLength(0);
    });

    it('« Je ne cherche plus » rend indisponible, la reprise restaure le statut (RG-10)', async () => {
      const id = await svc.verifierConnexion('690000001', MDP, null);
      await getDb().update(schema.candidat).set({ statut: 'preselectionne' }).where(eq(schema.candidat.id, id));
      await svc.definirRecherche(id, false, null);
      expect((await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, id)))[0]!.statut).toBe('indisponible');
      expect((await svc.lireEspace(id)).enRecherche).toBe(false);
      await svc.definirRecherche(id, true, null);
      expect((await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, id)))[0]!.statut).toBe('preselectionne');
    });

    it('affiche le rappel de mise à jour après 6 mois (RG-11)', async () => {
      const id = await svc.verifierConnexion('690000001', MDP, null);
      await getDb().update(schema.candidat).set({ profilMisAJourLe: new Date(Date.now() - 200 * 86_400_000) }).where(eq(schema.candidat.id, id));
      expect((await svc.lireEspace(id)).rappelMiseAJour).toBe(true);
    });
  });

  describe('Documents', () => {
    it('remplace le CV (ancien fichier effacé) et limite les justificatifs à 5', async () => {
      const id = await svc.verifierConnexion('690000001', MDP, null);
      await svc.ajouterDocument(id, 'cv', 'cv.pdf', PDF, null);
      const [premier] = await getDb().select().from(schema.candidatDocument).where(eq(schema.candidatDocument.candidatId, id));
      await svc.ajouterDocument(id, 'cv', 'cv-photo.png', PNG, null);
      const cvs = await getDb().select().from(schema.candidatDocument).where(and(eq(schema.candidatDocument.candidatId, id), eq(schema.candidatDocument.categorie, 'cv')));
      expect(cvs).toHaveLength(1);
      expect(cvs[0]!.nomOrigine).toBe('cv-photo.png');
      expect(await fichierExiste(premier!.cle)).toBe(false);
      for (let i = 0; i < 5; i++) await svc.ajouterDocument(id, 'justificatif', `j${i}.pdf`, PDF, null);
      await expect(svc.ajouterDocument(id, 'justificatif', 'j6.pdf', PDF, null)).rejects.toThrow(/5 justificatifs/);
      await expect(svc.ajouterDocument(id, 'cv', 'faux.pdf', new Uint8Array(80).fill(65), null)).rejects.toThrow();
      expect((await svc.lireEspace(id)).completude.manquants).not.toContain('votre CV');
    });
  });

  describe('Mot de passe oublié (RG-07)', () => {
    it('sans e-mail : tâche assistée chez la Direction (non attribué), aucun lien envoyé', async () => {
      const [c] = await getDb().select().from(schema.candidat).where(eq(schema.candidat.telephone, '+237690000002'));
      await svc.demanderReinitialisation('690000002', null);
      await svc.demanderReinitialisation('690000002', null); // une seule demande ouverte
      expect(await getDb().select().from(schema.candidatDemandeReinitialisation).where(eq(schema.candidatDemandeReinitialisation.candidatId, c!.id))).toHaveLength(1);
      expect(await getDb().select().from(schema.candidatJeton).where(eq(schema.candidatJeton.candidatId, c!.id))).toHaveLength(0);
      const notifs = await getDb().select().from(schema.notification).where(eq(schema.notification.destinataireId, direction));
      expect(notifs.some((n) => n.type === 'reinitialisation_candidat')).toBe(true);
    });

    it('avec e-mail : lien à usage unique, puis nouveau mot de passe et sessions fermées', async () => {
      const id = await svc.verifierConnexion('690000001', MDP, null);
      await getDb().update(schema.candidat).set({ email: 'josiane@exemple.cm' }).where(eq(schema.candidat.id, id));
      const log = vi.spyOn(console, 'info');
      await svc.demanderReinitialisation('690000001', null);
      const jeton = String(log.mock.calls.at(-1)?.[0]).match(/reinitialiser\/([A-Za-z0-9_-]+)/)![1]!;
      expect(await svc.lireJetonReinitialisation(jeton)).toEqual({ prenom: 'Josiane' });
      await getDb().insert(schema.candidatSession).values({ empreinte: 'x'.repeat(64), candidatId: id, expireLe: new Date(Date.now() + 3_600_000) });
      await svc.reinitialiserMotDePasse(jeton, 'nouveau-mdp-1', null);
      expect(await getDb().select().from(schema.candidatSession).where(eq(schema.candidatSession.candidatId, id))).toHaveLength(0);
      await expect(svc.reinitialiserMotDePasse(jeton, 'encore-un-1', null)).rejects.toThrow(/invalide ou expiré/);
      expect(await svc.verifierConnexion('690000001', 'nouveau-mdp-1', null)).toBe(id);
    });

    it('un numéro inconnu ne révèle rien', async () => {
      await expect(svc.demanderReinitialisation('699888777', null)).resolves.toBeUndefined();
    });
  });

  describe('Suppression des données (RG-15..18)', () => {
    it('bloque la connexion dès la demande (RG-16), puis supprime fichiers et données à l’échéance (RG-17)', async () => {
      const id = await svc.verifierConnexion('690000001', 'nouveau-mdp-1', null);
      const cles = (await getDb().select().from(schema.candidatDocument).where(eq(schema.candidatDocument.candidatId, id))).map((d) => d.cle);
      expect(cles.length).toBeGreaterThan(0);
      await expect(svc.demanderSuppression(id, 'mauvais', null)).rejects.toThrow(/incorrect/);
      const { prevueLe } = await svc.demanderSuppression(id, 'nouveau-mdp-1', null);
      expect(prevueLe.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
      await expect(svc.verifierConnexion('690000001', 'nouveau-mdp-1', null)).rejects.toThrow(svc.MESSAGE_SUPPRESSION_EN_COURS);
      await getDb().insert(schema.candidature).values({ candidatId: id, offreSlug: 'agent-de-caisse', offreTitre: 'Agent de caisse' });

      expect(await svc.executerSuppressionsDues()).toBe(0); // pas encore échu
      expect(await svc.executerSuppressionsDues(new Date(prevueLe.getTime() + 1000))).toBe(1);
      const [c] = await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, id));
      expect(c).toMatchObject({ telephone: null, email: null, prenom: '', nom: pseudonyme(id), motDePasse: null, statut: 'indisponible' });
      expect(c!.supprimeLe).toBeTruthy();
      for (const cle of cles) expect(await fichierExiste(cle)).toBe(false);
      expect(await getDb().select().from(schema.candidatDocument).where(eq(schema.candidatDocument.candidatId, id))).toHaveLength(0);
      expect(await getDb().select().from(schema.candidatConsentement).where(eq(schema.candidatConsentement.candidatId, id))).toHaveLength(0);
      expect(await getDb().select().from(schema.candidature).where(eq(schema.candidature.candidatId, id))).toHaveLength(0);
      const audit = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'candidat.donnees_supprimees'));
      expect(audit).toHaveLength(1);
      // Le numéro est libéré : la personne peut se réinscrire.
      await expect(svc.inscrireCandidat(brouillon('690000001'), MDP, { ip: null })).resolves.toBeTruthy();
    });
  });
});
