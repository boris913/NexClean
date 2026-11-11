// Tableau de bord commercial (specs/COM1-02 RG-05..08) : requête SQL sur une vraie base.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Tableau de bord commercial (intégration)', async () => {
  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const svc = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');
  const geo = await import('@/lib/geo/service');
  const { lignesCommerciales, exporterCsv } = await import('@/lib/commercial/service');
  const { totaux } = await import('@/lib/commercial/indicateurs');

  type A = { id: string; roles: ('referent' | 'direction')[] };
  let ref: A;
  let autre: A;
  let dir: A;
  let villeId: number;
  let n = 0;
  const du = new Date('2026-11-01T00:00:00+01:00');
  const au = new Date('2026-12-01T00:00:00+01:00');
  const t = (iso: string) => new Date(`${iso}+01:00`);

  async function dossier(o: { source?: 'facebook' | 'bouche_a_oreille'; creeLe: string; referent?: A; statut?: 'en_cours' | 'nouvelle_demande' | 'en_qualification' }) {
    const r = await svc.creerDemande(
      {
        type: 'NET',
        canal: 'telephone',
        source: o.source ?? 'bouche_a_oreille',
        formulaire: 'saisie',
        client: { type: 'particulier', nom: `Client TB ${++n}`, contact: null, whatsapp: `6930000${String(n).padStart(2, '0')}` },
        villeId,
        villeAutre: null,
        quartierId: null,
        quartierAutre: null,
        lieu: null,
        secteur: null,
        description: 'Ménage',
        donnees: {},
      },
      dir,
    );
    await getDb()
      .update(schema.dossier)
      .set({ creeLe: t(o.creeLe), referentId: (o.referent ?? ref).id, statut: o.statut ?? 'en_cours' })
      .where(eq(schema.dossier.id, r.dossierId));
    // L'événement de création porte l'heure réelle : on l'aligne sur la date simulée.
    await getDb().update(schema.evenementDossier).set({ horodatage: t(o.creeLe) }).where(eq(schema.evenementDossier.dossierId, r.dossierId));
    return r.dossierId;
  }
  const evenement = (dossierId: number, horodatage: string, e: Partial<typeof schema.evenementDossier.$inferInsert>) =>
    getDb().insert(schema.evenementDossier).values({ dossierId, horodatage: t(horodatage), auteurId: ref.id, type: 'transition', ...e });

  let d1: number, d2: number, d3: number, d4: number;

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    villeId = (await geo.listesLieux()).find((l) => l.nom === 'Douala')!.id;
    const mk = async (email: string, roles: A['roles']) => ({ id: (await collab.creerCollaborateur({ nom: email, email, roles }, { id: null })).userId, roles });
    ref = await mk('ref-tb@nexclean.test', ['referent']);
    autre = await mk('autre-tb@nexclean.test', ['referent']);
    dir = await mk('dir-tb@nexclean.test', ['direction']);

    // d1 : Facebook, créé en novembre, répondu 2 h après, devis envoyé puis accepté, facturé, encaissé.
    d1 = await dossier({ source: 'facebook', creeLe: '2026-11-03T08:00:00' });
    await evenement(d1, '2026-11-03T10:00:00', { type: 'note', commentaire: 'Appel client' });
    await evenement(d1, '2026-11-04T09:00:00', { deStatut: 'devis_pret', versStatut: 'devis_envoye' });
    await evenement(d1, '2026-11-06T09:00:00', { deStatut: 'devis_envoye', versStatut: 'accepte' });
    await evenement(d1, '2026-11-20T09:00:00', { deStatut: 'en_cours', versStatut: 'termine' });
    await evenement(d1, '2026-11-21T09:00:00', { deStatut: 'termine', versStatut: 'solde_recu' });
    await getDb().insert(schema.facture).values([
      { numero: 'FAC-TB-1', type: 'solde', dossierId: d1, libelle: 'Ménage', lignes: [], tauxTva: 0, totalHt: 80_000, montantTva: 0, totalTtc: 80_000, client: { nom: 'x', contact: null, whatsapp: 'x', email: null, ville: null }, mentionsLegales: '', emiseLe: t('2026-11-20T10:00:00') },
      { numero: 'AV-TB-1', type: 'avoir', dossierId: d1, libelle: 'Avoir', lignes: [], tauxTva: 0, totalHt: 5_000, montantTva: 0, totalTtc: 5_000, client: { nom: 'x', contact: null, whatsapp: 'x', email: null, ville: null }, mentionsLegales: '', emiseLe: t('2026-11-22T10:00:00') },
    ]);
    await getDb().insert(schema.encaissement).values([
      { dossierId: d1, nature: 'acompte', montant: 40_000, moyen: 'orange_money', recuLe: '2026-11-07' },
      { dossierId: d1, nature: 'solde', montant: 35_000, moyen: 'orange_money', recuLe: '2026-12-01' }, // hors période
    ]);

    // d2 : créé en novembre, en attente, jamais répondu → sans réponse > 24 h.
    d2 = await dossier({ creeLe: '2026-11-25T08:00:00', statut: 'nouvelle_demande' });
    // d3 : créé en octobre, accepté en novembre (compte dans les acceptés, pas dans les nouveaux).
    d3 = await dossier({ creeLe: '2026-10-15T08:00:00' });
    await evenement(d3, '2026-11-02T09:00:00', { deStatut: 'devis_envoye', versStatut: 'accepte' });
    // d4 : autre référent, créé en novembre.
    d4 = await dossier({ creeLe: '2026-11-10T08:00:00', referent: autre });
  });

  it('RG-06 : faits datés par dossier', async () => {
    const lignes = await lignesCommerciales({ du, au }, dir);
    const l1 = lignes.find((l) => l.id === d1)!;
    expect(l1).toMatchObject({ source: 'facebook', devisEnvoyePeriode: true, accepteePeriode: true, termineePeriode: true, facturePeriode: 75_000, encaissePeriode: 40_000, devisEnvoyeJamais: true, accepteeJamais: true, encaisseJamais: true });
    expect(l1.premiereReponseLe).toEqual(t('2026-11-03T10:00:00'));
    expect(lignes.find((l) => l.id === d2)).toMatchObject({ premiereReponseLe: null, accepteePeriode: false });
    expect(lignes.find((l) => l.id === d3)).toMatchObject({ accepteePeriode: true });
  });

  it('RG-06 : totaux de la Direction', async () => {
    const lignes = await lignesCommerciales({ du, au }, dir);
    const tot = totaux(lignes, { du, au, maintenant: t('2026-11-30T12:00:00') });
    expect(tot).toMatchObject({ nouveaux: 3, enAttente: 1, sansReponse: 1, devisEnvoyes: 1, devisAcceptes: 2, tauxTransformation: 67, prestationsRealisees: 1, facture: 75_000, encaisse: 40_000, delaiPremiereReponseMin: 120 });
  });

  it('RG-05 : un référent ne voit que ses dossiers', async () => {
    const ids = (await lignesCommerciales({ du, au }, ref)).map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining([d1, d2, d3]));
    expect(ids).not.toContain(d4);
    expect((await lignesCommerciales({ du, au }, autre)).map((l) => l.id)).toEqual([d4]);
  });

  it('période sans activité pour un dossier : il n’apparaît pas', async () => {
    const ids = (await lignesCommerciales({ du: new Date('2026-09-01T00:00:00+01:00'), au: new Date('2026-10-01T00:00:00+01:00') }, dir)).map((l) => l.id);
    expect(ids).toEqual([d2]); // seul le dossier encore en attente remonte
  });

  it('RG-08 : export CSV journalisé', async () => {
    const csv = await exporterCsv({ du, au }, { ...dir, ip: '10.0.0.9' });
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(1 + 4);
    const audit = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'commercial.export'));
    expect(audit.at(-1)).toMatchObject({ acteurId: dir.id, details: { lignes: 4 } });
  });
});
