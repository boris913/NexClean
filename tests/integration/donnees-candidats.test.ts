// POST-04 (ADR 0017 §4, §6) : relance à 24 mois d'inactivité, anonymisation, export « Mes
// données », sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Données personnelles des candidats (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-donnees-candidats-'));

  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const dossiers = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');
  const candidats = await import('@/lib/candidats/service');
  const conservation = await import('@/lib/candidats/conservation');
  const exportSvc = await import('@/lib/candidats/export');
  const { pseudonyme } = await import('@/lib/candidats/domaine');
  const { MAX_EXPORTS_PAR_JOUR, MESSAGE_LIMITE_EXPORT } = await import('@/lib/candidats/donnees');
  const { hacherMotDePasse } = await import('@/lib/auth/mot-de-passe');

  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, ...new Array(64).fill(0x20)]);
  const JOUR = 86_400_000;
  const MAINTENANT = new Date();
  const IL_Y_A_25_MOIS = new Date(MAINTENANT.getTime() - 760 * JOUR);
  let refId: string;
  let direction: string;
  let dossierId: number;
  let clientId: number;
  let lignes: number[];
  let empreinteMdp: string;
  let seq = 0;

  const nouveauCandidat = async (valeurs: Partial<typeof schema.candidat.$inferInsert> = {}) => {
    const telephone = `+2376904000${String(++seq).padStart(2, '0')}`;
    const [c] = await getDb()
      .insert(schema.candidat)
      .values({ nom: 'Ngo', prenom: `Awa${seq}`, telephone, whatsapp: telephone, email: `awa${seq}@exemple.test`, statut: 'a_contacter', motDePasse: empreinteMdp, referentId: refId, creeLe: IL_Y_A_25_MOIS, profilMisAJourLe: IL_Y_A_25_MOIS, ...valeurs })
      .returning();
    await getDb().insert(schema.candidatConsentement).values({ candidatId: c!.id, type: 'traitement', version: '2026-11-03', canal: 'site', horodatage: IL_Y_A_25_MOIS });
    return c!;
  };
  const lire = async (id: number) => (await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, id)))[0]!;
  const journal = async (action: string, id: number) =>
    getDb().select().from(schema.journalAudit).where(and(eq(schema.journalAudit.action, action), eq(schema.journalAudit.objetId, String(id))));
  const fichierExiste = (cle: string) => fs.access(path.join(process.env.STORAGE_DIR!, cle)).then(() => true, () => false);

  beforeAll(async () => {
    await reinitialiserBase();
    empreinteMdp = await hacherMotDePasse('motdepasse-1');
    refId = (await collab.creerCollaborateur({ nom: 'Rita Recrutement', email: 'rita-donnees@nexclean.test', roles: ['referent'] }, { id: null })).userId;
    // Service Recrutement : accès au vivier (fiche candidat) pour le référent.
    await collab.definirAttributs(refId, { services: ['REC'], villeIds: [], telephone: null, capacite: null, absentDu: null, absentAu: null }, { id: null });
    direction = (await collab.creerCollaborateur({ nom: 'Dir', email: 'dir-donnees@nexclean.test', roles: ['direction'] }, { id: null })).userId;
    const r = await dossiers.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: 'Hôtel du Lac', contact: 'M. Kamga', whatsapp: '+237699001133' },
      villeId: null,
      villeAutre: 'Kribi',
      quartierId: null,
      quartierAutre: 'Centre',
      lieu: null,
      secteur: 'Hôtellerie',
      description: null,
      lignes: [
        { intitule: 'Serveur', nombre: 2 },
        { intitule: 'Cuisinier', nombre: 1 },
      ],
      donnees: { test: 1 },
    });
    dossierId = r.dossierId;
    await getDb().update(schema.dossier).set({ referentId: refId, statut: 'recherche_en_cours' }).where(eq(schema.dossier.id, dossierId));
    lignes = (await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId)).orderBy(schema.lignePoste.ordre)).map((l) => l.id);
    clientId = (await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, dossierId)))[0]!.clientId;
  });

  describe('Relance (RG-02, RG-03)', () => {
    it('relance une fois le profil inactif depuis 24 mois : notification, alerte au référent, journal', async () => {
      const inactif = await nouveauCandidat();
      const actif = await nouveauCandidat({ creeLe: IL_Y_A_25_MOIS, profilMisAJourLe: new Date(MAINTENANT.getTime() - 100 * JOUR) });
      const bilan = await conservation.appliquerConservation(MAINTENANT);
      expect(bilan.relances).toBeGreaterThanOrEqual(1);
      expect((await lire(inactif.id)).relanceInactiviteLe?.getTime()).toBe(MAINTENANT.getTime());
      expect((await lire(actif.id)).relanceInactiviteLe).toBeNull();

      const notifs = await getDb().select().from(schema.notificationCandidat).where(eq(schema.notificationCandidat.candidatId, inactif.id));
      expect(notifs).toHaveLength(1);
      const alertes = await getDb().select().from(schema.notification).where(and(eq(schema.notification.type, 'relance_inactivite_candidat'), eq(schema.notification.lien, `/admin/candidats/${inactif.id}`)));
      expect(alertes.map((a) => a.destinataireId)).toEqual([refId]);
      expect(alertes[0]!.email).toBe(true);
      expect(alertes[0]!.texte).toContain('Relance inactivité');
      expect(await journal('candidat.relance_inactivite', inactif.id)).toHaveLength(1);

      // Idempotent : un second passage ne relance pas de nouveau.
      await conservation.appliquerConservation(new Date(MAINTENANT.getTime() + 15 * 60 * 1000));
      expect(await getDb().select().from(schema.notificationCandidat).where(eq(schema.notificationCandidat.candidatId, inactif.id))).toHaveLength(1);
      expect(await journal('candidat.relance_inactivite', inactif.id)).toHaveLength(1);
    });

    it('sans référent actif, l’alerte va à la Direction', async () => {
      const c = await nouveauCandidat({ referentId: null });
      await conservation.appliquerConservation(MAINTENANT);
      const alertes = await getDb().select().from(schema.notification).where(and(eq(schema.notification.type, 'relance_inactivite_candidat'), eq(schema.notification.lien, `/admin/candidats/${c.id}`)));
      expect(alertes.map((a) => a.destinataireId)).toEqual([direction]);
    });

    it('le modèle WhatsApp de relance est créé par la migration', async () => {
      const [m] = await getDb().select().from(schema.modeleMessage).where(eq(schema.modeleMessage.nom, 'Relance inactivité'));
      expect(m?.texte).toContain('{{candidat.lien_espace}}');
    });
  });

  describe('Annulation (RG-04, RG-06)', () => {
    it('une connexion après la relance l’annule', async () => {
      const c = await nouveauCandidat({ relanceInactiviteLe: new Date(MAINTENANT.getTime() - 10 * JOUR) });
      await getDb().update(schema.candidat).set({ derniereConnexionLe: new Date(MAINTENANT.getTime() - 2 * JOUR) }).where(eq(schema.candidat.id, c.id));
      const bilan = await conservation.appliquerConservation(MAINTENANT);
      expect(bilan.annulations).toBeGreaterThanOrEqual(1);
      expect((await lire(c.id)).relanceInactiviteLe).toBeNull();
      expect((await journal('candidat.relance_inactivite_annulee', c.id))[0]!.details).toMatchObject({ raison: 'activite' });
    });

    it('le référent note la réponse WhatsApp : la relance est annulée, même après 30 jours', async () => {
      const c = await nouveauCandidat({ relanceInactiviteLe: new Date(MAINTENANT.getTime() - 40 * JOUR) });
      const acteur = { id: refId, roles: ['referent' as const], ip: null };
      await conservation.confirmerConservation(c.id, acteur, new Date(MAINTENANT.getTime() - 1000));
      expect(await journal('candidat.conservation_confirmee', c.id)).toHaveLength(1);
      await conservation.appliquerConservation(MAINTENANT);
      const apres = await lire(c.id);
      expect(apres.relanceInactiviteLe).toBeNull();
      expect(apres.supprimeLe).toBeNull();
    });

    it('un processus actif (proposition en cours) annule la relance et empêche l’anonymisation', async () => {
      const c = await nouveauCandidat({ relanceInactiviteLe: new Date(MAINTENANT.getTime() - 40 * JOUR) });
      await getDb().insert(schema.proposition).values({ dossierId, lignePosteId: lignes[0]!, candidatId: c.id, clientId, auteurId: refId, statut: 'proposee' });
      await conservation.appliquerConservation(MAINTENANT);
      const apres = await lire(c.id);
      expect(apres.supprimeLe).toBeNull();
      expect(apres.relanceInactiviteLe).toBeNull();
      expect((await journal('candidat.relance_inactivite_annulee', c.id))[0]!.details).toMatchObject({ raison: 'processus_actif' });
      // Tant que la proposition est en cours, pas de nouvelle relance.
      await conservation.appliquerConservation(new Date(MAINTENANT.getTime() + 60_000));
      expect((await lire(c.id)).relanceInactiviteLe).toBeNull();
    });

    it('une suppression déjà demandée suit son propre circuit (RG-07)', async () => {
      const c = await nouveauCandidat({ suppressionDemandeeLe: new Date(MAINTENANT.getTime() - JOUR), suppressionPrevueLe: new Date(MAINTENANT.getTime() + 6 * JOUR) });
      await conservation.appliquerConservation(MAINTENANT);
      const apres = await lire(c.id);
      expect(apres.relanceInactiviteLe).toBeNull();
      expect(apres.supprimeLe).toBeNull();
    });
  });

  describe('Anonymisation (RG-05)', () => {
    it('30 jours sans réponse : données effacées, fichiers et sessions supprimés, traces conservées sous pseudonyme', async () => {
      const c = await nouveauCandidat({ relanceInactiviteLe: new Date(MAINTENANT.getTime() - 31 * JOUR) });
      await candidats.ajouterDocument(c.id, 'cv', 'cv.pdf', PDF, null);
      // L'ajout du CV est une mise à jour : on la replace avant la relance.
      await getDb().update(schema.candidat).set({ profilMisAJourLe: IL_Y_A_25_MOIS }).where(eq(schema.candidat.id, c.id));
      const cles = (await getDb().select().from(schema.candidatDocument).where(eq(schema.candidatDocument.candidatId, c.id))).map((d) => d.cle);
      await getDb().insert(schema.candidatSession).values({ empreinte: `session-${c.id}`, candidatId: c.id, expireLe: new Date(MAINTENANT.getTime() + JOUR) });
      await getDb().insert(schema.candidature).values({ candidatId: c.id, offreSlug: 'agent-de-caisse', offreTitre: 'Agent de caisse', motivation: 'Texte personnel', creeLe: IL_Y_A_25_MOIS });
      const [p] = await getDb().insert(schema.proposition).values({ dossierId, lignePosteId: lignes[1]!, candidatId: c.id, clientId, auteurId: refId, statut: 'placee', creeLe: IL_Y_A_25_MOIS }).returning();
      await getDb().insert(schema.placement).values({ propositionId: p!.id, dossierId, lignePosteId: lignes[1]!, candidatId: c.id, statut: 'termine', datePrevue: '2024-01-01', poste: 'Cuisinier', creeLe: IL_Y_A_25_MOIS });

      const bilan = await conservation.appliquerConservation(MAINTENANT);
      expect(bilan.anonymisations).toBeGreaterThanOrEqual(1);
      const apres = await lire(c.id);
      expect(apres).toMatchObject({ telephone: null, email: null, whatsapp: null, prenom: '', nom: pseudonyme(c.id), motDePasse: null, statut: 'indisponible' });
      expect(apres.supprimeLe).toBeTruthy();
      for (const cle of cles) expect(await fichierExiste(cle)).toBe(false);
      expect(await getDb().select().from(schema.candidatDocument).where(eq(schema.candidatDocument.candidatId, c.id))).toHaveLength(0);
      expect(await getDb().select().from(schema.candidatSession).where(eq(schema.candidatSession.candidatId, c.id))).toHaveLength(0);
      expect(await getDb().select().from(schema.candidatConsentement).where(eq(schema.candidatConsentement.candidatId, c.id))).toHaveLength(0);
      // Candidatures, Propositions et Placements conservés, pseudonymisés.
      const ks = await getDb().select().from(schema.candidature).where(eq(schema.candidature.candidatId, c.id));
      expect(ks).toHaveLength(1);
      expect(ks[0]!.motivation).toBeNull();
      expect(await getDb().select().from(schema.proposition).where(eq(schema.proposition.candidatId, c.id))).toHaveLength(1);
      expect(await getDb().select().from(schema.placement).where(eq(schema.placement.candidatId, c.id))).toHaveLength(1);
      expect((await journal('candidat.anonymise', c.id))[0]!.details).toMatchObject({ motif: 'inactivite', documents: 1 });
      expect(await journal('candidat.donnees_supprimees', c.id)).toHaveLength(0);

      // Un second passage ne refait rien ; le numéro est libéré.
      await conservation.appliquerConservation(new Date(MAINTENANT.getTime() + 60_000));
      expect(await journal('candidat.anonymise', c.id)).toHaveLength(1);
    });

    it('une connexion de dernière minute empêche l’anonymisation', async () => {
      const c = await nouveauCandidat({ relanceInactiviteLe: new Date(MAINTENANT.getTime() - 31 * JOUR), derniereConnexionLe: new Date(MAINTENANT.getTime() - 60_000) });
      await conservation.appliquerConservation(MAINTENANT);
      expect((await lire(c.id)).supprimeLe).toBeNull();
    });
  });

  describe('Export « Mes données » (RG-09..14)', () => {
    it('JSON : les données du seul candidat, sans secret ; journalisé', async () => {
      const c = await nouveauCandidat({ creeLe: MAINTENANT, profilMisAJourLe: MAINTENANT });
      const autre = await nouveauCandidat({ creeLe: MAINTENANT, profilMisAJourLe: MAINTENANT, prenom: 'AUTRE-PERSONNE' });
      await getDb().insert(schema.proposition).values({ dossierId, lignePosteId: lignes[0]!, candidatId: c.id, clientId, auteurId: refId, statut: 'refusee', motif: 'MOTIF-INTERNE-SECRET', retourClientMotif: 'RETOUR-SECRET', accordMode: 'espace', accordLe: MAINTENANT });
      await getDb().insert(schema.proposition).values({ dossierId, lignePosteId: lignes[1]!, candidatId: autre.id, clientId, auteurId: refId, statut: 'proposee' });
      await getDb().insert(schema.candidatJeton).values({ candidatId: c.id, type: 'reinitialisation', empreinte: `jeton-${c.id}`, expireLe: MAINTENANT });

      const f = await exportSvc.exporterDonnees(c.id, 'json', '10.0.0.7', MAINTENANT);
      expect(f.mime).toContain('application/json');
      expect(f.nom).toMatch(/^nexclean-mes-donnees-\d{4}-\d{2}-\d{2}\.json$/);
      const texte = new TextDecoder().decode(f.octets);
      const e = JSON.parse(texte);
      expect(e.profil).toMatchObject({ identifiant: c.id, prenom: c.prenom, email: c.email });
      expect(e.consentements).toHaveLength(1);
      expect(e.propositions).toHaveLength(1);
      expect(e.propositions[0]).toMatchObject({ client: 'Hôtel du Lac', poste: 'Serveur', accord: { mode: 'Dans votre espace candidat' } });
      for (const interdit of ['$argon2', 'motDePasse', `jeton-${c.id}`, 'SECRET', 'AUTRE-PERSONNE', 'referent']) expect(texte).not.toContain(interdit);
      const [j] = await journal(exportSvc.ACTION_EXPORT, c.id);
      expect(j).toMatchObject({ acteurType: 'candidat', acteurId: String(c.id), ip: '10.0.0.7' });
      expect(j!.details).toMatchObject({ format: 'json' });
    });

    it('PDF lisible, puis limite de fréquence sur 24 heures', async () => {
      const c = await nouveauCandidat({ creeLe: MAINTENANT, profilMisAJourLe: MAINTENANT });
      const f = await exportSvc.exporterDonnees(c.id, 'pdf', null, MAINTENANT);
      expect(f.mime).toBe('application/pdf');
      expect(new TextDecoder().decode(f.octets.slice(0, 5))).toBe('%PDF-');
      for (let i = 1; i < MAX_EXPORTS_PAR_JOUR; i++) await exportSvc.exporterDonnees(c.id, 'json', null, MAINTENANT);
      await expect(exportSvc.exporterDonnees(c.id, 'json', null, MAINTENANT)).rejects.toThrow(MESSAGE_LIMITE_EXPORT);
      expect(await journal(exportSvc.ACTION_EXPORT, c.id)).toHaveLength(MAX_EXPORTS_PAR_JOUR);
    });

    it('refuse l’export d’un compte supprimé', async () => {
      const c = await nouveauCandidat({ supprimeLe: MAINTENANT });
      await expect(exportSvc.exporterDonnees(c.id, 'json', null, MAINTENANT)).rejects.toThrow(/introuvable/);
    });
  });
});
