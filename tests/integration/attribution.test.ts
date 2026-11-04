// Attribution, notifications, modèles, escalade (specs/MVP1-05) sur une vraie base PostgreSQL.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Attribution et notifications (intégration)', async () => {
  const { and, desc, eq, inArray, sql } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const svc = await import('@/lib/dossiers/service');
  const attr = await import('@/lib/dossiers/attribution');
  const notif = await import('@/lib/notifications');
  const modeles = await import('@/lib/modeles/service');
  const taches = await import('@/lib/taches');
  const compteurs = await import('@/lib/dossiers/compteurs');
  const collab = await import('@/lib/collaborateurs/service');
  const geo = await import('@/lib/geo/service');

  type R = 'referent' | 'direction' | 'finances' | 'admin';
  let douala: number;
  let yaounde: number;
  let dir: { id: string; roles: R[] };
  let awa: { id: string; roles: R[] };
  let ben: { id: string; roles: R[] };
  let yao: { id: string; roles: R[] };
  let clientFixe: number;
  let seq = 0;
  const douala1 = (s: string) => new Date(`${s}+01:00`);

  const demande = (type: 'NET' | 'REC', whatsapp: string, villeId: number | null, extra: Record<string, unknown> = {}) =>
    svc.creerDemande({
      type,
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: `Client ${whatsapp}`, contact: 'M. Test', whatsapp },
      villeId,
      villeAutre: villeId ? null : 'Kribi',
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: null,
      description: null,
      lignes: type === 'REC' ? [{ intitule: 'Serveur', nombre: 2, salaire: '80 000 FCFA' }] : [],
      donnees: { n: ++seq, ...extra },
    });

  const dossier = async (id: number) => (await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, id)))[0]!;
  const dernierEvenement = async (id: number, type: 'attribution' | 'reaffectation' | 'whatsapp') =>
    (await getDb().select().from(schema.evenementDossier).where(and(eq(schema.evenementDossier.dossierId, id), eq(schema.evenementDossier.type, type))).orderBy(desc(schema.evenementDossier.id)))[0];
  const notifications = (dossierId: number) => getDb().select().from(schema.notification).where(eq(schema.notification.dossierId, dossierId));

  /** Ferme tous les dossiers depuis 2 ans : charge nulle, pas de continuité. */
  async function remettreAZero() {
    await getDb().update(schema.dossier).set({ statut: 'cloture', fermeLe: new Date(Date.now() - 2 * 365 * 86_400_000) });
    await getDb().update(schema.collaborateurProfil).set({ derniereAttributionLe: null });
  }
  /** n dossiers ouverts confiés directement à un référent. */
  async function charger(referentId: string, n: number) {
    for (let i = 0; i < n; i++) {
      await getDb().insert(schema.dossier).values({ numero: `TEST-${referentId.slice(0, 6)}-${++seq}`, type: 'NET', clientId: clientFixe, referentId, statut: 'en_qualification', villeId: douala, jetonSuivi: `jeton-${seq}-${Math.random()}` });
    }
  }

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    const villes = await geo.listesLieux();
    douala = villes.find((v) => v.nom === 'Douala')!.id;
    yaounde = villes.find((v) => v.nom === 'Yaoundé')!.id;
    const mk = async (nom: string, roles: R[], services: ('NET' | 'REC')[], villeIds: number[], absent = false) => {
      const id = (await collab.creerCollaborateur({ nom, email: `${nom.toLowerCase().split(' ')[0]}@nexclean.test`, roles }, { id: null })).userId;
      if (services.length) await collab.definirAttributs(id, { services, villeIds, telephone: '+237690000099', capacite: null, absentDu: absent ? '2020-01-01' : null, absentAu: absent ? '2099-12-31' : null }, { id: null });
      return { id, roles };
    };
    dir = await mk('Diane Direction', ['direction'], [], []);
    awa = await mk('Awa Ngo', ['referent'], ['NET', 'REC'], [douala]);
    ben = await mk('Ben Eto', ['referent'], ['NET'], [douala]);
    yao = await mk('Yves Ondoa', ['referent'], ['REC'], [yaounde], true);
    const [c] = await getDb().insert(schema.client).values({ type: 'entreprise', nom: 'Client de charge', whatsapp: '+237699999999' }).returning();
    clientFixe = c!.id;
  });

  beforeEach(() => consoleInfo.mockClear());

  it('RG-03 continuité : dossier NET clos il y a 2 mois chez Awa → la nouvelle demande va à Awa', async () => {
    await remettreAZero();
    const premier = await demande('NET', '690100001', douala);
    await getDb().update(schema.dossier).set({ referentId: awa.id, statut: 'cloture', fermeLe: new Date(Date.now() - 60 * 86_400_000) }).where(eq(schema.dossier.id, premier.dossierId));
    await charger(awa.id, 3); // Awa plus chargée que Ben : seule la continuité explique le choix.
    const r = await demande('NET', '690100001', douala);
    const d = await dossier(r.dossierId);
    expect([d.referentId, d.statut, d.enFileDepuis]).toEqual([awa.id, 'attribuee', null]);
    expect((await dernierEvenement(r.dossierId, 'attribution'))!.apres).toEqual({ referentId: awa.id, regle: 'continuité' });
  });

  it('RG-03 charge minimale : 4 ouverts plutôt que 7', async () => {
    await remettreAZero();
    await charger(awa.id, 7);
    await charger(ben.id, 4);
    const r = await demande('NET', '690100002', douala);
    expect((await dossier(r.dossierId)).referentId).toBe(ben.id);
    expect((await dernierEvenement(r.dossierId, 'attribution'))!.apres).toMatchObject({ regle: 'charge minimale' });
  });

  it('RG-03 tour de rôle : à égalité, la dernière attribution la plus ancienne', async () => {
    await remettreAZero();
    await getDb().update(schema.collaborateurProfil).set({ derniereAttributionLe: new Date() }).where(eq(schema.collaborateurProfil.userId, awa.id));
    await getDb().update(schema.collaborateurProfil).set({ derniereAttributionLe: new Date(Date.now() - 86_400_000) }).where(eq(schema.collaborateurProfil.userId, ben.id));
    const r = await demande('NET', '690100003', douala);
    expect((await dossier(r.dossierId)).referentId).toBe(ben.id);
    expect((await dernierEvenement(r.dossierId, 'attribution'))!.apres).toMatchObject({ regle: 'tour de rôle' });
    // Ben vient de recevoir un dossier : le suivant va à Awa (charge minimale).
    const r2 = await demande('NET', '690100004', douala);
    expect((await dossier(r2.dossierId)).referentId).toBe(awa.id);
  });

  it('RG-02 / RG-05 : seul référent REC de Yaoundé absent → Non attribués, Direction notifiée (in-app + e-mail)', async () => {
    await remettreAZero();
    const r = await demande('REC', '690100005', yaounde);
    const d = await dossier(r.dossierId);
    expect([d.referentId, d.statut]).toEqual([null, 'nouvelle_demande']);
    expect(d.enFileDepuis).not.toBeNull();
    const n = await notifications(r.dossierId);
    expect(n.map((x) => [x.destinataireId, x.type, x.email, x.inApp])).toEqual([[dir.id, 'non_attribue', true, true]]);
    expect(n[0]!.texte).not.toContain('80 000');
  });

  it('RG-05 : ville hors référentiel → Non attribués', async () => {
    const r = await demande('NET', '690100006', null);
    expect((await dossier(r.dossierId)).referentId).toBeNull();
    expect((await dernierEvenement(r.dossierId, 'attribution'))!.apres).toMatchObject({ referentId: null });
  });

  it('RG-08 : réaffectation sans motif refusée ; avec motif → avertissement, notifications, journal', async () => {
    await remettreAZero();
    const r = await demande('NET', '690100007', douala);
    const avant = (await dossier(r.dossierId)).referentId!;
    await expect(attr.reaffecter(r.dossierId, yao.id, '  ', dir)).rejects.toThrow('Motif obligatoire.');
    await expect(attr.reaffecter(r.dossierId, yao.id, 'Renfort', awa)).rejects.toThrow(/Direction/);
    const res = await attr.reaffecter(r.dossierId, yao.id, 'Renfort sur ce client', dir);
    expect(res.avertissements).toEqual(expect.arrayContaining(['absent', 'ne traite pas « Nettoyage »']));
    expect((await dossier(r.dossierId)).referentId).toBe(yao.id);
    const ev = (await dernierEvenement(r.dossierId, 'reaffectation'))!;
    expect([ev.commentaire, (ev.avant as { referentId: string }).referentId]).toEqual(['Renfort sur ce client', avant]);
    const n = await notifications(r.dossierId);
    expect(n.find((x) => x.destinataireId === yao.id && x.type === 'attribution')?.email).toBe(true);
    expect(n.find((x) => x.destinataireId === avant && x.type === 'retrait')?.email).toBe(false);
    const [j] = await getDb().select().from(schema.journalAudit).where(and(eq(schema.journalAudit.action, 'dossier.reaffecte'), eq(schema.journalAudit.objetId, String(r.dossierId))));
    expect(j).toBeDefined();
  });

  it('RG-12 / RG-13 : l’e-mail d’attribution d’un dossier REC ne contient pas le budget', async () => {
    await remettreAZero();
    const r = await demande('REC', '690100008', douala);
    expect((await dossier(r.dossierId)).referentId).toBe(awa.id);
    const envoyes = await notif.envoyerNotificationsEnAttente();
    expect(envoyes).toBeGreaterThan(0);
    const sortie = consoleInfo.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sortie).toContain(r.numero);
    expect(sortie).toContain('awa@nexclean.test');
    expect(sortie).not.toMatch(/80 000|salaire|budget/i);
    const [n] = (await notifications(r.dossierId)).filter((x) => x.type === 'attribution');
    expect(n!.emailEnvoyeLe).not.toBeNull();
    expect(await notif.envoyerNotificationsEnAttente()).toBe(0);
  });

  it('notifications : dédoublonnage par clé, lecture et compteur de non-lues', async () => {
    await notif.notifier({ destinataires: [ben.id, ben.id], type: 'test', titre: 'T', texte: 'x', cle: 'unique-1' });
    await notif.notifier({ destinataires: [ben.id], type: 'test', titre: 'T', texte: 'x', cle: 'unique-1' });
    const rows = await getDb().select().from(schema.notification).where(and(eq(schema.notification.destinataireId, ben.id), eq(schema.notification.cle, 'unique-1')));
    expect(rows).toHaveLength(1);
    const avant = await notif.compterNonLues(ben.id);
    expect(await notif.marquerLue(rows[0]!.id, awa.id)).toBeNull(); // pas la sienne
    await notif.marquerLue(rows[0]!.id, ben.id);
    expect(await notif.compterNonLues(ben.id)).toBe(avant - 1);
    await notif.marquerToutesLues(ben.id);
    expect(await notif.compterNonLues(ben.id)).toBe(0);
  });

  it('RG-11 : nouvelle demande rattachée à un dossier existant → référent prévenu', async () => {
    await remettreAZero();
    const r = await demande('NET', '690100009', douala);
    const referent = (await dossier(r.dossierId)).referentId!;
    await svc.creerDemande(
      { type: 'NET', canal: 'whatsapp', formulaire: 'saisie', client: { type: 'entreprise', nom: 'Client 690100009', contact: null, whatsapp: '690100009' }, villeId: douala, villeAutre: null, quartierId: null, quartierAutre: null, lieu: null, secteur: null, description: null, lignes: [], donnees: { x: 1 }, dossierExistantId: r.dossierId },
      { ...dir, ip: null },
    );
    expect((await notifications(r.dossierId)).some((x) => x.destinataireId === referent && x.type === 'rattachement')).toBe(true);
  });

  it('RG-15 : variable inconnue refusée ; RG-16 : modèles initiaux ; RG-17 : message préparé historisé', async () => {
    await expect(modeles.enregistrerModele(null, { nom: 'Test', texte: 'Montant : {{dossier.montant}}' }, { id: dir.id })).rejects.toThrow('Variable inconnue : dossier.montant');
    const tous = await modeles.listerModeles();
    // Modèles initiaux : 5 pour les dossiers (0004), 3 pour les candidats (0008, MVP2-02), 4 pour les propositions (0010, MVP2-03), 1 pour l’envoi du devis (0012, MVP2-04).
    expect(tous.map((m) => m.nom).sort()).toEqual(['Attestation de prise de poste', 'Bienvenue candidat', 'Compléter votre profil', 'Convocation entretien', 'Envoi du devis', 'Informations complémentaires', 'Lien de réinitialisation', 'Lien de suivi', 'Premier contact', 'Profil candidat', 'Proposition de poste', 'Relance demande de devis', 'Relance sans réponse']);
    expect((await modeles.listerModeles({ type: 'REC' })).map((m) => m.nom)).not.toContain('Relance demande de devis');

    const r = await demande('REC', '690100010', douala);
    const ctx = await modeles.contexteDossier(r.dossierId, { id: dir.id, nom: 'Diane Direction' });
    expect(ctx).toMatchObject({ 'dossier.numero': r.numero, 'dossier.ville': 'Douala', 'client.contact': 'M. Test', 'postes.resume': '2 × Serveur', 'referent.prenom': 'Awa', 'referent.telephone': '+237 6 90 00 00 99' });
    expect(ctx['dossier.lien_suivi']).toMatch(/\/suivi\//);
    await svc.noterMessageWhatsApp(r.dossierId, 'Premier contact', 'Bonjour M. Test…', { ...awa, ip: null });
    const ev = (await dernierEvenement(r.dossierId, 'whatsapp'))!;
    expect([ev.commentaire, (ev.apres as { texte: string }).texte]).toEqual(['Message WhatsApp préparé : Premier contact', 'Bonjour M. Test…']);
    await expect(svc.noterMessageWhatsApp(r.dossierId, 'Premier contact', 'x', { ...ben, ip: null })).rejects.toThrow();
  });

  it('RG-06 : entré en file vendredi 17 h → escalade samedi 10 h, puis lundi 8 h', async () => {
    const r = await demande('REC', '690100011', yaounde);
    await getDb().update(schema.dossier).set({ enFileDepuis: douala1('2026-11-06T17:00:00'), derniereRelanceLe: null }).where(eq(schema.dossier.id, r.dossierId));
    const escalades = async () => (await notifications(r.dossierId)).filter((x) => x.type === 'escalade');
    await taches.escaladerNonAttribues(douala1('2026-11-07T09:59:00'));
    expect(await escalades()).toHaveLength(0);
    await taches.escaladerNonAttribues(douala1('2026-11-07T10:00:00'));
    expect((await escalades()).map((x) => [x.destinataireId, x.email, x.inApp])).toEqual([[dir.id, true, false]]);
    await taches.escaladerNonAttribues(douala1('2026-11-07T16:00:00'));
    await taches.escaladerNonAttribues(douala1('2026-11-08T12:00:00'));
    expect(await escalades()).toHaveLength(1);
    await taches.escaladerNonAttribues(douala1('2026-11-09T08:00:00'));
    expect(await escalades()).toHaveLength(2);
  });

  it('RG-11 : dossiers sans action → notification par dossier + récapitulatif e-mail, une fois par jour', async () => {
    await remettreAZero();
    const r = await demande('NET', '690100012', douala);
    const referent = (await dossier(r.dossierId)).referentId!;
    await getDb().update(schema.dossier).set({ derniereActionLe: new Date(Date.now() - 5 * 86_400_000) }).where(eq(schema.dossier.id, r.dossierId));
    // Prochain lundi 9 h (jour ouvré, après 8 h).
    const lundi = douala1('2026-11-09T09:00:00');
    const avant = new Date(lundi.getTime() - 4 * 86_400_000);
    await getDb().update(schema.dossier).set({ derniereActionLe: avant }).where(eq(schema.dossier.id, r.dossierId));
    await taches.signalerSansAction(lundi);
    await taches.signalerSansAction(new Date(lundi.getTime() + 3600_000));
    expect((await notifications(r.dossierId)).filter((x) => x.type === 'sans_action')).toHaveLength(1);
    const recap = await getDb().select().from(schema.notification).where(and(eq(schema.notification.destinataireId, referent), eq(schema.notification.type, 'recap_sans_action')));
    expect(recap).toHaveLength(1);
    expect([recap[0]!.email, recap[0]!.inApp]).toEqual([true, false]);
    expect(recap[0]!.texte).toContain(r.numero);
    // Dimanche : rien.
    expect(await taches.signalerSansAction(douala1('2026-11-08T10:00:00'))).toBe(0);
  });

  it('RG-01 : changement de type rendant le référent inéligible → proposition à la Direction', async () => {
    await remettreAZero();
    await getDb().update(schema.collaborateurProfil).set({ derniereAttributionLe: new Date() }).where(eq(schema.collaborateurProfil.userId, awa.id));
    const r = await demande('NET', '690100013', douala);
    expect((await dossier(r.dossierId)).referentId).toBe(ben.id); // Ben ne traite que NET
    await svc.changerType(r.dossierId, 'REC', { ...dir, ip: null });
    expect((await dossier(r.dossierId)).referentId).toBe(ben.id); // pas de réattribution silencieuse
    expect((await notifications(r.dossierId)).some((x) => x.type === 'referent_ineligible' && x.destinataireId === dir.id)).toBe(true);
  });

  it('RG-18 : compteurs Direction et Référent', async () => {
    await demande('REC', '690100014', yaounde); // va en Non attribués (référent absent)
    const d = await compteurs.compteursDirection('jour');
    expect(d.nonAttribues).toBeGreaterThan(0);
    expect(d.parReferent.find((l) => l.cle === 'aucun')).toBeDefined();
    expect(d.parPhase.every((l) => l.ouverts >= 0 && l.crees >= 0)).toBe(true);
    const m = await compteurs.compteursReferent(ben.id);
    expect(m.parStatut.length).toBeGreaterThan(0);
  });

  it('cas limite : référent désactivé → ses dossiers ouverts en Non attribués, Direction notifiée', async () => {
    const ouverts = await getDb().select({ id: schema.dossier.id }).from(schema.dossier).where(and(eq(schema.dossier.referentId, ben.id), inArray(schema.dossier.statut, attr.STATUTS_OUVERTS)));
    expect(ouverts.length).toBeGreaterThan(0);
    await collab.desactiverCollaborateur(ben.id, { id: dir.id });
    const apres = await getDb().select().from(schema.dossier).where(inArray(schema.dossier.id, ouverts.map((o) => o.id)));
    expect(apres.every((d) => d.referentId === null && d.enFileDepuis !== null && d.statut !== 'attribuee')).toBe(true);
    const [n] = await getDb().select().from(schema.notification).where(and(eq(schema.notification.destinataireId, dir.id), sql`${schema.notification.cle} like ${`desactivation:${ben.id}:%`}`));
    expect(n!.texte).toContain('Ben Eto');
    expect((await attr.fileNonAttribues()).length).toBeGreaterThanOrEqual(ouverts.length);
  });

  it('couverture manquante : avertissement par service × ville', async () => {
    const m = await attr.couverturesManquantes();
    expect(m).toContainEqual({ type: 'NET', ville: 'Yaoundé' });
    expect(m.some((x) => x.type === 'MAD')).toBe(false);
    expect(m).not.toContainEqual({ type: 'REC', ville: 'Douala' });
  });
});
