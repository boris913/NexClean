// Lot C MVP2-03 : propositions vues et traitées depuis l'espace candidat, notifications candidat,
// suppression des données d'un candidat ayant des Propositions et Placements (vraie base PostgreSQL).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Propositions — espace candidat (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-prop-candidat-'));

  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const dossiers = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');
  const candidats = await import('@/lib/candidats/service');
  const { pseudonyme } = await import('@/lib/candidats/domaine');
  const { hacherMotDePasse } = await import('@/lib/auth/mot-de-passe');
  const { nomAffichable } = await import('@/lib/propositions/domaine');
  const effets = await import('@/lib/propositions/effets');
  const svc = await import('@/lib/propositions/candidat');

  const MDP = 'motdepasse-1';
  let refId: string;
  let dossierId: number;
  let clientId: number;
  let lignes: number[];
  let empreinteMdp: string;
  let seq = 0;

  const nouveauCandidat = async (statut: 'preselectionne' | 'propose' | 'place' = 'preselectionne') => {
    const telephone = `+2376903000${String(++seq).padStart(2, '0')}`;
    const [c] = await getDb()
      .insert(schema.candidat)
      .values({ nom: 'Ngo', prenom: 'Awa', telephone, whatsapp: telephone, email: `awa${seq}@exemple.test`, statut, motDePasse: empreinteMdp })
      .returning();
    return c!;
  };
  const proposer = async (candidatId: number, ligne: number, valeurs: Partial<typeof schema.proposition.$inferInsert> = {}) => {
    const [p] = await getDb().insert(schema.proposition).values({ dossierId, lignePosteId: ligne, candidatId, clientId, auteurId: refId, ...valeurs }).returning();
    return p!.id;
  };
  const proposition = async (id: number) => (await getDb().select().from(schema.proposition).where(eq(schema.proposition.id, id)))[0]!;

  beforeAll(async () => {
    await reinitialiserBase();
    empreinteMdp = await hacherMotDePasse(MDP);
    refId = (await collab.creerCollaborateur({ nom: 'Rita Recrutement', email: 'rita-c@nexclean.test', roles: ['referent'] }, { id: null })).userId;
    const r = await dossiers.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: 'Hôtel du Lac', contact: 'M. Kamga', whatsapp: '+237699001122' },
      villeId: null,
      villeAutre: 'Kribi',
      quartierId: null,
      quartierAutre: 'Centre',
      lieu: null,
      secteur: 'Hôtellerie',
      description: null,
      lignes: [
        { intitule: 'Serveur', nombre: 2 },
        { intitule: 'Cuisinier', nombre: 1 },
        { intitule: 'Plongeur', nombre: 1 },
        { intitule: 'Réceptionniste', nombre: 1 },
      ],
      donnees: { test: 1 },
    });
    dossierId = r.dossierId;
    await getDb().update(schema.dossier).set({ referentId: refId, statut: 'recherche_en_cours' }).where(eq(schema.dossier.id, dossierId));
    lignes = (await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId)).orderBy(schema.lignePoste.ordre)).map((l) => l.id);
    await getDb().update(schema.lignePoste).set({ salaire: '150 000 FCFA', typeContrat: 'CDI', horaires: '7 h – 15 h' });
    clientId = (await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, dossierId)))[0]!.clientId;
  });

  describe('Liste (MVP2-01 RG-13)', () => {
    it('affiche les champs RG-13 et le salaire seulement s’il est communicable', async () => {
      const c = await nouveauCandidat();
      const masque = await proposer(c.id, lignes[0]!);
      const visible = await proposer(c.id, lignes[1]!, { salaireCommunicable: true });
      const { enAttente, historique } = await svc.listerPropositionsCandidat(c.id);
      expect(historique).toHaveLength(0);
      const a = enAttente.find((p) => p.id === masque)!;
      expect(a).toMatchObject({ poste: 'Serveur', client: 'Hôtel du Lac', secteur: 'Hôtellerie', ville: 'Kribi', quartier: 'Centre', typeContrat: 'CDI', horaires: '7 h – 15 h', salaire: null, statut: 'en_attente_accord' });
      expect(JSON.stringify(a)).not.toContain('150 000');
      expect(enAttente.find((p) => p.id === visible)!.salaire).toBe('150 000 FCFA');
    });

    it('historique : libellés pour le candidat, sans retour client ni motif interne', async () => {
      const c = await nouveauCandidat();
      const entretien = new Date('2026-11-10T08:30:00Z'); // 09 h 30 à Douala
      await proposer(c.id, lignes[0]!, { statut: 'entretien', entretienLe: entretien, entretienLieu: 'Hôtel du Lac, Kribi', retourClient: 'rencontrer', retourClientMotif: 'RETOUR-CLIENT-SECRET' });
      await proposer(c.id, lignes[1]!, { statut: 'refusee', motif: 'MOTIF-INTERNE-SECRET', retourClient: 'ne_correspond_pas', retourClientMotif: 'TROP-JEUNE-SECRET' });
      await proposer(c.id, lignes[2]!, { statut: 'proposee' });
      const { enAttente, historique } = await svc.listerPropositionsCandidat(c.id);
      expect(enAttente).toHaveLength(0);
      const libelles = historique.map((p) => p.libelleStatut);
      expect(libelles).toContain('Entretien prévu le mardi 10 novembre à 09 h 30');
      expect(libelles).toContain('Non retenu(e)');
      expect(libelles).toContain('Présenté(e) au client');
      expect(historique.find((p) => p.statut === 'entretien')!.entretienLieu).toBe('Hôtel du Lac, Kribi');
      const json = JSON.stringify(historique);
      for (const secret of ['SECRET', 'rencontrer', 'ne_correspond_pas', '150 000']) expect(json).not.toContain(secret);
    });

    it('ne liste pas les propositions des autres candidats', async () => {
      const a = await nouveauCandidat();
      const b = await nouveauCandidat();
      await proposer(a.id, lignes[0]!);
      const { enAttente, historique } = await svc.listerPropositionsCandidat(b.id);
      expect(enAttente.length + historique.length).toBe(0);
    });
  });

  describe('Réponse (MVP2-01 RG-14 ; MVP2-03 RG-03, RG-04, RG-08)', () => {
    it('accepte : proposée, accord « espace » horodaté avec IP, numéro communicable, journalisé, référent notifié', async () => {
      const c = await nouveauCandidat();
      const id = await proposer(c.id, lignes[0]!);
      await svc.repondreProposition(c.id, id, 'accepte', { numeroCommunicable: true, ip: '10.1.1.1' });
      const p = await proposition(id);
      expect(p).toMatchObject({ statut: 'proposee', accordMode: 'espace', accordIp: '10.1.1.1', numeroCommunicable: true });
      expect(p.reponseLe).toBeInstanceOf(Date);
      expect(p.accordLe).toBeInstanceOf(Date);
      const audit = await getDb().select().from(schema.journalAudit).where(and(eq(schema.journalAudit.action, 'proposition.accord'), eq(schema.journalAudit.objetId, String(id))));
      expect(audit[0]).toMatchObject({ acteurType: 'candidat', acteurId: String(c.id), ip: '10.1.1.1' });
      const notifs = await getDb().select().from(schema.notification).where(and(eq(schema.notification.destinataireId, refId), eq(schema.notification.cle, `proposition_accord:${id}`)));
      expect(notifs).toHaveLength(1);
      // Une seconde réponse est refusée.
      await expect(svc.repondreProposition(c.id, id, 'refuse')).rejects.toThrow('n’attend plus de réponse');
    });

    it('accepte sans cocher la case : numéro non communicable (RG-08)', async () => {
      const c = await nouveauCandidat();
      const id = await proposer(c.id, lignes[0]!);
      await svc.repondreProposition(c.id, id, 'accepte', { ip: null });
      expect((await proposition(id)).numeroCommunicable).toBe(false);
    });

    it('refuse : définitif (RG-04), motif facultatif enregistré, seconde réponse refusée', async () => {
      const c = await nouveauCandidat();
      const id = await proposer(c.id, lignes[0]!);
      await svc.repondreProposition(c.id, id, 'refuse', { motif: '  Trop loin  ' });
      expect(await proposition(id)).toMatchObject({ statut: 'refusee_candidat', motif: 'Trop loin' });
      await expect(svc.repondreProposition(c.id, id, 'accepte')).rejects.toThrow('déjà refusé');
      await expect(svc.repondreProposition(c.id, id, 'refuse')).rejects.toThrow('déjà refusé');
      expect((await svc.listerPropositionsCandidat(c.id)).historique[0]!.libelleStatut).toBe('Vous avez refusé');
      const audit = await getDb().select().from(schema.journalAudit).where(and(eq(schema.journalAudit.action, 'proposition.refus_candidat'), eq(schema.journalAudit.objetId, String(id))));
      expect(audit).toHaveLength(1);
    });

    it('refuse sans motif', async () => {
      const c = await nouveauCandidat();
      const id = await proposer(c.id, lignes[0]!);
      await svc.repondreProposition(c.id, id, 'refuse', {});
      expect(await proposition(id)).toMatchObject({ statut: 'refusee_candidat', motif: null });
    });

    it('un candidat ne peut pas répondre à la proposition d’un autre', async () => {
      const a = await nouveauCandidat();
      const b = await nouveauCandidat();
      const id = await proposer(a.id, lignes[0]!);
      await expect(svc.repondreProposition(b.id, id, 'accepte')).rejects.toThrow('Proposition introuvable.');
      await expect(svc.repondreProposition(b.id, 999_999, 'accepte')).rejects.toThrow('Proposition introuvable.');
      expect((await proposition(id)).statut).toBe('en_attente_accord');
    });

    it('une proposition qui n’est plus en attente ne peut pas recevoir de réponse', async () => {
      const c = await nouveauCandidat();
      const retiree = await proposer(c.id, lignes[0]!, { statut: 'retiree', motif: 'Poste pourvu' });
      const proposee = await proposer(c.id, lignes[1]!, { statut: 'proposee' });
      await expect(svc.repondreProposition(c.id, retiree, 'accepte')).rejects.toThrow('n’attend plus de réponse (retirée)');
      await expect(svc.repondreProposition(c.id, proposee, 'refuse')).rejects.toThrow('n’attend plus de réponse');
      expect((await proposition(proposee)).statut).toBe('proposee');
    });
  });

  describe('Notifications candidat', () => {
    it('liste, compte les non lues, marque une ou toutes comme lues (seulement les siennes)', async () => {
      const a = await nouveauCandidat();
      const b = await nouveauCandidat();
      const tx = <T,>(f: (t: import('@/lib/propositions/effets').Tx) => Promise<T>) => getDb().transaction(f);
      await tx(async (t) => {
        await effets.notifierCandidat(t, a.id, { titre: 'Prise de poste confirmée', texte: 'Bravo', cle: 'n1' });
        await effets.notifierCandidat(t, a.id, { titre: 'Proposition retirée', texte: 'Le poste est pourvu', cle: 'n2' });
        await effets.notifierCandidat(t, a.id, { titre: 'Doublon', texte: 'Ignoré', cle: 'n2' });
        await effets.notifierCandidat(t, b.id, { titre: 'Autre', texte: 'Pour B' });
      });
      const liste = await svc.listerNotificationsCandidat(a.id);
      expect(liste.map((n) => n.titre).sort()).toEqual(['Prise de poste confirmée', 'Proposition retirée']);
      expect(await svc.compterNonLuesCandidat(a.id)).toBe(2);
      const idB = (await svc.listerNotificationsCandidat(b.id))[0]!.id;
      expect(await svc.marquerLuesCandidat(a.id, [idB])).toBe(0);
      expect(await svc.compterNonLuesCandidat(b.id)).toBe(1);
      expect(await svc.marquerLuesCandidat(a.id, [liste[0]!.id])).toBe(1);
      expect(await svc.compterNonLuesCandidat(a.id)).toBe(1);
      expect(await svc.marquerLuesCandidat(a.id)).toBe(1);
      expect(await svc.compterNonLuesCandidat(a.id)).toBe(0);
      expect(await svc.compterNonLuesCandidat(b.id)).toBe(1);
      expect(await svc.marquerLuesCandidat(a.id, [])).toBe(0);
    });
  });

  describe('Suppression des données (MVP2-01 RG-16, RG-17 ; MVP2-03 RG-01, cas limites)', () => {
    it('demande : propositions en cours retirées, accès révoqués, placements annoncés abandonnés, référent notifié ; exécution : placement conservé avec pseudonyme', async () => {
      const c = await nouveauCandidat('place');
      const enAttente = await proposer(c.id, lignes[0]!);
      const retenue = await proposer(c.id, lignes[1]!, { statut: 'retenue', accordMode: 'espace', accordLe: new Date() });
      const placee = await proposer(c.id, lignes[2]!, { statut: 'placee', accordMode: 'whatsapp', accordLe: new Date(), accordPreuveCle: 'preuves/accord-whatsapp.png', accordParId: refId });
      const refusee = await proposer(c.id, lignes[3]!, { statut: 'refusee', motif: 'Profil non adapté' });
      const [annonce] = await getDb().insert(schema.placement).values({ propositionId: retenue, dossierId, lignePosteId: lignes[1]!, candidatId: c.id, datePrevue: '2026-12-01', poste: 'Cuisinier' }).returning();
      const [confirme] = await getDb()
        .insert(schema.placement)
        .values({ propositionId: placee, dossierId, lignePosteId: lignes[2]!, candidatId: c.id, datePrevue: '2026-11-01', poste: 'Plongeur', statut: 'confirme', confirmeLe: new Date(), confirmationMode: 'preuve', datePriseDePoste: '2026-11-02', preuveCle: 'preuves/attestation.pdf', salaire: '80 000 FCFA' })
        .returning();
      const [lien] = await getDb().insert(schema.accesProfil).values({ propositionId: retenue, empreinte: `emp-${c.id}`, expireLe: new Date(Date.now() + 86_400_000) }).returning();
      await effets.evenementDossier(getDb() as never, dossierId, 'placement', `${nomAffichable(c.prenom, c.nom)} — Plongeur : prise de poste confirmée`, { type: 'collaborateur', id: refId }, { placementId: confirme!.id });
      await getDb().transaction((t) => effets.notifierCandidat(t, c.id, { titre: 'Prise de poste confirmée', texte: 'Bravo' }));

      const { prevueLe } = await candidats.demanderSuppression(c.id, MDP, '10.2.2.2');

      for (const id of [enAttente, retenue]) {
        const p = await proposition(id);
        expect(p).toMatchObject({ statut: 'retiree', motif: candidats.MOTIF_RETRAIT_SUPPRESSION });
        expect(p.accesRevoqueLe).toBeInstanceOf(Date);
      }
      expect((await proposition(placee)).statut).toBe('placee');
      expect(await proposition(refusee)).toMatchObject({ statut: 'refusee', motif: 'Profil non adapté' });
      expect((await getDb().select().from(schema.accesProfil).where(eq(schema.accesProfil.id, lien!.id)))[0]!.revoqueLe).toBeInstanceOf(Date);
      expect((await getDb().select().from(schema.placement).where(eq(schema.placement.id, annonce!.id)))[0]).toMatchObject({ statut: 'abandonne', finMotif: candidats.MOTIF_RETRAIT_SUPPRESSION });
      expect((await getDb().select().from(schema.placement).where(eq(schema.placement.id, confirme!.id)))[0]!.statut).toBe('confirme');
      const notifs = await getDb().select().from(schema.notification).where(and(eq(schema.notification.destinataireId, refId), eq(schema.notification.type, 'proposition_retiree')));
      expect(notifs.map((n) => n.cle).sort()).toEqual([`proposition_retiree_suppression:${enAttente}`, `proposition_retiree_suppression:${retenue}`].sort());
      const evenements = await getDb().select().from(schema.evenementDossier).where(eq(schema.evenementDossier.dossierId, dossierId));
      expect(evenements.filter((e) => (e.apres as { statut?: string } | null)?.statut === 'retiree' && [enAttente, retenue].includes((e.apres as { propositionId: number }).propositionId))).toHaveLength(2);

      // Exécution à l'échéance.
      expect(await candidats.executerSuppressionsDues(new Date(prevueLe.getTime() + 1000))).toBe(1);
      const pseudo = pseudonyme(c.id);
      // « Le Dossier client affiche le placement avec un pseudonyme » (MVP2-01 RG-17).
      const [vu] = await getDb()
        .select({ prenom: schema.candidat.prenom, nom: schema.candidat.nom, statut: schema.placement.statut, preuveCle: schema.placement.preuveCle })
        .from(schema.placement)
        .innerJoin(schema.candidat, eq(schema.candidat.id, schema.placement.candidatId))
        .where(eq(schema.placement.id, confirme!.id));
      expect(vu).toMatchObject({ statut: 'confirme', preuveCle: 'preuves/attestation.pdf' });
      expect(nomAffichable(vu!.prenom, vu!.nom)).toBe(pseudo);
      // Propositions conservées, preuve d'accord WhatsApp conservée.
      expect(await getDb().select().from(schema.proposition).where(eq(schema.proposition.candidatId, c.id))).toHaveLength(4);
      expect((await proposition(placee)).accordPreuveCle).toBe('preuves/accord-whatsapp.png');
      // Aucune coordonnée du candidat dans les Propositions et Placements.
      const traces = JSON.stringify([
        await getDb().select().from(schema.proposition).where(eq(schema.proposition.candidatId, c.id)),
        await getDb().select().from(schema.placement).where(eq(schema.placement.candidatId, c.id)),
      ]);
      for (const donnee of [c.telephone!, c.telephone!.slice(4), c.email!]) expect(traces).not.toContain(donnee);
      // Historique du Dossier et notifications des collaborateurs : pseudonyme à la place du nom.
      const apres = await getDb().select().from(schema.evenementDossier).where(eq(schema.evenementDossier.dossierId, dossierId));
      const lies = apres.filter((e) => {
        const a = e.apres as { propositionId?: number; placementId?: number } | null;
        return [enAttente, retenue].includes(a?.propositionId ?? -1) || a?.placementId === confirme!.id;
      });
      expect(lies).toHaveLength(3);
      for (const e of lies) {
        expect(e.commentaire).toContain(pseudo);
        expect(e.commentaire).not.toContain('Awa N.');
      }
      const notifsApres = await getDb().select().from(schema.notification).where(and(eq(schema.notification.destinataireId, refId), eq(schema.notification.type, 'proposition_retiree')));
      for (const n of notifsApres) expect(n.texte).not.toContain('Awa N.');
      // Notifications du candidat supprimées.
      expect(await getDb().select().from(schema.notificationCandidat).where(eq(schema.notificationCandidat.candidatId, c.id))).toHaveLength(0);
    });

    it('sans proposition en cours, la demande ne notifie personne', async () => {
      const c = await nouveauCandidat();
      const avant = (await getDb().select().from(schema.notification).where(eq(schema.notification.type, 'proposition_retiree'))).length;
      await candidats.demanderSuppression(c.id, MDP, null);
      expect(await getDb().select().from(schema.notification).where(eq(schema.notification.type, 'proposition_retiree'))).toHaveLength(avant);
    });
  });

  describe('Candidat placé (ADR 0011 §4)', () => {
    it('n’est plus « en recherche » et peut se déclarer de nouveau en recherche', async () => {
      const c = await nouveauCandidat('place');
      const e = await candidats.lireEspace(c.id);
      expect(e).toMatchObject({ enRecherche: false, place: true });
      await candidats.definirRecherche(c.id, false, null); // déjà hors recherche : sans effet
      expect((await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, c.id)))[0]!.statut).toBe('place');
      await candidats.definirRecherche(c.id, true, null);
      expect((await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, c.id)))[0]!.statut).toBe('a_contacter');
      expect((await candidats.lireEspace(c.id)).enRecherche).toBe(true);
    });

    it('un candidat « indisponible » après un placement reprend « à contacter », pas « placé »', async () => {
      const c = await nouveauCandidat('place');
      await getDb().update(schema.candidat).set({ statut: 'indisponible', statutAvantIndisponible: 'place' }).where(eq(schema.candidat.id, c.id));
      await candidats.definirRecherche(c.id, true, null);
      expect((await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, c.id)))[0]!.statut).toBe('a_contacter');
    });
  });
});
