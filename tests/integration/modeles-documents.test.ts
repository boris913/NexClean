// POST-05 : versions des modèles de documents sur une vraie base PostgreSQL — création journalisée,
// conflit de version, retour arrière, version en vigueur à la date de référence, facture et accusé
// de réception régénérés avec le modèle de leur date (ADR 0020 §3), versions en ajout seul.
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

describe.skipIf(!baseDisponible)('Modèles de documents (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-modeles-documents-'));

  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const collab = await import('@/lib/collaborateurs/service');
  const dossiers = await import('@/lib/dossiers/service');
  const effets = await import('@/lib/devis/effets');
  const rendu = await import('@/lib/documents/rendu');
  const { calculerDevis } = await import('@/lib/devis/domaine');
  const v = await import('@/lib/documents/versions');
  const { modeleOrigine } = await import('@/lib/documents/personnalisation');

  let dir: { id: string; ip: string };
  const H = 3_600_000;
  const avec = (type: Parameters<typeof modeleOrigine>[0], blocs: Record<string, string>) => {
    const o = modeleOrigine(type);
    return { blocs: { ...o.blocs, ...blocs }, ordre: o.ordre };
  };
  const journal = (action: string) => getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, action));

  beforeAll(async () => {
    await reinitialiserBase();
    const { userId } = await collab.creerCollaborateur({ nom: 'Diane Direction', email: 'diane@modeles-documents.test', roles: ['direction'] }, { id: null });
    dir = { id: userId, ip: '10.0.0.9' };
  }, 120_000);

  it('RG-08 : sans version, le modèle d’origine s’applique (version 0)', async () => {
    expect(await v.modeleEnVigueur('facture', new Date())).toEqual(modeleOrigine('facture'));
    const versions = await v.listerVersions('facture');
    expect(versions.map((x) => x.version)).toEqual([0]);
    expect((await v.versionsCourantes()).facture).toEqual({ version: 0, creeLe: null });
  });

  it('RG-03, RG-07 : contenu invalide refusé, rien n’est créé', async () => {
    await expect(v.enregistrerModeleDocument({ type: 'devis', versionBase: 0, contenu: avec('devis', { introduction: '{{client.telephone}}' }) }, dir)).rejects.toThrow('Variable inconnue dans « Introduction (sous le titre) » : client.telephone');
    await expect(v.enregistrerModeleDocument({ type: 'devis', versionBase: 0, contenu: avec('devis', { modalites_titre: '' }) }, dir)).rejects.toThrow('ne peut pas être vide');
    await expect(v.enregistrerModeleDocument({ type: 'devis', versionBase: 0, contenu: { ...modeleOrigine('devis'), ordre: ['montants', 'destinataire', 'modalites', 'conditions', 'complement', 'signature'] } }, dir)).rejects.toThrow('verrouillée');
    await expect(v.enregistrerModeleDocument({ type: 'devis', versionBase: 0, contenu: modeleOrigine('devis') }, dir)).rejects.toThrow('Aucune modification');
    expect(await getDb().select().from(schema.modeleDocumentVersion)).toHaveLength(0);
  });

  it('RG-09, RG-10, RG-11 : versions numérotées et journalisées, conflit, retour arrière, version en vigueur par date', async () => {
    const t0 = new Date(Date.now() - 10 * H);
    const t1 = new Date(t0.getTime() + H);
    const t2 = new Date(t0.getTime() + 2 * H);
    const t3 = new Date(t0.getTime() + 3 * H);

    expect(await v.enregistrerModeleDocument({ type: 'avoir', versionBase: 0, contenu: avec('avoir', { explication: '  Version un.  ' }), commentaire: 'Premier essai' }, dir, t0)).toBe(1);
    const [v1] = await getDb().select().from(schema.modeleDocumentVersion).where(eq(schema.modeleDocumentVersion.type, 'avoir'));
    expect(v1).toMatchObject({ version: 1, creePar: dir.id, commentaire: 'Premier essai', restaureDe: null });
    expect(v1!.contenu.blocs.explication).toBe('Version un.');
    const [j] = await journal('modele_document.version_creee');
    expect(j).toMatchObject({ acteurId: dir.id, objetType: 'modele_document', objetId: 'avoir', ip: '10.0.0.9' });
    expect((j!.apres as { blocs: Record<string, string> }).blocs.explication).toBe('Version un.');

    // Enregistrement fondé sur une version périmée : refusé.
    await expect(v.enregistrerModeleDocument({ type: 'avoir', versionBase: 0, contenu: avec('avoir', { explication: 'Concurrent' }) }, dir, t1)).rejects.toThrow('rechargez la page');
    expect(await v.enregistrerModeleDocument({ type: 'avoir', versionBase: 1, contenu: avec('avoir', { explication: 'Version deux.' }) }, dir, t1)).toBe(2);

    // RG-11 : dernière version créée au plus tard à la date de référence.
    expect((await v.modeleEnVigueur('avoir', new Date(t0.getTime() - 1))).blocs.explication).toBe(modeleOrigine('avoir').blocs.explication);
    expect((await v.modeleEnVigueur('avoir', t0)).blocs.explication).toBe('Version un.');
    expect((await v.modeleEnVigueur('avoir', new Date(t1.getTime() - 1))).blocs.explication).toBe('Version un.');
    expect((await v.modeleEnVigueur('avoir', t1)).blocs.explication).toBe('Version deux.');
    // Les autres types ne sont pas concernés.
    expect(await v.modeleEnVigueur('facture', t3)).toEqual(modeleOrigine('facture'));

    // RG-10 : retour à la version 1, puis au modèle d'origine.
    expect(await v.restaurerVersion('avoir', 1, dir, t2)).toBe(3);
    expect((await v.modeleEnVigueur('avoir', t2)).blocs.explication).toBe('Version un.');
    await expect(v.restaurerVersion('avoir', 1, dir, t2)).rejects.toThrow('déjà celle en vigueur');
    await expect(v.restaurerVersion('avoir', 9, dir, t2)).rejects.toThrow('Version introuvable');
    expect(await v.restaurerVersion('avoir', 0, dir, t3)).toBe(4);
    expect(await v.modeleEnVigueur('avoir', t3)).toEqual(modeleOrigine('avoir'));
    expect((await journal('modele_document.version_restauree')).map((x) => (x.details as { restaureDe: number }).restaureDe)).toEqual([1, 0]);

    const versions = await v.listerVersions('avoir');
    expect(versions.map((x) => [x.version, x.restaureDe, x.commentaire])).toEqual([
      [4, 0, 'Retour au modèle d’origine'],
      [3, 1, 'Reprise de la version 1'],
      [2, null, null],
      [1, null, 'Premier essai'],
      [0, null, 'Modèle d’origine'],
    ]);
    expect(versions[0]!.auteur).toBe('Diane Direction');
    expect((await v.versionsCourantes()).avoir.version).toBe(4);
  });

  it('RG-09 : une version n’est jamais modifiée ni supprimée (base en ajout seul)', async () => {
    await expect(getDb().update(schema.modeleDocumentVersion).set({ commentaire: 'modifié' }).where(eq(schema.modeleDocumentVersion.type, 'avoir'))).rejects.toThrow();
    await expect(getDb().delete(schema.modeleDocumentVersion).where(eq(schema.modeleDocumentVersion.type, 'avoir'))).rejects.toThrow();
    expect(await getDb().select().from(schema.modeleDocumentVersion).where(eq(schema.modeleDocumentVersion.type, 'avoir'))).toHaveLength(4);
  });

  it('RG-11, RG-12 (ADR 0020 §3) : facture régénérée avec le modèle de son émission ; accusé de réception avec celui de la réception', async () => {
    // Version 1 de la facture, en vigueur avant l'émission.
    await v.enregistrerModeleDocument({ type: 'facture', versionBase: 0, contenu: avec('facture', { paiement: 'V1 : référence {{facture.numero}}.' }) }, dir, new Date(Date.now() - H));

    const r = await dossiers.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: 'Hôtel du Lac', contact: 'M. Kamga', whatsapp: '+237699100001' },
      villeId: null,
      villeAutre: 'Kribi',
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: null,
      description: null,
      lignes: [{ intitule: 'Serveur', nombre: 2 }],
      donnees: {},
    });
    const [dos] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, r.dossierId));
    const lignes = await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, r.dossierId));
    const t = calculerDevis(lignes.map((l) => ({ lignePosteId: l.id, intitule: l.intitule, nombre: l.nombre })), { commission: 5000, commissionsParCategorie: {}, tauxTva: 0 }, 50);
    const [devis] = await getDb()
      .insert(schema.devis)
      .values({
        dossierId: r.dossierId,
        clientId: dos!.clientId,
        numero: 'DEV-2026-99001',
        statut: 'envoye',
        lignes: t.lignes,
        tauxTva: 0,
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
    const acceptation = await getDb().transaction((tx) => effets.accepterDevis(tx, devis!.id, { mode: 'suivi', signataireNom: 'Paul Kamga', signataireFonction: 'Gérant' }, { type: 'client' }));
    const facture = acceptation.facture!;

    // Version 2 enregistrée après l'émission : la facture déjà émise n'en tient pas compte.
    await v.enregistrerModeleDocument({ type: 'facture', versionBase: 1, contenu: avec('facture', { paiement: 'V2 : nouvelle consigne.' }) }, dir, new Date(Date.now() + H));
    const tf = await texteDuPdf(await rendu.genererPdfFacture(facture.id));
    expect(tf).toContain(`V1 : référence ${facture.numero}.`);
    expect(tf).not.toContain('V2');

    // Archivage différé (premier téléchargement) : même modèle que l'émission.
    await effets.archiverPdfFacture(facture.id);
    const [archive] = await getDb().select().from(schema.facturePdf).where(eq(schema.facturePdf.factureId, facture.id));
    const [doc] = await getDb().select().from(schema.document).where(eq(schema.document.id, archive!.documentId));
    const { getStockage } = await import('@/lib/fichiers/stockage');
    expect(await texteDuPdf(await getStockage().lire(doc!.cle))).toContain('V1 : référence');

    // Accusé de réception : version enregistrée après la réception du dossier → sans effet.
    await v.enregistrerModeleDocument({ type: 'accuse_reception', versionBase: 0, contenu: avec('accuse_reception', { conclusion: 'Conclusion postérieure.' }) }, dir, new Date(Date.now() + H));
    const ar = await texteDuPdf(await rendu.genererAccuseReception(r.dossierId));
    expect(ar).toContain('Suivez votre demande via le lien reçu par WhatsApp.');
    expect(ar).not.toContain('Conclusion postérieure.');
    expect(await getDb().select().from(schema.modeleDocumentVersion).where(and(eq(schema.modeleDocumentVersion.type, 'accuse_reception'), eq(schema.modeleDocumentVersion.version, 1)))).toHaveLength(1);
  }, 60_000);
});
