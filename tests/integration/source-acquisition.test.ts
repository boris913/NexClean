// Source d'acquisition (specs/COM1-01 RG-01..04) sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Source d’acquisition (intégration)', async () => {
  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const svc = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');
  const geo = await import('@/lib/geo/service');
  const { soumettreDemandeDevis } = await import('@/lib/dossiers/demande-devis');
  const { compteursDirection } = await import('@/lib/dossiers/compteurs');

  let referent: { id: string; roles: ('referent' | 'direction')[] };
  let autre: { id: string; roles: ('referent' | 'direction')[] };
  let lieu: { villeId: number; villeAutre: string; quartierId: number; quartierAutre: string };
  let n = 0;
  const ip = () => `10.9.0.${++n}`;

  const facebook = {
    premier: { source: 'facebook' as const, utmSource: 'facebook', utmCampaign: 'menage-nov', le: '2026-11-07T08:00:00.000Z' },
    dernier: { source: 'google_naturel' as const, le: '2026-11-10T08:00:00.000Z' },
  };

  const saisie = (whatsapp: string, canal: 'telephone' | 'visite' | 'email', source?: 'inconnue' | 'bouche_a_oreille') => ({
    type: 'NET' as const,
    canal,
    ...(source ? { source } : {}),
    formulaire: 'saisie',
    client: { type: 'particulier' as const, nom: 'Mme Ngo', contact: null, whatsapp },
    villeId: lieu.villeId,
    villeAutre: null,
    quartierId: null,
    quartierAutre: null,
    lieu: null,
    secteur: null,
    description: 'Ménage hebdomadaire',
    donnees: { whatsapp },
  });

  const demandeDe = async (dossierId: number) => (await getDb().select().from(schema.demande).where(eq(schema.demande.dossierId, dossierId)))[0]!;

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    const v = (await geo.listesLieux()).find((l) => l.nom === 'Douala')!;
    lieu = { villeId: v.id, villeAutre: '', quartierId: v.quartiers.find((q) => q.nom === 'Akwa')!.id, quartierAutre: '' };
    const mk = async (email: string) => ({ id: (await collab.creerCollaborateur({ nom: email, email, roles: ['referent'] }, { id: null })).userId, roles: ['referent' as const] });
    referent = await mk('ref@nexclean.test');
    autre = await mk('autre@nexclean.test');
  });

  it('RG-02 : un formulaire du site prend la source du premier contact et garde l’attribution', async () => {
    const r = await soumettreDemandeDevis(
      { formId: 'devis-pro', valeurs: { company: 'ACME SARL', sector: 'Bureaux', contact: 'M. Talla', phone: '690 22 33 44', need: 'Entretien des bureaux' }, lieu, consentement: true },
      { ip: ip(), attribution: facebook },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.numero, r.numero));
    const dem = await demandeDe(d!.id);
    expect(dem.source).toBe('facebook');
    expect(dem.attribution).toEqual(facebook);
  });

  it('RG-02 : sans cookie, la demande du site part en « inconnue »', async () => {
    const r = await soumettreDemandeDevis(
      { formId: 'devis-pro', valeurs: { company: 'Beta SARL', sector: 'Bureaux', contact: 'Mme Eyoum', phone: '690 22 33 55', need: 'Vitres' }, lieu, consentement: true },
      { ip: ip() },
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.numero, r.numero));
    const dem = await demandeDe(d!.id);
    expect([dem.source, dem.attribution]).toEqual(['inconnue', null]);
  });

  it('RG-03 : saisie au téléphone sans source → refusée ; avec source → acceptée', async () => {
    await expect(svc.creerDemande(saisie('691000001', 'telephone', 'inconnue'), referent)).rejects.toThrow(/connu NEXCLEAN/);
    await expect(svc.creerDemande(saisie('691000001', 'visite'), referent)).rejects.toThrow(/connu NEXCLEAN/);
    const r = await svc.creerDemande(saisie('691000001', 'telephone', 'bouche_a_oreille'), referent);
    expect((await demandeDe(r.dossierId)).source).toBe('bouche_a_oreille');
  });

  it('RG-03 : la règle ne vise que téléphone et visite', async () => {
    const r = await svc.creerDemande(saisie('691000002', 'email', 'inconnue'), referent);
    expect((await demandeDe(r.dossierId)).source).toBe('inconnue');
  });

  it('RG-04 : correction de la source historisée et journalisée, données soumises intactes', async () => {
    const r = await svc.creerDemande(saisie('691000003', 'telephone', 'bouche_a_oreille'), referent);
    await getDb().update(schema.dossier).set({ referentId: referent.id, statut: 'attribuee' }).where(eq(schema.dossier.id, r.dossierId));
    const avant = await demandeDe(r.dossierId);

    await svc.corrigerSource(avant.id, 'tiktok', referent);

    const apres = await demandeDe(r.dossierId);
    expect(apres.source).toBe('tiktok');
    expect(apres.donnees).toEqual(avant.donnees);
    const evs = await getDb().select().from(schema.evenementDossier).where(eq(schema.evenementDossier.dossierId, r.dossierId));
    expect(evs.map((e) => e.commentaire)).toContain(`Source de la demande n° ${avant.id} : Bouche-à-oreille → TikTok`);
    const audit = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'demande.source_corrigee'));
    expect(audit.at(-1)).toMatchObject({ avant: { source: 'bouche_a_oreille' }, apres: { source: 'tiktok' } });
  });

  it('RG-04 : un référent ne corrige pas la source d’un dossier qui n’est pas le sien', async () => {
    const r = await svc.creerDemande(saisie('691000004', 'telephone', 'bouche_a_oreille'), referent);
    await getDb().update(schema.dossier).set({ referentId: referent.id, statut: 'attribuee' }).where(eq(schema.dossier.id, r.dossierId));
    await expect(svc.corrigerSource((await demandeDe(r.dossierId)).id, 'facebook', autre)).rejects.toThrow(/Accès refusé/);
  });

  it('tableau de bord : compteur par source', async () => {
    const c = await compteursDirection('mois');
    const fb = c.parSource.find((l) => l.cle === 'facebook');
    expect(fb).toMatchObject({ libelle: 'Facebook', crees: 1 });
  });
});
