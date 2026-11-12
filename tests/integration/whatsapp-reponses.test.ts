// WhatsApp Cloud API, réponses (specs/COM2-02) sur une vraie base PostgreSQL ; API Meta simulée.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
process.env.WHATSAPP_APP_SECRET = 'secret-application-meta-test';
process.env.WHATSAPP_ACCESS_TOKEN = 'jeton-test';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'PNID';
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Meta simulée : chaque envoi reçoit un wamid ; les corps envoyés sont conservés.
const envois: { url: string; corps: Record<string, unknown> }[] = [];
let echecMeta = false;
let compteur = 0;
vi.stubGlobal(
  'fetch',
  vi.fn(async (url: string, init?: { body?: string }) => {
    if (echecMeta) return new Response(JSON.stringify({ error: { code: 131047, message: 'Re-engagement message' } }), { status: 400 });
    const corps = init?.body ? JSON.parse(init.body) : {};
    envois.push({ url: String(url), corps });
    return new Response(JSON.stringify({ messages: [{ id: `wamid.OUT${++compteur}` }] }), { status: 200 });
  }),
);

describe.skipIf(!baseDisponible)('WhatsApp, réponses (intégration)', async () => {
  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const collab = await import('@/lib/collaborateurs/service');
  const rec = await import('@/lib/whatsapp/reception');
  const envoi = await import('@/lib/whatsapp/envoi');
  const { enregistrerModele } = await import('@/lib/modeles/service');

  const webhook = (field: string, value: object) => ({ object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field, value: { messaging_product: 'whatsapp', ...value } }] }] });
  const ts = (iso: string) => String(Math.floor(new Date(`${iso}+01:00`).getTime() / 1000));
  const t = (iso: string) => new Date(`${iso}+01:00`);
  const texte = (from: string, id: string, body: string, iso: string) => webhook('messages', { contacts: [{ profile: { name: 'Client' }, wa_id: from }], messages: [{ from, id, timestamp: ts(iso), type: 'text', text: { body } }] });
  const echo = (to: string, id: string, body: string, iso: string) => webhook('smb_message_echoes', { message_echoes: [{ from: '237696370479', to, id, timestamp: ts(iso), type: 'text', text: { body } }] });
  async function recevoir(corps: object, maintenant: Date) {
    await rec.enregistrerWebhook(corps);
    await rec.traiterWebhooksEnAttente(50, maintenant);
  }
  const conv = async (numero: string) => (await getDb().select().from(schema.conversation).where(eq(schema.conversation.numero, numero)))[0]!;
  const automatiques = async (conversationId: number) => (await getDb().select().from(schema.messageWhatsapp).where(eq(schema.messageWhatsapp.conversationId, conversationId))).filter((m) => m.automatique);

  let ref: { id: string; roles: ('referent' | 'direction')[]; nom: string };

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    const douala = (await geo.listesLieux()).find((l) => l.nom === 'Douala')!;
    ref = { id: (await collab.creerCollaborateur({ nom: 'Stéphanie', email: 'steph-rep@nexclean.test', roles: ['referent'] }, { id: null })).userId, roles: ['referent'], nom: 'Stéphanie' };
    await collab.definirAttributs(ref.id, { services: ['NET', 'REC', 'EV'], villeIds: [douala.id], telephone: '+237690000099', capacite: null, absentDu: null, absentAu: null }, { id: null });
  });
  beforeEach(() => {
    echecMeta = false;
  });

  it('RG-06 : accusé de réception au premier message, avec le numéro de dossier (heures ouvrées)', async () => {
    envois.length = 0;
    await recevoir(texte('237690100001', 'wamid.R1', 'Nettoyage de bureaux à Akwa', '2026-11-12T10:00:00'), t('2026-11-12T10:00:30'));
    const c = await conv('+237690100001');
    const [d] = await getDb().select({ numero: schema.dossier.numero }).from(schema.dossier).where(eq(schema.dossier.id, c.dossierId!));
    const auto = await automatiques(c.id);
    expect(auto).toHaveLength(1);
    expect(auto[0]!.texte).toContain(`dossier ${d!.numero}`);
    expect(auto[0]!.texte).toContain('du lundi au vendredi de 7 h à 19 h');
    expect(envois[0]!.corps).toMatchObject({ to: '237690100001', type: 'text' });
    // Une réponse automatique ne rend pas la conversation « traitée ».
    expect(c.dernierSortantLe).toBeNull();
  });

  it('RG-06 : la nuit, variante « nous vous répondons dès demain à 07:00 »', async () => {
    await recevoir(texte('237690100002', 'wamid.R2', 'Bonsoir, un ménage à Bonapriso', '2026-11-12T22:30:00'), t('2026-11-12T22:30:10'));
    const auto = await automatiques((await conv('+237690100002')).id);
    expect(auto[0]!.texte).toContain('dès demain à 07:00');
  });

  it('RG-07 : réponse rapide par mot-clé ; rien si aucun mot-clé', async () => {
    const c = await conv('+237690100001');
    await recevoir(texte('237690100001', 'wamid.R3', 'Quels sont vos horaires ?', '2026-11-12T10:10:00'), t('2026-11-12T10:10:10'));
    await recevoir(texte('237690100001', 'wamid.R4', 'Merci beaucoup', '2026-11-12T10:12:00'), t('2026-11-12T10:12:10'));
    const auto = await automatiques(c.id);
    expect(auto.map((m) => m.texte)).toEqual([expect.stringContaining('merci pour votre message'), 'Nos horaires : du lundi au vendredi de 7 h à 19 h, le samedi de 8 h à 17 h.']);
  });

  it('RG-08 (critère) : réponse de Stéphanie depuis son téléphone à 10 h 20, le client réécrit à 10 h 25 → aucune réponse automatique', async () => {
    const c = await conv('+237690100001');
    await recevoir(echo('237690100001', 'wamid.E1', 'Bonjour, je vous appelle', '2026-11-12T10:20:00'), t('2026-11-12T10:20:05'));
    const avant = (await automatiques(c.id)).length;
    await recevoir(texte('237690100001', 'wamid.R5', 'Vos horaires svp ?', '2026-11-12T10:25:00'), t('2026-11-12T10:25:05'));
    expect(await automatiques(c.id)).toHaveLength(avant);
  });

  it('RG-08 : « reprendre la main » coupe l’automate, « rendre la main » le rétablit', async () => {
    const c = await conv('+237690100002');
    await envoi.changerAutomate(c.id, 'manuel', ref);
    await recevoir(texte('237690100002', 'wamid.R6', 'horaires ?', '2026-11-13T08:00:00'), t('2026-11-13T08:00:05'));
    expect(await automatiques(c.id)).toHaveLength(1); // seul l'accusé initial
    await envoi.changerAutomate(c.id, 'actif', ref);
    await recevoir(texte('237690100002', 'wamid.R7', 'horaires ?', '2026-11-13T08:05:00'), t('2026-11-13T08:05:05'));
    expect(await automatiques(c.id)).toHaveLength(2);
  });

  it('RG-02 (critère) : 30 h après le dernier message, texte libre bloqué ; dans la fenêtre, envoyé et conversation traitée', async () => {
    const c = await conv('+237690100001');
    await expect(envoi.envoyerTexte(c.id, 'Bonjour', ref, t('2026-11-13T16:30:00'))).rejects.toThrow(/plus de 24 h/);
    await envoi.envoyerTexte(c.id, 'Nous passons demain à 9 h', ref, t('2026-11-12T11:00:00'));
    const apres = await conv('+237690100001');
    expect(apres.dernierSortantLe).toEqual(t('2026-11-12T11:00:00'));
    const [m] = (await getDb().select().from(schema.messageWhatsapp).where(eq(schema.messageWhatsapp.conversationId, c.id))).filter((x) => x.auteurId === ref.id);
    expect(m).toMatchObject({ origine: 'back_office', statut: 'envoye', automatique: false, texte: 'Nous passons demain à 9 h' });
  });

  it('RG-04 : échec Meta → erreur avec repli wa.me, rien d’enregistré', async () => {
    const c = await conv('+237690100001');
    echecMeta = true;
    const err = await envoi.envoyerTexte(c.id, 'Test échec', ref, t('2026-11-12T11:05:00')).catch((e) => e);
    expect(err).toBeInstanceOf(envoi.ErreurEnvoi);
    expect(err.repli).toBe('https://wa.me/237690100001?text=Test%20%C3%A9chec');
    expect((await getDb().select().from(schema.messageWhatsapp).where(eq(schema.messageWhatsapp.texte, 'Test échec')))).toHaveLength(0);
  });

  it('RG-03 : modèle non approuvé refusé ; approuvé → envoyé hors fenêtre avec ses paramètres', async () => {
    const c = await conv('+237690100001');
    const id = await enregistrerModele(null, { nom: 'Relance', texte: 'Bonjour {{client.nom}}, avez-vous pu étudier notre proposition ?', metaNom: 'relance_devis', metaParametres: ['client.nom'] }, { id: ref.id });
    await expect(envoi.envoyerModele(c.id, id, ref, t('2026-11-14T10:00:00'))).rejects.toThrow(/pas approuvé/);
    await getDb().update(schema.modeleMessage).set({ metaStatut: 'APPROVED', metaCategorie: 'utility' }).where(eq(schema.modeleMessage.id, id));
    envois.length = 0;
    await envoi.envoyerModele(c.id, id, ref, t('2026-11-14T10:00:00'));
    expect(envois[0]!.corps).toMatchObject({ type: 'template', template: { name: 'relance_devis', language: { code: 'fr' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Client' }] }] } });
  });

  it('RG-09 (critère) : « STOP » → désinscription journalisée, confirmation, plus aucun modèle marketing', async () => {
    const c = await conv('+237690100001');
    const promo = await enregistrerModele(null, { nom: 'Promo', texte: 'Offre spéciale ménage ce mois-ci !', metaNom: 'promo_menage' }, { id: ref.id });
    await getDb().update(schema.modeleMessage).set({ metaStatut: 'APPROVED', metaCategorie: 'marketing' }).where(eq(schema.modeleMessage.id, promo));
    await envoi.enregistrerAccord(c.numero, 'Oui, envoyez-moi vos offres par WhatsApp', 'whatsapp', ref, t('2026-11-12T12:00:00'));
    await envoi.envoyerModele(c.id, promo, ref, t('2026-11-12T12:05:00'));
    // Plafond : 1 par semaine.
    await expect(envoi.envoyerModele(c.id, promo, ref, t('2026-11-13T12:05:00'))).rejects.toThrow(/Plafond/);

    await recevoir(texte('237690100001', 'wamid.STOP', 'STOP', '2026-11-20T09:00:00'), t('2026-11-20T09:00:05'));
    const consentement = await envoi.etatConsentement(c.numero);
    expect(consentement!.retireLe).toEqual(t('2026-11-20T09:00:05'));
    expect((await automatiques(c.id)).at(-1)!.texte).toMatch(/plus de messages promotionnels/);
    const audit = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'whatsapp.stop'));
    expect(audit).toHaveLength(1);
    await expect(envoi.envoyerModele(c.id, promo, ref, t('2026-11-28T12:00:00'))).rejects.toThrow(/STOP/);
  });

  it('sans configuration d’envoi : repli wa.me', async () => {
    const c = await conv('+237690100002');
    const jeton = process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const { env } = await import('@/lib/env');
    const e = env() as { WHATSAPP_ACCESS_TOKEN?: string };
    const sauve = e.WHATSAPP_ACCESS_TOKEN;
    e.WHATSAPP_ACCESS_TOKEN = undefined;
    try {
      const err = await envoi.envoyerTexte(c.id, 'Bonjour', ref, t('2026-11-13T08:10:00')).catch((x) => x);
      expect(err).toBeInstanceOf(envoi.ErreurEnvoi);
      expect(err.message).toMatch(/pas encore activé/);
    } finally {
      e.WHATSAPP_ACCESS_TOKEN = sauve;
      process.env.WHATSAPP_ACCESS_TOKEN = jeton;
    }
  });

  it('RG-05 : envoi au client — fenêtre ouverte → texte ; fermée → modèle approuvé du même nom, sinon manuel', async () => {
    const c = await conv('+237690100001');
    const base = { numero: c.numero, dossierId: c.dossierId!, texte: 'Votre devis est prêt : https://nexclean.xyz/suivi/x', nomModeleInterne: 'Envoi du devis', ctx: { 'client.nom': 'Client', 'devis.montant': '50 000 FCFA' } };
    envois.length = 0;
    expect(await envoi.envoyerAuClient(base, ref, t('2026-11-20T10:00:00'))).toEqual({ statut: 'envoye' }); // STOP de 9 h ouvre la fenêtre
    expect(envois[0]!.corps).toMatchObject({ type: 'text' });
    expect(await envoi.envoyerAuClient(base, ref, t('2026-11-25T10:00:00'))).toMatchObject({ statut: 'manuel' });
    // Le modèle « Envoi du devis » existe (migration 0012) : on le relie à son modèle Meta approuvé.
    await getDb().update(schema.modeleMessage).set({ metaNom: 'envoi_devis', metaParametres: ['client.nom', 'devis.montant'], metaStatut: 'APPROVED', metaCategorie: 'utility' }).where(eq(schema.modeleMessage.nom, 'Envoi du devis'));
    expect(await envoi.envoyerAuClient(base, ref, t('2026-11-25T10:00:00'))).toEqual({ statut: 'envoye' });
    expect(envois.at(-1)!.corps).toMatchObject({ type: 'template', template: { name: 'envoi_devis', components: [{ parameters: [{ text: 'Client' }, { text: '50 000 FCFA' }] }] } });
    echecMeta = true;
    expect(await envoi.envoyerAuClient(base, ref, t('2026-11-25T11:00:00'))).toMatchObject({ statut: 'echec' });
  });

  it('RG-01 : documents partagés par lien vers l’espace de suivi, jamais le fichier', async () => {
    const c = await conv('+237690100001');
    await getDb().insert(schema.document).values([
      { dossierId: c.dossierId!, cle: 'x/devis.pdf', nomOrigine: 'DEV-2026-00001.pdf', mime: 'application/pdf', taille: 10, categorie: 'devis' },
      { dossierId: c.dossierId!, cle: 'x/piece.pdf', nomOrigine: 'piece-identite.pdf', mime: 'application/pdf', taille: 10, categorie: 'piece_client' },
    ]);
    const docs = await envoi.documentsPartageables(c.dossierId!);
    expect(docs.map((d) => d.libelle)).toEqual(['Devis — DEV-2026-00001.pdf']);
    expect(docs[0]!.texte).toMatch(/\/suivi\/[\w-]+ \(code demandé : les 4 derniers chiffres/);
  });
});
