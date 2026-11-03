// Tests d'intégration du référentiel géographique : couverture du site public (M1-GEO-05)
// et revue des saisies « Autre quartier » (M1-GEO-04), sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Référentiel géographique (intégration)', async () => {
  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const svc = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');

  let admin: { id: string };
  let douala: number;
  let yaounde: number;

  const quartier = async (villeId: number, nom: string) =>
    (await getDb().select().from(schema.quartier).where(and(eq(schema.quartier.villeId, villeId), eq(schema.quartier.nom, nom))))[0]!;

  const demande = (whatsapp: string, villeId: number, quartierAutre: string) =>
    svc.creerDemande({
      type: 'NET' as const,
      canal: 'site' as const,
      formulaire: 'devis-general',
      client: { type: 'particulier' as const, nom: 'Client ' + whatsapp, contact: null, whatsapp },
      villeId,
      villeAutre: null,
      quartierId: null,
      quartierAutre,
      lieu: null,
      secteur: null,
      description: 'Nettoyage',
      lignes: [],
      donnees: { n: whatsapp },
    });

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    const villes = await getDb().select().from(schema.ville);
    douala = villes.find((v) => v.nom === 'Douala')!.id;
    yaounde = villes.find((v) => v.nom === 'Yaoundé')!.id;
    admin = { id: (await collab.creerCollaborateur({ nom: 'Admin', email: 'admin-geo@nexclean.test', roles: ['admin'] }, { id: null })).userId };
  });

  describe('Couverture du site public (M1-GEO-05)', () => {
    it('annonce les villes couvertes et les quartiers affichés d’office', async () => {
      const c = await geo.couverturePublique();
      expect(c.villes).toEqual(['Douala', 'Yaoundé']);
      expect(c.quartiers).toEqual([{ ville: 'Douala', noms: ['Akwa', 'Bali', 'Bonamoussadi', 'Bonanjo', 'Bonapriso', 'Deido', 'Makepe', 'New Bell'] }]);
    });

    it('suit les cases « Sur le site », la couverture des villes et la désactivation des quartiers', async () => {
      const bastos = await quartier(yaounde, 'Bastos');
      await geo.modifierEntree('quartier', bastos.id, { afficheSite: true }, admin);
      await geo.modifierEntree('quartier', (await quartier(douala, 'Akwa')).id, { actif: false }, admin);
      let c = await geo.couverturePublique();
      expect(c.quartiers.find((g) => g.ville === 'Yaoundé')?.noms).toEqual(['Bastos']);
      expect(c.quartiers.find((g) => g.ville === 'Douala')?.noms).not.toContain('Akwa');

      await geo.modifierEntree('ville', yaounde, { couverte: false }, admin);
      c = await geo.couverturePublique();
      expect(c.villes).toEqual(['Douala']);
      expect(c.quartiers.map((g) => g.ville)).toEqual(['Douala']);

      await geo.modifierEntree('ville', yaounde, { couverte: true }, admin);
      await geo.modifierEntree('quartier', (await quartier(douala, 'Akwa')).id, { actif: true }, admin);
    });

    it('refuse « Afficher sur le site » ailleurs que sur un quartier', async () => {
      await expect(geo.modifierEntree('ville', douala, { afficheSite: true }, admin)).rejects.toThrow(/quartiers/);
    });
  });

  describe('Saisies « Autre quartier » (M1-GEO-04)', () => {
    it('regroupe les saisies par ville et par libellé, sans tenir compte de la casse ni des espaces', async () => {
      await demande('690100001', douala, 'Bonamoussadi Carrefour');
      await demande('690100002', douala, '  bonamoussadi carrefour ');
      await demande('690100003', douala, 'Ndokotti');
      await demande('690100004', yaounde, 'Ndokotti');
      const saisies = await geo.saisiesAutreQuartier();
      const carrefour = saisies.find((s) => s.villeId === douala && s.saisie === 'Bonamoussadi Carrefour');
      expect(carrefour?.nombreDossiers).toBe(2);
      expect(carrefour?.numeros).toHaveLength(2);
      expect(saisies.filter((s) => s.saisie === 'Ndokotti').map((s) => s.ville).sort()).toEqual(['Douala', 'Yaoundé']);
    });

    it('rattache à un quartier existant tous les dossiers de la ville portant la saisie, avec historique et audit', async () => {
      const ndokoti = await quartier(douala, 'Ndokoti');
      const r = await geo.convertirSaisieAutre({ villeId: douala, saisie: 'ndokotti', quartierId: ndokoti.id }, admin);
      expect(r).toEqual({ quartierId: ndokoti.id, dossiers: 1 });

      const dossiers = await getDb().select().from(schema.dossier).where(eq(schema.dossier.quartierId, ndokoti.id));
      expect(dossiers).toHaveLength(1);
      expect(dossiers[0]!.quartierAutre).toBeNull();
      const [evt] = await getDb().select().from(schema.evenementDossier).where(and(eq(schema.evenementDossier.dossierId, dossiers[0]!.id), eq(schema.evenementDossier.type, 'modification')));
      expect(evt?.commentaire).toMatch(/Ndokotti.*Ndokoti/);
      const audit = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'referentiel.saisie_convertie'));
      expect(audit).toHaveLength(1);

      // La saisie identique de Yaoundé n'est pas touchée.
      expect((await geo.saisiesAutreQuartier()).some((s) => s.villeId === yaounde && s.saisie === 'Ndokotti')).toBe(true);
    });

    it('crée un nouveau quartier et y rattache les dossiers', async () => {
      const douala5 = (await getDb().select().from(schema.arrondissement).where(eq(schema.arrondissement.nom, 'Douala V')))[0]!;
      const r = await geo.convertirSaisieAutre({ villeId: douala, saisie: 'Bonamoussadi Carrefour', nouveau: { nom: 'Carrefour Bonamoussadi', arrondissementId: douala5.id } }, admin);
      expect(r.dossiers).toBe(2);
      const cree = await quartier(douala, 'Carrefour Bonamoussadi');
      expect(cree.arrondissementId).toBe(douala5.id);
      expect(cree.afficheSite).toBe(false);
      expect((await geo.saisiesAutreQuartier()).some((s) => s.villeId === douala)).toBe(false);
    });

    it('refuse un quartier d’une autre ville, un doublon, ou une saisie déjà traitée', async () => {
      const akwa = await quartier(douala, 'Akwa');
      await expect(geo.convertirSaisieAutre({ villeId: yaounde, saisie: 'Ndokotti', quartierId: akwa.id }, admin)).rejects.toThrow(/ville/);
      await expect(geo.convertirSaisieAutre({ villeId: yaounde, saisie: 'Ndokotti', nouveau: { nom: 'Bastos', arrondissementId: null } }, admin)).rejects.toThrow(/existe déjà/);
      await expect(geo.convertirSaisieAutre({ villeId: douala, saisie: 'Ndokotti', quartierId: akwa.id }, admin)).rejects.toThrow(/déjà été traitée/);
      await expect(geo.convertirSaisieAutre({ villeId: douala, saisie: 'X' }, admin)).rejects.toThrow(/existant ou créez/);
    });
  });
});
