// Socle MVP2-05 : écritures immuables, garde « Acompte reçu » (date de l'Encaissement qui complète),
// garde « Solde reçu », situation financière — vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Encaissements — socle (intégration)', async () => {
  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const svc = await import('@/lib/dossiers/service');
  const effets = await import('@/lib/encaissements/effets');
  const { situationFinanciere, tropPercuARegulariser } = await import('@/lib/encaissements/lecture');
  const { calculerDevis } = await import('@/lib/devis/domaine');

  let dossierId: number;
  let clientId: number;
  let devisId: number;
  const tx = <T,>(f: (t: import('@/lib/devis/effets').Tx) => Promise<T>) => getDb().transaction(f);
  const dossier = async () => (await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, dossierId)))[0]!;
  const encaisser = (montant: number, recuLe: string, nature: 'acompte' | 'solde' | 'autre' = 'acompte', type: 'encaissement' | 'annulation' | 'remboursement' | 'credit' = 'encaissement', annuleEncaissementId?: number) =>
    getDb()
      .insert(schema.encaissement)
      .values({ dossierId, devisId, type, nature, montant, moyen: type === 'credit' ? 'credit_client' : 'especes', recuLe, annuleEncaissementId: annuleEncaissementId ?? null })
      .returning({ id: schema.encaissement.id })
      .then((r) => r[0]!.id);

  beforeAll(async () => {
    await reinitialiserBase();
    const r = await svc.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: 'Hôtel du Lac', contact: 'M. Kamga', whatsapp: '+237699001122' },
      villeId: null,
      villeAutre: 'Kribi',
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: null,
      description: null,
      lignes: [{ intitule: 'Serveur', nombre: 10 }],
      donnees: { test: 1 },
    });
    dossierId = r.dossierId;
    const d = await dossier();
    clientId = d.clientId;
    const t = calculerDevis([{ lignePosteId: null, intitule: 'Serveur', nombre: 10 }], { commission: 5000, commissionsParCategorie: {}, tauxTva: 0 }, 50);
    const [dv] = await getDb()
      .insert(schema.devis)
      .values({ dossierId, clientId, numero: 'DEV-2026-00001', statut: 'accepte', lignes: t.lignes, tauxTva: 0, totalHt: t.totalHt, montantTva: 0, totalTtc: t.totalTtc, tauxAcompte: 50, acompte: t.acompte, delaiRechercheJours: 45, garantieJours: 15, validiteJours: 15, conditions: 'C', mentionsLegales: 'M', accepteLe: new Date() })
      .returning({ id: schema.devis.id });
    devisId = dv!.id;
    await getDb().update(schema.dossier).set({ statut: 'accepte' }).where(eq(schema.dossier.id, dossierId));
  });

  it('RG-05 : 15 000 → reste « Accepté », acompte partiel ; +10 000 → « Acompte reçu », délai à la date de l’Encaissement qui complète', async () => {
    await encaisser(15000, '2026-10-20');
    expect(await tx((t) => effets.appliquerGardeAcompte(t, dossierId))).toBe(false);
    let s = (await situationFinanciere(dossierId))!;
    expect(s.etatAcompte).toMatchObject({ etat: 'partiel', libelle: 'acompte partiel : 15 000 / 25 000' });
    expect((await dossier()).statut).toBe('accepte');
    await encaisser(10000, '2026-10-25');
    expect(await tx((t) => effets.appliquerGardeAcompte(t, dossierId))).toBe(true);
    const d = await dossier();
    expect(d.statut).toBe('acompte_recu');
    expect(d.acompteCompletLe?.toISOString()).toBe('2026-10-25T11:00:00.000Z');
    s = (await situationFinanciere(dossierId))!;
    expect(s).toMatchObject({ nets: 25000, acompteEncaisse: 25000, resteAPayer: 25000, tropPercu: 0, montantFinalTtc: null, issue: null });
  });

  it('RG-02 : une écriture ne se modifie ni ne se supprime (base)', async () => {
    const [e] = await getDb().select().from(schema.encaissement).limit(1);
    await expect(getDb().update(schema.encaissement).set({ montant: 1 }).where(eq(schema.encaissement.id, e!.id))).rejects.toThrow();
    await expect(getDb().delete(schema.encaissement).where(eq(schema.encaissement.id, e!.id))).rejects.toThrow();
  });

  it('RG-08 : montant final 35 000 → « Solde reçu » seulement quand le solde est payé ; annulation prise en compte', async () => {
    await getDb().update(schema.dossier).set({ statut: 'placements_confirmes', montantFinalTtc: 35000 }).where(eq(schema.dossier.id, dossierId));
    expect(await tx((t) => effets.appliquerGardeSolde(t, dossierId))).toBe(false);
    const errone = await encaisser(10000, '2026-11-02', 'solde');
    await encaisser(-10000, '2026-11-02', 'solde', 'annulation', errone);
    expect(await tx((t) => effets.appliquerGardeSolde(t, dossierId))).toBe(false);
    let s = (await situationFinanciere(dossierId))!;
    expect(s.issue).toEqual({ issue: 'solde_a_payer', montant: 10000 });
    expect(s.ecritures.find((e) => e.id === errone)?.annule).toBe(true);
    await encaisser(10000, '2026-11-03', 'solde');
    expect(await tx((t) => effets.appliquerGardeSolde(t, dossierId))).toBe(true);
    expect((await dossier()).statut).toBe('solde_recu');
    s = (await situationFinanciere(dossierId))!;
    expect(s).toMatchObject({ resteAPayer: 0, tropPercu: 0, issue: { issue: 'solde_nul' } });
  });

  it('RG-10..12 : trop-perçu à régulariser ; crédit client = écriture négative, puis crédit disponible', async () => {
    await getDb().update(schema.dossier).set({ statut: 'placements_confirmes', montantFinalTtc: 30000 }).where(eq(schema.dossier.id, dossierId));
    let s = (await situationFinanciere(dossierId))!;
    expect(s.tropPercu).toBe(5000);
    expect(tropPercuARegulariser(s)).toBe(5000);
    expect(await tx((t) => effets.appliquerGardeSolde(t, dossierId))).toBe(false);
    await encaisser(-5000, '2026-11-04', 'autre', 'credit');
    await getDb().insert(schema.mouvementCredit).values({ clientId, montant: 5000, libelle: 'Trop-perçu', dossierId });
    s = (await situationFinanciere(dossierId))!;
    expect(s).toMatchObject({ tropPercu: 0, creditClient: 5000 });
    expect(await tx((t) => effets.appliquerGardeSolde(t, dossierId))).toBe(true);
    await expect(getDb().update(schema.mouvementCredit).set({ montant: 1 })).rejects.toThrow();
  });
});
