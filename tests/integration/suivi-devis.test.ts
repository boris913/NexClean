// Devis sur la page de suivi (specs/MVP2-04 RG-12..14, RG-19, cas limites) : vérification des
// 4 chiffres, acceptation, refus, téléchargements — vraie base PostgreSQL, actions serveur et
// routes de la page appelées directement (next/headers simulé : cookies et en-têtes).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

const h = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  entetes: new Headers({ 'x-forwarded-for': '41.202.1.2', 'user-agent': 'Mozilla/5.0 (Test mobile)' }),
  accuses: 0,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (nom: string) => (h.cookies.has(nom) ? { name: nom, value: h.cookies.get(nom)! } : undefined),
    set: (nom: string, valeur: string) => void h.cookies.set(nom, valeur),
  }),
  headers: async () => h.entetes,
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
// Le rendu PDF est implémenté par le lot documents : simulé ici.
vi.mock('@/lib/documents/rendu', () => ({
  genererPdfDevis: async () => new TextEncoder().encode('%PDF-1.4 devis'),
  genererPdfFacture: async (id: number) => new TextEncoder().encode(`%PDF-1.4 facture ${id}`),
  genererAccuseReception: async (id: number) => {
    h.accuses++;
    await new Promise((r) => setTimeout(r, 30));
    return new TextEncoder().encode(`%PDF-1.4 accuse ${id}`);
  },
}));

