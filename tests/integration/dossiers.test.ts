// Tests d'intégration des dossiers (specs/MVP1-02) sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Dossiers (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-docs-'));

  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const svc = await import('@/lib/dossiers/service');
  const lecture = await import('@/lib/dossiers/lecture');
  const collab = await import('@/lib/collaborateurs/service');
  const geo = await import('@/lib/geo/service');

  type Acteur = Awaited<typeof svc>['changerStatut'] extends (a: number, b: never, c: never, d: infer A) => unknown ? A : never;
  let referentA: Acteur;
  let referentB: Acteur;
  let direction: Acteur;
  let finances: Acteur;
  let douala: number;

  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, ...new Array(64).fill(0x20)]);

  const demandeRec = (whatsapp = '690000000', extra: Record<string, unknown> = {}) => ({
    type: 'REC' as const,
    canal: 'site' as const,
    formulaire: 'demande-personnel',
    client: { type: 'entreprise' as const, nom: 'Hôtel Akwa Palace', contact: 'M. Ekwalla', whatsapp },
    villeId: douala,
    villeAutre: null,
    quartierId: null,
    quartierAutre: null,
    lieu: 'Akwa',
    secteur: 'Hôtellerie',
    description: null,
    lignes: [
      { intitule: 'Serveur', nombre: 3, salaire: '80 000 FCFA', typeContrat: 'CDD', duree: '6 mois' },
      { intitule: 'Cuisinier', nombre: 2, typeContrat: 'CDI' },
    ],
    donnees: { postes: ['Serveur x3', 'Cuisinier x2'], ...extra },
  });

  async function attribuer(dossierId: number, a: Acteur) {
    await getDb().update(schema.dossier).set({ referentId: a.id, statut: 'attribuee' }).where(eq(schema.dossier.id, dossierId));
  }

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    douala = (await getDb().select().from(schema.ville).where(eq(schema.ville.nom, 'Douala')))[0]!.id;
    const mk = async (email: string, roles: ('referent' | 'direction' | 'finances')[]) => ({ id: (await collab.creerCollaborateur({ nom: email, email, roles }, { id: null })).userId, roles });
    referentA = await mk('a@nexclean.test', ['referent']);
    referentB = await mk('b@nexclean.test', ['referent']);
    direction = await mk('dir@nexclean.test', ['direction']);
    finances = await mk('fin@nexclean.test', ['finances']);
  });

  it('RG-03/04 : un seul dossier REC avec 2 lignes et 5 personnes ; client créé', async () => {
    const r = await svc.creerDemande(demandeRec());
    expect(r.numero).toMatch(/^REC-\d{4}-00001$/);
    const fiche = await lecture.lireDossier(r.dossierId, direction);
    if (!fiche || fiche === 'interdit') throw new Error('fiche');
    expect(fiche.lignes.map((l) => [l.intitule, l.nombre])).toEqual([['Serveur', 3], ['Cuisinier', 2]]);
    expect(fiche.client.whatsapp).toBe('+237690000000');
    expect(fiche.dossier.statut).toBe('nouvelle_demande');
    expect(fiche.evenements.map((e) => e.ev.type)).toContain('creation');
  });

  it('RG-03 : « 690 00 00 00 » est rattaché au client « +237690000000 », sans écraser ses données', async () => {
    const r = await svc.creerDemande({ ...demandeRec('690 00 00 00', { autre: 1 }), client: { type: 'entreprise', nom: 'Autre Nom', contact: null, whatsapp: '690 00 00 00' } });
    expect(r.coordonneesDifferentes).toBe(true);
    const clients = await getDb().select().from(schema.client).where(eq(schema.client.whatsapp, '+237690000000'));
    expect(clients).toHaveLength(1);
    expect(clients[0]!.nom).toBe('Hôtel Akwa Palace');
  });

  it('anti-doublon : la même soumission dans les 10 min renvoie le même dossier', async () => {
    const a = await svc.creerDemande(demandeRec('677111111'));
    const b = await svc.creerDemande(demandeRec('677111111'));
    expect(b).toMatchObject({ dossierId: a.dossierId, doublon: true });
  });

  it('RG-01 : 20 soumissions simultanées → 20 numéros distincts', async () => {
    const resultats = await Promise.all(Array.from({ length: 20 }, (_, i) => svc.creerDemande(demandeRec(`6991000${String(i).padStart(2, '0')}`))));
    expect(new Set(resultats.map((r) => r.numero)).size).toBe(20);
  });

  it('RG-06 : modifier une ligne ne change pas la Demande ; l’historique garde avant/après', async () => {
    const r = await svc.creerDemande(demandeRec('671000001'));
    await attribuer(r.dossierId, referentA);
    await svc.remplacerLignes(r.dossierId, [{ intitule: 'Serveur', nombre: 5 }], referentA);
    const fiche = await lecture.lireDossier(r.dossierId, referentA);
    if (!fiche || fiche === 'interdit') throw new Error('fiche');
    expect(fiche.lignes[0]!.nombre).toBe(5);
    expect(fiche.demandes[0]!.donnees).toMatchObject({ postes: ['Serveur x3', 'Cuisinier x2'] });
    const modif = fiche.evenements.find((e) => e.ev.type === 'modification')!;
    expect(modif.ev.avant).toEqual(expect.arrayContaining([expect.objectContaining({ intitule: 'Serveur', nombre: 3 })]));
  });

  it('M1-ROL-04 : un Référent ne voit pas le dossier d’un autre ; le Responsable finances lit tout sans salaire', async () => {
    const r = await svc.creerDemande(demandeRec('671000002'));
    await attribuer(r.dossierId, referentB);
    expect(await lecture.lireDossier(r.dossierId, referentA)).toBe('interdit');
    const vueFin = await lecture.lireDossier(r.dossierId, finances);
    if (!vueFin || vueFin === 'interdit') throw new Error('fiche');
    expect(vueFin.lignes[0]!.salaire).toBeNull();
    const vueB = await lecture.lireDossier(r.dossierId, referentB);
    if (!vueB || vueB === 'interdit') throw new Error('fiche');
    expect(vueB.lignes[0]!.salaire).toBe('80 000 FCFA');
    await expect(svc.ajouterNote(r.dossierId, 'test', referentA)).rejects.toThrow(/Accès refusé/);
    await expect(svc.ajouterNote(r.dossierId, 'test', finances)).rejects.toThrow(/Accès refusé/);
    const liste = await lecture.listerDossiers(referentA, {});
    expect(liste.lignes.every((l) => l.referentId === referentA.id)).toBe(true);
  });

  describe('transitions', () => {
    it('RG-15 : « À compléter » exige un commentaire ; RG-17 : chaque transition est historisée', async () => {
      const r = await svc.creerDemande(demandeRec('671000003'));
      await attribuer(r.dossierId, referentA);
      await svc.changerStatut(r.dossierId, 'en_qualification', null, referentA);
      await expect(svc.changerStatut(r.dossierId, 'a_completer', null, referentA)).rejects.toThrow('Indiquez les informations manquantes.');
      await svc.changerStatut(r.dossierId, 'a_completer', 'Horaires manquants', referentA);
      const evs = await getDb().select().from(schema.evenementDossier).where(eq(schema.evenementDossier.dossierId, r.dossierId));
      expect(evs.filter((e) => e.type === 'transition').map((e) => [e.deStatut, e.versStatut, e.commentaire])).toEqual([
        ['attribuee', 'en_qualification', null],
        ['en_qualification', 'a_completer', 'Horaires manquants'],
      ]);
    });

    it('RG-16 : « Devis prêt » exige un devis externe joint ; « Acompte reçu » un justificatif', async () => {
      const r = await svc.creerDemande(demandeRec('671000004'));
      await attribuer(r.dossierId, referentA);
      await svc.changerStatut(r.dossierId, 'en_qualification', null, referentA);
      await expect(svc.changerStatut(r.dossierId, 'devis_pret', null, referentA)).rejects.toThrow(/devis/);
      await svc.ajouterDocument(r.dossierId, { nom: 'devis.pdf', octets: PDF }, 'devis_externe', referentA);
      await svc.changerStatut(r.dossierId, 'devis_pret', null, referentA);
      await svc.changerStatut(r.dossierId, 'devis_envoye', null, referentA);
      await svc.changerStatut(r.dossierId, 'accepte', null, referentA);
      await expect(svc.changerStatut(r.dossierId, 'acompte_recu', '25 000 MoMo réf. MP1', referentA)).rejects.toThrow(/justificatif/);
      await svc.ajouterDocument(r.dossierId, { nom: 'recu.pdf', octets: PDF }, 'justificatif', referentA);
      await svc.changerStatut(r.dossierId, 'acompte_recu', '25 000 MoMo réf. MP1', referentA);
    });

    it('RG-18 : un dossier clôturé n’est rouvrable que par la Direction', async () => {
      const r = await svc.creerDemande(demandeRec('671000005'));
      await attribuer(r.dossierId, referentA);
      await svc.changerStatut(r.dossierId, 'sans_suite', 'Client injoignable', referentA);
      await expect(svc.changerStatut(r.dossierId, 'en_qualification', 'retour', referentA)).rejects.toThrow(/Direction/);
      await svc.changerStatut(r.dossierId, 'en_qualification', 'Le client a rappelé', direction);
      const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, r.dossierId));
      expect(d).toMatchObject({ statut: 'en_qualification', fermeLe: null });
    });
  });

  it('RG-08 : rattacher l’unique demande de A à B passe A « Sans suite — Fusionné dans B »', async () => {
    const a = await svc.creerDemande(demandeRec('672000001', { n: 1 }));
    const b = await svc.creerDemande(demandeRec('672000001', { n: 2 }));
    await attribuer(a.dossierId, referentA);
    await attribuer(b.dossierId, referentA);
    const [demA] = await getDb().select().from(schema.demande).where(eq(schema.demande.dossierId, a.dossierId));
    await svc.rattacherDemande(demA!.id, b.dossierId, referentA);
    const [dA] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, a.dossierId));
    expect(dA!.statut).toBe('sans_suite');
    const evA = await getDb().select().from(schema.evenementDossier).where(eq(schema.evenementDossier.dossierId, a.dossierId));
    expect(evA.some((e) => e.commentaire === `Fusionné dans ${b.numero}`)).toBe(true);
    expect(await getDb().select().from(schema.demande).where(eq(schema.demande.dossierId, b.dossierId))).toHaveLength(2);
  });

  it('saisie manuelle avec « Me l’attribuer » : dossier attribué au référent', async () => {
    const r = await svc.creerDemande({ ...demandeRec('673000001'), canal: 'whatsapp', formulaire: 'saisie', meLAttribuer: true }, referentA);
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, r.dossierId));
    expect(d).toMatchObject({ referentId: referentA.id, statut: 'attribuee' });
  });

  it('RG-02 : changement de type → numéro inchangé ; refusé après l’envoi du devis', async () => {
    const r = await svc.creerDemande({ ...demandeRec('674000001'), type: 'NET', lignes: [], formulaire: 'devis' });
    await attribuer(r.dossierId, referentA);
    await svc.changerType(r.dossierId, 'ABO', referentA);
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, r.dossierId));
    expect(d).toMatchObject({ type: 'ABO', numero: r.numero });
    expect(r.numero.startsWith('NET-')).toBe(true);
  });

  describe('documents (M1-DOC-03..05)', () => {
    it('téléverse, relit (journalisé) et refuse la lecture hors périmètre', async () => {
      const r = await svc.creerDemande(demandeRec('675000001'));
      await attribuer(r.dossierId, referentA);
      const id = await svc.ajouterDocument(r.dossierId, { nom: 'cv.pdf', octets: PDF }, 'piece_client', referentA);
      const lu = await svc.lireDocument(id, referentA);
      expect(lu).toMatchObject({ nom: 'cv.pdf', mime: 'application/pdf' });
      await expect(svc.lireDocument(id, referentB)).rejects.toThrow(/Accès refusé/);
      const refus = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'acces.refuse'));
      expect(refus.some((j) => j.objetId === String(id))).toBe(true);
    });

    it('refuse un exécutable renommé en .pdf', async () => {
      const r = await svc.creerDemande(demandeRec('675000002'));
      await attribuer(r.dossierId, referentA);
      await expect(svc.ajouterDocument(r.dossierId, { nom: 'cv.pdf', octets: new Uint8Array([0x4d, 0x5a, 0, 0]) }, 'piece_client', referentA)).rejects.toThrow('Format de fichier non accepté.');
    });

    it('suppression : l’auteur dans les 24 h ou la Direction ; puis purge à 30 jours', async () => {
      const r = await svc.creerDemande(demandeRec('675000003'));
      await attribuer(r.dossierId, referentA);
      const id = await svc.ajouterDocument(r.dossierId, { nom: 'a.pdf', octets: PDF }, 'autre', referentA);
      await expect(svc.supprimerDocument(id, referentA, new Date(Date.now() + 25 * 3600_000))).rejects.toThrow(/24 h/);
      await svc.supprimerDocument(id, direction);
      await expect(svc.lireDocument(id, direction)).rejects.toThrow(/introuvable/);
      expect(await svc.purgerDocuments(new Date(Date.now() + 31 * 86_400_000))).toBeGreaterThanOrEqual(1);
    });
  });

  describe('page de suivi (RG-24..29)', () => {
    it('affiche le statut sans montant ; un lien régénéré invalide l’ancien', async () => {
      const r = await svc.creerDemande(demandeRec('676000001'));
      await attribuer(r.dossierId, referentA);
      const vue = await svc.lireSuivi(r.jetonSuivi, '1.2.3.4');
      expect(vue).toMatchObject({ numero: r.numero, statut: 'attribuee', contact: 'M. Ekwalla' });
      expect(Object.keys(vue!)).not.toContain('salaire');
      const nouveau = await svc.regenererJetonSuivi(r.dossierId, referentA);
      expect(await svc.lireSuivi(r.jetonSuivi, null)).toBeNull();
      expect(await svc.lireSuivi(nouveau, null)).not.toBeNull();
    });

    it('expire 90 jours après la fermeture', async () => {
      const r = await svc.creerDemande(demandeRec('676000002'));
      await attribuer(r.dossierId, referentA);
      await svc.changerStatut(r.dossierId, 'sans_suite', 'test', referentA);
      expect(await svc.lireSuivi(r.jetonSuivi, null, new Date(Date.now() + 89 * 86_400_000))).not.toBeNull();
      expect(await svc.lireSuivi(r.jetonSuivi, null, new Date(Date.now() + 91 * 86_400_000))).toBeNull();
    });
  });

  it('RG-21 : recherche par numéro, nom et téléphone', async () => {
    const r = await svc.creerDemande({ ...demandeRec('677999888'), client: { type: 'particulier', nom: 'Mme Ngono', contact: null, whatsapp: '677999888' } });
    expect((await lecture.listerDossiers(direction, { q: r.numero })).lignes.map((l) => l.id)).toEqual([r.dossierId]);
    expect((await lecture.listerDossiers(direction, { q: 'ngono' })).lignes.map((l) => l.id)).toContain(r.dossierId);
    expect((await lecture.listerDossiers(direction, { q: '77 99 98' })).lignes.map((l) => l.id)).toContain(r.dossierId);
  });

  it('RG-05 : fusion de clients par la Direction', async () => {
    const a = await svc.creerDemande({ ...demandeRec('678000001'), client: { type: 'entreprise', nom: 'Société X', contact: null, whatsapp: '678000001' } });
    const b = await svc.creerDemande({ ...demandeRec('678000002'), client: { type: 'entreprise', nom: 'Société X bis', contact: null, whatsapp: '678000002' } });
    const [da] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, a.dossierId));
    const [db_] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, b.dossierId));
    await expect(svc.fusionnerClients(da!.clientId, db_!.clientId, referentA)).rejects.toThrow(/Accès refusé/);
    await svc.fusionnerClients(da!.clientId, db_!.clientId, direction);
    const [apres] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, b.dossierId));
    expect(apres!.clientId).toBe(da!.clientId);
  });
});
