// MVP2-03 lot A : Propositions, Placements et clôture de la recherche côté référent
// (lib/propositions/service.ts), sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Propositions — référent (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-propositions-'));

  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const dossiers = await import('@/lib/dossiers/service');
  const svc = await import('@/lib/propositions/service');
  const effets = await import('@/lib/propositions/effets');
  const domaine = await import('@/lib/propositions/domaine');
  const jetons = await import('@/lib/propositions/jetons');
  const statuts = await import('@/lib/dossiers/statuts');
  const collab = await import('@/lib/collaborateurs/service');

  type R = 'referent' | 'direction';
  type Acteur = { id: string; nom: string; roles: R[]; ip: string };
  let dir: Acteur;
  let rita: Acteur;
  let autre: Acteur;
  let sansRec: Acteur;
  let seq = 0;

  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)]);
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, ...new Array(64).fill(0x20)]);
  const capture = () => ({ nom: 'capture.png', octets: PNG });
  const preuve = () => ({ nom: 'attestation.pdf', octets: PDF });
  const HIER = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  async function collaborateur(nom: string, roles: R[], services: ('REC' | 'NET')[]): Promise<Acteur> {
    const { userId } = await collab.creerCollaborateur({ nom, email: `${nom.toLowerCase()}@propositions.test`, roles }, { id: null });
    if (services.length) await collab.definirAttributs(userId, { services, villeIds: [], telephone: null, capacite: null, absentDu: null, absentAu: null }, { id: null });
    return { id: userId, nom, roles, ip: '10.0.0.2' };
  }

  /** Dossier REC attribué à `referent`, au statut demandé ; acompte encaissé il y a `acompteIlYa` jours. */
  async function nouveauDossier(referent: Acteur, lignes: { intitule: string; nombre: number }[], statut: 'recherche_en_cours' | 'accepte' = 'recherche_en_cours', acompteIlYa: number | null = 5) {
    const r = await dossiers.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: `Client ${++seq}`, contact: 'M. Kamga', whatsapp: `+2376990${String(seq).padStart(5, '0')}` },
      villeId: null,
      villeAutre: 'Douala',
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: null,
      description: null,
      lignes,
      donnees: { n: seq },
    });
    await getDb().update(schema.dossier).set({ referentId: referent.id, statut }).where(eq(schema.dossier.id, r.dossierId));
    if (acompteIlYa !== null) {
      await getDb().insert(schema.evenementDossier).values({ dossierId: r.dossierId, type: 'transition', deStatut: 'accepte', versStatut: 'acompte_recu', horodatage: new Date(Date.now() - acompteIlYa * 86_400_000) });
    }
    const l = await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, r.dossierId)).orderBy(schema.lignePoste.ordre);
    return { id: r.dossierId, lignes: l.map((x) => x.id) };
  }

  const nouveauCandidat = async (statut: 'preselectionne' | 'indisponible' | 'place' = 'preselectionne', prenom = 'Awa') => {
    const [c] = await getDb()
      .insert(schema.candidat)
      .values({ nom: 'Ngo', prenom, telephone: `+2376903${String(++seq).padStart(5, '0')}`, statut, metiers: ['Serveur'] })
      .returning();
    return c!.id;
  };
  const proposition = async (id: number) => (await getDb().select().from(schema.proposition).where(eq(schema.proposition.id, id)))[0]!;
  const placement = async (id: number) => (await getDb().select().from(schema.placement).where(eq(schema.placement.id, id)))[0]!;
  const dossier = async (id: number) => (await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, id)))[0]!;
  const candidat = async (id: number) => (await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, id)))[0]!;

  /** Proposition « proposée » (accord WhatsApp enregistré). */
  async function proposee(d: { id: number; lignes: number[] }, ligne = 0, a: Acteur = rita) {
    const c = await nouveauCandidat();
    const { propositionId } = await svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[ligne]!, candidatId: c }, a);
    await svc.enregistrerAccordWhatsApp(propositionId, { fichier: capture(), date: HIER, numeroCommunicable: false }, a);
    return { candidatId: c, propositionId };
  }

  /** Proposition retenue puis placement confirmé sur preuve. */
  async function placementConfirme(d: { id: number; lignes: number[] }, datePriseDePoste: string, ligne = 0) {
    const { candidatId, propositionId } = await proposee(d, ligne);
    await svc.changerStatutProposition(propositionId, 'retenue', {}, rita);
    const { placementId } = await svc.annoncerPlacement(propositionId, { datePrevue: datePriseDePoste }, rita);
    await svc.confirmerPlacementParPreuve(placementId, { fichier: preuve(), datePriseDePoste }, rita);
    return { candidatId, propositionId, placementId };
  }

  beforeAll(async () => {
    await reinitialiserBase();
    dir = await collaborateur('Dir', ['direction'], []);
    rita = await collaborateur('Rita', ['referent'], ['REC']);
    autre = await collaborateur('Omar', ['referent'], ['REC']);
    sansRec = await collaborateur('Nina', ['referent'], ['NET']);
  }, 120_000);

  describe('Création (RG-02, RG-05) et droits', () => {
    it('RG-02 : refusée si le Dossier n’est pas « Recherche en cours » ou « Candidats proposés »', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }], 'accepte');
      await expect(svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: await nouveauCandidat() }, rita)).rejects.toThrow(domaine.MESSAGE_STATUT_DOSSIER_PROPOSITION);
    });

    it('droits : un autre référent est refusé ; un référent sans service Recrutement aussi', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }]);
      const c = await nouveauCandidat();
      await expect(svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: c }, autre)).rejects.toThrow('Accès refusé à ce dossier.');
      await expect(svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: c }, sansRec)).rejects.toThrow(svc.MESSAGE_VIVIER);
      // La Direction peut proposer sur tout dossier.
      const { propositionId } = await svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: c }, dir);
      await expect(svc.changerStatutProposition(propositionId, 'retiree', { motif: 'Test' }, autre)).rejects.toThrow('Accès refusé');
      await expect(svc.creerLienAcces(propositionId, 'profil', autre)).rejects.toThrow('Accès refusé');
    });

    it('création : « en attente d’accord », client figé, candidat notifié dans son espace, historique et journal', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 2 }]);
      const c = await nouveauCandidat();
      const r = await svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: c, salaireCommunicable: true }, rita);
      expect(r.avertissements).toEqual([]);
      const p = await proposition(r.propositionId);
      expect(p).toMatchObject({ statut: 'en_attente_accord', clientId: (await dossier(d.id)).clientId, salaireCommunicable: true, auteurId: rita.id });
      const notifs = await getDb().select().from(schema.notificationCandidat).where(eq(schema.notificationCandidat.candidatId, c));
      expect(notifs).toHaveLength(1);
      expect(notifs[0]!.texte).toContain('Serveur');
      const evs = await getDb().select().from(schema.evenementDossier).where(and(eq(schema.evenementDossier.dossierId, d.id), eq(schema.evenementDossier.type, 'proposition')));
      expect(evs.at(-1)!.commentaire).toContain('en attente de son accord');
      const j = await getDb().select().from(schema.journalAudit).where(and(eq(schema.journalAudit.action, 'proposition.creee'), eq(schema.journalAudit.objetId, String(r.propositionId))));
      expect(j).toHaveLength(1);
    });

    it('RG-05 : une seule Proposition active par ligne ; avertissement si actif chez un autre client ou déjà placé', async () => {
      const d1 = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 2 }, { intitule: 'Cuisinier', nombre: 1 }]);
      const d2 = await nouveauDossier(rita, [{ intitule: 'Plongeur', nombre: 1 }]);
      const c = await nouveauCandidat();
      await svc.creerProposition({ dossierId: d1.id, lignePosteId: d1.lignes[0]!, candidatId: c }, rita);
      await expect(svc.creerProposition({ dossierId: d1.id, lignePosteId: d1.lignes[0]!, candidatId: c }, rita)).rejects.toThrow(svc.MESSAGE_DEJA_PROPOSE);
      // Autre ligne du même client : pas d'avertissement multi-clients.
      expect((await svc.creerProposition({ dossierId: d1.id, lignePosteId: d1.lignes[1]!, candidatId: c }, rita)).avertissements).toEqual([]);
      // Autre client : autorisé, avec avertissement nommant le client.
      const client1 = (await getDb().select().from(schema.client).where(eq(schema.client.id, (await dossier(d1.id)).clientId)))[0]!;
      const r = await svc.creerProposition({ dossierId: d2.id, lignePosteId: d2.lignes[0]!, candidatId: c }, rita);
      expect(r.avertissements.join(' ')).toContain(client1.nom);
      // Candidat déjà placé.
      const place = await nouveauCandidat('place');
      expect((await svc.creerProposition({ dossierId: d1.id, lignePosteId: d1.lignes[0]!, candidatId: place }, rita)).avertissements).toContain('Ce candidat est déjà placé.');
    });

    it('candidat indisponible ou supprimé : refusé', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }]);
      await expect(svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: await nouveauCandidat('indisponible') }, rita)).rejects.toThrow('indisponible');
      const sup = await nouveauCandidat();
      await getDb().update(schema.candidat).set({ supprimeLe: new Date() }).where(eq(schema.candidat.id, sup));
      await expect(svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: sup }, rita)).rejects.toThrow('Candidat introuvable.');
    });
  });

  describe('Accord, statuts (RG-03, RG-04, RG-06, RG-12, RG-13)', () => {
    it('RG-03 (WhatsApp) : sans capture, l’enregistrement est refusé ; un fichier non image/PDF aussi', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }]);
      const { propositionId } = await svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: await nouveauCandidat() }, rita);
      await expect(svc.enregistrerAccordWhatsApp(propositionId, { fichier: null, date: HIER, numeroCommunicable: false }, rita)).rejects.toThrow('capture');
      await expect(svc.enregistrerAccordWhatsApp(propositionId, { fichier: { nom: 'x.png', octets: new Uint8Array(0) }, date: HIER, numeroCommunicable: false }, rita)).rejects.toThrow('capture');
      await expect(svc.enregistrerAccordWhatsApp(propositionId, { fichier: { nom: 'x.txt', octets: new Uint8Array([1, 2, 3]) }, date: HIER, numeroCommunicable: false }, rita)).rejects.toThrow('Format');
      await expect(svc.enregistrerAccordWhatsApp(propositionId, { fichier: capture(), date: '2999-01-01', numeroCommunicable: false }, rita)).rejects.toThrow('futur');
      expect((await proposition(propositionId)).statut).toBe('en_attente_accord');
    });

    it('RG-03, RG-06 : accord WhatsApp avec capture → « proposée », Dossier « Candidats proposés » (automatique), preuve lisible et journalisée', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }]);
      const c = await nouveauCandidat();
      const { propositionId } = await svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: c }, rita);
      await svc.enregistrerAccordWhatsApp(propositionId, { fichier: capture(), date: HIER, numeroCommunicable: true }, rita);
      const p = await proposition(propositionId);
      expect(p).toMatchObject({ statut: 'proposee', accordMode: 'whatsapp', accordParId: rita.id, numeroCommunicable: true, accordPreuveMime: 'image/png' });
      expect((await dossier(d.id)).statut).toBe('candidats_proposes');
      const t = await getDb().select().from(schema.evenementDossier).where(and(eq(schema.evenementDossier.dossierId, d.id), eq(schema.evenementDossier.versStatut, 'candidats_proposes')));
      expect(t[0]!.commentaire).toContain('automatique');
      expect((await candidat(c)).statut).toBe('propose');
      const lu = await svc.lirePreuveAccord(d.id, propositionId, rita);
      expect(lu!.mime).toBe('image/png');
      expect(Buffer.from(lu!.octets).equals(Buffer.from(PNG))).toBe(true);
      await expect(svc.lirePreuveAccord(d.id, propositionId, autre)).rejects.toThrow('Accès refusé');
      expect(await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'proposition.preuve_consultee'))).toHaveLength(1);
    });

    it('RG-04 : « refusée par le candidat » ne peut pas être passée à « proposée » ; une nouvelle Proposition exige un nouvel accord', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }]);
      const c = await nouveauCandidat();
      const { propositionId } = await svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: c }, rita);
      await getDb().transaction((tx) => effets.enregistrerRefusCandidat(tx, propositionId, 'Trop loin', { type: 'candidat', candidatId: c }));
      expect(domaine.transitionsReferent('refusee_candidat')).toEqual([]);
      for (const vers of ['proposee', 'entretien', 'retenue', 'retiree'] as const) {
        await expect(svc.changerStatutProposition(propositionId, vers, { motif: 'x' }, rita)).rejects.toThrow();
      }
      await expect(svc.enregistrerAccordWhatsApp(propositionId, { fichier: capture(), date: HIER, numeroCommunicable: false }, rita)).rejects.toThrow('n’attend plus');
      const nouvelle = await svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: c }, rita);
      expect((await proposition(nouvelle.propositionId)).statut).toBe('en_attente_accord');
    });

    it('RG-12, RG-13 : entretien (date, lieu facultatifs), refus avec motif obligatoire, retrait avec motif', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 3 }]);
      const a = await proposee(d);
      await svc.changerStatutProposition(a.propositionId, 'entretien', { entretienLe: '2026-12-01T10:30', entretienLieu: 'Hôtel, Akwa' }, rita);
      const p = await proposition(a.propositionId);
      expect(p).toMatchObject({ statut: 'entretien', entretienLieu: 'Hôtel, Akwa' });
      expect(p.entretienLe!.toISOString()).toBe('2026-12-01T09:30:00.000Z');
      await svc.modifierEntretien(a.propositionId, { entretienLe: null, entretienLieu: 'Bonapriso' }, rita);
      expect((await proposition(a.propositionId)).entretienLieu).toBe('Bonapriso');
      await expect(svc.changerStatutProposition(a.propositionId, 'refusee', {}, rita)).rejects.toThrow('motif');
      await svc.changerStatutProposition(a.propositionId, 'refusee', { motif: 'Profil trop junior' }, rita);
      expect(await proposition(a.propositionId)).toMatchObject({ statut: 'refusee', motif: 'Profil trop junior' });

      const b = await proposee(d);
      await svc.creerLienAcces(b.propositionId, 'profil', rita);
      await expect(svc.changerStatutProposition(b.propositionId, 'retiree', {}, rita)).rejects.toThrow('motif');
      await svc.changerStatutProposition(b.propositionId, 'retiree', { motif: 'Candidat injoignable' }, rita);
      expect((await proposition(b.propositionId)).accesRevoqueLe).not.toBeNull();
      const liens = await getDb().select().from(schema.accesProfil).where(eq(schema.accesProfil.propositionId, b.propositionId));
      expect(liens.every((l) => l.revoqueLe !== null)).toBe(true);
      expect((await getDb().select().from(schema.notificationCandidat).where(eq(schema.notificationCandidat.candidatId, b.candidatId))).some((n) => n.titre === 'Proposition retirée')).toBe(true);
    });
  });

  describe('Liens temporaires (RG-10, RG-15)', () => {
    it('lien seulement pour un profil transmis ; empreinte stockée, 7 jours, révocable ; attestation après annonce du placement', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }]);
      const { propositionId: attente } = await svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: await nouveauCandidat() }, rita);
      await expect(svc.creerLienAcces(attente, 'profil', rita)).rejects.toThrow('accord du candidat');
      const { propositionId } = await proposee(d);
      const maintenant = new Date('2026-11-04T08:00:00Z');
      const l = await svc.creerLienAcces(propositionId, 'profil', rita, maintenant);
      expect(l.url).toMatch(/^http:\/\/localhost:3000\/profil\/[A-Za-z0-9_-]{43}$/);
      const jeton = l.url.split('/').pop()!;
      const [ligne] = await getDb().select().from(schema.accesProfil).where(eq(schema.accesProfil.id, l.id));
      expect(ligne).toMatchObject({ empreinte: jetons.empreinteJeton(jeton), objet: 'profil', revoqueLe: null });
      expect(ligne!.expireLe.getTime() - maintenant.getTime()).toBe(7 * 86_400_000);
      await expect(svc.creerLienAcces(propositionId, 'attestation', rita)).rejects.toThrow('Annoncez');
      await svc.revoquerLienAcces(l.id, rita);
      expect((await getDb().select().from(schema.accesProfil).where(eq(schema.accesProfil.id, l.id)))[0]!.revoqueLe).not.toBeNull();
      await svc.changerStatutProposition(propositionId, 'retenue', {}, rita);
      await svc.annoncerPlacement(propositionId, { datePrevue: '2026-12-01' }, rita);
      expect((await svc.creerLienAcces(propositionId, 'attestation', rita)).url).toContain('/profil/');
    });

    it('message WhatsApp « Profil candidat » : lien généré, rendu du modèle ; la trace masque le lien', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }]);
      const { propositionId } = await proposee(d);
      const m = await svc.preparerMessageProposition(propositionId, svc.MODELE_PROFIL_CANDIDAT, rita);
      expect(m.lien).not.toBeNull();
      expect(m.texte).toContain(m.lien!.url);
      expect(m.texte).toContain('Awa N.');
      expect(m.numero).toMatch(/^\+2376990/);
      await svc.noterWhatsAppProposition(propositionId, svc.MODELE_PROFIL_CANDIDAT, m.texte, rita);
      const [ev] = await getDb().select().from(schema.evenementDossier).where(and(eq(schema.evenementDossier.dossierId, d.id), eq(schema.evenementDossier.type, 'whatsapp')));
      const trace = (ev!.apres as { texte: string }).texte;
      expect(trace).toContain('/profil/[lien masqué]');
      expect(trace).not.toContain(m.lien!.url);
      const conv = await svc.preparerMessageProposition(propositionId, svc.MODELE_PROPOSITION_POSTE, rita);
      expect(conv.lien).toBeNull();
      expect(conv.texte).toContain('/candidat/espace');
    });
  });

  describe('Placements et clôture (RG-14..23)', () => {
    it('RG-14, RG-16, RG-21 : placement annoncé sans preuve → clôture bloquée et placement listé ; abandon puis clôture avant échéance avec motif', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 2 }]);
      const a = await proposee(d);
      await expect(svc.annoncerPlacement(a.propositionId, { datePrevue: '2026-12-01' }, rita)).rejects.toThrow('Retenue');
      await svc.changerStatutProposition(a.propositionId, 'retenue', {}, rita);
      const { placementId } = await svc.annoncerPlacement(a.propositionId, { datePrevue: '2026-12-01', salaire: '80 000 FCFA' }, rita);
      expect(await placement(placementId)).toMatchObject({ statut: 'annonce', poste: 'Serveur', salaire: '80 000 FCFA', remplacement: false });
      await expect(svc.annoncerPlacement(a.propositionId, { datePrevue: '2026-12-02' }, rita)).rejects.toThrow();
      await expect(svc.confirmerPlacementParPreuve(placementId, { fichier: null, datePriseDePoste: HIER }, rita)).rejects.toThrow('preuve');

      const etat = (await svc.etatRecherche(d.id, rita))!;
      expect(etat.annonces).toEqual([{ id: placementId, libelle: 'Awa N. — Serveur' }]);
      expect(etat.verdict.ok).toBe(false);
      const erreur = await svc.cloturerRecherche(d.id, 'Fin de mission', rita).catch((e: unknown) => e);
      expect(erreur).toBeInstanceOf(svc.ErreurCloture);
      expect((erreur as InstanceType<typeof svc.ErreurCloture>).annonces).toEqual([{ id: placementId, libelle: 'Awa N. — Serveur' }]);
      expect((erreur as Error).message).toContain('Awa N. — Serveur');
      expect((await dossier(d.id)).statut).toBe('candidats_proposes');

      await expect(svc.abandonnerPlacement(placementId, '', rita)).rejects.toThrow('motif');
      await svc.abandonnerPlacement(placementId, 'Le client a changé d’avis', rita);
      expect((await placement(placementId)).statut).toBe('abandonne');
      // Avant l'échéance, ni tout pourvu : motif obligatoire.
      await expect(svc.cloturerRecherche(d.id, null, rita)).rejects.toThrow('motif');
      await expect(svc.cloturerRecherche(d.id, 'Client injoignable', autre)).rejects.toThrow('Accès refusé');
      const r = await svc.cloturerRecherche(d.id, 'Client injoignable', rita);
      expect(r.placementsRetenus).toBe(0);
      // MVP2-04 RG-18 : sans devis accepté (dossier de test), aucune facture n’est émise ; c’est signalé.
      expect(r.facturation).toMatchObject({ montantFinal: null, sansDevis: true });
      expect(await dossier(d.id)).toMatchObject({ statut: 'placements_confirmes', placementsRetenus: 0, rechercheClotureMotif: 'Client injoignable' });
      await expect(svc.cloturerRecherche(d.id, 'Encore', rita)).rejects.toThrow('déjà clôturée');
    });

    it('RG-18, RG-22, RG-23 : 7 placements confirmés dont 1 rompu au 10e jour et remplacé → 7 retenus ; propositions en cours retirées et accès révoqués', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Agent d’entretien', nombre: 7 }]);
      const confirmes = [];
      for (let i = 0; i < 7; i++) confirmes.push(await placementConfirme(d, '2025-03-01'));
      expect(await candidat(confirmes[0]!.candidatId)).toMatchObject({ statut: 'place' });
      expect(await placement(confirmes[0]!.placementId)).toMatchObject({ statut: 'confirme', confirmationMode: 'preuve', confirmeParId: rita.id, datePriseDePoste: '2025-03-01' });
      const preuveLue = await svc.lirePreuvePlacement(d.id, confirmes[0]!.placementId, rita);
      expect(preuveLue!.mime).toBe('application/pdf');

      // Rupture au 10e jour (garantie 15 jours) avec remplaçant choisi tout de suite.
      const remplacant = await nouveauCandidat('preselectionne', 'Brice');
      const rupture = await svc.declarerRupture(confirmes[0]!.placementId, { dateRupture: '2025-03-11', motif: 'Départ volontaire', remplacantId: remplacant }, rita);
      expect(rupture.statut).toBe('rompu_garantie');
      const prop = await proposition(rupture.remplacement!.propositionId);
      expect(prop).toMatchObject({ statut: 'en_attente_accord', remplacePlacementId: confirmes[0]!.placementId, lignePosteId: d.lignes[0] });
      await svc.enregistrerAccordWhatsApp(prop.id, { fichier: capture(), date: HIER, numeroCommunicable: false }, rita);
      await svc.changerStatutProposition(prop.id, 'retenue', {}, rita);
      const rempl = await svc.annoncerPlacement(prop.id, { datePrevue: '2025-03-14' }, rita);
      expect(rempl.avertissements).toEqual([]);
      expect(await placement(rempl.placementId)).toMatchObject({ remplacement: true, remplacePlacementId: confirmes[0]!.placementId });
      await svc.confirmerPlacementParPreuve(rempl.placementId, { fichier: preuve(), datePriseDePoste: '2025-03-14' }, rita);
      // Un second remplaçant pour le même placement : refusé.
      await expect(svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: await nouveauCandidat(), remplacePlacementId: confirmes[0]!.placementId }, rita)).rejects.toThrow('déjà un remplaçant');

      // Propositions encore en cours : une en attente d'accord, une proposée avec un lien actif.
      const { propositionId: enAttente } = await svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: await nouveauCandidat() }, rita);
      const transmise = await proposee(d);
      const lien = await svc.creerLienAcces(transmise.propositionId, 'profil', rita);
      const lienPlace = await svc.creerLienAcces(confirmes[1]!.propositionId, 'profil', rita);

      const etat = (await svc.etatRecherche(d.id, rita))!;
      expect(etat.lignes[0]).toMatchObject({ places: 7, nombre: 7 });
      expect(etat.tousPourvus).toBe(true);
      expect(etat.retenus).toBe(7);

      const r = await svc.cloturerRecherche(d.id, null, rita);
      expect(r).toMatchObject({ placementsRetenus: 7, propositionsRetirees: 2, facturation: { sansDevis: true } });
      const dd = await dossier(d.id);
      expect(dd).toMatchObject({ statut: 'placements_confirmes', placementsRetenus: 7 });
      expect(dd.rechercheClotureLe).not.toBeNull();
      const transition = await getDb().select().from(schema.evenementDossier).where(and(eq(schema.evenementDossier.dossierId, d.id), eq(schema.evenementDossier.versStatut, 'placements_confirmes')));
      expect(transition[0]!.commentaire).toContain('7 placement(s) retenu(s)');
      expect(await proposition(enAttente)).toMatchObject({ statut: 'retiree', motif: 'Clôture de la recherche' });
      expect((await proposition(transmise.propositionId)).statut).toBe('retiree');
      expect((await getDb().select().from(schema.notificationCandidat).where(eq(schema.notificationCandidat.candidatId, transmise.candidatId))).some((n) => n.titre === 'Recherche terminée')).toBe(true);
      // RG-23 : accès révoqué pour les non placés, conservé pour les placés.
      expect((await proposition(transmise.propositionId)).accesRevoqueLe).not.toBeNull();
      expect((await getDb().select().from(schema.accesProfil).where(eq(schema.accesProfil.id, lien.id)))[0]!.revoqueLe).not.toBeNull();
      expect((await proposition(confirmes[1]!.propositionId)).accesRevoqueLe).toBeNull();
      expect((await getDb().select().from(schema.accesProfil).where(eq(schema.accesProfil.id, lienPlace.id)))[0]!.revoqueLe).toBeNull();
      // Après la clôture : plus de nouvelle proposition ordinaire.
      await expect(svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: await nouveauCandidat() }, rita)).rejects.toThrow(domaine.MESSAGE_STATUT_DOSSIER_PROPOSITION);
    });

    it('RG-19 : départ après la garantie → « terminé », sans remplacement', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }]);
      const { placementId } = await placementConfirme(d, '2025-03-01');
      await expect(svc.declarerRupture(placementId, { dateRupture: '2025-02-01', motif: 'x' }, rita)).rejects.toThrow('précède');
      const r = await svc.declarerRupture(placementId, { dateRupture: '2025-04-01', motif: 'Fin de contrat', remplacantId: await nouveauCandidat() }, rita);
      expect(r).toEqual({ statut: 'termine', remplacement: null });
      expect(await placement(placementId)).toMatchObject({ statut: 'termine', finLe: '2025-04-01', finMotif: 'Fin de contrat' });
      expect((await svc.etatRecherche(d.id, rita))!.retenus).toBe(1);
    });

    it('cas limite : placement direct sur preuve quand le client a recruté sans déclarer', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }]);
      const { candidatId: attenteC } = { candidatId: await nouveauCandidat() };
      const { propositionId: attente } = await svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: attenteC }, rita);
      await expect(svc.placementDirectSurPreuve(attente, { fichier: preuve(), datePriseDePoste: HIER }, rita)).rejects.toThrow('transmis');
      const { propositionId, candidatId } = await proposee(d);
      await expect(svc.placementDirectSurPreuve(propositionId, { fichier: null, datePriseDePoste: HIER }, rita)).rejects.toThrow('preuve');
      const r = await svc.placementDirectSurPreuve(propositionId, { fichier: { nom: 'capture.png', octets: PNG }, datePriseDePoste: HIER }, rita);
      expect(await placement(r.placementId)).toMatchObject({ statut: 'confirme', confirmationMode: 'preuve', datePriseDePoste: HIER });
      expect((await proposition(propositionId)).statut).toBe('placee');
      expect((await candidat(candidatId)).statut).toBe('place');
    });

    it('plus de placements que demandés : autorisé avec avertissement', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }]);
      await placementConfirme(d, HIER);
      const b = await proposee(d);
      await svc.changerStatutProposition(b.propositionId, 'retenue', {}, rita);
      const r = await svc.annoncerPlacement(b.propositionId, { datePrevue: '2026-12-01' }, rita);
      expect(r.avertissements[0]).toContain('avenant');
    });

    it('RG-22 : « Placements confirmés » n’est pas une transition manuelle ; RG-23 : la fermeture du Dossier révoque l’accès des non placés', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 2 }]);
      const a = await proposee(d);
      const lien = await svc.creerLienAcces(a.propositionId, 'profil', rita);
      await expect(dossiers.changerStatut(d.id, 'placements_confirmes', '2 placés', rita)).rejects.toThrow(statuts.MESSAGE_CLOTURE_RECHERCHE);
      await dossiers.changerStatut(d.id, 'sans_suite', 'Le client abandonne', rita);
      expect((await proposition(a.propositionId)).accesRevoqueLe).not.toBeNull();
      expect((await getDb().select().from(schema.accesProfil).where(eq(schema.accesProfil.id, lien.id)))[0]!.revoqueLe).not.toBeNull();
    });
  });

  describe('Tâches planifiées', () => {
    it('MVP2-01 RG-14 : proposition sans réponse depuis 72 h → référent notifié une seule fois', async () => {
      const d = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }]);
      const { propositionId } = await svc.creerProposition({ dossierId: d.id, lignePosteId: d.lignes[0]!, candidatId: await nouveauCandidat() }, rita);
      const cle = `proposition_sans_reponse:${propositionId}`;
      await svc.signalerAccordsSansReponse(new Date(Date.now() + 71 * 3_600_000));
      expect(await getDb().select().from(schema.notification).where(eq(schema.notification.cle, cle))).toHaveLength(0);
      expect(await svc.signalerAccordsSansReponse(new Date(Date.now() + 73 * 3_600_000))).toBeGreaterThanOrEqual(1);
      const n = await getDb().select().from(schema.notification).where(eq(schema.notification.cle, cle));
      expect(n).toHaveLength(1);
      expect(n[0]).toMatchObject({ destinataireId: rita.id, type: 'proposition_sans_reponse', dossierId: d.id });
      expect((await proposition(propositionId)).relanceAccordLe).not.toBeNull();
      expect(await svc.signalerAccordsSansReponse(new Date(Date.now() + 100 * 3_600_000))).toBe(0);
    });

    it('RG-20 : alerte au référent 5 jours avant l’échéance, une seule fois', async () => {
      const proche = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }], 'recherche_en_cours', 26);
      const loin = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }], 'recherche_en_cours', 10);
      const prolonge = await nouveauDossier(rita, [{ intitule: 'Serveur', nombre: 1 }], 'recherche_en_cours', 26);
      await getDb().update(schema.dossier).set({ delaiRechercheJours: 60 }).where(eq(schema.dossier.id, prolonge.id));
      expect((await svc.etatRecherche(proche.id, rita))!.delaiJours).toBe(30);
      await svc.alerterEcheancesRecherche();
      const notifs = await getDb().select().from(schema.notification).where(eq(schema.notification.type, 'echeance_recherche'));
      expect(notifs.map((n) => n.dossierId)).toContain(proche.id);
      expect(notifs.map((n) => n.dossierId)).not.toContain(loin.id);
      expect(notifs.map((n) => n.dossierId)).not.toContain(prolonge.id);
      expect(notifs.find((n) => n.dossierId === proche.id)).toMatchObject({ destinataireId: rita.id, email: true });
      expect((await dossier(proche.id)).alerteEcheanceLe).not.toBeNull();
      expect(await svc.alerterEcheancesRecherche()).toBe(0);
    });
  });
});
