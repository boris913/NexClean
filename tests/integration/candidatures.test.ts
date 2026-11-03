// Candidatures aux offres (specs/MVP2-02 RG-07..12) sur une vraie base PostgreSQL.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Candidatures (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-candidatures-'));

  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const collab = await import('@/lib/collaborateurs/service');
  const svc = await import('@/lib/candidats/service');
  const k = await import('@/lib/candidats/candidatures');
  const { brouillonCandidatVide } = await import('@/lib/candidats/domaine');
  const { brouillonCandidatureVide, MESSAGE_DEJA_POSTULE, MESSAGE_OFFRE_POURVUE } = await import('@/lib/candidats/formulaire-candidature');

  type R = 'referent' | 'direction';
  const MDP = 'motdepasse-1';
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, ...new Array(64).fill(0x20)]);
  const CAISSE = 'agent-caisse-akwa';
  const CM = 'community-manager';
  let douala: number;
  let yaounde: number;
  let akwa: number;
  let dir: { id: string; roles: R[] };
  let awa: { id: string; roles: R[] };
  let ben: { id: string; roles: R[] };
  let net: { id: string; roles: R[] };

  const court = (telephone: string, extra: Partial<ReturnType<typeof brouillonCandidatureVide>> = {}) => ({
    ...brouillonCandidatureVide('Agent de caisse'),
    nom: 'Ngo',
    prenom: 'Awa',
    telephone,
    villeId: douala,
    quartierId: akwa,
    experience: '1 à 3 ans' as const,
    disponibilite: 'immediate' as const,
    consentementTraitement: true,
    consentementContact: true,
    consentementMajorite: true,
    ...extra,
  });
  const candidature = async (id: number) => (await getDb().select().from(schema.candidature).where(eq(schema.candidature.id, id)))[0]!;
  const candidat = async (id: number) => (await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, id)))[0]!;

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    const villes = await geo.listesLieux();
    douala = villes.find((v) => v.nom === 'Douala')!.id;
    yaounde = villes.find((v) => v.nom === 'Yaoundé')!.id;
    akwa = villes.find((v) => v.nom === 'Douala')!.quartiers.find((q) => q.nom === 'Akwa')!.id;
    const mk = async (nom: string, roles: R[], services: ('NET' | 'REC')[], villeIds: number[]) => {
      const id = (await collab.creerCollaborateur({ nom, email: `${nom.toLowerCase().split(' ')[0]}-k@nexclean.test`, roles }, { id: null })).userId;
      if (services.length) await collab.definirAttributs(id, { services, villeIds, telephone: '+237690000099', capacite: null, absentDu: null, absentAu: null }, { id: null });
      return { id, roles };
    };
    dir = await mk('Diane Direction', ['direction'], [], []);
    awa = await mk('Awa Recrutement', ['referent'], ['REC'], [douala]);
    ben = await mk('Ben Recrutement', ['referent'], ['REC'], [yaounde]);
    net = await mk('Nadia Nettoyage', ['referent'], ['NET'], [douala]);
  });

  afterEach(() => vi.restoreAllMocks());

  describe('Visiteur non inscrit (RG-07, RG-11)', () => {
    it('postule à « Agent de caisse » : compte léger + Candidature « reçue », sans aucun appel externe', async () => {
      const appels = vi.spyOn(globalThis, 'fetch');
      const r = await k.postulerAvecCompteLeger(court('677000001', { motivation: 'Disponible tout de suite.' }), MDP, CAISSE, { nom: 'cv.pdf', octets: PDF }, { ip: '10.1.0.1' });
      // RG-07 / RG-11 : ni webhook Google Sheet ni e-mail avec CV (les e-mails partent par la file de notifications).
      expect(appels).not.toHaveBeenCalled();

      const c = await candidat(r.candidatId);
      expect(c).toMatchObject({ telephone: '+237677000001', compteLeger: true, statut: 'nouveau', metiers: ['Agent de caisse'], villeId: douala, quartierId: akwa, disponibilite: 'immediate', referentId: awa.id });
      expect(c.motDePasse).toMatch(/^\$argon2id\$/);
      expect(c.arrondissementId).not.toBeNull();
      const consentements = await getDb().select().from(schema.candidatConsentement).where(eq(schema.candidatConsentement.candidatId, r.candidatId));
      expect(consentements.map((x) => x.type).sort()).toEqual(['contact', 'majorite', 'traitement']);
      expect(await getDb().select().from(schema.candidatExperience).where(eq(schema.candidatExperience.candidatId, r.candidatId))).toMatchObject([{ poste: 'Agent de caisse', duree: '1 à 3 ans' }]);

      const kd = await candidature(r.candidatureId);
      expect(kd).toMatchObject({ candidatId: r.candidatId, offreSlug: CAISSE, statut: 'recue', motivation: 'Disponible tout de suite.', referentId: awa.id });
      expect(kd.offreTitre).toMatch(/Agent de caisse/);
      expect(r.cvEnregistre).toBe(true);
      expect(await getDb().select().from(schema.candidatDocument).where(and(eq(schema.candidatDocument.candidatId, r.candidatId), eq(schema.candidatDocument.categorie, 'cv')))).toHaveLength(1);

      // Notification interne in-app + e-mail, sans pièce jointe ni CV.
      const notifs = await getDb().select().from(schema.notification).where(eq(schema.notification.type, 'candidature_recue'));
      expect(notifs).toHaveLength(1);
      expect(notifs[0]).toMatchObject({ destinataireId: awa.id, email: true, inApp: true });
      expect(notifs[0]!.texte).toMatch(/Ngo/);
      expect(notifs[0]!.texte).not.toMatch(/cv\.pdf/);
      // Journal : inscription (compte léger) et candidature.
      const journal = await getDb().select({ action: schema.journalAudit.action }).from(schema.journalAudit).where(eq(schema.journalAudit.objetId, String(r.candidatureId)));
      expect(journal.map((j) => j.action)).toContain('candidature.creee');
    });

    it('numéro déjà inscrit : refus avec le message de l’inscription, rien n’est créé', async () => {
      const avant = (await getDb().select().from(schema.candidat)).length;
      await expect(k.postulerAvecCompteLeger(court('6 77 00 00 01'), MDP, CM, null, { ip: null })).rejects.toThrow(svc.MESSAGE_DEJA_INSCRIT);
      expect(await getDb().select().from(schema.candidat)).toHaveLength(avant);
    });

    it('offre pourvue : refus, aucun compte créé', async () => {
      await expect(k.postulerAvecCompteLeger(court('677000009'), MDP, 'agent-nettoyage', null, { ip: null })).rejects.toThrow(MESSAGE_OFFRE_POURVUE);
      expect(await getDb().select().from(schema.candidat).where(eq(schema.candidat.telephone, '+237677000009'))).toHaveLength(0);
    });

    it('CV au type réel non accepté : refus avant toute création de compte', async () => {
      const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, ...new Array(64).fill(0)]);
      await expect(k.postulerAvecCompteLeger(court('677000008'), MDP, CAISSE, { nom: 'cv.pdf', octets: exe }, { ip: null })).rejects.toThrow(/CV/);
      expect(await getDb().select().from(schema.candidat).where(eq(schema.candidat.telephone, '+237677000008'))).toHaveLength(0);
    });

    it('sans les consentements : refus', async () => {
      await expect(k.postulerAvecCompteLeger(court('677000007', { consentementContact: false }), MDP, CAISSE, null, { ip: null })).rejects.toThrow(/consentement/i);
    });
  });

  describe('Candidat connecté (RG-07, RG-12)', () => {
    let complet: number;

    it('postule avec une motivation facultative ; une seconde fois : « Vous avez déjà postulé »', async () => {
      complet = (
        await svc.inscrireCandidat(
          {
            ...brouillonCandidatVide(),
            nom: 'Mballa',
            prenom: 'Josiane',
            telephone: '677000002',
            villeId: yaounde,
            villeAutre: '',
            quartierAutre: 'Bastos',
            zonesTouteVille: true,
            metiers: ['Community manager'],
            typesContrat: ['CDI'],
            niveauEtudes: 'Licence / Bachelor',
            disponibilite: 'immediate',
            consentementTraitement: true,
            consentementContact: true,
            consentementMajorite: true,
          },
          MDP,
          { ip: null },
        )
      ).candidatId;
      const r = await k.postuler(complet, CM, '', null);
      const kd = await candidature(r.candidatureId);
      expect(kd).toMatchObject({ statut: 'recue', motivation: null, referentId: ben.id });
      expect(await k.aDejaPostule(complet, CM)).toBe(true);
      await expect(k.postuler(complet, CM, 'encore', null)).rejects.toThrow(MESSAGE_DEJA_POSTULE);
      expect(await getDb().select().from(schema.candidature).where(eq(schema.candidature.candidatId, complet))).toHaveLength(1);
    });

    it('offre pourvue : refus', async () => {
      await expect(k.postuler(complet, 'chef-equipe', null, null)).rejects.toThrow(MESSAGE_OFFRE_POURVUE);
    });

    it('responsable désigné pour l’offre : prioritaire sur le référent du candidat (RG-10), journalisé', async () => {
      await expect(k.definirResponsablesOffre(CAISSE, [awa.id], { id: awa.id, roles: awa.roles })).rejects.toThrow(/Direction/);
      await expect(k.definirResponsablesOffre(CAISSE, [net.id], { id: dir.id, roles: dir.roles })).rejects.toThrow(/Recrutement/);
      await k.definirResponsablesOffre(CAISSE, [ben.id], { id: dir.id, roles: dir.roles });
      expect((await k.lireResponsablesOffres())[CAISSE]?.map((x) => x.id)).toEqual([ben.id]);
      const [j] = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'offre.responsables_modifies'));
      expect(j).toMatchObject({ acteurId: dir.id, objetId: CAISSE });

      const r = await k.postulerAvecCompteLeger(court('677000003', { prenom: 'Paul' }), MDP, CAISSE, null, { ip: null });
      expect((await candidature(r.candidatureId)).referentId).toBe(ben.id);
      // Le candidat, lui, reste attribué par ville (RG-01).
      expect((await candidat(r.candidatId)).referentId).toBe(awa.id);
    });

    it('le profil complété n’est plus « léger »', async () => {
      const [c] = await getDb().select({ id: schema.candidat.id }).from(schema.candidat).where(eq(schema.candidat.telephone, '+237677000001'));
      expect((await k.lireCandidaturesCandidat(c!.id)).profilIncomplet).toBe(true);
      await k.marquerProfilComplet(c!.id, null);
      const e = await k.lireCandidaturesCandidat(c!.id);
      expect(e.profilIncomplet).toBe(false);
      expect(e.candidatures).toMatchObject([{ offreSlug: CAISSE, statut: 'recue' }]);
    });
  });

  describe('Liste et traitement (RG-09, RG-10)', () => {
    it('un référent voit les siennes, la Direction toutes ; filtre par offre et non attribuées', async () => {
      const deAwa = await k.listerCandidatures(awa, {});
      expect(deAwa.direction).toBe(false);
      expect(deAwa.lignes.every((l) => l.referentId === awa.id)).toBe(true);
      expect(deAwa.lignes).toHaveLength(1);

      const tout = await k.listerCandidatures(dir, {});
      expect(tout.lignes).toHaveLength(3);
      const caisse = await k.listerCandidatures(dir, { offre: CAISSE });
      expect(caisse.lignes.map((l) => l.offreSlug)).toEqual([CAISSE, CAISSE]);
      expect((await k.listerCandidatures(dir, { offre: CM })).lignes).toHaveLength(1);

      await getDb().update(schema.candidature).set({ referentId: null }).where(eq(schema.candidature.offreSlug, CM));
      expect((await k.listerCandidatures(dir, { attribution: 'aucune' })).lignes.map((l) => l.offreSlug)).toEqual([CM]);
      expect((await k.listerCandidatures(ben, {})).lignes.map((l) => l.offreSlug)).toEqual([CAISSE]);
      // Sans service Recrutement : pas d'accès au vivier.
      await expect(k.listerCandidatures(net, {})).rejects.toThrow(/référents recrutement/);
    });

    it('reçue → retenue / refusée, journalisé ; portée limitée au référent ; pas de retour arrière', async () => {
      const [l] = (await k.listerCandidatures(awa, {})).lignes;
      await expect(k.changerStatutCandidature(l!.id, 'retenue', ben)).rejects.toThrow(/autre référent/);
      await k.changerStatutCandidature(l!.id, 'retenue', awa);
      const kd = await candidature(l!.id);
      expect(kd).toMatchObject({ statut: 'retenue', traiteePar: awa.id });
      expect(kd.traiteeLe).not.toBeNull();
      await expect(k.changerStatutCandidature(l!.id, 'refusee', dir)).rejects.toThrow(/déjà été traitée/);
      const [j] = await getDb().select().from(schema.journalAudit).where(and(eq(schema.journalAudit.action, 'candidature.statut_modifie'), eq(schema.journalAudit.objetId, String(l!.id))));
      expect(j).toMatchObject({ acteurId: awa.id, avant: { statut: 'recue' }, apres: { statut: 'retenue' } });
      expect((await k.listerCandidatures(awa, { statut: 'retenue' })).lignes).toHaveLength(1);
      expect((await k.listerCandidatures(awa, { statut: 'recue' })).lignes).toHaveLength(0);

      // La Direction traite une candidature non attribuée.
      const [na] = (await k.listerCandidatures(dir, { attribution: 'aucune' })).lignes;
      await k.changerStatutCandidature(na!.id, 'refusee', dir);
      expect((await candidature(na!.id)).statut).toBe('refusee');
    });
  });
});
