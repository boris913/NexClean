// MVP2-04 lot B : facturation à la clôture de la recherche (RG-18, ADR 0010), numérotation et
// immuabilité des factures (RG-17), PDF figés (RG-02, RG-19), avoir de correction (ADR 0020),
// archivage de l'attestation de prise de poste (RG-16) — vraie base PostgreSQL.
import { inflateSync } from 'node:zlib';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

async function texteDuPdf(octets: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(octets);
  let brut = '';
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const filtre = obj.dict.get(PDFName.of('Filter'));
    brut += (filtre === PDFName.of('FlateDecode') ? inflateSync(Buffer.from(obj.contents)) : Buffer.from(obj.contents)).toString('latin1');
  }
  return [...brut.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((m) => Buffer.from(m[1]!, 'hex').toString('latin1')).join('\n');
}

describe.skipIf(!baseDisponible)('Facturation et documents (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-facturation-'));

  const { and, asc, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const dossiers = await import('@/lib/dossiers/service');
  const svc = await import('@/lib/propositions/service');
  const effets = await import('@/lib/devis/effets');
  const facturation = await import('@/lib/devis/facturation');
  const rendu = await import('@/lib/documents/rendu');
  const { calculerDevis } = await import('@/lib/devis/domaine');
  const collab = await import('@/lib/collaborateurs/service');
  const params = await import('@/lib/parametres');
  const { getStockage } = await import('@/lib/fichiers/stockage');

  type R = 'referent' | 'direction';
  type Acteur = { id: string; nom: string; roles: R[]; ip: string };
  let dir: Acteur;
  let rita: Acteur;
  let seq = 0;

  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)]);
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, ...new Array(64).fill(0x20)]);
  const HIER = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  async function collaborateur(nom: string, roles: R[]): Promise<Acteur> {
    const { userId } = await collab.creerCollaborateur({ nom, email: `${nom.toLowerCase()}@facturation.test`, roles }, { id: null });
    if (roles.includes('referent')) await collab.definirAttributs(userId, { services: ['REC'], villeIds: [], telephone: null, capacite: null, absentDu: null, absentAu: null }, { id: null });
    return { id: userId, nom, roles, ip: '10.0.0.3' };
  }

  /** Dossier REC « Recherche en cours », acompte encaissé il y a 5 jours. */
  async function nouveauDossier(lignes: { intitule: string; nombre: number }[]) {
    const r = await dossiers.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: `Hôtel ${++seq}`, contact: 'M. Kamga', whatsapp: `+2376991${String(seq).padStart(5, '0')}` },
      villeId: null,
      villeAutre: 'Kribi',
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: null,
      description: null,
      lignes,
      donnees: { n: seq },
    });
    await getDb().update(schema.dossier).set({ referentId: rita.id, statut: 'recherche_en_cours' }).where(eq(schema.dossier.id, r.dossierId));
    await getDb().insert(schema.evenementDossier).values({ dossierId: r.dossierId, type: 'transition', deStatut: 'accepte', versStatut: 'acompte_recu', horodatage: new Date(Date.now() - 5 * 86_400_000) });
    const l = await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, r.dossierId)).orderBy(schema.lignePoste.ordre);
    return { id: r.dossierId, lignes: l.map((x) => ({ id: x.id, intitule: x.intitule, nombre: x.nombre })) };
  }

  /** Devis accepté sur la page de suivi (facture d'acompte émise et archivée). */
  async function devisAccepte(d: Awaited<ReturnType<typeof nouveauDossier>>, o: { commission?: number; tauxTva?: number } = {}) {
    const [dos] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, d.id));
    const t = calculerDevis(d.lignes.map((l) => ({ lignePosteId: l.id, intitule: l.intitule, nombre: l.nombre })), { commission: o.commission ?? 5000, commissionsParCategorie: {}, tauxTva: o.tauxTva ?? 0 }, 50);
    const [ligne] = await getDb()
      .insert(schema.devis)
      .values({
        dossierId: d.id,
        clientId: dos!.clientId,
        numero: `DEV-2026-${String(90000 + seq).padStart(5, '0')}`,
        statut: 'envoye',
        lignes: t.lignes,
        tauxTva: o.tauxTva ?? 0,
        totalHt: t.totalHt,
        montantTva: t.montantTva,
        totalTtc: t.totalTtc,
        tauxAcompte: 50,
        acompte: t.acompte,
        delaiRechercheJours: 30,
        garantieJours: 15,
        validiteJours: 15,
        conditions: 'Conditions générales de test.',
        mentionsLegales: 'NEXCLEAN SARL — RCCM : RC/DLA/TEST',
        envoyeLe: new Date(),
        expireLe: new Date(Date.now() + 15 * 86_400_000),
      })
      .returning({ id: schema.devis.id });
    const r = await getDb().transaction((tx) => effets.accepterDevis(tx, ligne!.id, { mode: 'suivi', signataireNom: 'Paul Kamga', signataireFonction: 'Gérant' }, { type: 'client' }));
    await effets.archiverPdfFacture(r.facture!.id);
    return { devisId: ligne!.id, acompte: r.facture! };
  }

  const nouveauCandidat = async (prenom = 'Awa') => {
    const [c] = await getDb()
      .insert(schema.candidat)
      .values({ nom: 'Ngo', prenom, telephone: `+2376904${String(++seq).padStart(5, '0')}`, statut: 'preselectionne', metiers: ['Serveur'] })
      .returning();
    return c!.id;
  };

  async function retenue(dossierId: number, lignePosteId: number, remplacePlacementId?: number) {
    const { propositionId } = await svc.creerProposition({ dossierId, lignePosteId, candidatId: await nouveauCandidat(), remplacePlacementId }, rita);
    await svc.enregistrerAccordWhatsApp(propositionId, { fichier: { nom: 'capture.png', octets: PNG }, date: HIER, numeroCommunicable: false }, rita);
    await svc.changerStatutProposition(propositionId, 'retenue', {}, rita);
    return propositionId;
  }

  async function placementConfirme(dossierId: number, lignePosteId: number, remplacePlacementId?: number) {
    const { placementId } = await svc.annoncerPlacement(await retenue(dossierId, lignePosteId, remplacePlacementId), { datePrevue: '2025-03-01' }, rita);
    await svc.confirmerPlacementParPreuve(placementId, { fichier: { nom: 'attestation.pdf', octets: PDF }, datePriseDePoste: '2025-03-01' }, rita);
    return placementId;
  }

  const facture = async (id: number) => (await getDb().select().from(schema.facture).where(eq(schema.facture.id, id)))[0]!;
  const facturesDossier = (dossierId: number) => getDb().select().from(schema.facture).where(eq(schema.facture.dossierId, dossierId)).orderBy(asc(schema.facture.id));
  const numeroDe = (n: string) => Number(n.slice(-5));

  beforeAll(async () => {
    await reinitialiserBase();
    dir = await collaborateur('Dir', ['direction']);
    rita = await collaborateur('Rita', ['referent']);
  }, 120_000);

  describe('RG-18 : solde ou avoir à la clôture (exemples de l’ADR 0010, devis 10 × 5 000, acompte 25 000)', () => {
    it.each([
      [10, 'solde', 25000, 50000],
      [7, 'solde', 10000, 35000],
      [4, 'avoir', 5000, 20000],
      [0, 'avoir', 25000, 0],
    ] as const)(
      '%i placement(s) confirmé(s) → %s de %i (montant final %i)',
      async (n, type, montant, final) => {
        const d = await nouveauDossier([{ intitule: 'Serveur', nombre: 10 }]);
        const { acompte } = await devisAccepte(d);
        expect((await facture(acompte.id)).totalTtc).toBe(25000);
        for (let i = 0; i < n; i++) await placementConfirme(d.id, d.lignes[0]!.id);

        const r = await svc.cloturerRecherche(d.id, n === 10 ? null : 'Fin de la recherche', rita);
        expect(r.placementsRetenus).toBe(n);
        expect(r.facturation.montantFinal).toEqual({ totalHt: final, montantTva: 0, totalTtc: final, placements: n });
        expect(r.facturation.acompteFactureTtc).toBe(25000);
        expect(r.facturation.facture).toMatchObject({ type, totalTtc: montant });

        const f = await facture(r.facturation.facture!.id);
        expect(f).toMatchObject({ type, totalTtc: montant, totalHt: montant, montantTva: 0, tauxTva: 0, dossierId: d.id });
        // RG-17 : numéro consécutif à celui de la facture d'acompte (aucune autre émission entre-temps).
        expect(numeroDe(f.numero)).toBe(numeroDe(acompte.numero) + 1);
        expect(f.lignes.reduce((s, l) => s + l.montantHt, 0)).toBe(f.totalHt);
        if (type === 'avoir') {
          expect(f.factureOrigineId).toBe(acompte.id);
        } else {
          expect(f.lignes[0]).toMatchObject({ quantite: n, prixUnitaire: 5000, montantHt: n * 5000 });
          expect(f.lignes.at(-1)).toMatchObject({ montantHt: -25000 });
        }
        // RG-19 : PDF archivé après la clôture, dans les Documents du Dossier.
        const [pdf] = await getDb().select().from(schema.facturePdf).where(eq(schema.facturePdf.factureId, f.id));
        expect(pdf).toBeDefined();
        const [doc] = await getDb().select().from(schema.document).where(eq(schema.document.id, pdf!.documentId));
        expect(doc).toMatchObject({ dossierId: d.id, categorie: 'facture', mime: 'application/pdf', nomOrigine: `${f.numero}.pdf` });
        const texte = await texteDuPdf(await getStockage().lire(doc!.cle));
        expect(texte).toContain(type === 'avoir' ? 'AVOIR' : 'FACTURE DE SOLDE');
        expect(texte).toContain(f.numero);
        if (type === 'avoir') expect(texte).toContain(`Sur la facture ${acompte.numero}`);
        // Historique du Dossier et journal.
        const evs = await getDb().select().from(schema.evenementDossier).where(eq(schema.evenementDossier.dossierId, d.id));
        expect(evs.some((e) => e.commentaire?.includes(`${f.numero} émise`))).toBe(true);
        const j = await getDb().select().from(schema.journalAudit).where(and(eq(schema.journalAudit.action, 'dossier.montant_final'), eq(schema.journalAudit.objetId, String(d.id))));
        expect(j).toHaveLength(1);
      },
      180_000,
    );

    it('montant final égal à l’acompte facturé : rien n’est émis', async () => {
      const d = await nouveauDossier([{ intitule: 'Serveur', nombre: 2 }]);
      await devisAccepte(d); // acompte 50 % de 10 000 = 5 000
      await placementConfirme(d.id, d.lignes[0]!.id);
      const r = await svc.cloturerRecherche(d.id, 'Un seul poste pourvu', rita);
      expect(r.facturation).toMatchObject({ montantFinal: { totalTtc: 5000 }, acompteFactureTtc: 5000 });
      expect(r.facturation.facture).toBeUndefined();
      expect(await facturesDossier(d.id)).toHaveLength(1);
    }, 60_000);

    it('MVP2-03 RG-18 : 7 confirmés dont 1 rompu pendant la garantie et remplacé → montant final sur 7', async () => {
      const d = await nouveauDossier([{ intitule: 'Agent d’entretien', nombre: 7 }]);
      const { acompte } = await devisAccepte(d); // 35 000 HT, acompte 17 500
      const ids = [];
      for (let i = 0; i < 7; i++) ids.push(await placementConfirme(d.id, d.lignes[0]!.id));
      await svc.declarerRupture(ids[0]!, { dateRupture: '2025-03-11', motif: 'Départ volontaire' }, rita);
      await placementConfirme(d.id, d.lignes[0]!.id, ids[0]);
      const r = await svc.cloturerRecherche(d.id, null, rita);
      expect(r.placementsRetenus).toBe(7);
      expect(r.facturation.montantFinal).toMatchObject({ totalTtc: 35000, placements: 7 });
      expect(r.facturation.facture).toMatchObject({ type: 'solde', totalTtc: 35000 - (await facture(acompte.id)).totalTtc });
    }, 180_000);

    it('TVA 19 % figée au devis : HT + TVA = TTC sur l’avoir de régularisation', async () => {
      const d = await nouveauDossier([{ intitule: 'Serveur', nombre: 2 }]);
      const { acompte } = await devisAccepte(d, { tauxTva: 19 }); // TTC 11 900, acompte 6 000
      const a = await facture(acompte.id);
      expect(a).toMatchObject({ totalTtc: 6000, tauxTva: 19 });
      await params.definirParametre('tva_taux', 0, { id: null }); // sans effet sur le dossier (RG-02)
      await placementConfirme(d.id, d.lignes[0]!.id);
      const r = await svc.cloturerRecherche(d.id, 'Un seul poste pourvu', rita);
      expect(r.facturation.montantFinal).toEqual({ totalHt: 5000, montantTva: 950, totalTtc: 5950, placements: 1 });
      const f = await facture(r.facturation.facture!.id);
      expect(f).toMatchObject({ type: 'avoir', tauxTva: 19, totalTtc: 50 });
      expect(f.totalHt + f.montantTva).toBe(50);
      expect(f.totalHt).toBe(a.totalHt - 5000);
    }, 60_000);

    it('dossier sans devis accepté (MVP-1, transitoire) : clôture sans facture, signalée', async () => {
      const d = await nouveauDossier([{ intitule: 'Serveur', nombre: 1 }]);
      await placementConfirme(d.id, d.lignes[0]!.id);
      const r = await svc.cloturerRecherche(d.id, null, rita);
      expect(r.facturation).toMatchObject({ montantFinal: null, sansDevis: true });
      expect(r.avertissements.some((x) => x.includes('Aucun devis accepté'))).toBe(true);
      expect(await facturesDossier(d.id)).toHaveLength(0);
    }, 60_000);
  });

  describe('RG-17, ADR 0020 : factures immuables, correction par avoir (Direction)', () => {
    it('une facture émise ne peut être modifiée ; l’avoir de correction est réservé à la Direction et crédite au plus le montant de la facture', async () => {
      const d = await nouveauDossier([{ intitule: 'Serveur', nombre: 4 }]);
      const { acompte } = await devisAccepte(d); // 10 000
      await expect(getDb().update(schema.facture).set({ totalTtc: 1 }).where(eq(schema.facture.id, acompte.id))).rejects.toThrow();
      expect((await facture(acompte.id)).totalTtc).toBe(10000);

      await expect(facturation.emettreAvoirCorrection(acompte.id, 'Erreur de taux', rita)).rejects.toThrow(facturation.MESSAGE_DIRECTION_AVOIR);
      await expect(facturation.emettreAvoirCorrection(acompte.id, '  ', dir)).rejects.toThrow('motif');
      const avoir = await facturation.emettreAvoirCorrection(acompte.id, 'Erreur de taux d’acompte', dir);
      expect(numeroDe(avoir.numero)).toBe(numeroDe(acompte.numero) + 1);
      const f = await facture(avoir.id);
      expect(f).toMatchObject({ type: 'avoir', factureOrigineId: acompte.id, totalTtc: 10000, auteurId: dir.id });
      expect(f.libelle).toContain('Erreur de taux d’acompte');
      expect(await getDb().select().from(schema.facturePdf).where(eq(schema.facturePdf.factureId, avoir.id))).toHaveLength(1);
      const j = await getDb().select().from(schema.journalAudit).where(and(eq(schema.journalAudit.action, 'facture.avoir_correction'), eq(schema.journalAudit.objetId, String(acompte.id))));
      expect(j).toHaveLength(1);
      await expect(facturation.emettreAvoirCorrection(acompte.id, 'Encore', dir)).rejects.toThrow('intégralement créditée');
      await expect(facturation.emettreAvoirCorrection(avoir.id, 'Avoir d’avoir', dir)).rejects.toThrow('ne se corrige pas');

      // Vue Back-Office : rien à créditer sur la facture d'acompte.
      const vue = await facturation.listerFactures(d.id, dir);
      expect(vue.map((v) => [v.type, v.restantTtc, v.documentId !== null])).toEqual([
        ['acompte', 0, true],
        ['avoir', 0, true],
      ]);
      // À la clôture, l'acompte annulé n'est plus déduit : solde = montant final.
      await placementConfirme(d.id, d.lignes[0]!.id);
      const r = await svc.cloturerRecherche(d.id, 'Fin', rita);
      expect(r.facturation).toMatchObject({ acompteFactureTtc: 0, facture: { type: 'solde', totalTtc: 5000 } });
    }, 60_000);
  });

  describe('Documents PDF figés et archivage', () => {
    it('RG-02 : le PDF d’un devis à 5 000 reste à 5 000 après passage de la commission à 6 000', async () => {
      const d = await nouveauDossier([{ intitule: 'Cuisinière', nombre: 3 }]);
      const { devisId, acompte } = await devisAccepte(d, { commission: 5000 });
      await params.definirParametre('commission_par_personne', 6000, { id: null });
      await params.definirParametre('mentions_legales', 'NOUVELLES MENTIONS LÉGALES — RCCM : RC/DLA/NOUVEAU', { id: null });
      const octets = await rendu.genererPdfDevis(devisId);
      expect(octets.byteLength).toBeLessThan(300 * 1024);
      const t = await texteDuPdf(octets);
      expect(t).toContain('5 000 FCFA');
      expect(t).toContain('15 000 FCFA');
      expect(t).not.toContain('6 000 FCFA');
      expect(t).toContain('RCCM : RC/DLA/TEST');
      expect(t).not.toContain('NOUVELLES MENTIONS');
      expect(t).toContain('Cuisinière');
      expect(t).toContain('TVA non applicable');
      // La facture d'acompte porte ses mentions figées à l'émission.
      const tf = await texteDuPdf(await rendu.genererPdfFacture(acompte.id));
      expect(tf).toContain(acompte.numero);
      expect(tf).toContain("FACTURE D'ACOMPTE");
      expect(tf).not.toContain('NOUVELLES MENTIONS');
    }, 60_000);

    it('RG-16 : l’attestation de prise de poste est archivée à l’annonce du placement ; accusé de réception', async () => {
      const d = await nouveauDossier([{ intitule: 'Serveur', nombre: 1 }]);
      const { placementId } = await svc.annoncerPlacement(await retenue(d.id, d.lignes[0]!.id), { datePrevue: '2026-12-01' }, rita);
      expect(placementId).toBeGreaterThan(0);
      const docs = await getDb().select().from(schema.document).where(and(eq(schema.document.dossierId, d.id), eq(schema.document.categorie, 'attestation')));
      expect(docs).toHaveLength(1);
      expect(docs[0]!.nomOrigine).toMatch(/^Attestation-prise-de-poste-REC-/);
      const t = await texteDuPdf(await getStockage().lire(docs[0]!.cle));
      expect(t).toContain('Attestation de prise de poste');
      expect(t).toContain('1 décembre 2026');

      const [dos] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, d.id));
      const ar = await texteDuPdf(await rendu.genererAccuseReception(d.id));
      expect(ar).toContain(dos!.numero);
      expect(ar).toContain('Suivez votre demande via le lien reçu par WhatsApp.');
    }, 60_000);
  });
});
