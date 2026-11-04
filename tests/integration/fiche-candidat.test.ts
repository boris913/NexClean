// Fiche candidat du Back-Office (MVP2-02 lot B) sur une vraie base PostgreSQL : accès (RG-13),
// consultation et téléchargement journalisés, réinitialisation assistée, changement de numéro,
// réaffectation, modèles WhatsApp candidat.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

// Garde des pages : le collaborateur « connecté » est choisi par le test ; forbidden() lève une erreur.
const session = vi.hoisted(() => ({ courant: null as null | { id: string; nom: string; email: string; roles: ('referent' | 'direction' | 'finances' | 'admin')[]; deuxFacteurs: boolean; ip: string | null } }));
vi.mock('next/navigation', () => ({
  forbidden: () => {
    throw new Error('403');
  },
  notFound: () => {
    throw new Error('404');
  },
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock('@/lib/authz/session', () => ({
  exigerCollaborateur: async () => {
    if (!session.courant) throw new Error('redirect:/admin/connexion');
    return session.courant;
  },
  collaborateurCourant: async () => session.courant,
}));

describe.skipIf(!baseDisponible)('Fiche candidat (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-fiche-'));

  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const collab = await import('@/lib/collaborateurs/service');
  const svc = await import('@/lib/candidats/service');
  const fiche = await import('@/lib/candidats/fiche');
  const { exigerAccesVivier } = await import('@/lib/candidats/acces-page');
  const modeles = await import('@/lib/modeles/service');
  const { brouillonCandidatVide } = await import('@/lib/candidats/domaine');

  type R = 'referent' | 'direction' | 'finances' | 'admin';
  type Acteur = { id: string; nom: string; roles: R[]; ip: string | null };
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, ...new Array(64).fill(0x20)]);
  const MDP = 'motdepasse-1';
  let douala: number;
  let akwa: number;
  let dir: Acteur;
  let awa: Acteur; // référent recrutement, Douala
  let ben: Acteur; // référent sans service Recrutement
  let cyr: Acteur; // second référent recrutement, Douala
  let josiane: number;
  let paul: number;

  const brouillon = (telephone: string, prenom: string) => ({
    ...brouillonCandidatVide(),
    nom: 'Mballa',
    prenom,
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
  });
  const candidat = async (id: number) => (await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, id)))[0]!;
  const audits = (action: string, objetId?: number) =>
    getDb()
      .select()
      .from(schema.journalAudit)
      .where(objetId === undefined ? eq(schema.journalAudit.action, action) : and(eq(schema.journalAudit.action, action), eq(schema.journalAudit.objetId, String(objetId))));
  const jetonDepuisLien = (lien: string) => lien.match(/reinitialiser\/([A-Za-z0-9_-]+)$/)![1]!;
  const ouvrirSession = (candidatId: number, n: string) => getDb().insert(schema.candidatSession).values({ empreinte: n.repeat(64), candidatId, expireLe: new Date(Date.now() + 3_600_000) });

  async function collaborateur(nom: string, roles: R[], services: ('REC' | 'NET')[]): Promise<Acteur> {
    const { userId } = await collab.creerCollaborateur({ nom, email: `${nom.toLowerCase()}@fiche.test`, roles }, { id: null });
    if (services.length) await collab.definirAttributs(userId, { services, villeIds: [douala], telephone: null, capacite: null, absentDu: null, absentAu: null }, { id: null });
    return { id: userId, nom, roles, ip: '10.0.0.1' };
  }

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    douala = (await getDb().select().from(schema.ville).where(eq(schema.ville.nom, 'Douala')))[0]!.id;
    akwa = (await getDb().select().from(schema.quartier).where(eq(schema.quartier.nom, 'Akwa')))[0]!.id;
    dir = await collaborateur('Dir', ['direction'], []);
    awa = await collaborateur('Awa', ['referent'], ['REC']);
    ben = await collaborateur('Ben', ['referent'], ['NET']);
    josiane = (await svc.inscrireCandidat(brouillon('690000101', 'Josiane'), MDP, { ip: null })).candidatId;
    paul = (await svc.inscrireCandidat(brouillon('690000102', 'Paul'), MDP, { ip: null })).candidatId;
    cyr = await collaborateur('Cyr', ['referent'], ['REC']);
  }, 120_000);

  describe('Accès et consultation (RG-13)', () => {
    it('les candidats inscrits à Douala sont attribués au référent recrutement', async () => {
      expect((await candidat(josiane)).referentId).toBe(awa.id);
    });

    it('référent sans service Recrutement : 403 et tentative journalisée', async () => {
      session.courant = { ...ben, email: 'ben@fiche.test', deuxFacteurs: true };
      await expect(exigerAccesVivier('candidat.voir', { candidatId: String(josiane) })).rejects.toThrow('403');
      const refus = (await audits('acces.refuse')).filter((x) => x.acteurId === ben.id);
      expect(refus).toHaveLength(1);
      expect(refus[0]!.details).toMatchObject({ vivier: true, candidatId: String(josiane) });
      await expect(fiche.lireFicheCandidat(josiane, ben)).rejects.toThrow(/réservé/);
      expect(await audits('candidat.fiche_consultee', josiane)).toHaveLength(0);
    });

    it('référent recrutement : la garde laisse passer', async () => {
      session.courant = { ...awa, email: 'awa@fiche.test', deuxFacteurs: true };
      await expect(exigerAccesVivier()).resolves.toMatchObject({ id: awa.id });
    });

    it('chaque consultation de fiche est journalisée ; le mot de passe n’est jamais lu', async () => {
      const f = await fiche.lireFicheCandidat(josiane, awa);
      expect(f && !f.supprime).toBe(true);
      if (!f || f.supprime) return;
      expect(f.candidat).not.toHaveProperty('motDePasse');
      expect(f.verification).toEqual(['experience', 'quartier', 'metier']);
      expect(f.experiences).toHaveLength(1);
      expect(f.quartier).toBe('Akwa');
      await fiche.lireFicheCandidat(josiane, dir);
      const lignes = await audits('candidat.fiche_consultee', josiane);
      expect(lignes.map((l) => l.acteurId).sort()).toEqual([awa.id, dir.id].sort());
      // Les consultations n'encombrent pas l'historique de la fiche.
      const f2 = await fiche.lireFicheCandidat(josiane, awa);
      expect(f2 && !f2.supprime && f2.historique.some((h) => h.action === 'candidat.fiche_consultee')).toBe(false);
    });

    it('le téléchargement d’un CV est journalisé (candidat.cv_telecharge)', async () => {
      await svc.ajouterDocument(josiane, 'cv', 'cv.pdf', PDF, null);
      const [doc] = await getDb().select().from(schema.candidatDocument).where(eq(schema.candidatDocument.candidatId, josiane));
      const lu = await fiche.lireDocumentPourCollaborateur(josiane, doc!.id, awa);
      expect(lu?.nom).toBe('cv.pdf');
      expect(await fiche.lireDocumentPourCollaborateur(paul, doc!.id, awa)).toBeNull(); // document d'un autre candidat
      const lignes = await audits('candidat.cv_telecharge', josiane);
      expect(lignes).toHaveLength(1);
      expect(lignes[0]!.details).toMatchObject({ documentId: doc!.id, categorie: 'cv' });
      await expect(fiche.lireDocumentPourCollaborateur(josiane, doc!.id, ben)).rejects.toThrow(/réservé/);
    });

    it('compte supprimé : seul le pseudonyme est renvoyé', async () => {
      const id = (await svc.inscrireCandidat(brouillon('690000109', 'Zoé'), MDP, { ip: null })).candidatId;
      const { prevueLe } = await svc.demanderSuppression(id, MDP, null);
      await svc.executerSuppressionsDues(new Date(prevueLe.getTime() + 1000));
      const f = await fiche.lireFicheCandidat(id, dir);
      expect(f).toMatchObject({ supprime: true });
      expect(JSON.stringify(f)).not.toMatch(/Zoé|Mballa|690000109/);
    });
  });

  describe('Réinitialisation assistée (MVP2-01 RG-07)', () => {
    it('réservée au référent du candidat ou à la Direction, après au moins 2 vérifications', async () => {
      await expect(fiche.genererLienReinitialisation(josiane, ['quartier', 'metier'], cyr)).rejects.toThrow(/référent du candidat ou à la Direction/);
      await expect(fiche.genererLienReinitialisation(josiane, ['quartier', 'metier'], ben)).rejects.toThrow(/réservé/i);
      await expect(fiche.genererLienReinitialisation(josiane, ['quartier'], awa)).rejects.toThrow(/au moins 2/);
      expect(await getDb().select().from(schema.candidatJeton).where(eq(schema.candidatJeton.candidatId, josiane))).toHaveLength(0);
      expect(await audits('candidat.identite_verifiee', josiane)).toHaveLength(0);
    });

    it('génère un lien à usage unique de 30 min (empreinte seule, creePar), clôt la demande, journalise', async () => {
      await svc.demanderReinitialisation('690000101', null);
      const maintenant = new Date();
      const { lien, expireLe } = await fiche.genererLienReinitialisation(josiane, ['quartier', 'experience'], awa, maintenant);
      expect(lien).toMatch(/^http:\/\/localhost:3000\/candidat\/reinitialiser\/[A-Za-z0-9_-]{43}$/);
      expect(expireLe.getTime() - maintenant.getTime()).toBe(30 * 60 * 1000);
      const jeton = jetonDepuisLien(lien);
      const [j] = await getDb().select().from(schema.candidatJeton).where(eq(schema.candidatJeton.candidatId, josiane));
      expect(j).toMatchObject({ type: 'reinitialisation', creePar: awa.id, utiliseLe: null });
      expect(j!.empreinte).not.toContain(jeton);
      expect(j!.empreinte).toHaveLength(64);
      const [d] = await getDb().select().from(schema.candidatDemandeReinitialisation).where(eq(schema.candidatDemandeReinitialisation.candidatId, josiane));
      expect(d).toMatchObject({ traiteePar: awa.id });
      expect(d!.traiteeLe).toBeTruthy();
      expect((await audits('candidat.identite_verifiee', josiane))[0]!.details).toMatchObject({ procedure: 'reinitialisation', elements: ['quartier', 'experience'] });
      const gen = await audits('candidat.lien_reinitialisation_genere', josiane);
      expect(gen).toHaveLength(1);
      expect(JSON.stringify(gen)).not.toContain(jeton);
      expect(await svc.lireJetonReinitialisation(jeton)).toEqual({ prenom: 'Josiane' });
    });

    it('un nouveau lien invalide le précédent ; le lien ne sert qu’une fois et ferme les sessions', async () => {
      const premier = jetonDepuisLien((await fiche.genererLienReinitialisation(josiane, ['metier', 'experience'], dir)).lien);
      const second = jetonDepuisLien((await fiche.genererLienReinitialisation(josiane, ['metier', 'experience'], awa)).lien);
      expect(await svc.lireJetonReinitialisation(premier)).toBeNull();
      await expect(svc.reinitialiserMotDePasse(premier, 'nouveau-mdp-1', null)).rejects.toThrow(/invalide ou expiré/);
      await ouvrirSession(josiane, 'a');
      await svc.reinitialiserMotDePasse(second, 'nouveau-mdp-1', null);
      expect(await getDb().select().from(schema.candidatSession).where(eq(schema.candidatSession.candidatId, josiane))).toHaveLength(0);
      await expect(svc.reinitialiserMotDePasse(second, 'encore-un-1', null)).rejects.toThrow(/invalide ou expiré/);
      expect(await svc.verifierConnexion('690000101', 'nouveau-mdp-1', null)).toBe(josiane);
    });

    it('le lien expire au bout de 30 minutes', async () => {
      const il_y_a_31_min = new Date(Date.now() - 31 * 60 * 1000);
      const jeton = jetonDepuisLien((await fiche.genererLienReinitialisation(josiane, ['metier', 'quartier'], awa, il_y_a_31_min)).lien);
      expect(await svc.lireJetonReinitialisation(jeton)).toBeNull();
      await expect(svc.reinitialiserMotDePasse(jeton, 'trop-tard-1', null)).rejects.toThrow(/invalide ou expiré/);
    });

    it('message WhatsApp prérempli avec le lien ; le journal ne garde qu’un lien masqué', async () => {
      const { lien } = await fiche.genererLienReinitialisation(josiane, ['metier', 'quartier'], awa);
      const texte = await fiche.messageReinitialisation(josiane, lien, awa);
      expect(texte).toContain(lien);
      expect(texte).toContain('Bonjour Josiane');
      await fiche.noterWhatsAppCandidat(josiane, fiche.MODELE_REINITIALISATION, texte, awa);
      const [n] = await audits('candidat.whatsapp_prepare', josiane);
      expect(JSON.stringify(n!.details)).not.toContain(jetonDepuisLien(lien));
      expect(n!.details).toMatchObject({ modele: fiche.MODELE_REINITIALISATION });
    });

    it('liste des demandes en attente : les miennes ; la Direction voit tout, y compris sans référent', async () => {
      await svc.demanderReinitialisation('690000102', null); // Paul, suivi par Awa
      const orphelin = (await svc.inscrireCandidat({ ...brouillon('690000103', 'Line'), villeId: null, villeAutre: 'Kribi', quartierId: null, quartierAutre: 'Centre' }, MDP, { ip: null })).candidatId;
      expect((await candidat(orphelin)).referentId).toBeNull();
      await svc.demanderReinitialisation('690000103', null);
      expect((await fiche.listerDemandesReinitialisation(awa)).map((d) => d.candidatId)).toEqual([paul]);
      expect(await fiche.listerDemandesReinitialisation(cyr)).toEqual([]);
      expect((await fiche.listerDemandesReinitialisation(dir)).map((d) => d.candidatId).sort()).toEqual([paul, orphelin].sort());
      await expect(fiche.listerDemandesReinitialisation(ben)).rejects.toThrow(/réservé/);
    });
  });

  describe('Changement de numéro (MVP2-01 RG-08)', () => {
    it('refuse un numéro invalide, déjà utilisé, ou une vérification insuffisante', async () => {
      await expect(fiche.changerNumeroCandidat(josiane, '12', ['metier', 'quartier'], awa)).rejects.toThrow(/invalide/);
      await expect(fiche.changerNumeroCandidat(josiane, '6 90 00 01 02', ['metier', 'quartier'], awa)).rejects.toThrow(fiche.MESSAGE_NUMERO_PRIS);
      await expect(fiche.changerNumeroCandidat(josiane, '690000199', ['metier'], awa)).rejects.toThrow(/au moins 2/);
      await expect(fiche.changerNumeroCandidat(josiane, '690000199', ['metier', 'quartier'], cyr)).rejects.toThrow(/référent du candidat ou à la Direction/);
      expect((await candidat(josiane)).telephone).toBe('+237690000101');
    });

    it('normalise en E.164, met à jour le WhatsApp identique, ferme les sessions, journalise', async () => {
      await ouvrirSession(josiane, 'b');
      await ouvrirSession(josiane, 'c');
      expect(await fiche.changerNumeroCandidat(josiane, '+237 6 90 00 01 99', ['metier', 'experience'], awa)).toBe('+237690000199');
      expect(await candidat(josiane)).toMatchObject({ telephone: '+237690000199', whatsapp: '+237690000199' });
      expect(await getDb().select().from(schema.candidatSession).where(eq(schema.candidatSession.candidatId, josiane))).toHaveLength(0);
      const [l] = await audits('candidat.telephone_modifie', josiane);
      expect(l).toMatchObject({ acteurId: awa.id, avant: { telephone: '+237690000101' }, apres: { telephone: '+237690000199' } });
      expect((await audits('candidat.identite_verifiee', josiane)).some((x) => (x.details as { procedure?: string }).procedure === 'changement_numero')).toBe(true);
      await expect(svc.verifierConnexion('690000101', 'nouveau-mdp-1', null)).rejects.toThrow(svc.MESSAGE_IDENTIFIANTS);
      expect(await svc.verifierConnexion('690000199', 'nouveau-mdp-1', null)).toBe(josiane);
    });
  });

  describe('Réaffectation (Direction)', () => {
    it('réservée à la Direction ; motif obligatoire', async () => {
      await expect(fiche.reaffecterCandidat(paul, cyr.id, 'Surcharge', awa)).rejects.toThrow(/Direction/);
      await expect(fiche.reaffecterCandidat(paul, cyr.id, ' ', dir)).rejects.toThrow(/Motif/);
      await expect(fiche.reaffecterCandidat(paul, ben.id, 'Essai', dir)).rejects.toThrow(/accès au vivier/);
      expect((await candidat(paul)).referentId).toBe(awa.id);
    });

    it('change le référent, remet à zéro l’escalade, notifie le nouveau référent et journalise', async () => {
      await getDb().update(schema.candidat).set({ derniereRelanceLe: new Date(), alerteNonTraiteLe: new Date(), enFileDepuis: new Date() }).where(eq(schema.candidat.id, paul));
      const avant = Date.now();
      const r = await fiche.reaffecterCandidat(paul, cyr.id, 'Congé d’Awa', dir);
      expect(r.avertissements).toEqual([]);
      const c = await candidat(paul);
      expect(c).toMatchObject({ referentId: cyr.id, enFileDepuis: null, derniereRelanceLe: null, alerteNonTraiteLe: null });
      expect(c.attribueLe!.getTime()).toBeGreaterThanOrEqual(avant - 1000);
      const notifs = await getDb().select().from(schema.notification).where(eq(schema.notification.destinataireId, cyr.id));
      expect(notifs.some((n) => n.type === 'candidat_attribue' && n.lien === `/admin/candidats/${paul}` && n.texte.includes('Congé d’Awa'))).toBe(true);
      const [l] = await audits('candidat.reaffecte', paul);
      expect(l).toMatchObject({ acteurId: dir.id, avant: { referentId: awa.id }, apres: { referentId: cyr.id }, details: { motif: 'Congé d’Awa' } });
      await expect(fiche.reaffecterCandidat(paul, cyr.id, 'Encore', dir)).rejects.toThrow(/déjà le référent/);
    });

    it('traite la file « Non attribués » et affiche l’éligibilité (service REC)', async () => {
      const [orphelin] = await getDb().select().from(schema.candidat).where(eq(schema.candidat.telephone, '+237690000103'));
      const referents = await fiche.referentsPourCandidat(douala);
      expect(referents.find((x) => x.id === awa.id)?.raisons).toEqual([]);
      expect(referents.find((x) => x.id === ben.id)?.raisons.join()).toMatch(/Recrutement/);
      const r = await fiche.reaffecterCandidat(orphelin!.id, awa.id, 'Attribution manuelle', dir);
      expect(r.avertissements.length).toBeGreaterThan(0); // Kribi : ville hors référentiel
      expect((await candidat(orphelin!.id)).referentId).toBe(awa.id);
    });
  });

  describe('Modèles WhatsApp candidat', () => {
    it('initialisation idempotente ; jamais proposés dans un dossier', async () => {
      // Déjà créés par la migration 0008 ; l'initialisation ne recrée que ceux qui manquent.
      expect(await fiche.initialiserModelesCandidat()).toBe(0);
      await getDb().delete(schema.modeleMessage).where(eq(schema.modeleMessage.nom, 'Compléter votre profil'));
      expect(await fiche.initialiserModelesCandidat()).toBe(1);
      expect(await fiche.initialiserModelesCandidat()).toBe(0);
      const pourDossier = await modeles.listerModeles({ type: 'REC', actifsSeulement: true });
      expect(pourDossier.some((m) => m.nom === 'Bienvenue candidat')).toBe(false);
      expect(pourDossier.some((m) => m.nom === 'Premier contact')).toBe(true);
      const candidats = await fiche.listerModelesCandidat();
      expect(candidats.map((m) => m.nom)).toEqual(['Bienvenue candidat', 'Compléter votre profil', 'Lien de réinitialisation']);
    });

    it('un message préparé depuis la fiche est noté au journal', async () => {
      await fiche.noterWhatsAppCandidat(paul, 'Bienvenue candidat', 'Bonjour Paul', cyr);
      const lignes = await audits('candidat.whatsapp_prepare', paul);
      expect(lignes[0]).toMatchObject({ acteurId: cyr.id, details: { modele: 'Bienvenue candidat', texte: 'Bonjour Paul' } });
      await expect(fiche.noterWhatsAppCandidat(paul, 'Bienvenue candidat', 'Bonjour', ben)).rejects.toThrow(/réservé/);
    });
  });
});
