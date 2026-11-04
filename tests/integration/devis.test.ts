// MVP2-04 lot A : cycle du devis et des avenants côté Back-Office, « Valider et envoyer »,
// transitions du Dossier — vraie base PostgreSQL. Le rendu PDF (lot B) est simulé.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

const rendu = vi.hoisted(() => ({
  genererPdfDevis: vi.fn(async (id: number) => new TextEncoder().encode(`%PDF-1.4 devis ${id}`)),
  genererPdfFacture: vi.fn(async (id: number) => new TextEncoder().encode(`%PDF-1.4 facture ${id}`)),
  genererAccuseReception: vi.fn(async (id: number) => new TextEncoder().encode(`%PDF-1.4 accuse ${id}`)),
}));
vi.mock('@/lib/documents/rendu', () => rendu);

configurerEnvironnementTest();
// RG-10 : l'e-mail avec pièce jointe part vers Resend (fetch simulé : aucun appel réseau).
process.env.RESEND_API_KEY = 're_test_cle';
const reponseOk = async () => new Response('{"id":"x"}', { status: 200 });
const fetchSimule = vi.fn(reponseOk);
vi.stubGlobal('fetch', fetchSimule);
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Devis — Back-Office (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-devis-'));

  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const dossiers = await import('@/lib/dossiers/service');
  const svc = await import('@/lib/devis/service');
  const effets = await import('@/lib/devis/effets');
  const { lignesFacturables } = await import('@/lib/devis/lignes');
  const { mentionTva, MESSAGE_A_COMPLETER } = await import('@/lib/devis/domaine');
  const { MESSAGE_CIRCUIT_DEVIS } = await import('@/lib/dossiers/statuts');
  const collab = await import('@/lib/collaborateurs/service');
  const params = await import('@/lib/parametres');

  type Acteur = { id: string; roles: ('referent' | 'direction')[]; nom: string };
  let rita: Acteur;
  let bob: Acteur;
  let diane: Acteur;
  let telephone = 690100000;

  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)]);

  async function nouveauDossier(o: { lignes?: { intitule: string; nombre: number }[]; email?: string | null; ville?: string | null; referent?: Acteur; type?: 'REC' | 'NET' } = {}) {
    const r = await dossiers.creerDemande({
      type: o.type ?? 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: 'Hôtel du Lac', contact: 'M. Kamga', whatsapp: `+237${telephone++}`, email: o.email ?? null },
      villeId: null,
      villeAutre: o.ville === undefined ? 'Kribi' : o.ville,
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: null,
      description: null,
      lignes: o.type === 'NET' ? [] : (o.lignes ?? [{ intitule: 'Serveur', nombre: 10 }]),
      donnees: { test: telephone },
    });
    const ref = o.referent ?? rita;
    await getDb().update(schema.dossier).set({ referentId: ref.id, statut: 'attribuee' }).where(eq(schema.dossier.id, r.dossierId));
    await dossiers.changerStatut(r.dossierId, 'en_qualification', null, ref);
    return r.dossierId;
  }

  const dossier = async (id: number) => (await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, id)))[0]!;
  const devis = async (id: number) => (await getDb().select().from(schema.devis).where(eq(schema.devis.id, id)))[0]!;
  const notifications = async (destinataireId: string, type: string) => getDb().select().from(schema.notification).where(and(eq(schema.notification.destinataireId, destinataireId), eq(schema.notification.type, type)));

  /** Dossier REC avec un devis envoyé (10 serveurs). */
  async function devisEnvoye(o: { email?: string | null } = {}) {
    const dossierId = await nouveauDossier({ email: o.email });
    const { devisId } = await svc.creerDevis(dossierId, rita);
    await svc.validerDevis(devisId, rita);
    await svc.validerEtEnvoyer(devisId, rita);
    return { dossierId, devisId };
  }

  beforeAll(async () => {
    await reinitialiserBase();
    const mk = async (nom: string, email: string, roles: Acteur['roles']): Promise<Acteur> => ({ id: (await collab.creerCollaborateur({ nom, email, roles }, { id: null })).userId, roles, nom });
    rita = await mk('Rita Recrutement', 'rita@nexclean.test', ['referent']);
    bob = await mk('Bob Recrutement', 'bob@nexclean.test', ['referent']);
    diane = await mk('Diane Direction', 'diane@nexclean.test', ['direction']);
  }, 120_000);

  afterEach(() => vi.restoreAllMocks());

  it('RG-04 : 10 personnes, TVA 0 %, acompte 50 % → 50 000 FCFA, « TVA non applicable », acompte 25 000, valeurs figées', async () => {
    const dossierId = await nouveauDossier();
    const { devisId, numero } = await svc.creerDevis(dossierId, rita);
    expect(numero).toMatch(/^DEV-\d{4}-\d{5}$/);
    const d = await devis(devisId);
    expect(d).toMatchObject({ type: 'devis', version: 1, statut: 'brouillon', totalHt: 50_000, tauxTva: 0, montantTva: 0, totalTtc: 50_000, tauxAcompte: 50, acompte: 25_000, delaiRechercheJours: 30, garantieJours: 15, validiteJours: 15, auteurId: rita.id });
    expect(d.lignes).toMatchObject([{ intitule: 'Serveur', nombre: 10, commission: 5000, montantHt: 50_000 }]);
    expect(d.lignes[0]!.lignePosteId).toEqual(expect.any(Number));
    expect(d.conditions).toBe(params.CONDITIONS_DEVIS_PAR_DEFAUT);
    expect(d.mentionsLegales).toBe(params.MENTIONS_LEGALES_PAR_DEFAUT);
    expect(mentionTva(d.tauxTva)).toBe('TVA non applicable');
    // Un seul devis non terminal à la fois.
    await expect(svc.creerDevis(dossierId, rita)).rejects.toThrow(/en cours/);
  });

  it('droits : un autre référent est refusé ; la Direction peut agir ; RG-03 : pas de devis intégré hors REC', async () => {
    const dossierId = await nouveauDossier();
    await expect(svc.creerDevis(dossierId, bob)).rejects.toThrow('Accès refusé à ce dossier.');
    const { devisId } = await svc.creerDevis(dossierId, diane);
    await expect(svc.modifierDevis(devisId, { nombres: [8] }, bob)).rejects.toThrow('Accès refusé');
    await expect(svc.validerDevis(devisId, bob)).rejects.toThrow('Accès refusé');
    await expect(svc.lireDevisDossier(dossierId, bob)).rejects.toThrow('Accès refusé');
    expect((await svc.lireDevisDossier(dossierId, rita))?.courant?.id).toBe(devisId);
    const net = await nouveauDossier({ type: 'NET' });
    await expect(svc.creerDevis(net, rita)).rejects.toThrow(svc.MESSAGE_TYPE_NON_REC);
    expect(await svc.lireDevisDossier(net, rita)).toBeNull();
  });

  it('RG-05 : Dossier « À compléter » → création refusée avec la liste des données manquantes', async () => {
    const dossierId = await nouveauDossier({ ville: null });
    // En qualification, il manque la ville : message listant les manques et proposant « À compléter ».
    const e = await svc.creerDevis(dossierId, rita).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(svc.ErreurDonneesManquantes);
    expect((e as InstanceType<typeof svc.ErreurDonneesManquantes>).manques).toEqual(['ville']);
    expect((e as Error).message).toMatch(/il manque : ville.*« À compléter »/);
    await dossiers.changerStatut(dossierId, 'a_completer', 'Ville et quartier à confirmer', rita);
    const e2 = (await svc.creerDevis(dossierId, rita).catch((x: unknown) => x)) as Error;
    expect(e2.message).toContain(MESSAGE_A_COMPLETER);
    expect(e2.message).toContain('Il manque : ville');
    expect(e2.message).toContain('Ville et quartier à confirmer');
    expect(await getDb().select().from(schema.devis).where(eq(schema.devis.dossierId, dossierId))).toHaveLength(0);
  });

  it('RG-06 : quantités, taux justifié ; 20 % (borne 30 %) → « en attente de validation direction », Direction notifiée puis validation', async () => {
    const dossierId = await nouveauDossier();
    const { devisId } = await svc.creerDevis(dossierId, rita);
    await expect(svc.modifierDevis(devisId, { nombres: [10], tauxAcompte: 40 }, rita)).rejects.toThrow(/Justifiez le taux/);
    await svc.modifierDevis(devisId, { nombres: [8], tauxAcompte: 40, justificationTaux: 'Client fidèle', delaiRechercheJours: 45, conditionsParticulieres: 'Prise de poste au 1er décembre' }, rita);
    expect(await devis(devisId)).toMatchObject({ totalTtc: 40_000, tauxAcompte: 40, acompte: 16_000, justificationTaux: 'Client fidèle', delaiRechercheJours: 45, conditionsParticulieres: 'Prise de poste au 1er décembre' });
    // Recalcul avec les commissions figées : la grille passe à 7 000, le brouillon reste à 5 000.
    await params.definirParametre('commission_par_personne', 7000, { id: diane.id });
    await svc.modifierDevis(devisId, { nombres: [10] }, rita);
    expect(await devis(devisId)).toMatchObject({ totalTtc: 50_000, acompte: 20_000 });
    await params.definirParametre('commission_par_personne', 5000, { id: diane.id });

    await svc.modifierDevis(devisId, { nombres: [10], tauxAcompte: 20, justificationTaux: 'Association partenaire' }, rita);
    expect(await svc.validerDevis(devisId, rita)).toEqual({ statut: 'attente_direction' });
    expect(await devis(devisId)).toMatchObject({ statut: 'attente_direction', acompte: 10_000 });
    expect((await dossier(dossierId)).statut).toBe('en_qualification');
    const notifs = await notifications(diane.id, 'devis_attente_direction');
    expect(notifs).toHaveLength(1);
    expect(notifs[0]).toMatchObject({ dossierId, lien: `/admin/dossiers/${dossierId}?onglet=devis`, email: true });
    expect(notifs[0]!.texte).toMatch(/20 %.*Association partenaire/);
    await expect(svc.validerDevis(devisId, rita)).rejects.toThrow(/attend la validation de la Direction/);
    await expect(svc.validerParDirection(devisId, rita)).rejects.toThrow(/Seule la Direction/);
    await svc.validerParDirection(devisId, diane);
    expect(await devis(devisId)).toMatchObject({ statut: 'valide', valideDirectionParId: diane.id });
    expect((await dossier(dossierId)).statut).toBe('devis_pret');
    expect(await notifications(rita.id, 'devis_valide_direction')).toHaveLength(1);
  });

  it('RG-07 : devis validé non modifiable ; nouvelle version v2 (même numéro), l’ancienne passe « remplacé »', async () => {
    const dossierId = await nouveauDossier();
    const { devisId, numero } = await svc.creerDevis(dossierId, rita);
    expect(await svc.validerDevis(devisId, rita)).toEqual({ statut: 'valide' });
    expect((await dossier(dossierId)).statut).toBe('devis_pret');
    await expect(svc.modifierDevis(devisId, { nombres: [5] }, rita)).rejects.toThrow(/plus modifiable/);
    const v2 = await svc.nouvelleVersion(devisId, rita);
    expect(v2.version).toBe(2);
    expect(await devis(v2.devisId)).toMatchObject({ numero, version: 2, statut: 'brouillon', totalTtc: 50_000 });
    expect((await devis(devisId)).statut).toBe('remplace');
    // Le Dossier revient « En qualification » tant que la v2 n'est pas validée.
    expect((await dossier(dossierId)).statut).toBe('en_qualification');
    await expect(svc.nouvelleVersion(devisId, rita)).rejects.toThrow();
    await svc.modifierDevis(v2.devisId, { nombres: [6] }, rita);
    await svc.validerDevis(v2.devisId, rita);
    expect(await devis(v2.devisId)).toMatchObject({ statut: 'valide', totalTtc: 30_000 });
  });

  it('brouillon : un poste ajouté au dossier après la création est repris (commission figée conservée pour les postes existants)', async () => {
    const dossierId = await nouveauDossier();
    const { devisId } = await svc.creerDevis(dossierId, rita);
    await params.definirParametre('commission_par_personne', 6000, { id: diane.id });
    try {
      await dossiers.remplacerLignes(dossierId, [{ intitule: 'Serveur', nombre: 10 }, { intitule: 'Plongeur', nombre: 1 }], rita);
      await svc.reprendrePostes(devisId, rita);
      const d = await devis(devisId);
      expect(d.lignes.map((l) => [l.intitule, l.nombre, l.commission])).toEqual([['Serveur', 10, 5000], ['Plongeur', 1, 6000]]);
      expect(d.totalTtc).toBe(56_000);
      await svc.validerDevis(devisId, rita);
      await expect(svc.reprendrePostes(devisId, rita)).rejects.toThrow(/brouillon/);
    } finally {
      await params.definirParametre('commission_par_personne', 5000, { id: diane.id });
    }
  });

  it('RG-02 : un devis validé à 5 000 reste à 5 000 après passage de la commission à 6 000 ; un nouveau devis utilise 6 000', async () => {
    const dossierId = await nouveauDossier();
    const { devisId } = await svc.creerDevis(dossierId, rita);
    await svc.validerDevis(devisId, rita);
    await params.definirParametre('commission_par_personne', 6000, { id: diane.id });
    try {
      await svc.validerEtEnvoyer(devisId, rita);
      expect(await devis(devisId)).toMatchObject({ statut: 'envoye', totalTtc: 50_000, acompte: 25_000 });
      expect((await devis(devisId)).lignes[0]!.commission).toBe(5000);
      // Le PDF est produit à partir du devis figé.
      expect(rendu.genererPdfDevis).toHaveBeenLastCalledWith(devisId);
      // Nouveau devis (autre dossier) et nouvelle version : nouvelles valeurs.
      const autre = await nouveauDossier();
      const n = await svc.creerDevis(autre, rita);
      expect(await devis(n.devisId)).toMatchObject({ totalTtc: 60_000, acompte: 30_000 });
      const v2 = await svc.nouvelleVersion(devisId, rita);
      expect(await devis(v2.devisId)).toMatchObject({ totalTtc: 60_000 });
      expect((await devis(devisId)).statut).toBe('remplace');
    } finally {
      await params.definirParametre('commission_par_personne', 5000, { id: diane.id });
    }
  });

  it('RG-10 : « Valider et envoyer » archive le PDF (empreinte), passe le devis « envoyé », le Dossier « Devis envoyé », e-mail avec pièce jointe et message WhatsApp', async () => {
    const dossierId = await nouveauDossier({ email: 'contact@hotel-du-lac.cm' });
    const appels = fetchSimule;
    appels.mockClear();
    const { devisId, numero } = await svc.creerDevis(dossierId, rita);
    await expect(svc.validerEtEnvoyer(devisId, rita)).rejects.toThrow(/doit être validé/);
    await svc.validerDevis(devisId, rita);
    await expect(svc.validerEtEnvoyer(devisId, bob)).rejects.toThrow('Accès refusé');
    const avant = Date.now();
    const r = await svc.validerEtEnvoyer(devisId, rita);

    const octets = new TextEncoder().encode(`%PDF-1.4 devis ${devisId}`);
    const empreinte = createHash('sha256').update(octets).digest('hex');
    const d = await devis(devisId);
    expect(d).toMatchObject({ statut: 'envoye', documentId: r.documentId, pdfEmpreinte: empreinte });
    expect(d.envoyeLe!.getTime()).toBeGreaterThanOrEqual(avant - 1000);
    expect(d.expireLe!.getTime() - d.envoyeLe!.getTime()).toBe(15 * 86_400_000);
    const [doc] = await getDb().select().from(schema.document).where(eq(schema.document.id, r.documentId));
    expect(doc).toMatchObject({ dossierId, categorie: 'devis', mime: 'application/pdf', nomOrigine: `Devis-${numero}-v1.pdf` });
    expect(await fs.readFile(path.join(process.env.STORAGE_DIR!, doc!.cle))).toEqual(Buffer.from(octets));
    expect((await dossier(dossierId)).statut).toBe('devis_envoye');

    // E-mail Resend avec le PDF en pièce jointe (base64).
    expect(r.email).toBe('envoye');
    expect(appels).toHaveBeenCalledTimes(1);
    const [url, init] = appels.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const corps = JSON.parse(String(init.body));
    expect(corps.to).toEqual(['contact@hotel-du-lac.cm']);
    expect(corps.subject).toContain(numero);
    expect(corps.attachments).toEqual([{ filename: `Devis-${numero}-v1.pdf`, content: Buffer.from(octets).toString('base64') }]);
    expect(corps.text).toMatch(/\/suivi\//);

    // Message WhatsApp « Envoi du devis » avec le lien de la page de suivi.
    const { jetonSuivi } = await dossier(dossierId);
    expect(r.texte).toContain(`http://localhost:3000/suivi/${jetonSuivi}`);
    expect(r.texte).toContain(numero);
    expect(r.texte).toContain('50 000 FCFA');
    expect(r.texte).toContain('25 000 FCFA');
    expect(r.numero).toMatch(/^\+237/);
    await svc.noterEnvoiWhatsApp(devisId, r.texte, rita);
    const evts = await getDb().select().from(schema.evenementDossier).where(eq(schema.evenementDossier.dossierId, dossierId));
    expect(evts.some((x) => x.type === 'whatsapp' && x.commentaire?.includes('Envoi du devis'))).toBe(true);
    expect(evts.some((x) => x.type === 'transition' && x.versStatut === 'devis_envoye')).toBe(true);
    expect(evts.some((x) => x.commentaire?.startsWith('E-mail envoyé à contact@hotel-du-lac.cm'))).toBe(true);
    await expect(svc.validerEtEnvoyer(devisId, rita)).rejects.toThrow('déjà été envoyé');
  });

  it('RG-10 : client sans e-mail → aucun e-mail ; échec de Resend → le devis reste envoyé', async () => {
    const appels = fetchSimule;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    appels.mockClear();
    const sans = await devisEnvoye();
    expect(appels).not.toHaveBeenCalled();
    expect((await devis(sans.devisId)).statut).toBe('envoye');

    const dossierId = await nouveauDossier({ email: 'echec@client.cm' });
    const { devisId } = await svc.creerDevis(dossierId, rita);
    await svc.validerDevis(devisId, rita);
    appels.mockImplementation(async () => new Response('erreur', { status: 500 }));
    const r = await svc.validerEtEnvoyer(devisId, rita).finally(() => appels.mockImplementation(reponseOk));
    expect(r.email).toBe('echec');
    expect(appels).toHaveBeenCalledTimes(3);
    expect((await devis(devisId)).statut).toBe('envoye');
    expect((await dossier(dossierId)).statut).toBe('devis_envoye');
  });

  it('RG-08 : transitions liées au devis ; refus → « Refusé », le référent rouvre en « En qualification » pour une v2', async () => {
    const { dossierId, devisId } = await devisEnvoye();
    await expect(dossiers.changerStatut(dossierId, 'accepte', null, rita)).rejects.toThrow(MESSAGE_CIRCUIT_DEVIS);
    await expect(svc.enregistrerRefus(devisId, 'Trop cher', bob)).rejects.toThrow('Accès refusé');
    await svc.enregistrerRefus(devisId, 'Trop cher', rita);
    expect(await devis(devisId)).toMatchObject({ statut: 'refuse', refusMotif: 'Trop cher' });
    expect((await dossier(dossierId)).statut).toBe('refuse');
    await expect(svc.nouvelleVersion(devisId, rita)).rejects.toThrow(/rouvrez-le/);
    await expect(svc.creerDevis(dossierId, rita)).rejects.toThrow(/rouvrez-le/);
    // Le référent (pas seulement la Direction) rouvre, car le dernier devis est refusé.
    await dossiers.changerStatut(dossierId, 'en_qualification', null, rita);
    expect(await dossier(dossierId)).toMatchObject({ statut: 'en_qualification', fermeLe: null });
    const v2 = await svc.nouvelleVersion(devisId, rita);
    expect((await devis(devisId)).statut).toBe('refuse');
    expect(await devis(v2.devisId)).toMatchObject({ version: 2, statut: 'brouillon' });
    await svc.validerDevis(v2.devisId, rita);
    expect((await dossier(dossierId)).statut).toBe('devis_pret');

    // Dossier refusé à la main (sans devis refusé) : réouverture par la Direction uniquement.
    const autre = await nouveauDossier();
    await dossiers.changerStatut(autre, 'refuse', 'Client a renoncé', rita);
    await expect(dossiers.changerStatut(autre, 'en_qualification', 'retour', rita)).rejects.toThrow(/Direction/);
  });

  it('RG-15 : acceptation WhatsApp — capture obligatoire ; devis accepté, Dossier « Accepté », facture d’acompte émise et archivée', async () => {
    const { dossierId, devisId } = await devisEnvoye();
    const base = { signataireNom: 'Paul Kamga', signataireFonction: 'Gérant' };
    await expect(svc.enregistrerAcceptationWhatsApp(devisId, { ...base, fichier: null }, rita)).rejects.toThrow(/capture/);
    await expect(svc.enregistrerAcceptationWhatsApp(devisId, { ...base, fichier: { nom: 'capture.png', octets: new Uint8Array([1, 2, 3]) } }, rita)).rejects.toThrow(/Format/);
    await expect(svc.enregistrerAcceptationWhatsApp(devisId, { ...base, signataireNom: ' ', fichier: { nom: 'capture.png', octets: PNG } }, rita)).rejects.toThrow(/signataire/);
    await expect(svc.enregistrerAcceptationWhatsApp(devisId, { ...base, fichier: { nom: 'capture.png', octets: PNG } }, bob)).rejects.toThrow('Accès refusé');
    expect((await devis(devisId)).statut).toBe('envoye');

    const r = await svc.enregistrerAcceptationWhatsApp(devisId, { ...base, fichier: { nom: 'capture.png', octets: PNG } }, rita);
    const d = await devis(devisId);
    expect(d).toMatchObject({ statut: 'accepte', acceptationMode: 'whatsapp', signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', acceptationParId: rita.id, acceptationPreuveMime: 'image/png' });
    expect(await fs.readFile(path.join(process.env.STORAGE_DIR!, d.acceptationPreuveCle!))).toEqual(Buffer.from(PNG));
    expect((await dossier(dossierId)).statut).toBe('accepte');
    expect(r.facture?.numero).toMatch(/^FAC-\d{4}-\d{5}$/);
    const [pdf] = await getDb().select().from(schema.facturePdf).where(eq(schema.facturePdf.factureId, r.facture!.id));
    expect(pdf?.documentId).toEqual(expect.any(Number));
    const preuve = await svc.lirePreuveAcceptation(dossierId, devisId, rita);
    expect(preuve?.mime).toBe('image/png');
    await expect(svc.lirePreuveAcceptation(dossierId, devisId, bob)).rejects.toThrow('Accès refusé');
  });

  it('RG-15 : si l’archivage du PDF de la facture échoue, l’acceptation et la facture restent acquises', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    rendu.genererPdfFacture.mockRejectedValueOnce(new Error('rendu indisponible'));
    const { devisId } = await devisEnvoye();
    const r = await svc.enregistrerAcceptationWhatsApp(devisId, { signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', fichier: { nom: 'accord.png', octets: PNG } }, rita);
    expect((await devis(devisId)).statut).toBe('accepte');
    expect(r.facture).not.toBeNull();
    expect(await getDb().select().from(schema.facturePdf).where(eq(schema.facturePdf.factureId, r.facture!.id))).toHaveLength(0);
    const journal = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'facture.pdf_echec'));
    expect(journal.some((j) => j.objetId === String(r.facture!.id))).toBe(true);
  });

  it('RG-09 : avenant sur un devis accepté (personnes + prolongation) → même circuit ; accepté, il entre dans les lignes facturables', async () => {
    const dossierId = await nouveauDossier({ lignes: [{ intitule: 'Serveur', nombre: 10 }, { intitule: 'Cuisinier', nombre: 2 }] });
    const { devisId } = await svc.creerDevis(dossierId, rita);
    await svc.validerDevis(devisId, rita);
    await svc.validerEtEnvoyer(devisId, rita);
    await expect(svc.creerAvenant(devisId, { lignes: [], prolongationJours: 10 }, rita)).rejects.toThrow(/devis accepté/);
    await getDb().transaction((tx) => effets.accepterDevis(tx, devisId, { mode: 'suivi', signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', ip: '10.0.0.1' }, { type: 'client', ip: '10.0.0.1' }));
    const postes = await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId)).orderBy(schema.lignePoste.ordre);
    const [serveur, cuisinier] = postes;
    expect(await lignesFacturables(dossierId)).toEqual([
      { lignePosteId: serveur!.id, intitule: 'Serveur', commission: 5000, nombre: 10 },
      { lignePosteId: cuisinier!.id, intitule: 'Cuisinier', commission: 5000, nombre: 2 },
    ]);
    await expect(svc.creerAvenant(devisId, { lignes: [{ lignePosteId: serveur!.id, nombre: 10 }] }, rita)).rejects.toThrow(/modifier un nombre/);
    await expect(svc.creerAvenant(devisId, { lignes: [{ lignePosteId: serveur!.id, nombre: 12 }] }, bob)).rejects.toThrow('Accès refusé');

    const av = await svc.creerAvenant(devisId, { lignes: [{ lignePosteId: serveur!.id, nombre: 12 }, { lignePosteId: cuisinier!.id, nombre: 2 }], prolongationJours: 15 }, rita);
    const initial = await devis(devisId);
    expect(av.numero).not.toBe(initial.numero);
    expect(await devis(av.devisId)).toMatchObject({ type: 'avenant', devisInitialId: devisId, version: 1, statut: 'brouillon', totalTtc: 10_000, acompte: 0, prolongationJours: 15 });
    expect((await devis(av.devisId)).lignes).toMatchObject([{ lignePosteId: serveur!.id, nombre: 2, commission: 5000, montantHt: 10_000 }]);
    await expect(svc.creerAvenant(devisId, { lignes: [], prolongationJours: 5 }, rita)).rejects.toThrow(/en cours/);
    // Un avenant ne retire pas plus de personnes que le contrat n'en compte.
    await expect(svc.modifierDevis(av.devisId, { nombres: [-11] }, rita)).rejects.toThrow(/retirer plus de 10/);

    expect(await svc.validerDevis(av.devisId, rita)).toEqual({ statut: 'valide' });
    expect((await dossier(dossierId)).statut).toBe('accepte');
    const envoi = await svc.validerEtEnvoyer(av.devisId, rita);
    expect(envoi.texte).toContain('avenant');
    expect((await dossier(dossierId)).statut).toBe('accepte');
    expect(await lignesFacturables(dossierId)).toHaveLength(2);
    expect((await lignesFacturables(dossierId))[0]!.nombre).toBe(10); // avenant non encore accepté
    const acc = await getDb().transaction((tx) => effets.accepterDevis(tx, av.devisId, { mode: 'suivi', signataireNom: 'Paul Kamga', signataireFonction: 'Gérant' }, { type: 'client' }));
    expect(acc.facture).toBeNull();
    expect(await lignesFacturables(dossierId)).toEqual([
      { lignePosteId: serveur!.id, intitule: 'Serveur', commission: 5000, nombre: 12 },
      { lignePosteId: cuisinier!.id, intitule: 'Cuisinier', commission: 5000, nombre: 2 },
    ]);
    expect((await dossier(dossierId)).delaiRechercheJours).toBe(45);
    const vue = await svc.lireDevisDossier(dossierId, rita);
    expect(vue?.avenants.map((x) => x.id)).toEqual([av.devisId]);
    expect(vue?.contrat.find((c) => c.lignePosteId === serveur!.id)?.nombre).toBe(12);
    expect(vue?.peutCreerAvenant).toBe(true);
  });

  it('RG-14 : un devis envoyé non accepté à la date de validité passe « expiré », référent notifié une seule fois', async () => {
    const { dossierId, devisId } = await devisEnvoye();
    const { expireLe } = await devis(devisId);
    expect(await svc.expirerDevis(new Date(expireLe!.getTime() - 60_000))).toBe(0);
    const apres = new Date(expireLe!.getTime() + 60_000);
    expect(await svc.expirerDevis(apres)).toBeGreaterThanOrEqual(1);
    expect((await devis(devisId)).statut).toBe('expire');
    expect(await svc.expirerDevis(apres)).toBe(0);
    const notifs = (await notifications(rita.id, 'devis_expire')).filter((n) => n.dossierId === dossierId);
    expect(notifs).toHaveLength(1);
    await expect(svc.enregistrerAcceptationWhatsApp(devisId, { signataireNom: 'X', signataireFonction: 'Y', fichier: { nom: 'a.png', octets: PNG } }, rita)).rejects.toThrow(/ne peut plus être accepté/);
    // Relance : une nouvelle version repart en brouillon.
    const v2 = await svc.nouvelleVersion(devisId, rita);
    expect((await devis(devisId)).statut).toBe('expire');
    expect((await devis(v2.devisId)).statut).toBe('brouillon');
    expect((await dossier(dossierId)).statut).toBe('en_qualification');
  });
});
