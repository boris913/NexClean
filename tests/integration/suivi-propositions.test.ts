// Côté client des Propositions (specs/MVP2-03 RG-03, RG-07..11, RG-15, RG-16, RG-23) : page de
// suivi et liens temporaires, sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Page de suivi — profils transmis (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-suivi-'));

  const { and, eq } = await import('drizzle-orm');
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const { getDb, schema } = await import('@/lib/db');
  const { getStockage } = await import('@/lib/fichiers/stockage');
  const svc = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');
  const client = await import('@/lib/propositions/client');
  const { empreinteJeton, genererJetonAcces } = await import('@/lib/propositions/jetons');
  const { BLOCAGE_VERIFICATION_MS } = await import('@/lib/propositions/domaine');

  const WHATSAPP_CLIENT = '+237699001122';
  const TEL_CANDIDAT = '+237690200001';
  let refId: string;
  let dossierId: number;
  let jetonSuivi: string;
  let ligneId: number;
  let clientId: number;
  let quartierId: number;
  let seq = 0;

  const nouveauCandidat = async (prenom = 'Awa', nom = 'Ngo') => {
    const n = String(++seq).padStart(2, '0');
    const [c] = await getDb()
      .insert(schema.candidat)
      .values({
        nom,
        prenom,
        telephone: `+2376902000${n}`,
        whatsapp: `+2376902000${n}`,
        email: `candidat${n}@exemple.test`,
        quartierId,
        repere: 'Derrière la pharmacie du carrefour',
        metiers: ['Serveur(se)'],
        competences: ['Service en salle', 'Accueil'],
        disponibilite: 'immediate',
        statut: 'preselectionne',
      })
      .returning();
    return c!;
  };
  const proposer = async (candidatId: number, statut: 'en_attente_accord' | 'proposee' | 'retenue' = 'proposee') => {
    const [p] = await getDb().insert(schema.proposition).values({ dossierId, lignePosteId: ligneId, candidatId, clientId, auteurId: refId, statut }).returning();
    return p!.id;
  };
  const ctxSuivi = async () => (await client.chargerContexteSuivi(jetonSuivi))!;
  const journal = (action: string) => getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, action));
  const nouvelAcces = async (propositionId: number, o: { objet?: string; expireLe?: Date; revoqueLe?: Date | null } = {}) => {
    const jeton = genererJetonAcces();
    const [a] = await getDb()
      .insert(schema.accesProfil)
      .values({ propositionId, empreinte: empreinteJeton(jeton), objet: o.objet ?? 'profil', expireLe: o.expireLe ?? new Date(Date.now() + 7 * 864e5), revoqueLe: o.revoqueLe ?? null, auteurId: refId })
      .returning();
    return { jeton, id: a!.id };
  };

  beforeAll(async () => {
    await reinitialiserBase();
    refId = (await collab.creerCollaborateur({ nom: 'Rita Recrutement', email: 'rita@nexclean.test', roles: ['referent'] }, { id: null })).userId;
    const [v] = await getDb().insert(schema.ville).values({ nom: 'Douala' }).returning();
    const [q] = await getDb().insert(schema.quartier).values({ villeId: v!.id, nom: 'Bonamoussadi' }).returning();
    quartierId = q!.id;
    const r = await svc.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: 'Hôtel du Lac', contact: 'M. Kamga', whatsapp: WHATSAPP_CLIENT },
      villeId: null,
      villeAutre: 'Kribi',
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: null,
      description: null,
      lignes: [{ intitule: 'Serveur', nombre: 2 }],
      donnees: { test: 1 },
    });
    dossierId = r.dossierId;
    await getDb().update(schema.dossier).set({ referentId: refId, statut: 'candidats_proposes' }).where(eq(schema.dossier.id, dossierId));
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, dossierId));
    jetonSuivi = d!.jetonSuivi;
    clientId = d!.clientId;
    ligneId = (await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId)))[0]!.id;
  });

  it('RG-03, RG-07 : seules les propositions transmises figurent ; une proposition en attente d’accord n’apparaît jamais', async () => {
    const enAttente = await nouveauCandidat('Bella', 'Mbarga');
    await proposer(enAttente.id, 'en_attente_accord');
    const ctx = await ctxSuivi();
    expect(await client.compterVisibles(ctx)).toBe(0);
    expect(await client.profilsTransmis(ctx)).toEqual([]);

    const c = await nouveauCandidat();
    await getDb().insert(schema.candidatExperience).values({ candidatId: c.id, ordre: 1, poste: 'Serveuse', employeur: 'Restaurant Le Wouri', duree: '2 ans' });
    const p = await proposer(c.id);
    const profils = await client.profilsTransmis(ctx);
    expect(profils).toHaveLength(1);
    expect(profils[0]).toMatchObject({ propositionId: p, nom: 'Awa N.', poste: 'Serveur', metiers: ['Serveur(se)'], experiences: [{ poste: 'Serveuse', duree: '2 ans' }], quartier: 'Bonamoussadi', disponibilite: 'Disponible immédiatement', aCv: false });
    expect(JSON.stringify(profils)).not.toContain('Bella');
  });

  it('RG-08 : ni téléphone, ni WhatsApp, ni e-mail, ni repère, ni nom complet dans les données du profil', async () => {
    const profils = await client.profilsTransmis(await ctxSuivi());
    const json = JSON.stringify(profils);
    const candidats = await getDb().select().from(schema.candidat);
    for (const c of candidats) {
      expect(json).not.toContain(c.telephone!.slice(4));
      expect(json).not.toContain(c.whatsapp!.slice(4));
      expect(json).not.toContain(c.email!);
    }
    expect(json).not.toContain('pharmacie');
    expect(json).not.toContain('Ngo"');
    expect(json).not.toContain('Restaurant Le Wouri');
    expect(json).not.toContain(TEL_CANDIDAT.slice(-6));
  });

  it('RG-07 : 5 mauvais essais → blocage 30 min, tentatives journalisées ; accès possible après expiration', async () => {
    const ctx = await ctxSuivi();
    const t0 = new Date();
    for (let i = 1; i <= 4; i++) {
      const r = await client.verifierChiffres(ctx, '0000', '10.0.0.1', t0);
      expect(r).toMatchObject({ ok: false, essaisRestants: 5 - i });
    }
    const cinquieme = await client.verifierChiffres(ctx, '0000', '10.0.0.1', t0);
    expect(cinquieme.ok).toBe(false);
    expect(!cinquieme.ok && cinquieme.bloqueJusquA!.getTime()).toBe(t0.getTime() + BLOCAGE_VERIFICATION_MS);
    // Bons chiffres pendant le blocage : refusés.
    const pendant = await client.verifierChiffres(ctx, '1122', '10.0.0.1', new Date(t0.getTime() + 10 * 60_000));
    expect(pendant.ok).toBe(false);
    expect(await client.blocageEnCours(ctx.cle, new Date(t0.getTime() + 10 * 60_000))).not.toBeNull();

    const echecs = await journal('verification_client.echec');
    expect(echecs).toHaveLength(5);
    expect(echecs.every((e) => e.acteurType === 'client' && e.ip === '10.0.0.1' && e.objetType === 'dossier' && e.objetId === String(dossierId))).toBe(true);
    expect(await journal('verification_client.bloquee')).toHaveLength(1);

    // Après 30 min : bons chiffres acceptés, compteur remis à zéro.
    const apres = new Date(t0.getTime() + BLOCAGE_VERIFICATION_MS + 1000);
    expect(await client.verifierChiffres(ctx, '1122', '10.0.0.1', apres)).toEqual({ ok: true });
    expect(await journal('verification_client.reussie')).toHaveLength(1);
    const [v] = await getDb().select().from(schema.verificationClient).where(eq(schema.verificationClient.cle, ctx.cle));
    expect(v).toMatchObject({ echecs: 0, bloqueJusquA: null });
    // Un échec isolé après un blocage échu repart de zéro.
    expect(await client.verifierChiffres(ctx, '9999', null, new Date(apres.getTime() + 1000))).toMatchObject({ ok: false, essaisRestants: 4 });
  });

  it('RG-07 : le cookie de vérification est lié au dossier et au jeton (régénération → invalide)', async () => {
    const ctx = await ctxSuivi();
    const { env } = await import('@/lib/env');
    const valeur = client.signerVerification({ portee: ctx.cle, jeton: ctx.jeton, expireLe: Date.now() + 60_000 }, env().BETTER_AUTH_SECRET);
    expect(client.contexteVerifie(ctx, valeur)).toBe(true);
    expect(client.contexteVerifie({ ...ctx, jeton: `${ctx.jeton}autre` }, valeur)).toBe(false);
    expect(client.contexteVerifie({ ...ctx, cle: 'dossier:999999' }, valeur)).toBe(false);
  });

  it('RG-09 : CV PDF filigrané, consultation journalisée ; profil non transmis refusé', async () => {
    const c = await nouveauCandidat('Chantal', 'Eto');
    const p = await proposer(c.id);
    const doc = await PDFDocument.create();
    doc.addPage().drawText('CV de Chantal', { font: await doc.embedFont(StandardFonts.Helvetica), x: 50, y: 700 });
    const cle = `candidats/test/${c.id}-cv.pdf`;
    await getStockage().deposer(cle, await doc.save());
    await getDb().insert(schema.candidatDocument).values({ candidatId: c.id, categorie: 'cv', cle, nomOrigine: 'mon-cv.pdf', mime: 'application/pdf', taille: 1000 });
    const ctx = await ctxSuivi();
    expect((await client.profilsTransmis(ctx)).find((x) => x.propositionId === p)!.aCv).toBe(true);

    const cv = await client.lireCvTransmis(ctx, p, '10.0.0.2');
    expect(cv!.mime).toBe('application/pdf');
    expect(cv!.nom).toBe('CV-Chantal-E.pdf');
    const sortie = await PDFDocument.load(cv!.octets);
    expect(sortie.getPageCount()).toBe(1);
    const [entree] = await journal('proposition.cv_consulte');
    expect(entree).toMatchObject({ acteurType: 'client', objetType: 'proposition', objetId: String(p), ip: '10.0.0.2' });
    expect(entree!.details).toMatchObject({ documentId: expect.any(Number), via: 'suivi' });

    const enAttente = await proposer((await nouveauCandidat('Diane', 'Fouda')).id, 'en_attente_accord');
    await expect(client.lireCvTransmis(ctx, enAttente, null)).rejects.toThrow('plus disponible');
  });

  it('RG-11 : retour du client → proposition annotée, référent notifié, statut inchangé', async () => {
    const c = await nouveauCandidat('Estelle', 'Kana');
    const p = await proposer(c.id);
    const ctx = await ctxSuivi();
    await client.enregistrerRetourClient(ctx, p, 'ne_correspond_pas', '  Trop loin ', '10.0.0.3');
    const [prop] = await getDb().select().from(schema.proposition).where(eq(schema.proposition.id, p));
    expect(prop).toMatchObject({ statut: 'proposee', retourClient: 'ne_correspond_pas', retourClientMotif: 'Trop loin' });
    expect(prop!.retourClientLe).toBeInstanceOf(Date);
    const notifs = await getDb()
      .select()
      .from(schema.notification)
      .where(and(eq(schema.notification.destinataireId, refId), eq(schema.notification.type, 'proposition_retour_client')));
    expect(notifs).toHaveLength(1);
    expect(notifs[0]!.lien).toBe(`/admin/dossiers/${dossierId}#propositions`);
    // Même réponse renvoyée : pas de nouvelle notification.
    await client.enregistrerRetourClient(ctx, p, 'ne_correspond_pas', 'Trop loin', null);
    await client.enregistrerRetourClient(ctx, p, 'rencontrer', null, null);
    const apres = await getDb().select().from(schema.notification).where(eq(schema.notification.type, 'proposition_retour_client'));
    expect(apres).toHaveLength(2);
    expect((await getDb().select().from(schema.proposition).where(eq(schema.proposition.id, p)))[0]).toMatchObject({ statut: 'proposee', retourClient: 'rencontrer', retourClientMotif: null });
    expect(await journal('proposition.retour_client')).toHaveLength(2);
  });

  it('RG-16 : confirmation de la prise de poste par le client → placement confirmé, proposition placée ; attestation téléchargeable', async () => {
    const c = await nouveauCandidat('Fanny', 'Ondoa');
    const p = await proposer(c.id, 'retenue');
    const [pl] = await getDb().insert(schema.placement).values({ propositionId: p, dossierId, lignePosteId: ligneId, candidatId: c.id, datePrevue: '2026-11-10', poste: 'Serveur' }).returning();
    const ctx = await ctxSuivi();
    expect((await client.placementsClient(ctx)).find((x) => x.placementId === pl!.id)).toMatchObject({ statut: 'annonce', nom: 'Fanny O.', datePrevue: '2026-11-10' });

    const att = await client.attestationPourClient(ctx, pl!.id, '10.0.0.4');
    expect((await PDFDocument.load(att.octets)).getPageCount()).toBe(1);
    expect(await journal('placement.attestation_telechargee')).toHaveLength(1);

    await expect(client.confirmerPriseDePoste(ctx, pl!.id, { signataireNom: 'Paul Kamga', signataireFonction: '' }, null)).rejects.toThrow('fonction');
    await expect(client.confirmerPriseDePoste(ctx, pl!.id, { signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', datePriseDePoste: '2026-02-31' }, null)).rejects.toThrow('invalide');
    await client.confirmerPriseDePoste(ctx, pl!.id, { signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', datePriseDePoste: '2026-11-12' }, '10.0.0.4');
    expect((await getDb().select().from(schema.placement).where(eq(schema.placement.id, pl!.id)))[0]).toMatchObject({
      statut: 'confirme',
      confirmationMode: 'client',
      datePriseDePoste: '2026-11-12',
      signataireNom: 'Paul Kamga',
      signataireFonction: 'Gérant',
      confirmationIp: '10.0.0.4',
    });
    expect((await getDb().select().from(schema.proposition).where(eq(schema.proposition.id, p)))[0]!.statut).toBe('placee');
    await expect(client.confirmerPriseDePoste(ctx, pl!.id, { signataireNom: 'X', signataireFonction: 'Y' }, null)).rejects.toThrow('plus à confirmer');
    // Attestation après confirmation : signataire pré-rempli.
    const d = await client.donneesAttestation(pl!.id);
    expect(d!.confirmation).toMatchObject({ signataireNom: 'Paul Kamga', datePriseDePoste: '2026-11-12' });
    expect(d!.garantieJours).toBe(15);
  });

  it('RG-10 : lien temporaire valide → profil seul ; expiré, révoqué ou proposition non transmise → refusé', async () => {
    const c = await nouveauCandidat('Grace', 'Abena');
    const p = await proposer(c.id);
    const ok = await nouvelAcces(p);
    const ctx = await client.chargerContexteAcces(ok.jeton);
    expect(ctx).toMatchObject({ type: 'acces', cle: `acces:${ok.id}`, propositionId: p, objet: 'profil', chemin: `/profil/${ok.jeton}` });
    const profils = await client.profilsTransmis(ctx!);
    expect(profils.map((x) => x.propositionId)).toEqual([p]);
    expect(await client.placementsClient(ctx!)).toEqual([]);
    // Vérification propre au lien (clé acces:<id>).
    expect(await client.verifierChiffres(ctx!, '1122', null)).toEqual({ ok: true });
    expect((await journal('verification_client.reussie')).at(-1)).toMatchObject({ objetType: 'acces_profil', objetId: String(ok.id) });

    expect(await client.chargerContexteAcces((await nouvelAcces(p, { expireLe: new Date(Date.now() - 1000) })).jeton)).toBeNull();
    expect(await client.chargerContexteAcces((await nouvelAcces(p, { revoqueLe: new Date() })).jeton)).toBeNull();
    const enAttente = await proposer((await nouveauCandidat('Hawa', 'Bello')).id, 'en_attente_accord');
    expect(await client.chargerContexteAcces((await nouvelAcces(enAttente)).jeton)).toBeNull();
    expect(await client.chargerContexteAcces(genererJetonAcces())).toBeNull();
    expect(await client.chargerContexteAcces('trop-court')).toBeNull();
  });

  it('RG-15 : lien temporaire « attestation » → placement seul, confirmation possible ; pas de profil', async () => {
    const c = await nouveauCandidat('Inès', 'Manga');
    const p = await proposer(c.id, 'retenue');
    const [pl] = await getDb().insert(schema.placement).values({ propositionId: p, dossierId, lignePosteId: ligneId, candidatId: c.id, datePrevue: '2026-11-15', poste: 'Serveur' }).returning();
    const acces = await nouvelAcces(p, { objet: 'attestation' });
    const ctx = (await client.chargerContexteAcces(acces.jeton))!;
    expect(await client.profilsTransmis(ctx)).toEqual([]);
    expect((await client.placementsClient(ctx)).map((x) => x.placementId)).toEqual([pl!.id]);
    await expect(client.lireCvTransmis(ctx, p, null)).rejects.toThrow();
    await client.confirmerPriseDePoste(ctx, pl!.id, { signataireNom: 'Paul Kamga', signataireFonction: 'Gérant' }, null);
    expect((await getDb().select().from(schema.placement).where(eq(schema.placement.id, pl!.id)))[0]).toMatchObject({ statut: 'confirme', datePriseDePoste: '2026-11-15' });
    // Un lien « profil » ne permet pas de confirmer un placement.
    const lienProfil = (await client.chargerContexteAcces((await nouvelAcces(p)).jeton))!;
    await expect(client.attestationPourClient(lienProfil, pl!.id, null)).rejects.toThrow();
  });

  it('RG-23 : accès révoqué ou recherche clôturée → plus rien pour les non placés', async () => {
    const c = await nouveauCandidat('Julie', 'Nkoulou');
    const p = await proposer(c.id);
    const lien = await nouvelAcces(p);
    let ctx = await ctxSuivi();
    expect((await client.profilsTransmis(ctx)).some((x) => x.propositionId === p)).toBe(true);
    await getDb().update(schema.proposition).set({ accesRevoqueLe: new Date() }).where(eq(schema.proposition.id, p));
    expect((await client.profilsTransmis(ctx)).some((x) => x.propositionId === p)).toBe(false);
    expect(await client.chargerContexteAcces(lien.jeton)).toBeNull();
    await expect(client.enregistrerRetourClient(ctx, p, 'rencontrer', null, null)).rejects.toThrow('plus disponible');

    // Clôture de la recherche : seuls les placés restent visibles.
    await getDb().update(schema.dossier).set({ rechercheClotureLe: new Date(), statut: 'placements_confirmes' }).where(eq(schema.dossier.id, dossierId));
    ctx = await ctxSuivi();
    expect(ctx.ferme).toBe(true);
    const restants = await client.profilsTransmis(ctx);
    expect(restants.length).toBeGreaterThan(0);
    expect(restants.every((x) => x.statut === 'Placé(e)')).toBe(true);
  });
});
