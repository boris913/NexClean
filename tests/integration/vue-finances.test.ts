// MVP2-05 lot C : vue Responsable finances (impayés, moyens « Autre », remboursements, demandes
// d'annulation, crédits), paiements sur la page de suivi (aucune donnée interne) et reçu PDF
// (génération, archivage, route de téléchargement contrôlée par jeton) — vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

const h = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  entetes: new Headers({ 'x-forwarded-for': '41.202.1.9', 'user-agent': 'Mozilla/5.0 (Test mobile)' }),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (nom: string) => (h.cookies.has(nom) ? { name: nom, value: h.cookies.get(nom)! } : undefined),
    set: (nom: string, valeur: string) => void h.cookies.set(nom, valeur),
  }),
  headers: async () => h.entetes,
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const JOUR = 24 * 60 * 60 * 1000;

describe.skipIf(!baseDisponible)('Vue Finances, paiements du suivi et reçus (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-vue-finances-'));

  const { eq } = await import('drizzle-orm');
  const { PDFDocument } = await import('pdf-lib');
  const { getDb, schema } = await import('@/lib/db');
  const svc = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');
  const devisEffets = await import('@/lib/devis/effets');
  const { calculerDevis } = await import('@/lib/devis/domaine');
  const effets = await import('@/lib/encaissements/effets');
  const vue = await import('@/lib/encaissements/vue-finances');
  const suivi = await import('@/lib/encaissements/suivi');
  const propClient = await import('@/lib/propositions/client');
  const actions = await import('@/app/(site)/suivi/[jeton]/actions');
  const routeRecu = await import('@/app/(site)/suivi/[jeton]/documents/recus/[encaissementId]/route');

  const maintenant = new Date('2026-11-04T10:00:00Z');
  let refId: string;
  let seq = 0;
  let numeroRecu = 0;
  const req = new Request('http://localhost/');
  type D = { id: number; jeton: string; clientId: number; numero: string; devisId: number };
  let a: D; // impayé (moyen « Autre », annulation, justificatif, commentaire)
  let b: D; // trop-perçu, remboursements, crédit
  let c: D; // soldé : pas d'impayé
  const ids: Record<string, number> = {};

  async function nouveauDossier(whatsapp: string): Promise<D> {
    const r = await svc.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: `Hôtel ${++seq}`, contact: 'M. Kamga', whatsapp },
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
    await getDb().update(schema.dossier).set({ referentId: refId, statut: 'acompte_recu' }).where(eq(schema.dossier.id, r.dossierId));
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, r.dossierId));
    const t = calculerDevis([{ lignePosteId: null, intitule: 'Serveur', nombre: 10 }], { commission: 5000, commissionsParCategorie: {}, tauxTva: 0 }, 50);
    const [dv] = await getDb()
      .insert(schema.devis)
      .values({ dossierId: d!.id, clientId: d!.clientId, numero: `DEV-2026-0000${seq}`, statut: 'accepte', lignes: t.lignes, tauxTva: 0, totalHt: t.totalHt, montantTva: 0, totalTtc: t.totalTtc, tauxAcompte: 50, acompte: t.acompte, delaiRechercheJours: 45, garantieJours: 15, validiteJours: 15, conditions: 'C', mentionsLegales: 'M', envoyeLe: new Date(), accepteLe: new Date() })
      .returning({ id: schema.devis.id });
    return { id: d!.id, jeton: d!.jetonSuivi, clientId: d!.clientId, numero: d!.numero, devisId: dv!.id };
  }

  const encaisser = (d: D, o: { montant: number; recuLe: string; nature?: 'acompte' | 'solde' | 'autre'; type?: 'encaissement' | 'annulation' | 'remboursement' | 'credit'; moyen?: 'mtn_momo' | 'orange_money' | 'especes' | 'autre' | 'credit_client'; reference?: string; commentaire?: string; justificatifDocumentId?: number; annuleEncaissementId?: number; motif?: string }) =>
    getDb()
      .insert(schema.encaissement)
      .values({
        dossierId: d.id,
        devisId: d.devisId,
        type: o.type ?? 'encaissement',
        nature: o.nature ?? 'acompte',
        montant: o.montant,
        moyen: o.moyen ?? 'mtn_momo',
        reference: o.reference ?? null,
        recuLe: o.recuLe,
        commentaire: o.commentaire ?? null,
        justificatifDocumentId: o.justificatifDocumentId ?? null,
        annuleEncaissementId: o.annuleEncaissementId ?? null,
        motif: o.motif ?? null,
        recuNumero: (o.type ?? 'encaissement') === 'encaissement' ? `REÇ-2026-${String(++numeroRecu).padStart(5, '0')}` : null,
        auteurId: refId,
      })
      .returning({ id: schema.encaissement.id })
      .then((r) => r[0]!.id);

  async function factureSolde(d: D, montant: number, emiseLe: Date) {
    await getDb()
      .insert(schema.facture)
      .values({ numero: `FAC-2026-1${d.id}`, type: 'solde', dossierId: d.id, devisId: d.devisId, libelle: 'Solde', lignes: [{ libelle: 'Solde', quantite: 1, prixUnitaire: montant, montantHt: montant }], tauxTva: 0, totalHt: montant, montantTva: 0, totalTtc: montant, client: { nom: 'Hôtel', contact: null, whatsapp: '+237', email: null, ville: null }, mentionsLegales: 'M', emiseLe });
  }

  beforeAll(async () => {
    await reinitialiserBase();
    refId = (await collab.creerCollaborateur({ nom: 'Rita Recrutement', email: 'rita@nexclean.test', roles: ['referent'] }, { id: null })).userId;
    a = await nouveauDossier('+237699001122');
    b = await nouveauDossier('+237699003344');
    c = await nouveauDossier('+237699005566');

    // A : acompte 25 000 payé sur un numéro personnel (moyen « Autre ») + justificatif ; un paiement
    // erroné annulé ; montant final 35 000, facture de solde de 10 000 émise il y a 20 jours.
    const justificatif = await devisEffets.archiverPdf(a.id, 'capture.pdf', new TextEncoder().encode('%PDF-1.4 justificatif'), 'recu', { type: 'systeme' });
    await getDb().update(schema.document).set({ categorie: 'justificatif' }).where(eq(schema.document.id, justificatif.documentId));
    ids.autre = await encaisser(a, { montant: 25000, recuLe: '2026-10-01', moyen: 'autre', reference: 'TEL-0612', commentaire: 'Reçu sur le numéro personnel de Paul', justificatifDocumentId: justificatif.documentId });
    ids.errone = await encaisser(a, { montant: 3000, recuLe: '2026-10-02', reference: 'MP-ERREUR', commentaire: 'note interne secrète' });
    await encaisser(a, { montant: -3000, recuLe: '2026-10-03', type: 'annulation', annuleEncaissementId: ids.errone, motif: 'Saisie en double (motif interne)' });
    ids.autreAnnule = await encaisser(a, { montant: 1000, recuLe: '2026-10-04', moyen: 'autre', reference: 'TEL-0999', commentaire: 'erreur' });
    await encaisser(a, { montant: -1000, recuLe: '2026-10-04', type: 'annulation', moyen: 'autre', annuleEncaissementId: ids.autreAnnule, motif: 'Erreur' });
    await getDb().update(schema.dossier).set({ statut: 'placements_confirmes', montantFinalTtc: 35000 }).where(eq(schema.dossier.id, a.id));
    await factureSolde(a, 10000, new Date(maintenant.getTime() - 20 * JOUR));
    await getDb().insert(schema.demandeAnnulation).values({ encaissementId: ids.autre, motif: 'Montant à vérifier', demandeParId: refId });

    // B : acompte 25 000, montant final 15 000 → trop-perçu 10 000 : un remboursement à valider
    // (6 000), un validé à effectuer (4 000 — fictif) ; crédit client de 2 000 disponible.
    ids.acompteB = await encaisser(b, { montant: 25000, recuLe: '2026-10-05', moyen: 'orange_money', reference: 'OM-1' });
    await getDb().update(schema.dossier).set({ statut: 'placements_confirmes', montantFinalTtc: 15000 }).where(eq(schema.dossier.id, b.id));
    const [aj] = await getDb().insert(schema.ajustement).values({ dossierId: b.id, montant: 10000, choix: 'remboursement', commentaire: 'commentaire ajustement interne' }).returning();
    ids.rembAValider = (await getDb().insert(schema.remboursement).values({ dossierId: b.id, ajustementId: aj!.id, montant: 6000, prepareParId: refId }).returning())[0]!.id;
    ids.rembValide = (await getDb().insert(schema.remboursement).values({ dossierId: b.id, ajustementId: aj!.id, montant: 4000, statut: 'valide', valideLe: new Date() }).returning())[0]!.id;
    await getDb().insert(schema.mouvementCredit).values({ clientId: b.clientId, montant: 2000, libelle: 'Trop-perçu', dossierId: b.id });

    // C : soldé (facture de solde émise, solde encaissé) → pas d'impayé.
    await encaisser(c, { montant: 25000, recuLe: '2026-10-06', reference: 'MP-C1' });
    await getDb().update(schema.dossier).set({ statut: 'placements_confirmes', montantFinalTtc: 30000 }).where(eq(schema.dossier.id, c.id));
    await factureSolde(c, 5000, new Date(maintenant.getTime() - 30 * JOUR));
    await encaisser(c, { montant: 5000, recuLe: '2026-10-20', nature: 'solde', reference: 'MP-C2' });
  });

  it('impayés : facture de solde émise, reste à payer > 0, ancienneté ; un Dossier soldé n’apparaît pas', async () => {
    const impayes = await vue.soldesImpayes(maintenant);
    expect(impayes).toHaveLength(1);
    expect(impayes[0]).toMatchObject({ dossierId: a.id, numeroDossier: a.numero, montantFinalTtc: 35000, nets: 25000, resteAPayer: 10000, ancienneteJours: 20, referentNom: 'Rita Recrutement' });
    expect(vue.lienFinancesDossier(a.id)).toBe(`/admin/dossiers/${a.id}?onglet=finances`);
  });

  it('moyens « Autre » signalés (commentaire visible en interne), annulés exclus', async () => {
    const autres = await vue.signalementsMoyenAutre();
    expect(autres.map((e) => e.id)).toEqual([ids.autre]);
    expect(autres[0]).toMatchObject({ moyen: 'autre', commentaire: 'Reçu sur le numéro personnel de Paul', annule: false, dossierId: a.id });
  });

  it('remboursements à valider et à effectuer, demandes d’annulation, crédits clients', async () => {
    const v = await vue.vueFinances({}, maintenant);
    expect(v.remboursementsAValider.map((r) => r.id)).toEqual([ids.rembAValider]);
    expect(v.remboursementsAValider[0]).toMatchObject({ dossierId: b.id, montant: 6000, statut: 'a_valider', prepareParNom: 'Rita Recrutement' });
    expect(v.remboursementsAEffectuer.map((r) => r.id)).toEqual([ids.rembValide]);
    expect(v.demandesAnnulation).toHaveLength(1);
    expect(v.demandesAnnulation[0]).toMatchObject({ encaissementId: ids.autre, motif: 'Montant à vérifier', demandeParNom: 'Rita Recrutement', dossierId: a.id });
    expect(v.credits).toEqual([{ clientId: b.clientId, clientNom: 'Hôtel 2', credit: 2000, dossierId: b.id, numeroDossier: b.numero }]);
    expect(v.impayes).toHaveLength(1);
  });

  it('encaissements récents : filtres période et moyen ; annulation signalée', async () => {
    const tous = await vue.encaissementsRecents();
    expect(tous).toHaveLength(8);
    expect(tous.find((e) => e.id === ids.errone)?.annule).toBe(true);
    expect(tous.find((e) => e.id === ids.autre)?.annule).toBe(false);
    expect((await vue.encaissementsRecents({ moyen: 'orange_money' })).map((e) => e.id)).toEqual([ids.acompteB]);
    const periode = await vue.encaissementsRecents({ du: '2026-10-02', au: '2026-10-03' });
    expect(periode.map((e) => e.recuLe).sort()).toEqual(['2026-10-02', '2026-10-03']);
    // Filtres invalides ignorés.
    expect(await vue.encaissementsRecents({ du: 'n’importe quoi', moyen: 'bitcoin' })).toHaveLength(8);
  });

  it('suivi : paiements, annulé marqué et exclu, reste à payer — sans aucune donnée interne', async () => {
    const ctx = (await propClient.chargerContexteSuivi(a.jeton))!;
    const p = (await suivi.paiementsPourSuivi(ctx))!;
    expect(p.devis).toMatchObject({ totalTtc: 50000, acompte: 25000, deductionCredit: 0 });
    expect(p).toMatchObject({ montantFinalTtc: 35000, totalPaye: 25000, resteAPayer: 10000, tropPercu: 0 });
    expect(p.lignes.map((l) => [l.genre, l.id, l.genre === 'paiement' ? l.annule : null])).toEqual([
      ['paiement', ids.autre, false],
      ['paiement', ids.errone, true],
      ['paiement', ids.autreAnnule, true],
    ]);
    const json = JSON.stringify(p);
    for (const interne of ['numéro personnel', 'note interne', 'motif interne', 'Saisie en double', 'justificatif', 'commentaire', 'motif', 'auteur', refId]) expect(json).not.toContain(interne);
    expect(json).toContain('TEL-0612'); // référence de la transaction : connue du client

    const pb = (await suivi.paiementsPourSuivi((await propClient.chargerContexteSuivi(b.jeton))!))!;
    expect(pb).toMatchObject({ tropPercu: 10000, resteAPayer: 0, regularisationEnCours: true });
    expect(JSON.stringify(pb)).not.toContain('ajustement interne');
  });

  it('reçu : PDF généré depuis les valeurs figées, archivé une fois ; route de suivi contrôlée par jeton et Dossier', async () => {
    const octets = await (await import('@/lib/documents/rendu')).genererPdfRecu(ids.autre);
    expect(octets.byteLength).toBeLessThan(300 * 1024);
    expect((await PDFDocument.load(octets)).getPageCount()).toBe(1);
    await expect((await import('@/lib/documents/rendu')).genererPdfRecu(ids.errone + 1)).rejects.toThrow('Reçu introuvable'); // écriture d'annulation : pas de reçu
    const doc1 = await effets.archiverPdfRecu(ids.autre);
    expect(await effets.archiverPdfRecu(ids.autre)).toBe(doc1);

    const get = (jeton: string, id: number) => routeRecu.GET(req, { params: Promise.resolve({ jeton, encaissementId: String(id) }) });
    h.cookies.clear();
    expect((await get(a.jeton, ids.autre)).status).toBe(403); // sans vérification des 4 chiffres
    expect(await actions.verifierChiffres('suivi', a.jeton, '1122')).toMatchObject({ ok: true });
    const r = await get(a.jeton, ids.autre);
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('application/pdf');
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(decodeURIComponent(r.headers.get('Content-Disposition') ?? '')).toContain('REÇ-2026-00001.pdf');
    // Reçu d'un paiement annulé : toujours servi tel qu'il a été émis (archivé à la volée).
    expect((await get(a.jeton, ids.errone)).status).toBe(200);
    // Reçu d'un autre Dossier, id invalide : introuvable.
    expect((await get(a.jeton, ids.acompteB)).status).toBe(404);
    expect((await get(a.jeton, 0)).status).toBe(404);
    const journal = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'recu.pdf_telecharge'));
    expect(journal.length).toBe(2);
  });
});