describe.skipIf(!baseDisponible)('Page de suivi — devis et documents (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-suivi-devis-'));

  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const svc = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');
  const effets = await import('@/lib/devis/effets');
  const { calculerDevis } = await import('@/lib/devis/domaine');
  const propClient = await import('@/lib/propositions/client');
  const devisClient = await import('@/lib/devis/client');
  const actions = await import('@/app/(site)/suivi/[jeton]/actions');
  const routeDevis = await import('@/app/(site)/suivi/[jeton]/documents/devis/[devisId]/route');
  const routeFacture = await import('@/app/(site)/suivi/[jeton]/documents/factures/[factureId]/route');
  const routeAccuse = await import('@/app/(site)/suivi/[jeton]/documents/accuse-reception/route');

  let refId: string;
  let seq = 0;
  const req = new Request('http://localhost/');

  async function nouveauDossier(whatsapp: string, type: 'REC' | 'NET' = 'REC') {
    const r = await svc.creerDemande({
      type,
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
      lignes: type === 'REC' ? [{ intitule: 'Serveur', nombre: 10 }] : [],
      donnees: { test: 1 },
    });
    await getDb().update(schema.dossier).set({ referentId: refId, statut: 'devis_envoye' }).where(eq(schema.dossier.id, r.dossierId));
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, r.dossierId));
    return { id: d!.id, jeton: d!.jetonSuivi, clientId: d!.clientId, numero: d!.numero };
  }

  async function devisEnvoye(dossier: { id: number; clientId: number }, o: { numero: string; version?: number; statut?: 'envoye' | 'remplace' | 'brouillon'; pdf?: boolean }) {
    const t = calculerDevis([{ lignePosteId: null, intitule: 'Serveur', nombre: 10 }], { commission: 5000, commissionsParCategorie: {}, tauxTva: 0 }, 50);
    const pdf = o.pdf === false ? null : await effets.archiverPdf(dossier.id, `${o.numero}.pdf`, new TextEncoder().encode(`%PDF-1.4 ${o.numero} v${o.version ?? 1}`), 'devis', { type: 'collaborateur', id: refId });
    const envoye = o.statut !== 'brouillon';
    const [ligne] = await getDb()
      .insert(schema.devis)
      .values({
        dossierId: dossier.id,
        clientId: dossier.clientId,
        numero: o.numero,
        version: o.version ?? 1,
        statut: o.statut ?? 'envoye',
        lignes: t.lignes,
        tauxTva: 0,
        totalHt: t.totalHt,
        montantTva: t.montantTva,
        totalTtc: t.totalTtc,
        tauxAcompte: 50,
        justificationTaux: 'JUSTIFICATION-INTERNE',
        acompte: t.acompte,
        delaiRechercheJours: 45,
        garantieJours: 15,
        validiteJours: 15,
        conditions: 'Conditions générales du devis',
        conditionsParticulieres: 'Entretiens dans nos locaux',
        mentionsLegales: 'NEXCLEAN',
        auteurId: refId,
        envoyeLe: envoye ? new Date(Date.now() - (10 - (o.version ?? 1)) * 60_000) : null,
        expireLe: envoye ? new Date(Date.now() + 15 * 86_400_000) : null,
        documentId: pdf?.documentId ?? null,
        pdfEmpreinte: pdf?.empreinte ?? null,
      })
      .returning({ id: schema.devis.id });
    return ligne!.id;
  }

  /** Vérification des 4 chiffres via l'action serveur (pose le cookie signé). */
  const verifier = async (jeton: string, chiffres: string) => actions.verifierChiffres('suivi', jeton, chiffres);
  const ctxDe = async (jeton: string) => (await propClient.chargerContexteSuivi(jeton))!;
  const journal = (action: string) => getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, action));

  let d1: Awaited<ReturnType<typeof nouveauDossier>>;
  let d2: Awaited<ReturnType<typeof nouveauDossier>>;
  let v1: number;
  let v2: number;
  let autre: number;

  beforeAll(async () => {
    await reinitialiserBase();
    refId = (await collab.creerCollaborateur({ nom: 'Rita Recrutement', email: 'rita@nexclean.test', roles: ['referent'] }, { id: null })).userId;
    d1 = await nouveauDossier('+237699001122');
    d2 = await nouveauDossier('+237677889900');
    v1 = await devisEnvoye(d1, { numero: 'DEV-2026-00001', version: 1, statut: 'remplace' });
    v2 = await devisEnvoye(d1, { numero: 'DEV-2026-00001', version: 2 });
    autre = await devisEnvoye(d2, { numero: 'DEV-2026-00002' });
  });

  it('RG-12 : sans vérification des 4 chiffres, ni devis ni PDF ni action ; après vérification, le devis en cours est affiché', async () => {
    h.cookies.clear();
    const ctx = await ctxDe(d1.jeton);
    expect(await propClient.estVerifie(ctx)).toBe(false);
    expect(await devisClient.devisEnvoyeExiste(ctx)).toBe(true);
    const pdf = await routeDevis.GET(req, { params: Promise.resolve({ jeton: d1.jeton, devisId: String(v2) }) });
    expect(pdf.status).toBe(403);
    const acc = await actions.accepterDevis(d1.jeton, v2, { signataireNom: 'Paul', signataireFonction: 'Gérant', conditionsAcceptees: true });
    expect(acc).toMatchObject({ ok: false, erreur: expect.stringContaining('Vérification') });
    expect((await actions.refuserDevis(d1.jeton, v2, null)).ok).toBe(false);
    expect((await routeAccuse.GET(req, { params: Promise.resolve({ jeton: d1.jeton }) })).status).toBe(403);

    expect((await verifier(d1.jeton, '0000')).ok).toBe(false);
    expect(await verifier(d1.jeton, '1122')).toEqual({ ok: true, message: undefined });
    expect(await propClient.estVerifie(ctx)).toBe(true);

    const { devis, avenant } = await devisClient.devisPourSuivi(ctx);
    expect(avenant).toBeNull();
    expect(devis).toMatchObject({
      id: v2,
      version: 2,
      etat: 'a_accepter',
      statut: 'En attente de votre réponse',
      totalTtc: 50_000,
      mentionTva: 'TVA non applicable',
      tauxAcompte: 50,
      acompte: 25_000,
      delaiRechercheJours: 45,
      garantieJours: 15,
      conditions: 'Conditions générales du devis',
      conditionsParticulieres: 'Entretiens dans nos locaux',
      aPdf: true,
    });
    expect(devis!.lignes).toEqual([{ intitule: 'Serveur', nombre: 10, commission: 5000, montantHt: 50_000 }]);
    // Aucune donnée interne.
    const json = JSON.stringify(devis);
    expect(json).not.toContain('JUSTIFICATION-INTERNE');
    expect(json).not.toContain(refId);
    expect(json).not.toMatch(/empreinte|auteur|Ip|navigateur|mentionsLegales/i);

    const ok = await routeDevis.GET(req, { params: Promise.resolve({ jeton: d1.jeton, devisId: String(v2) }) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Content-Type')).toBe('application/pdf');
    expect(ok.headers.get('Cache-Control')).toBe('no-store');
    expect(ok.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(ok.headers.get('Content-Disposition')).toMatch(/^inline; filename\*=UTF-8''Devis-DEV-2026-00001-v2\.pdf$/);
    expect(new TextDecoder().decode(await ok.arrayBuffer())).toBe('%PDF-1.4 DEV-2026-00001 v2');
    const j = await journal('devis.pdf_telecharge');
    expect(j.at(-1)).toMatchObject({ acteurType: 'client', objetId: String(v2), ip: '41.202.1.2' });
  });

  it('cas limite : une version remplacée (lien ancien) n’est pas acceptable et affiche « remplacé »', async () => {
    const acc = await actions.accepterDevis(d1.jeton, v1, { signataireNom: 'Paul', signataireFonction: 'Gérant', conditionsAcceptees: true });
    expect(acc).toEqual({ ok: false, erreur: devisClient.MESSAGE_REMPLACE });
    expect((await actions.refuserDevis(d1.jeton, v1, 'x')).ok).toBe(false);
    // Une version plus récente non encore envoyée : la dernière version envoyée est présentée comme remplacée.
    const [b] = await getDb().select().from(schema.devis).where(eq(schema.devis.id, v1));
    expect(devisClient.etatClient(b!.statut, b!.expireLe)).toBe('remplace');
    const d3 = await nouveauDossier('+237655443322');
    await devisEnvoye(d3, { numero: 'DEV-2026-00009', version: 1, statut: 'remplace' });
    await devisEnvoye(d3, { numero: 'DEV-2026-00009', version: 2, statut: 'brouillon', pdf: false });
    const vue = await devisClient.devisPourSuivi(await ctxDe(d3.jeton));
    expect(vue.devis).toMatchObject({ version: 1, etat: 'remplace', statut: 'Remplacé' });
    // Un brouillon n'est jamais visible ni téléchargeable.
    expect((await devisClient.documentsPourSuivi(await ctxDe(d3.jeton))).devis.map((x) => x.libelle)).toEqual(['Devis DEV-2026-00009 — version 1']);
  });

  it('sécurité : le devis d’un autre dossier ne peut être ni accepté, ni refusé, ni téléchargé', async () => {
    const acc = await actions.accepterDevis(d1.jeton, autre, { signataireNom: 'Paul', signataireFonction: 'Gérant', conditionsAcceptees: true });
    expect(acc).toEqual({ ok: false, erreur: 'Devis introuvable.' });
    expect(await actions.refuserDevis(d1.jeton, autre, null)).toEqual({ ok: false, erreur: 'Devis introuvable.' });
    const pdf = await routeDevis.GET(req, { params: Promise.resolve({ jeton: d1.jeton, devisId: String(autre) }) });
    expect(pdf.status).toBe(404);
    expect((await getDb().select().from(schema.devis).where(eq(schema.devis.id, autre)))[0]!.statut).toBe('envoye');
  });

  it('RG-13 : case des conditions obligatoire ; acceptation de la v2 → Dossier « Accepté », facture d’acompte FAC, historique complet', async () => {
    const sans = await actions.accepterDevis(d1.jeton, v2, { signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', conditionsAcceptees: false });
    expect(sans).toMatchObject({ ok: false, erreur: expect.stringContaining('J’ai lu et j’accepte les conditions') });
    const sansNom = await actions.accepterDevis(d1.jeton, v2, { signataireNom: ' ', signataireFonction: 'Gérant', conditionsAcceptees: true });
    expect(sansNom).toMatchObject({ ok: false, erreur: expect.stringContaining('nom et la fonction') });
    expect((await getDb().select().from(schema.devis).where(eq(schema.devis.id, v2)))[0]!.statut).toBe('envoye');

    const r = await actions.accepterDevis(d1.jeton, v2, { signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', conditionsAcceptees: true });
    expect(r).toMatchObject({ ok: true, message: expect.stringMatching(/FAC-\d{4}-\d{5}/) });

    const [dv] = await getDb().select().from(schema.devis).where(eq(schema.devis.id, v2));
    expect(dv).toMatchObject({ statut: 'accepte', acceptationMode: 'suivi', signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', acceptationIp: '41.202.1.2', acceptationNavigateur: 'Mozilla/5.0 (Test mobile)' });
    expect((await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, d1.id)))[0]!.statut).toBe('accepte');
    const [fac] = await getDb().select().from(schema.facture).where(and(eq(schema.facture.devisId, v2), eq(schema.facture.type, 'acompte')));
    expect(fac).toMatchObject({ totalTtc: 25_000 });
    expect(fac!.numero).toMatch(/^FAC-\d{4}-\d{5}$/);
    // PDF de la facture archivé après la transaction.
    const [fp] = await getDb().select().from(schema.facturePdf).where(eq(schema.facturePdf.factureId, fac!.id));
    expect(fp).toBeDefined();
    const evts = await getDb().select().from(schema.evenementDossier).where(eq(schema.evenementDossier.dossierId, d1.id));
    const acceptation = evts.find((e) => e.commentaire?.includes('accepté (page de suivi)'));
    expect(acceptation?.apres).toMatchObject({ devisId: v2, version: 2, signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', ip: '41.202.1.2', empreinte: dv!.pdfEmpreinte });
    expect(acceptation?.horodatage).toBeInstanceOf(Date);
    const notifs = await getDb().select().from(schema.notification).where(eq(schema.notification.destinataireId, refId));
    expect(notifs.some((n) => n.type === 'devis_accepte' && n.dossierId === d1.id)).toBe(true);

    // Récapitulatif côté client ; plus de bouton (état « accepté »), facture dans les documents.
    const ctx = await ctxDe(d1.jeton);
    const { devis } = await devisClient.devisPourSuivi(ctx);
    expect(devis).toMatchObject({ etat: 'accepte', statut: 'Accepté', acceptation: { signataireNom: 'Paul Kamga', signataireFonction: 'Gérant' } });
    const docs = await devisClient.documentsPourSuivi(ctx);
    expect(docs.factures).toEqual([expect.objectContaining({ id: fac!.id, numero: fac!.numero, libelle: `Facture d’acompte ${fac!.numero}`, totalTtc: 25_000 })]);
    const res = await routeFacture.GET(req, { params: Promise.resolve({ jeton: d1.jeton, factureId: String(fac!.id) }) });
    expect(res.status).toBe(200);
    expect(new TextDecoder().decode(await res.arrayBuffer())).toBe(`%PDF-1.4 facture ${fac!.id}`);
    expect((await journal('facture.pdf_telecharge')).at(-1)).toMatchObject({ objetId: String(fac!.id), ip: '41.202.1.2' });
    // Double acceptation impossible.
    expect((await actions.accepterDevis(d1.jeton, v2, { signataireNom: 'X', signataireFonction: 'Y', conditionsAcceptees: true })).ok).toBe(false);
  });

  it('RG-14 : refus avec motif → devis refusé, Dossier « Refusé », référent notifié', async () => {
    expect((await verifier(d2.jeton, '9900')).ok).toBe(true);
    const r = await actions.refuserDevis(d2.jeton, autre, '  Budget insuffisant  ');
    expect(r.ok).toBe(true);
    expect((await getDb().select().from(schema.devis).where(eq(schema.devis.id, autre)))[0]).toMatchObject({ statut: 'refuse', refusMotif: 'Budget insuffisant' });
    expect((await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, d2.id)))[0]!.statut).toBe('refuse');
    const notifs = await getDb().select().from(schema.notification).where(eq(schema.notification.destinataireId, refId));
    expect(notifs.some((n) => n.type === 'devis_refuse' && n.dossierId === d2.id)).toBe(true);
    expect((await journal('devis.refuse')).at(-1)).toMatchObject({ acteurType: 'client', ip: '41.202.1.2' });
    const { devis } = await devisClient.devisPourSuivi(await ctxDe(d2.jeton));
    expect(devis).toMatchObject({ etat: 'refuse', statut: 'Refusé' });
    // Le cookie de d2 ne vaut pas pour d1 (portée et jeton signés).
    expect(await propClient.estVerifie(await ctxDe(d1.jeton))).toBe(false);
  });

  it('RG-19 : facture non encore archivée → PDF généré et archivé au premier téléchargement', async () => {
    const f = await getDb().transaction((tx) =>
      effets.emettreFacture(tx, { type: 'acompte', dossierId: d2.id, libelle: 'Test', lignes: [{ libelle: 'x', quantite: 1, prixUnitaire: 1000, montantHt: 1000 }], tauxTva: 0, totalHt: 1000, montantTva: 0, totalTtc: 1000 }, { type: 'systeme' }),
    );
    const res = await routeFacture.GET(req, { params: Promise.resolve({ jeton: d2.jeton, factureId: String(f.id) }) });
    expect(res.status).toBe(200);
    expect(await getDb().select().from(schema.facturePdf).where(eq(schema.facturePdf.factureId, f.id))).toHaveLength(1);
    // Facture d'un autre dossier : introuvable.
    const [facD1] = await getDb().select().from(schema.facture).where(eq(schema.facture.dossierId, d1.id));
    expect((await routeFacture.GET(req, { params: Promise.resolve({ jeton: d2.jeton, factureId: String(facD1!.id) }) })).status).toBe(404);
  });

  it('RG-16, RG-19 : accusé de réception archivé une seule fois (même en simultané), puis resservi ; chaque téléchargement journalisé', async () => {
    const d4 = await nouveauDossier('+237611223344');
    expect((await verifier(d4.jeton, '3344')).ok).toBe(true);
    const avant = h.accuses;
    const params = { params: Promise.resolve({ jeton: d4.jeton }) };
    const [a, b] = await Promise.all([routeAccuse.GET(req, params), routeAccuse.GET(req, { params: Promise.resolve({ jeton: d4.jeton }) })]);
    const c = await routeAccuse.GET(req, { params: Promise.resolve({ jeton: d4.jeton }) });
    for (const r of [a, b, c]) {
      expect(r.status).toBe(200);
      expect(r.headers.get('Cache-Control')).toBe('no-store');
      expect(r.headers.get('Content-Disposition')).toContain('inline;');
      expect(new TextDecoder().decode(await r.arrayBuffer())).toBe(`%PDF-1.4 accuse ${d4.id}`);
    }
    expect(h.accuses - avant).toBe(1);
    const docs = await getDb().select().from(schema.document).where(and(eq(schema.document.dossierId, d4.id), eq(schema.document.categorie, 'accuse_reception')));
    expect(docs).toHaveLength(1);
    const j = (await journal('dossier.accuse_reception_telecharge')).filter((x) => x.objetId === String(d4.id));
    expect(j).toHaveLength(3);
    expect(j.every((x) => x.ip === '41.202.1.2' && x.acteurType === 'client')).toBe(true);
    expect(j.filter((x) => (x.details as { archive: boolean }).archive)).toHaveLength(1);
    expect((await devisClient.documentsPourSuivi(await ctxDe(d4.jeton))).accuseReception).toBe(true);
  });

  it('hors recrutement : ni devis ni documents sur la page de suivi', async () => {
    const net = await nouveauDossier('+237699887766', 'NET');
    const ctx = await ctxDe(net.jeton);
    expect(await devisClient.devisEnvoyeExiste(ctx)).toBe(false);
    expect(await devisClient.devisPourSuivi(ctx)).toEqual({ devis: null, avenant: null });
    expect((await devisClient.documentsPourSuivi(ctx)).accuseReception).toBe(false);
    await expect(devisClient.accuseReceptionClient(ctx, null)).rejects.toThrow('introuvable');
  });
});
