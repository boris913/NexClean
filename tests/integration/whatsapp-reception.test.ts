// WhatsApp Cloud API, réception (specs/COM2-01) sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
process.env.WHATSAPP_APP_SECRET = 'secret-application-meta-test';
process.env.WHATSAPP_VERIFY_TOKEN = 'jeton-de-verification-test';
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('WhatsApp, réception (intégration)', async () => {
  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const collab = await import('@/lib/collaborateurs/service');
  const { signer } = await import('@/lib/whatsapp/signature');
  const rec = await import('@/lib/whatsapp/reception');
  const route = await import('@/app/api/whatsapp/webhook/route');

  const SECRET = process.env.WHATSAPP_APP_SECRET!;
  const webhook = (field: string, value: object) => ({ object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field, value: { messaging_product: 'whatsapp', metadata: { phone_number_id: 'PNID' }, ...value } }] }] });
  const texte = (from: string, id: string, body: string, ts = '1762851600', nom = 'Mme Ngo') => webhook('messages', { contacts: [{ profile: { name: nom }, wa_id: from }], messages: [{ from, id, timestamp: ts, type: 'text', text: { body } }] });
  const echo = (to: string, id: string, body: string, ts: string) => webhook('smb_message_echoes', { message_echoes: [{ from: '237696370479', to, id, timestamp: ts, type: 'text', text: { body } }] });

  async function recevoir(corps: object) {
    await rec.enregistrerWebhook(corps);
    return rec.traiterWebhooksEnAttente();
  }
  const conv = async (numero: string) => (await getDb().select().from(schema.conversation).where(eq(schema.conversation.numero, numero)))[0];
  const messages = async (conversationId: number) => getDb().select().from(schema.messageWhatsapp).where(eq(schema.messageWhatsapp.conversationId, conversationId));

  let referentId: string;

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    const douala = (await geo.listesLieux()).find((l) => l.nom === 'Douala')!;
    // Référent qui traite le recrutement à Douala : l'attribution automatique doit le choisir.
    referentId = (await collab.creerCollaborateur({ nom: 'Stéphanie', email: 'stephanie@nexclean.test', roles: ['referent'] }, { id: null })).userId;
    await collab.definirAttributs(referentId, { services: ['REC', 'NET'], villeIds: [douala.id], telephone: '+237690000099', capacite: null, absentDu: null, absentAu: null }, { id: null });
  });

  it('RG-01 : signature invalide → 401, rien n’est stocké ; signature valide → 200', async () => {
    const corps = JSON.stringify(texte('237690000001', 'wamid.SIG', 'Bonjour'));
    const mauvais = await route.POST(new Request('http://x/api/whatsapp/webhook', { method: 'POST', body: corps, headers: { 'x-hub-signature-256': signer(corps, 'mauvais-secret-xxxxxxxx') } }));
    expect(mauvais.status).toBe(401);
    expect(await getDb().select().from(schema.webhookWhatsapp)).toHaveLength(0);
    const audit = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'whatsapp.signature_invalide'));
    expect(audit).toHaveLength(1);
  });

  it('défi de vérification Meta (GET)', async () => {
    const ok = await route.GET(new Request('http://x/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=jeton-de-verification-test&hub.challenge=42'));
    expect([ok.status, await ok.text()]).toEqual([200, '42']);
    expect((await route.GET(new Request('http://x/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=42'))).status).toBe(403);
  });

  it('RG-06 (critère) : numéro inconnu « [FB] … ménagère à Bonamoussadi » → Client, Demande facebook, Dossier attribué', async () => {
    await recevoir(texte('237690112233', 'wamid.A1', 'Bonjour [FB] je cherche une ménagère à Bonamoussadi'));
    const c = (await conv('+237690112233'))!;
    expect(c).toMatchObject({ nomProfil: 'Mme Ngo' });
    expect(c.clientId).not.toBeNull();
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, c.dossierId!));
    expect(d).toMatchObject({ type: 'REC', referentId, statut: 'attribuee' });
    const postes = await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, d!.id));
    expect(postes.map((p) => [p.intitule, p.nombre])).toEqual([['Ménagère', 1]]);
    const [dem] = await getDb().select().from(schema.demande).where(eq(schema.demande.dossierId, d!.id));
    expect(dem).toMatchObject({ canal: 'whatsapp', source: 'facebook' });
    const [cli] = await getDb().select().from(schema.client).where(eq(schema.client.id, c.clientId!));
    expect(cli).toMatchObject({ nom: 'Mme Ngo', whatsapp: '+237690112233' });
  });

  it('RG-02 : un même message renvoyé par Meta n’est enregistré qu’une fois', async () => {
    await recevoir(texte('237690112233', 'wamid.A1', 'Bonjour [FB] je cherche une ménagère à Bonamoussadi'));
    const c = (await conv('+237690112233'))!;
    expect(await messages(c.id)).toHaveLength(1);
    expect(await getDb().select().from(schema.dossier)).toHaveLength(1);
  });

  it('RG-06 : messages suivants → même conversation, historique du Dossier, pas de nouvelle Demande', async () => {
    await recevoir(texte('237690112233', 'wamid.A2', 'Elle doit savoir cuisiner', '1762851700'));
    const c = (await conv('+237690112233'))!;
    expect(await messages(c.id)).toHaveLength(2);
    expect(await getDb().select().from(schema.demande)).toHaveLength(1);
    const evs = await getDb().select().from(schema.evenementDossier).where(eq(schema.evenementDossier.dossierId, c.dossierId!));
    expect(evs.map((e) => e.commentaire)).toContain('WhatsApp reçu : Elle doit savoir cuisiner');
  });

  it('RG-04 (critère) : réponse depuis le téléphone → fil du Back-Office, conversation traitée', async () => {
    const { and, sql } = await import('drizzle-orm');
    const nonTraitee = async () => (await getDb().select({ id: schema.conversation.id }).from(schema.conversation).where(and(eq(schema.conversation.numero, '+237690112233'), sql`${rec.conditionNonTraitee}`))).length === 1;
    expect(await nonTraitee()).toBe(true);
    await recevoir(echo('237690112233', 'wamid.E1', 'Bonjour Madame, nous vous appelons', '1762851800'));
    const c = (await conv('+237690112233'))!;
    expect((await messages(c.id)).find((m) => m.waId === 'wamid.E1')).toMatchObject({ sens: 'sortant', origine: 'application' });
    expect(await nonTraitee()).toBe(false);
  });

  it('RG-04 : statuts dans le désordre → on garde le plus avancé', async () => {
    const statut = (status: string, ts: string) => webhook('messages', { statuses: [{ id: 'wamid.E1', status, timestamp: ts }] });
    await recevoir(statut('read', '1762851900'));
    await recevoir(statut('delivered', '1762851850'));
    const [m] = await getDb().select().from(schema.messageWhatsapp).where(eq(schema.messageWhatsapp.waId, 'wamid.E1'));
    expect(m!.statut).toBe('lu');
  });

  it('candidat connu : conversation « candidat », aucun Dossier client', async () => {
    await getDb().insert(schema.candidat).values({ telephone: '+237677000111', nom: 'Essomba', prenom: 'Luc' } as never);
    await recevoir(texte('237677000111', 'wamid.C1', 'Bonjour, ma candidature ?', '1762852000', 'Luc'));
    const c = (await conv('+237677000111'))!;
    expect(c.candidatId).not.toBeNull();
    expect(c.dossierId).toBeNull();
    expect(await getDb().select().from(schema.demande)).toHaveLength(1);
  });

  it('RG-09 : sans réponse depuis 2 h ouvrées → référent, 4 h → Direction, une fois', async () => {
    await recevoir(texte('237690445566', 'wamid.N1', 'Nettoyage de bureaux à Akwa', String(Math.floor(new Date('2026-11-12T09:00:00+01:00').getTime() / 1000)), 'ACME'));
    const c = (await conv('+237690445566'))!;
    const jeudi = (h: string) => new Date(`2026-11-12T${h}:00+01:00`);
    await rec.alerterConversationsNonTraitees(jeudi('10:30'));
    const cles = async () => (await getDb().select({ cle: schema.notification.cle }).from(schema.notification)).map((x) => x.cle).filter((k) => k?.startsWith(`wa:${c.id}:`));
    expect(await cles()).toEqual([]);
    await rec.alerterConversationsNonTraitees(jeudi('11:05'));
    await rec.alerterConversationsNonTraitees(jeudi('11:20'));
    expect((await cles()).filter((k) => k!.endsWith(':2h'))).toHaveLength(1);
  });

  it('RG-10 : accès à la messagerie — référent du dossier, Direction ; ni un autre référent, ni les Finances', async () => {
    const lec = await import('@/lib/whatsapp/lecture');
    const autre = (await collab.creerCollaborateur({ nom: 'Autre', email: 'autre-wa@nexclean.test', roles: ['referent'] }, { id: null })).userId;
    const fin = (await collab.creerCollaborateur({ nom: 'Fin', email: 'fin-wa@nexclean.test', roles: ['finances'] }, { id: null })).userId;
    const c = (await conv('+237690112233'))!;
    expect(await lec.lireConversation(c.id, { id: referentId, roles: ['referent'] })).not.toBeNull();
    expect(await lec.lireConversation(c.id, { id: 'x', roles: ['direction'] })).not.toBeNull();
    expect(await lec.lireConversation(c.id, { id: autre, roles: ['referent'] })).toBeNull();
    expect(await lec.lireConversation(c.id, { id: fin, roles: ['finances'] })).toBeNull();
    expect(lec.peutOuvrirMessagerie({ id: fin, roles: ['finances'] })).toBe(false);
    // La Direction voit aussi la conversation du candidat ; le référent, non.
    const dir = (await lec.listerConversations({ id: 'x', roles: ['direction'] })).map((x) => x.numero);
    expect(dir).toEqual(expect.arrayContaining(['+237690112233', '+237677000111']));
    expect((await lec.listerConversations({ id: referentId, roles: ['referent'] })).map((x) => x.numero)).not.toContain('+237677000111');
  });
});
