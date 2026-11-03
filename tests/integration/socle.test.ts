// Tests d'intégration du socle (specs/MVP1-01) sur une vraie base PostgreSQL.
// Exécution : DATABASE_URL_TEST=postgresql://…/nexclean_test npm test
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();

// Les e-mails sont simplement affichés en l'absence de RESEND_API_KEY : on les fait taire.
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Socle (intégration)', async () => {
  const { eq, sql } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const { getAuth } = await import('@/lib/auth');
  const { journaliser } = await import('@/lib/audit');
  const svc = await import('@/lib/collaborateurs/service');
  const geo = await import('@/lib/geo/service');

  const MDP = 'Mot-De-Passe-Solide-1';
  const jetonDepuis = (lien: string) => lien.split('/').pop()!;
  const connexion = (email: string, password: string, ip = '10.0.0.1') =>
    getAuth().api.signInEmail({ body: { email, password }, headers: new Headers({ 'x-forwarded-for': ip }) });

  async function collaborateurActif(email: string, roles: ('admin' | 'direction' | 'referent' | 'finances')[] = ['referent']) {
    const { userId, lienActivation } = await svc.creerCollaborateur({ nom: 'Test ' + email, email, roles }, { id: null });
    await svc.activerCompte(jetonDepuis(lienActivation), MDP);
    return userId;
  }

  beforeAll(async () => {
    await reinitialiserBase();
  });

  describe("Journal d'audit (M1-AUD-01)", () => {
    it('refuse UPDATE, DELETE et TRUNCATE', async () => {
      await journaliser({ acteurType: 'systeme', action: 'test.entree' });
      const db = getDb();
      // Drizzle enveloppe l'erreur PostgreSQL : le message du déclencheur est dans `cause`.
      const messageCause = (requete: Promise<unknown>) => requete.then(() => 'aucune erreur', (e: Error) => String((e.cause as Error | undefined)?.message ?? e.message));
      expect(await messageCause(db.execute(sql`update journal_audit set action = 'modifie'`))).toMatch(/ajout seul/);
      expect(await messageCause(db.execute(sql`delete from journal_audit`))).toMatch(/ajout seul/);
      expect(await messageCause(db.execute(sql`truncate journal_audit`))).toMatch(/ajout seul/);
      const [{ n }] = (await db.execute(sql`select count(*)::int as n from journal_audit where action = 'test.entree'`)) as unknown as [{ n: number }];
      expect(n).toBe(1);
    });
  });

  describe('Comptes collaborateurs (M1-AUT-03, 04)', () => {
    it("crée un compte sans mot de passe, activable une seule fois, puis la connexion fonctionne", async () => {
      const { userId, lienActivation } = await svc.creerCollaborateur({ nom: 'Awa Ngo', email: 'Awa@Nexclean.test', roles: ['referent'] }, { id: null });
      await expect(connexion('awa@nexclean.test', MDP)).rejects.toThrow();

      const jeton = jetonDepuis(lienActivation);
      await svc.activerCompte(jeton, MDP);
      await expect(svc.activerCompte(jeton, MDP)).rejects.toThrow('Lien invalide ou expiré.');

      const res = await connexion('awa@nexclean.test', MDP);
      expect(res).toMatchObject({ user: { id: userId } });
    });

    it('refuse un mot de passe de moins de 10 caractères', async () => {
      const { lienActivation } = await svc.creerCollaborateur({ nom: 'Court', email: 'court@nexclean.test', roles: ['referent'] }, { id: null });
      await expect(svc.activerCompte(jetonDepuis(lienActivation), 'court')).rejects.toThrow(/au moins 10/);
    });

    it('refuse un lien expiré', async () => {
      const { userId, lienActivation } = await svc.creerCollaborateur({ nom: 'Expire', email: 'expire@nexclean.test', roles: ['referent'] }, { id: null });
      await getDb().update(schema.jetonActivation).set({ expireLe: new Date(Date.now() - 1000) }).where(eq(schema.jetonActivation.userId, userId));
      await expect(svc.activerCompte(jetonDepuis(lienActivation), MDP)).rejects.toThrow('Lien invalide ou expiré.');
    });

    it("refuse un second compte avec le même e-mail", async () => {
      await expect(svc.creerCollaborateur({ nom: 'Doublon', email: 'awa@nexclean.test', roles: ['referent'] }, { id: null })).rejects.toThrow(/existe déjà/);
    });

    it('M1-AUT-04 : la désactivation révoque les sessions et bloque la connexion', async () => {
      const userId = await collaborateurActif('desactive@nexclean.test');
      const res = await connexion('desactive@nexclean.test', MDP);
      const sessionsAvant = await getDb().select().from(schema.session).where(eq(schema.session.userId, userId));
      expect(sessionsAvant.length).toBeGreaterThan(0);

      await svc.desactiverCollaborateur(userId, { id: null });

      expect(await getDb().select().from(schema.session).where(eq(schema.session.userId, userId))).toHaveLength(0);
      const session = await getAuth().api.getSession({ headers: new Headers({ authorization: `Bearer ${res.token}`, cookie: `better-auth.session_token=${res.token}` }) });
      expect(session).toBeNull();
      await expect(connexion('desactive@nexclean.test', MDP)).rejects.toThrow(/désactivé/);
    });
  });

  describe('Dernier administrateur (cas limite M1-AUT)', () => {
    it("ne peut être ni désactivé ni privé du rôle Administrateur", async () => {
      const admin = await collaborateurActif('admin1@nexclean.test', ['admin', 'direction']);
      await expect(svc.desactiverCollaborateur(admin, { id: null })).rejects.toThrow(/dernier administrateur/);
      await expect(svc.definirRoles(admin, ['direction'], { id: null })).rejects.toThrow(/dernier administrateur/);

      const admin2 = await collaborateurActif('admin2@nexclean.test', ['admin']);
      await svc.desactiverCollaborateur(admin, { id: admin2 });
      await expect(svc.desactiverCollaborateur(admin2, { id: admin2 })).rejects.toThrow(/dernier administrateur/);
    });
  });

  describe('Rôles et attributs (M1-ROL-02, 05)', () => {
    it('journalise les changements de rôles avant / après', async () => {
      const id = await collaborateurActif('roles@nexclean.test', ['referent']);
      await svc.definirRoles(id, ['referent', 'finances'], { id: null });
      const [entree] = await getDb()
        .select()
        .from(schema.journalAudit)
        .where(sql`${schema.journalAudit.action} = 'collaborateur.roles_modifies' and ${schema.journalAudit.objetId} = ${id}`);
      expect(entree).toMatchObject({ avant: ['referent'], apres: ['referent', 'finances'] });
    });

    it('enregistre services, villes, capacité et absence', async () => {
      await geo.initialiserReferentiel();
      const [douala] = await getDb().select().from(schema.ville).where(eq(schema.ville.nom, 'Douala'));
      const id = await collaborateurActif('attributs@nexclean.test');
      await svc.definirAttributs(id, { services: ['REC', 'NET'], villeIds: [douala!.id], telephone: '+237690000000', capacite: 20, absentDu: '2026-12-01', absentAu: '2026-12-15' }, { id: null });
      expect(await svc.lireAttributs(id)).toMatchObject({ services: expect.arrayContaining(['REC', 'NET']), villeIds: [douala!.id], capacite: 20, absentDu: '2026-12-01' });
    });

    it('refuse une absence dont la fin précède le début', async () => {
      const id = await collaborateurActif('absence@nexclean.test');
      await expect(svc.definirAttributs(id, { services: [], villeIds: [], telephone: null, capacite: null, absentDu: '2026-12-15', absentAu: '2026-12-01' }, { id: null })).rejects.toThrow();
    });
  });

  describe('Verrouillage après échecs (M1-AUT-06)', () => {
    it('bloque le 6e essai, même avec le bon mot de passe', async () => {
      await collaborateurActif('verrou@nexclean.test');
      for (let i = 0; i < 5; i++) await expect(connexion('verrou@nexclean.test', 'mauvais-mot-de-passe', '10.0.0.9')).rejects.toThrow();
      await expect(connexion('verrou@nexclean.test', MDP, '10.0.0.10')).rejects.toThrow(/15 minutes/);
    });
  });

  describe('Référentiel géographique (M1-GEO-02, 03)', () => {
    it('initialise Douala et Yaoundé comme villes couvertes, de façon idempotente', async () => {
      await geo.initialiserReferentiel();
      const second = await geo.initialiserReferentiel();
      expect(second).toEqual({ villes: 0, arrondissements: 0, quartiers: 0 });
      expect(await geo.villesCouvertes()).toEqual(['Douala', 'Yaoundé']);
      const ref = await geo.lireReferentiel();
      const douala = ref.find((v) => v.nom === 'Douala')!;
      const quartiers = douala.arrondissements.flatMap((a) => a.quartiers.map((q) => q.nom));
      expect(quartiers).toEqual(expect.arrayContaining(['Akwa', 'Bonapriso', 'Makepe', 'Bonamoussadi', 'Deido', 'New Bell', 'Bali', 'Bonanjo']));
    });

    it("désactive au lieu de supprimer, et journalise l'avant / après", async () => {
      const [akwa] = await getDb().select().from(schema.quartier).where(eq(schema.quartier.nom, 'Akwa'));
      await geo.modifierEntree('quartier', akwa!.id, { actif: false, latitude: 4.05, longitude: 9.7 }, { id: null });
      const [apres] = await getDb().select().from(schema.quartier).where(eq(schema.quartier.id, akwa!.id));
      expect(apres).toMatchObject({ actif: false, latitude: 4.05 });
      await expect(geo.modifierEntree('quartier', akwa!.id, { couverte: true }, { id: null })).rejects.toThrow(/villes/);
    });
  });
});
