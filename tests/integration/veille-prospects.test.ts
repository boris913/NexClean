// Veille prospects (specs/COM4-01) sur une vraie base PostgreSQL ; fournisseur IA simulé.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
process.env.IA_API_KEY = 'cle-de-test';
delete process.env.WHATSAPP_ACCESS_TOKEN; // aucun envoi : la réception seule est testée
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Veille prospects (intégration)', async () => {
  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const collab = await import('@/lib/collaborateurs/service');
  const svc = await import('@/lib/dossiers/service');
  const veille = await import('@/lib/veille/service');
  const { definirParametre } = await import('@/lib/parametres');
  const { definirFournisseur } = await import('@/lib/ia/client');
  type Fournisseur = import('@/lib/ia/client').Fournisseur;

  let extraction: unknown = null;
  let redaction: string | null = null;
  const appels: string[] = [];
  const simule: Fournisseur = {
    async extraire(_p, contenu, schemaSortie) {
      appels.push(contenu);
      const r = schemaSortie.safeParse(extraction);
      return r.success ? r.data : null;
    },
    async rediger() {
      return redaction;
    },
  };
  const analyse = (x: Partial<import('@/lib/veille/service').Analyse>) => ({ pertinent: true, motif_ecart: null, type: 'REC', postes: [], effectif: null, ville: null, quartier: null, date_publication: null, contact_nom: null, contact_email: null, contact_telephone: null, besoin: 'Besoin', score: 50, justification: 'Justification.', ...x });
  const lire = async (id: number) => (await getDb().select().from(schema.piste).where(eq(schema.piste.id, id)))[0]!;

  let steph: { id: string; roles: ('referent' | 'direction')[] };
  let yaounde: { id: number; quartiers: { id: number; nom: string }[] };

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    yaounde = (await geo.listesLieux()).find((l) => l.nom === 'Yaoundé')!;
    steph = { id: (await collab.creerCollaborateur({ nom: 'Stéphanie', email: 'steph-veille@nexclean.test', roles: ['referent'] }, { id: null })).userId, roles: ['referent'] };
    definirFournisseur(simule);
  });
  afterAll(() => definirFournisseur(null));
  beforeEach(() => {
    extraction = null;
    redaction = null;
  });

  it('RG-05 (critère) : « cherche gardien de nuit pour villa à Bastos » → piste Yaoundé / Bastos, poste gardien, score motivé', async () => {
    extraction = analyse({ type: 'REC', postes: ['Gardien de nuit'], effectif: 1, ville: 'Yaoundé', quartier: 'Bastos', besoin: 'Un gardien de nuit pour une villa', score: 72, justification: 'Besoin précis, quartier aisé couvert.' });
    const r = await veille.ajouterPiste({ url: 'https://www.facebook.com/groups/1/posts/2/?mibextid=x', texte: 'Cherche gardien de nuit pour villa à Bastos, sérieux, disponible vite.' }, steph);
    expect(r).toMatchObject({ issue: 'creee', statut: 'nouvelle' });
    const p = await lire((r as { pisteId: number }).pisteId);
    expect(p).toMatchObject({ villeId: yaounde.id, quartierId: yaounde.quartiers.find((q) => q.nom === 'Bastos')!.id, postes: ['gardien de nuit'], score: 72, justification: 'Besoin précis, quartier aisé couvert.', source: 'saisie_assistee', assigneA: steph.id });
    expect(appels.at(-1)).toMatch(/Date du jour : \d{4}-\d{2}-\d{2}/);
  });

  it('RG-03 : même publication (autres paramètres de lien) → doublon', async () => {
    const r = await veille.ajouterPiste({ url: 'http://m.facebook.com/groups/1/posts/2', texte: 'Cherche gardien de nuit pour villa à Bastos, sérieux.' }, steph);
    expect(r).toMatchObject({ issue: 'doublon', reference: 'P-0001' });
  });

  it('sécurité : lien non http(s) refusé (affiché comme lien cliquable) ; lien sans protocole complété', async () => {
    await expect(veille.ajouterPiste({ url: 'javascript:alert(document.cookie)', texte: 'Cherche gardien de nuit pour villa à Bastos, sérieux.' }, steph)).rejects.toThrow(/Lien invalide/);
    extraction = analyse({ type: 'NET', ville: 'Douala' });
    const r = await veille.ajouterPiste({ url: 'jumia.cm/annonce/77', texte: 'Nettoyage de bureaux à Akwa, deux fois par semaine.' }, steph);
    expect((await lire((r as { pisteId: number }).pisteId)).url).toBe('https://jumia.cm/annonce/77');
  });

  it('RG-05 (critère) : poste de comptable → écartée « hors services »', async () => {
    extraction = analyse({ pertinent: false, motif_ecart: 'hors_services', type: null, postes: ['comptable'], ville: 'Douala', score: 5 });
    const r = await veille.ajouterPiste({ url: null, texte: 'Entreprise à Akwa recrute un comptable confirmé, 5 ans d’expérience.' }, steph);
    expect(r).toMatchObject({ issue: 'creee', statut: 'ecartee' });
    expect((await lire((r as { pisteId: number }).pisteId)).motifEcart).toBe('hors_services');
  });

  it('RG-05 : ville hors zone → écartée « hors zone »', async () => {
    extraction = analyse({ type: 'REC', postes: ['ménagère'], ville: 'Bafoussam' });
    const r = await veille.ajouterPiste({ url: null, texte: 'Je cherche une ménagère sérieuse à Bafoussam, urgent.' }, steph);
    expect((await lire((r as { pisteId: number }).pisteId))).toMatchObject({ statut: 'ecartee', motifEcart: 'hors_zone', lieuTexte: 'Bafoussam' });
  });

  it('RG-03 : même contact et même besoin sur 30 jours → doublon ; contact inventé par l’IA ignoré', async () => {
    extraction = analyse({ type: 'NET', ville: 'Douala', contact_telephone: '699111222', contact_email: 'invente@exemple.cm' });
    const r1 = await veille.ajouterPiste({ url: 'https://jumia.cm/a/1', texte: 'Nettoyage de fin de chantier à Bonapriso. Appelez le 6 99 11 12 22.' }, steph);
    expect(await lire((r1 as { pisteId: number }).pisteId)).toMatchObject({ contactTelephone: '+237699111222', contactEmail: null });
    const r2 = await veille.ajouterPiste({ url: 'https://jumia.cm/a/2', texte: 'Toujours besoin d’un nettoyage de fin de chantier, Bonapriso. Tél 699111222.' }, steph);
    expect(r2).toMatchObject({ issue: 'doublon', pisteId: (r1 as { pisteId: number }).pisteId });
  });

  it('RG-03 : contact déjà client → signalé et rattaché au client, aucune piste', async () => {
    const c = await svc.creerDemande({ type: 'NET', canal: 'site', formulaire: 'devis-pro', client: { type: 'entreprise', nom: 'Hôtel Wouri', contact: null, whatsapp: '690112233' }, villeId: null, villeAutre: null, quartierId: null, quartierAutre: null, lieu: null, secteur: null, description: 'Nettoyage', donnees: {} });
    expect(c.dossierId).toBeGreaterThan(0);
    extraction = analyse({ type: 'REC', ville: 'Douala' });
    const avant = (await getDb().select().from(schema.piste)).length;
    const r = await veille.ajouterPiste({ url: null, texte: 'L’Hôtel Wouri recrute 3 serveurs. Contact : +237 690 11 22 33' }, steph);
    expect(r).toMatchObject({ issue: 'client_existant', nom: 'Hôtel Wouri' });
    expect(await getDb().select().from(schema.piste)).toHaveLength(avant);
    expect(await getDb().select().from(schema.signalementClient)).toHaveLength(1);
  });

  it('IA indisponible → piste enregistrée sans qualification, à traiter à la main', async () => {
    extraction = { invalide: true };
    const r = await veille.ajouterPiste({ url: null, texte: 'Besoin d’une nounou à Makepe pour deux enfants dès décembre.' }, steph);
    expect(await lire((r as { pisteId: number }).pisteId)).toMatchObject({ statut: 'nouvelle', score: null, justification: expect.stringMatching(/indisponible/) });
  });

  it('RG-07 : message d’approche — sans prix ni lien ; RG-08 / RG-10 : contact humain, plafond, relance unique', async () => {
    const id = 1;
    await expect(veille.marquerContactee(id, { canal: 'commentaire', texte: 'Bonjour, nous pouvons vous aider.' }, steph)).rejects.toThrow(/Retenez/);
    await veille.changerStatutPiste(id, 'retenue', null, steph);
    redaction = 'Bonjour, NEXCLEAN place des gardiens de nuit à Bastos pour 50 000 FCFA.';
    await expect(veille.redigerApproche(id, 'commentaire', steph)).rejects.toThrow(/prix, un lien ou un numéro/);
    redaction = 'Bonjour, NEXCLEAN accompagne les familles de Bastos pour trouver un gardien de nuit de confiance. Écrivons-nous sur WhatsApp ?';
    expect(await veille.redigerApproche(id, 'commentaire', steph)).toMatch(/gardien de nuit/);
    expect((await lire(id)).message).toMatch(/gardien de nuit/);

    const t0 = new Date('2026-11-12T10:00:00+01:00');
    expect(await veille.marquerContactee(id, { canal: 'commentaire', texte: 'Bonjour… https://wa.me/237696370479?text=Bonjour%20NEXCLEAN%20%5BP-0001%5D' }, steph, t0)).toBe('premier');
    expect((await lire(id)).statut).toBe('contactee');
    await expect(veille.marquerContactee(id, { canal: 'commentaire', texte: 'Petite relance, toujours intéressé ?' }, steph, new Date('2026-11-14T10:00:00+01:00'))).rejects.toThrow(/Relance possible à partir du/);
    expect(await veille.marquerContactee(id, { canal: 'commentaire', texte: 'Petite relance, toujours intéressé ?' }, steph, new Date('2026-11-18T10:00:00+01:00'))).toBe('relance');
    await expect(veille.marquerContactee(id, { canal: 'commentaire', texte: 'Encore une relance ?' }, steph, new Date('2026-11-30T10:00:00+01:00'))).rejects.toThrow(/déjà été relancée/);
    const journal = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'veille.contactee'));
    expect(journal).toHaveLength(1);

    // Plafond quotidien.
    await definirParametre('veille_plafond_contacts_jour', 1, { id: null });
    extraction = analyse({ type: 'EV', ville: 'Douala', quartier: 'Makepe' });
    const r = await veille.ajouterPiste({ url: 'https://exemple.cm/jardin', texte: 'Cherche jardinier pour entretien de gazon à Makepe.' }, steph);
    const autre = (r as { pisteId: number }).pisteId;
    await veille.changerStatutPiste(autre, 'retenue', null, steph);
    await expect(veille.marquerContactee(autre, { canal: 'annonce', texte: 'Bonjour, nous entretenons les jardins.' }, steph, new Date('2026-11-18T15:00:00+01:00'))).rejects.toThrow(/Plafond atteint : 1/);
    expect(await veille.marquerContactee(autre, { canal: 'annonce', texte: 'Bonjour, nous entretenons les jardins.' }, steph, new Date('2026-11-19T09:00:00+01:00'))).toBe('premier');
  });

  it('RG-09 (critère) : « Bonjour [P-0001] » sur WhatsApp → piste convertie, Dossier source prospection', async () => {
    process.env.WHATSAPP_APP_SECRET = 'secret';
    const rec = await import('@/lib/whatsapp/reception');
    const iso = '2026-11-20T10:00:00+01:00';
    await rec.enregistrerWebhook({ object: 'whatsapp_business_account', entry: [{ id: 'W', changes: [{ field: 'messages', value: { contacts: [{ profile: { name: 'M. Ndi' }, wa_id: '237677001122' }], messages: [{ from: '237677001122', id: 'wamid.V1', timestamp: String(Math.floor(new Date(iso).getTime() / 1000)), type: 'text', text: { body: 'Bonjour NEXCLEAN [P-0001]' } }] } }] }] });
    await rec.traiterWebhooksEnAttente(50, new Date(iso));
    const p = await lire(1);
    expect(p.statut).toBe('convertie');
    expect(p.dossierId).not.toBeNull();
    const [dem] = await getDb().select().from(schema.demande).where(eq(schema.demande.dossierId, p.dossierId!));
    expect(dem!.source).toBe('prospection');
    const notif = await getDb().select().from(schema.notification).where(eq(schema.notification.type, 'veille_conversion'));
    expect(notif).toHaveLength(1);
    // Idempotent : un second message ne reconvertit pas.
    expect(await veille.convertirPiste('P-0001', p.dossierId!)).toBe(false);
  });

  it('RG-11 : liste triée par score ; un référent ne voit que ses pistes et celles sans titulaire', async () => {
    const autre = { id: (await collab.creerCollaborateur({ nom: 'Paul', email: 'paul-veille@nexclean.test', roles: ['referent'] }, { id: null })).userId, roles: ['referent' as const] };
    const toutes = await veille.listerPistes({ statut: 'toutes' }, steph);
    expect(toutes.length).toBeGreaterThan(3);
    const scores = toutes.map((x) => x.score ?? -1);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(await veille.listerPistes({ statut: 'toutes' }, autre)).toHaveLength(0);
    // Ni action sur la piste d'un collègue.
    await expect(veille.changerStatutPiste(toutes.find((x) => x.statut === 'nouvelle')!.id, 'retenue', null, autre)).rejects.toThrow(/autre collaborateur/);
    const ecartees = await veille.listerPistes({ statut: 'ecartee' }, steph);
    expect(ecartees.every((x) => x.statut === 'ecartee')).toBe(true);
  });

  it('RG-02 : purge des pistes non converties après 90 jours ; les converties restent', async () => {
    await getDb().update(schema.piste).set({ creeLe: new Date('2026-01-01T00:00:00Z') });
    const n = await veille.purgerPistes(new Date('2026-11-25T00:00:00Z'));
    expect(n).toBeGreaterThan(0);
    const restantes = await getDb().select().from(schema.piste);
    expect(restantes.map((x) => x.statut)).toEqual(['convertie']);
  });
});
