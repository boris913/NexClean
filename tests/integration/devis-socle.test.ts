// Socle MVP2-04 : numérotation sans trou, factures immuables, acceptation d'un devis
// (facture d'acompte, transition du Dossier), historique des paramètres — vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Devis et factures — socle (intégration)', async () => {
  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const svc = await import('@/lib/dossiers/service');
  const effets = await import('@/lib/devis/effets');
  const { calculerDevis } = await import('@/lib/devis/domaine');
  const collab = await import('@/lib/collaborateurs/service');
  const params = await import('@/lib/parametres');

  let ref: { id: string; roles: ('referent' | 'direction')[] };
  let dossierId: number;
  const tx = <T,>(f: (t: import('@/lib/devis/effets').Tx) => Promise<T>) => getDb().transaction(f);
  const dossier = async () => (await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, dossierId)))[0]!;

  async function devisEnvoye(version = 1, numero = 'DEV-2026-00001') {
    const d = await dossier();
    const t = calculerDevis([{ lignePosteId: null, intitule: 'Serveur', nombre: 10 }], { commission: 5000, commissionsParCategorie: {}, tauxTva: 0 }, 50);
    const [ligne] = await getDb()
      .insert(schema.devis)
      .values({
        dossierId,
        clientId: d.clientId,
        numero,
        version,
        statut: 'envoye',
        lignes: t.lignes,
        tauxTva: 0,
        totalHt: t.totalHt,
        montantTva: t.montantTva,
        totalTtc: t.totalTtc,
        tauxAcompte: 50,
        acompte: t.acompte,
        delaiRechercheJours: 45,
        garantieJours: 15,
        validiteJours: 15,
        conditions: 'Conditions',
        mentionsLegales: 'NEXCLEAN',
        envoyeLe: new Date(),
        expireLe: new Date(Date.now() + 15 * 86_400_000),
        pdfEmpreinte: 'abc123',
      })
      .returning({ id: schema.devis.id });
    return ligne!.id;
  }

  beforeAll(async () => {
    await reinitialiserBase();
    ref = { id: (await collab.creerCollaborateur({ nom: 'Rita Recrutement', email: 'rita@nexclean.test', roles: ['referent'] }, { id: null })).userId, roles: ['referent'] };
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
    await getDb().update(schema.dossier).set({ referentId: ref.id, statut: 'devis_envoye' }).where(eq(schema.dossier.id, dossierId));
  });

  it('RG-17 : deux factures émises simultanément reçoivent deux numéros consécutifs distincts, sans trou', async () => {
    const f = () => tx((t) => effets.emettreFacture(t, { type: 'acompte', dossierId, libelle: 'Test', lignes: [{ libelle: 'x', quantite: 1, prixUnitaire: 1000, montantHt: 1000 }], tauxTva: 0, totalHt: 1000, montantTva: 0, totalTtc: 1000 }, { type: 'systeme' }));
    const [a, b] = await Promise.all([f(), f()]);
    const n = [a.numero, b.numero].map((x) => Number(x.slice(-5))).sort();
    expect(n[1]! - n[0]!).toBe(1);
    // Une transaction annulée ne consomme pas de numéro.
    await expect(
      tx(async (t) => {
        await effets.emettreFacture(t, { type: 'acompte', dossierId, libelle: 'Annulée', lignes: [], tauxTva: 0, totalHt: 1000, montantTva: 0, totalTtc: 1000 }, { type: 'systeme' });
        throw new Error('annulation');
      }),
    ).rejects.toThrow('annulation');
    const c = await f();
    expect(Number(c.numero.slice(-5))).toBe(n[1]! + 1);
    expect(c.numero).toMatch(/^FAC-\d{4}-\d{5}$/);
  });

  it('RG-17 : une facture émise ne peut être ni modifiée ni supprimée (base)', async () => {
    const [f] = await getDb().select().from(schema.facture).limit(1);
    await expect(getDb().update(schema.facture).set({ totalTtc: 1 }).where(eq(schema.facture.id, f!.id))).rejects.toThrow();
    await expect(getDb().delete(schema.facture).where(eq(schema.facture.id, f!.id))).rejects.toThrow();
  });

  it('RG-13 : acceptation → devis accepté, Dossier « Accepté », délai figé reporté, facture d’acompte, historique complet', async () => {
    const id = await devisEnvoye(2);
    await expect(tx((t) => effets.accepterDevis(t, id, { mode: 'suivi', signataireNom: '', signataireFonction: 'Gérant' }, { type: 'client' }))).rejects.toThrow('signataire');
    const r = await tx((t) => effets.accepterDevis(t, id, { mode: 'suivi', signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', ip: '1.2.3.4', navigateur: 'Mozilla/5.0' }, { type: 'client', ip: '1.2.3.4' }));
    expect(r.facture?.numero).toMatch(/^FAC-/);
    const [d] = await getDb().select().from(schema.devis).where(eq(schema.devis.id, id));
    expect(d).toMatchObject({ statut: 'accepte', acceptationMode: 'suivi', signataireNom: 'Paul Kamga', acceptationIp: '1.2.3.4' });
    expect(await dossier()).toMatchObject({ statut: 'accepte', delaiRechercheJours: 45 });
    const [fac] = await getDb().select().from(schema.facture).where(eq(schema.facture.id, r.facture!.id));
    expect(fac).toMatchObject({ type: 'acompte', totalTtc: 25000, devisId: id });
    expect(fac!.client.nom).toBe('Hôtel du Lac');
    const evts = await getDb().select().from(schema.evenementDossier).where(eq(schema.evenementDossier.dossierId, dossierId));
    const acceptation = evts.find((e) => e.commentaire?.includes('accepté (page de suivi)'));
    expect(acceptation?.apres).toMatchObject({ version: 2, signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', ip: '1.2.3.4' });
    expect(evts.some((e) => e.type === 'transition' && e.versStatut === 'accepte' && e.auteurId === null)).toBe(true);
    const notifs = await getDb().select().from(schema.notification).where(eq(schema.notification.destinataireId, ref.id));
    expect(notifs.some((n) => n.type === 'devis_accepte')).toBe(true);
    // Une seule facture d'acompte par devis ; un devis accepté ne l'est pas deux fois.
    await expect(tx((t) => effets.accepterDevis(t, id, { mode: 'suivi', signataireNom: 'X', signataireFonction: 'Y' }, { type: 'client' }))).rejects.toThrow();
    expect(await tx((t) => effets.emettreFactureAcompte(t, id, { type: 'systeme' }))).toMatchObject({ id: r.facture!.id });
  });

  it('cas limite : un devis remplacé ou expiré ne peut pas être accepté ; RG-15 exige la capture WhatsApp', async () => {
    const id = await devisEnvoye(1, 'DEV-2026-00002');
    await expect(tx((t) => effets.accepterDevis(t, id, { mode: 'whatsapp', signataireNom: 'A', signataireFonction: 'B' }, { type: 'collaborateur', id: ref.id }))).rejects.toThrow('capture');
    await getDb().update(schema.devis).set({ statut: 'remplace' }).where(eq(schema.devis.id, id));
    await expect(tx((t) => effets.accepterDevis(t, id, { mode: 'suivi', signataireNom: 'A', signataireFonction: 'B' }, { type: 'client' }))).rejects.toThrow('remplacé');
    const id2 = await devisEnvoye(1, 'DEV-2026-00003');
    await getDb().update(schema.devis).set({ expireLe: new Date(Date.now() - 1000) }).where(eq(schema.devis.id, id2));
    await expect(tx((t) => effets.accepterDevis(t, id2, { mode: 'suivi', signataireNom: 'A', signataireFonction: 'B' }, { type: 'client' }))).rejects.toThrow('expiré');
  });

  it('RG-14 : refus du client → devis refusé, Dossier « Refusé », référent notifié', async () => {
    await getDb().update(schema.dossier).set({ statut: 'devis_envoye', fermeLe: null }).where(eq(schema.dossier.id, dossierId));
    const id = await devisEnvoye(1, 'DEV-2026-00004');
    await tx((t) => effets.refuserDevis(t, id, 'Trop cher', { type: 'client', ip: '1.2.3.4' }));
    expect((await getDb().select().from(schema.devis).where(eq(schema.devis.id, id)))[0]).toMatchObject({ statut: 'refuse', refusMotif: 'Trop cher' });
    expect((await dossier()).statut).toBe('refuse');
    const notifs = await getDb().select().from(schema.notification).where(eq(schema.notification.destinataireId, ref.id));
    expect(notifs.some((n) => n.type === 'devis_refuse')).toBe(true);
    await expect(tx((t) => effets.refuserDevis(t, id, null, { type: 'client' }))).rejects.toThrow();
  });

  it('RG-01 : chaque modification de paramètre est historisée (valeur, date d’effet, auteur)', async () => {
    await params.definirParametre('commission_par_personne', 6000, { id: null });
    await params.definirParametre('tva_taux', 19, { id: null });
    const h = await getDb().select().from(schema.parametreHistorique);
    expect(h.map((x) => [x.cle, x.valeur])).toEqual(expect.arrayContaining([['commission_par_personne', 6000], ['tva_taux', 19]]));
    expect(await params.lireParametre('acompte_bornes')).toEqual({ min: 30, max: 100 });
    expect(await params.lireParametre('validite_devis_jours')).toBe(15);
  });

  it('documents générés : non supprimables', async () => {
    const { documentId } = await effets.archiverPdf(dossierId, 'test.pdf', new TextEncoder().encode('%PDF-1.4 test'), 'devis', { type: 'systeme' });
    await expect(svc.supprimerDocument(documentId, { id: ref.id, roles: ['direction'] })).rejects.toThrow('généré');
  });
});
