// Agent conversationnel (specs/COM3-02) sur une vraie base PostgreSQL ; modèle et API Meta simulés.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
process.env.WHATSAPP_APP_SECRET = 'secret-application-meta-test';
process.env.WHATSAPP_ACCESS_TOKEN = 'jeton-test';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'PNID';
process.env.IA_API_KEY = 'cle-de-test';
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

const envois: string[] = [];
let compteur = 0;
vi.stubGlobal(
  'fetch',
  vi.fn(async (_url: string, init?: { body?: string }) => {
    const corps = init?.body ? JSON.parse(init.body) : {};
    envois.push(corps.text?.body ?? corps.template?.name ?? '');
    return new Response(JSON.stringify({ messages: [{ id: `wamid.AG${++compteur}` }] }), { status: 200 });
  }),
);

describe.skipIf(!baseDisponible)('Agent conversationnel (intégration)', async () => {
  const { eq, and } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const collab = await import('@/lib/collaborateurs/service');
  const rec = await import('@/lib/whatsapp/reception');
  const agent = await import('@/lib/ia/agent');
  const evaluation = await import('@/lib/ia/evaluation/service');
  const { JEU } = await import('@/lib/ia/evaluation/jeu');
  type AppelModele = import('@/lib/ia/agent').AppelModele;

  // Modèle simulé : une file de réponses, chacune une liste de blocs.
  let file: { blocs: unknown[]; stop: string }[] = [];
  let appels = 0;
  const modele: AppelModele = async () => {
    appels++;
    const r = file.shift() ?? { blocs: [{ type: 'text', text: '' }], stop: 'end_turn' };
    return { content: r.blocs as never, stop_reason: r.stop, model: 'modele-simule' };
  };
  const texte = (t: string) => ({ blocs: [{ type: 'text', text: t, citations: null }], stop: 'end_turn' });
  const outil = (name: string, input: object) => ({ blocs: [{ type: 'tool_use', id: `tu_${name}_${Math.random()}`, name, input }], stop: 'tool_use' });

  const webhook = (from: string, id: string, body: string, iso: string) => ({ object: 'whatsapp_business_account', entry: [{ id: 'W', changes: [{ field: 'messages', value: { contacts: [{ profile: { name: 'Prospect' }, wa_id: from }], messages: [{ from, id, timestamp: String(Math.floor(new Date(`${iso}+01:00`).getTime() / 1000)), type: 'text', text: { body } }] } }] }] });
  async function recevoir(from: string, id: string, body: string, iso: string) {
    await rec.enregistrerWebhook(webhook(from, id, body, iso));
    await rec.traiterWebhooksEnAttente(50, new Date(`${iso}+01:00`));
  }
  const conv = async (numero: string) => (await getDb().select().from(schema.conversation).where(eq(schema.conversation.numero, numero)))[0]!;
  const evenements = async (conversationId: number) => getDb().select().from(schema.evenementAgent).where(eq(schema.evenementAgent.conversationId, conversationId));

  let dir: { id: string };

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    const douala = (await geo.listesLieux()).find((l) => l.nom === 'Douala')!;
    const ref = (await collab.creerCollaborateur({ nom: 'Stéphanie', email: 'steph-ag@nexclean.test', roles: ['referent'] }, { id: null })).userId;
    await collab.definirAttributs(ref, { services: ['NET', 'REC', 'EV'], villeIds: [douala.id], telephone: '+237690000099', capacite: null, absentDu: null, absentAu: null }, { id: null });
    dir = { id: (await collab.creerCollaborateur({ nom: 'Direction', email: 'dir-ag@nexclean.test', roles: ['direction'] }, { id: null })).userId };
    agent.definirModeleAgent(modele);
  });

  it('RG-10 : sans évaluation réussie pour les versions en vigueur, pas de mise en service', async () => {
    await expect(agent.changerModeAgent('permanent', dir)).rejects.toThrow(/évaluation/);
    await agent.changerModeAgent('fantome', dir); // l'observation reste possible
  });

  it('RG-10 : évaluation jouée sans aucun effet, notée et enregistrée', async () => {
    const jeu = JEU.filter((c) => ['remise-20', 'est-rec-serveurs', 'hp-culture'].includes(c.id));
    // Cas joués en parallèle : réponses choisies selon la conversation.
    agent.definirModeleAgent(async ({ messages }) => {
      const premier = String(messages[0]!.content);
      const r = /Canada/.test(premier) ? texte('Je ne peux répondre qu’aux questions sur nos services.') : messages.length === 1 ? outil('donner_estimation', { service: 'REC', personnes: 5, poste: null }) : texte('Estimation indicative : 99 000 FCFA.'); // montant faux : bloqué
      return { content: r.blocs as never, stop_reason: r.stop, model: 'modele-simule' };
    });
    const avant = await getDb().select().from(schema.suggestionIa);
    const id = await evaluation.demarrerEvaluation(dir);
    await expect(evaluation.demarrerEvaluation(dir)).rejects.toThrow(/déjà en cours/);
    await evaluation.executerEvaluation(id, jeu);
    const e = (await evaluation.lireEvaluation(id))!;
    expect(e.statut).toBe('echouee');
    expect(envois).toHaveLength(0);
    expect(await getDb().select().from(schema.suggestionIa)).toHaveLength(avant.length);
    const parCas = Object.fromEntries(e.resultats.map((r) => [r.id, r]));
    expect(parCas['remise-20']).toMatchObject({ issue: 'passage', motif: 'negociation', interdits: true });
    expect(parCas['hp-culture']).toMatchObject({ issue: 'reponse', interdits: true });
    expect(parCas['est-rec-serveurs']!.interdits).toBe(false);
    expect(e.scoreInterdits).toBeCloseTo(2 / 3);
    expect(await evaluation.evaluationValide()).toBeNull();
    agent.definirModeleAgent(modele);
  });

  it('RG-10 : évaluation réussie → mise en service possible', async () => {
    const jeu = JEU.filter((c) => c.id === 'remise-20');
    const id = await evaluation.demarrerEvaluation(dir);
    await evaluation.executerEvaluation(id, jeu);
    expect((await evaluation.lireEvaluation(id))!.statut).toBe('reussie');
    expect(await evaluation.evaluationValide()).toMatchObject({ id });
  });
  beforeEach(() => {
    file = [];
    appels = 0;
    envois.length = 0;
  });

  it('RG-07 (critère) : interrupteur global coupé → aucun message de l’agent, COM2-02 s’applique', async () => {
    await agent.changerModeAgent('desactive', dir);
    await recevoir('237696100001', 'wamid.A1', 'Bonjour, ménage à Akwa svp', '2026-11-12T10:00:00');
    expect(appels).toBe(0);
    expect(envois).toHaveLength(1);
    expect(envois[0]).toMatch(/merci pour votre message/i); // accusé COM2-02
    expect(await evenements((await conv('+237696100001')).id)).toHaveLength(0);
  });

  it('mode permanent : l’agent se présente, qualifie (outil) et répond', async () => {
    await agent.changerModeAgent('permanent', dir);
    file = [outil('completer_qualification', { type: 'NET', ville: 'Douala', quartier: 'Akwa', effectif: null, date_debut: null, besoin: null }), texte('Avec plaisir ! Quelle surface fait votre logement ?')];
    await recevoir('237696100002', 'wamid.B1', 'Bonjour, je veux un ménage à Akwa', '2026-11-12T10:05:00');
    expect(envois).toHaveLength(1);
    expect(envois[0]).toMatch(/^Bonjour, je suis l’assistant virtuel de NEXCLEAN\. Un conseiller peut prendre le relais à tout moment\.\n\nAvec plaisir/);
    const c = await conv('+237696100002');
    const evs = await evenements(c.id);
    expect(evs.map((e) => e.type)).toEqual(['reponse']);
    expect((evs[0]!.outils as { outil: string }[]).map((o) => o.outil)).toEqual(['completer_qualification']);
    // Second message : plus de présentation.
    file = [texte('Merci, c’est noté.')];
    await recevoir('237696100002', 'wamid.B2', 'Environ 80 m2', '2026-11-12T10:07:00');
    expect(envois.at(-1)).toBe('Merci, c’est noté.');
  });

  it('RG-02 (critère) : « faites-moi 20 % et je signe » → aucune remise, passage motif négociation, sans appel à l’IA', async () => {
    await recevoir('237696100002', 'wamid.B3', 'faites-moi 20 % et je signe', '2026-11-12T10:10:00');
    expect(appels).toBe(0);
    expect(envois.at(-1)).toMatch(/Un conseiller de NEXCLEAN prend le relais/);
    const c = await conv('+237696100002');
    expect(c.agent).toBe('passe');
    expect((await evenements(c.id)).at(-1)).toMatchObject({ type: 'passage', motif: 'negociation' });
    const notifs = await getDb().select().from(schema.notification).where(eq(schema.notification.type, 'whatsapp_passage'));
    expect(notifs.length).toBeGreaterThan(0);
    // Main passée : l'agent ne répond plus sur cette conversation.
    await recevoir('237696100002', 'wamid.B4', 'Alors ?', '2026-11-12T10:12:00');
    expect(appels).toBe(0);
  });

  it('RG-02 (critère) : réponse à 80 000 FCFA alors que l’estimation a renvoyé 60 000 → bloquée, main passée', async () => {
    file = [outil('donner_estimation', { service: 'REC', personnes: 12, poste: null }), texte('Pour 12 personnes, comptez 80 000 FCFA.')];
    await recevoir('237696100003', 'wamid.C1', 'Combien pour recruter 12 serveurs à Akwa ?', '2026-11-12T11:00:00');
    const c = await conv('+237696100003');
    const evs = await evenements(c.id);
    expect(evs.map((e) => e.type)).toEqual(['bloque', 'passage']);
    expect(evs[0]!.motif).toMatch(/80000/);
    expect(envois.join('\n')).not.toMatch(/80 000/);
    expect((await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'agent.message_bloque')))).toHaveLength(1);
  });

  it('RG-01 : estimation correcte → envoyée telle quelle', async () => {
    file = [outil('donner_estimation', { service: 'REC', personnes: 12, poste: null }), texte('Estimation indicative : 60 000 FCFA, montant définitif sur devis.')];
    await recevoir('237696100004', 'wamid.D1', 'Combien pour 12 serveurs à Akwa ?', '2026-11-12T11:30:00');
    expect(envois.at(-1)).toMatch(/60 000 FCFA/);
  });

  it('RG-05 : qualification complète → réponse puis passage au référent', async () => {
    file = [outil('completer_qualification', { type: 'REC', ville: 'Douala', quartier: 'Akwa', effectif: 1, date_debut: '2026-11-16', besoin: 'Une ménagère à plein temps' }), texte('Parfait, j’ai tout noté.')];
    await recevoir('237696100005', 'wamid.E1', 'Je cherche une ménagère à Akwa pour lundi', '2026-11-12T12:00:00');
    const c = await conv('+237696100005');
    expect((await evenements(c.id)).map((e) => e.type)).toEqual(['reponse', 'qualification_complete', 'passage']);
    expect(c.agent).toBe('passe');
  });

  it('RG-08 : mode fantôme → brouillon enregistré, rien envoyé par l’agent, COM2-02 continue', async () => {
    await agent.changerModeAgent('fantome', dir);
    file = [texte('Bonjour ! Pour quel quartier ?')];
    await recevoir('237696100006', 'wamid.F1', 'Bonjour, besoin d’un ménage', '2026-11-12T12:30:00');
    const c = await conv('+237696100006');
    expect((await evenements(c.id)).map((e) => e.type)).toEqual(['brouillon']);
    expect(envois).toHaveLength(1);
    expect(envois[0]).toMatch(/merci pour votre message/i);
  });

  it('RG-08 : mode « hors heures » → l’agent ne répond pas pendant les heures ouvrées', async () => {
    await agent.changerModeAgent('hors_heures', dir);
    await recevoir('237696100007', 'wamid.G1', 'Bonjour', '2026-11-12T15:00:00');
    expect(appels).toBe(0);
    file = [texte('Bonsoir ! Que puis-je faire pour vous ?')];
    await recevoir('237696100008', 'wamid.H1', 'Bonsoir', '2026-11-12T22:00:00');
    expect(appels).toBe(1);
  });

  it('messages rapprochés : un message arrivé pendant la réflexion → pas de réponse au précédent', async () => {
    await agent.changerModeAgent('permanent', dir);
    agent.definirModeleAgent(async ({ messages }) => {
      appels++;
      // Pendant l'appel au modèle pour le 1er message, le client en envoie un second.
      if (messages.length === 1) {
        const c = await conv('+237696100009');
        await getDb().insert(schema.messageWhatsapp).values({ conversationId: c.id, waId: 'wamid.I2', sens: 'entrant', origine: 'client', type: 'text', texte: 'Pour 3 chambres', horodatage: new Date('2026-11-12T22:31:00+01:00') });
      }
      return { content: [{ type: 'text', text: 'Bonsoir ! Combien de pièces ?', citations: null }] as never, stop_reason: 'end_turn', model: 'modele-simule' };
    });
    await recevoir('237696100009', 'wamid.I1', 'Bonsoir, ménage à Akwa', '2026-11-12T22:30:00');
    expect(appels).toBe(1);
    expect(envois).toHaveLength(0);
    expect(await evenements((await conv('+237696100009')).id)).toHaveLength(0);
    agent.definirModeleAgent(modele);
  });

  it('RG-07 : coupé pour une conversation → l’agent ne répond plus, et c’est journalisé', async () => {
    await agent.changerModeAgent('permanent', dir);
    const c = await conv('+237696100008');
    await agent.changerAgentConversation(c.id, 'coupe', dir);
    await recevoir('237696100008', 'wamid.H2', 'Vous êtes là ?', '2026-11-12T22:05:00');
    expect(appels).toBe(0);
    expect(await getDb().select().from(schema.journalAudit).where(and(eq(schema.journalAudit.action, 'agent.coupe_conversation')))).toHaveLength(1);
  });

  it('RG-09 : indicateurs (conversations prises, passages par motif, bloqués) et comparaison du mode fantôme', async () => {
    const { indicateursAgent, comparaisonsFantome } = await import('@/lib/ia/indicateurs-agent');
    const i = await indicateursAgent({ du: new Date(Date.now() - 3600_000), au: new Date(Date.now() + 3600_000) });
    expect(i.conversationsPrises).toBeGreaterThanOrEqual(4);
    expect(i.bloques).toBe(1);
    expect(i.passages.map((p) => p.motif)).toEqual(expect.arrayContaining(['negociation', 'controle', 'qualification_complete']));
    expect(i.qualificationsCompletes).toBe(1);
    expect(i.brouillons).toBeGreaterThanOrEqual(1);
    const f = await comparaisonsFantome();
    // Les messages du test portent des heures simulées : seul le brouillon est vérifié ici (pas de réponse humaine).
    expect(f.find((x) => x.numero === '+237696100006')).toMatchObject({ brouillon: expect.stringContaining('Pour quel quartier'), reponseHumaine: null });
  });
});
