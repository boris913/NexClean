// MVP2-05 lot B : clôture financière (RG-08), trop-perçu et remboursements (RG-10, RG-11), crédit
// client (RG-12), impayés (RG-09), « Sans suite » après acompte — vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Régularisation des encaissements (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-regularisation-'));

  const { and, asc, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const dossiers = await import('@/lib/dossiers/service');
  const svc = await import('@/lib/propositions/service');
  const effets = await import('@/lib/devis/effets');
  const devisSvc = await import('@/lib/devis/service');
  const reg = await import('@/lib/encaissements/regularisation');
  const { situationFinanciere, tropPercuARegulariser } = await import('@/lib/encaissements/lecture');
  const { creditDisponible } = await import('@/lib/encaissements/effets');
  const { dateDuJour } = await import('@/lib/encaissements/domaine');
  const { calculerDevis } = await import('@/lib/devis/domaine');
  const modeles = await import('@/lib/modeles/service');
  const { rendreMessage } = await import('@/lib/modeles/variables');
  const collab = await import('@/lib/collaborateurs/service');

  type R = 'referent' | 'direction' | 'finances';
  type Acteur = { id: string; nom: string; roles: R[]; ip: string };
  let dir: Acteur;
  let rita: Acteur;
  let fin: Acteur;
  let seq = 0;

  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)]);
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, ...new Array(64).fill(0x20)]);
  const HIER = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const JOUR = 86_400_000;

  async function collaborateur(nom: string, roles: R[]): Promise<Acteur> {
    const { userId } = await collab.creerCollaborateur({ nom, email: `${nom.toLowerCase()}@regularisation.test`, roles }, { id: null });
    if (roles.includes('referent')) await collab.definirAttributs(userId, { services: ['REC'], villeIds: [], telephone: null, capacite: null, absentDu: null, absentAu: null }, { id: null });
    return { id: userId, nom, roles, ip: '10.0.0.4' };
  }

  const dossier = async (id: number) => (await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, id)))[0]!;
  const notifications = (dossierId: number, type: string) => getDb().select().from(schema.notification).where(and(eq(schema.notification.dossierId, dossierId), eq(schema.notification.type, type)));

  /** Dossier REC « Recherche en cours » (client distinct, sauf `whatsapp` imposé). */
  async function nouveauDossier(nombre = 10, whatsapp?: string) {
    const r = await dossiers.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: `Hôtel ${++seq}`, contact: 'M. Kamga', whatsapp: whatsapp ?? `+2376992${String(seq).padStart(5, '0')}` },
      villeId: null,
      villeAutre: 'Kribi',
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: null,
      description: null,
      lignes: [{ intitule: 'Serveur', nombre }],
      donnees: { n: seq },
    });
    await getDb().update(schema.dossier).set({ referentId: rita.id, statut: 'recherche_en_cours' }).where(eq(schema.dossier.id, r.dossierId));
    await getDb().insert(schema.evenementDossier).values({ dossierId: r.dossierId, type: 'transition', deStatut: 'accepte', versStatut: 'acompte_recu', horodatage: new Date(Date.now() - 5 * JOUR) });
    const [l] = await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, r.dossierId));
    return { id: r.dossierId, ligneId: l!.id, nombre };
  }

  /** Devis 10 × 5 000 (acompte 50 %) accepté, puis acompte encaissé. */
  async function devisAccepteEtAcompte(d: Awaited<ReturnType<typeof nouveauDossier>>, encaisse = 25000) {
    const dos = await dossier(d.id);
    const t = calculerDevis([{ lignePosteId: d.ligneId, intitule: 'Serveur', nombre: d.nombre }], { commission: 5000, commissionsParCategorie: {}, tauxTva: 0 }, 50);
    const [ligne] = await getDb()
      .insert(schema.devis)
      .values({ dossierId: d.id, clientId: dos.clientId, numero: `DEV-2026-${String(80000 + seq).padStart(5, '0')}`, statut: 'envoye', lignes: t.lignes, tauxTva: 0, totalHt: t.totalHt, montantTva: 0, totalTtc: t.totalTtc, tauxAcompte: 50, acompte: t.acompte, delaiRechercheJours: 30, garantieJours: 15, validiteJours: 15, conditions: 'C', mentionsLegales: 'M', envoyeLe: new Date(), expireLe: new Date(Date.now() + 15 * JOUR) })
      .returning({ id: schema.devis.id });
    await getDb().transaction((tx) => effets.accepterDevis(tx, ligne!.id, { mode: 'suivi', signataireNom: 'Paul Kamga', signataireFonction: 'Gérant' }, { type: 'client' }));
    if (encaisse > 0) await getDb().insert(schema.encaissement).values({ dossierId: d.id, devisId: ligne!.id, nature: 'acompte', montant: encaisse, moyen: 'especes', recuLe: HIER });
    return ligne!.id;
  }

  const nouveauCandidat = async () => {
    const [c] = await getDb()
      .insert(schema.candidat)
      .values({ nom: 'Ngo', prenom: 'Awa', telephone: `+2376905${String(++seq).padStart(5, '0')}`, statut: 'preselectionne', metiers: ['Serveur'] })
      .returning();
    return c!.id;
  };

  async function retenue(dossierId: number, lignePosteId: number) {
    const { propositionId } = await svc.creerProposition({ dossierId, lignePosteId, candidatId: await nouveauCandidat() }, rita);
    await svc.enregistrerAccordWhatsApp(propositionId, { fichier: { nom: 'capture.png', octets: PNG }, date: HIER, numeroCommunicable: false }, rita);
    await svc.changerStatutProposition(propositionId, 'retenue', {}, rita);
    return propositionId;
  }

  async function placementsConfirmes(d: { id: number; ligneId: number }, n: number) {
    for (let i = 0; i < n; i++) {
      const { placementId } = await svc.annoncerPlacement(await retenue(d.id, d.ligneId), { datePrevue: '2025-03-01' }, rita);
      await svc.confirmerPlacementParPreuve(placementId, { fichier: { nom: 'attestation.pdf', octets: PDF }, datePriseDePoste: '2025-03-01' }, rita);
    }
  }

  beforeAll(async () => {
    await reinitialiserBase();
    dir = await collaborateur('Dir', ['direction']);
    rita = await collaborateur('Rita', ['referent']);
    fin = await collaborateur('Fin', ['finances']);
  }, 120_000);

  describe('RG-08 : clôture de la recherche (10 × 5 000, acompte 25 000 encaissé)', () => {
    it('7/10 : montant final 35 000 enregistré, facture de solde 10 000, reste « Placements confirmés »', async () => {
      const d = await nouveauDossier();
      await devisAccepteEtAcompte(d);
      await placementsConfirmes(d, 7);
      const r = await svc.cloturerRecherche(d.id, 'Fin de la recherche', rita);
      expect(r.facturation.facture).toMatchObject({ type: 'solde', totalTtc: 10000 });
      expect(r.issue).toEqual({ issue: 'solde_a_payer', montant: 10000 });
      expect(await dossier(d.id)).toMatchObject({ montantFinalTtc: 35000, statut: 'placements_confirmes' });
      expect((await situationFinanciere(d.id))!.resteAPayer).toBe(10000);
    }, 180_000);

    it('5/10 : solde nul → « Solde reçu » directement', async () => {
      const d = await nouveauDossier();
      await devisAccepteEtAcompte(d);
      await placementsConfirmes(d, 5);
      const r = await svc.cloturerRecherche(d.id, 'Fin de la recherche', rita);
      expect(r.issue).toEqual({ issue: 'solde_nul' });
      expect(await dossier(d.id)).toMatchObject({ montantFinalTtc: 25000, statut: 'solde_recu' });
    }, 180_000);

    it('4/10 : montant final 20 000, avoir 5 000, ajustement « trop-perçu 5 000 » à préparer (référent notifié) ; puis RG-11', async () => {
      const d = await nouveauDossier();
      await devisAccepteEtAcompte(d);
      await placementsConfirmes(d, 4);
      const r = await svc.cloturerRecherche(d.id, 'Fin de la recherche', rita);
      expect(r.facturation.facture).toMatchObject({ type: 'avoir', totalTtc: 5000 });
      expect(r.issue).toEqual({ issue: 'trop_percu', montant: 5000 });
      expect(await dossier(d.id)).toMatchObject({ montantFinalTtc: 20000, statut: 'placements_confirmes' });
      const n = await notifications(d.id, 'trop_percu');
      expect(n.map((x) => x.destinataireId)).toEqual([rita.id]);
      expect(n[0]!.texte).toContain('trop-perçu de 5 000 FCFA');
      let s = (await situationFinanciere(d.id))!;
      expect(tropPercuARegulariser(s)).toBe(5000);

      // RG-10 : jamais au-delà du trop-perçu ; un autre référent n'y a pas accès.
      await expect(reg.preparerAjustement(d.id, { choix: 'remboursement', montant: 6000 }, rita)).rejects.toThrow('ne peut pas dépasser');
      const autre = await collaborateur('Bob', ['referent']);
      await expect(reg.preparerAjustement(d.id, { choix: 'remboursement' }, autre)).rejects.toThrow('Accès refusé');

      // Remboursement préparé (montant par défaut), refusé par la Direction : le montant est libéré.
      const a1 = await reg.preparerAjustement(d.id, { choix: 'remboursement', commentaire: 'Le client préfère un remboursement' }, rita);
      expect(a1).toMatchObject({ montant: 5000, soldeRecu: false });
      expect((await notifications(d.id, 'remboursement_a_valider')).map((x) => x.destinataireId)).toEqual([dir.id]);
      expect(tropPercuARegulariser((await situationFinanciere(d.id))!)).toBe(0);
      await expect(reg.preparerAjustement(d.id, { choix: 'credit' }, rita)).rejects.toThrow('Aucun trop-perçu');
      await expect(reg.refuserRemboursement(a1.remboursementId!, ' ', dir)).rejects.toThrow('motif');
      await reg.refuserRemboursement(a1.remboursementId!, 'Coordonnées à confirmer', dir);
      expect(tropPercuARegulariser((await situationFinanciere(d.id))!)).toBe(5000);

      // RG-11 : un Référent ne valide pas (refus d'accès, journalisé) ; la Direction valide → Finances notifié.
      const a2 = await reg.preparerAjustement(d.id, { choix: 'remboursement' }, rita);
      const rid = a2.remboursementId!;
      const e = await reg.validerRemboursement(rid, rita).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(reg.ErreurAccesRegularisation);
      expect((e as Error).message).toBe(reg.MESSAGE_VALIDATION_REMBOURSEMENT);
      const refus = await getDb().select().from(schema.journalAudit).where(and(eq(schema.journalAudit.action, 'acces.refuse'), eq(schema.journalAudit.objetId, String(rid))));
      expect(refus).toHaveLength(1);
      await expect(reg.effectuerRemboursement(rid, { moyen: 'especes', date: dateDuJour() }, fin)).rejects.toThrow('validé par la Direction');
      await reg.validerRemboursement(rid, dir);
      const [rb] = await getDb().select().from(schema.remboursement).where(eq(schema.remboursement.id, rid));
      expect(rb).toMatchObject({ statut: 'valide', valideParId: dir.id });
      expect((await notifications(d.id, 'remboursement_valide')).map((x) => x.destinataireId).sort()).toEqual([fin.id, rita.id].sort());
      expect((await dossier(d.id)).statut).toBe('placements_confirmes');

      // Sortie : Finances uniquement (ou Direction) ; justificatif obligatoire hors espèces.
      await expect(reg.effectuerRemboursement(rid, { moyen: 'orange_money', reference: 'OM-1', date: dateDuJour() }, rita)).rejects.toThrow(reg.MESSAGE_EXECUTION_REMBOURSEMENT);
      await expect(reg.effectuerRemboursement(rid, { moyen: 'orange_money', reference: 'OM-1', date: dateDuJour() }, fin)).rejects.toThrow('justificatif');
      const sortie = await reg.effectuerRemboursement(rid, { moyen: 'orange_money', reference: 'OM 2611.77', date: dateDuJour(), justificatif: { nom: 'recu.png', octets: PNG } }, fin);
      expect(sortie.soldeRecu).toBe(true);
      const [ecriture] = await getDb().select().from(schema.encaissement).where(eq(schema.encaissement.id, sortie.encaissementId));
      expect(ecriture).toMatchObject({ type: 'remboursement', montant: -5000, moyen: 'orange_money', reference: 'OM 2611.77', referenceNormalisee: 'OM2611.77', remboursementId: rid });
      const [doc] = await getDb().select().from(schema.document).where(eq(schema.document.id, ecriture!.justificatifDocumentId!));
      expect(doc).toMatchObject({ dossierId: d.id, categorie: 'justificatif' });
      expect((await getDb().select().from(schema.remboursement).where(eq(schema.remboursement.id, rid)))[0]).toMatchObject({ statut: 'effectue', encaissementId: sortie.encaissementId });
      expect(await dossier(d.id)).toMatchObject({ statut: 'solde_recu' });
      s = (await situationFinanciere(d.id))!;
      expect(s).toMatchObject({ nets: 20000, tropPercu: 0, remboursementEnAttente: false });
    }, 240_000);
  });

  describe('RG-12 : crédit client', () => {
    it('trop-perçu versé au crédit ; nouveau devis : déduction proposée (retirable) ; imputée à l’acceptation, acompte payé avant (RG-06) → « Acompte reçu »', async () => {
      const whatsapp = '+237699300001';
      const d = await nouveauDossier(10, whatsapp);
      await devisAccepteEtAcompte(d);
      await placementsConfirmes(d, 4);
      await svc.cloturerRecherche(d.id, 'Fin de la recherche', rita);
      const a = await reg.preparerAjustement(d.id, { choix: 'credit' }, rita);
      expect(a).toMatchObject({ montant: 5000, remboursementId: null, soldeRecu: true });
      const dos = await dossier(d.id);
      expect(dos.statut).toBe('solde_recu');
      const [credit] = await getDb().select().from(schema.encaissement).where(and(eq(schema.encaissement.dossierId, d.id), eq(schema.encaissement.type, 'credit')));
      expect(credit).toMatchObject({ montant: -5000, nature: 'autre', moyen: 'credit_client' });
      expect(await creditDisponible(getDb(), dos.clientId)).toBe(5000);

      // Nouveau dossier du même client (même numéro WhatsApp) : déduction de 5 000 proposée.
      const r2 = await dossiers.creerDemande({ type: 'REC', canal: 'site', formulaire: 'test', client: { type: 'entreprise', nom: 'Hôtel bis', contact: 'M. Kamga', whatsapp }, villeId: null, villeAutre: 'Kribi', quartierId: null, quartierAutre: null, lieu: null, secteur: null, description: null, lignes: [{ intitule: 'Serveur', nombre: 10 }], donnees: { bis: 1 } });
      expect((await dossier(r2.dossierId)).clientId).toBe(dos.clientId);
      await getDb().update(schema.dossier).set({ referentId: rita.id, statut: 'en_qualification' }).where(eq(schema.dossier.id, r2.dossierId));
      const { devisId } = await devisSvc.creerDevis(r2.dossierId, rita);
      const devis = async () => (await getDb().select().from(schema.devis).where(eq(schema.devis.id, devisId)))[0]!;
      expect(await devis()).toMatchObject({ totalTtc: 50000, deductionCredit: 5000 });
      expect((await devisSvc.lireDevisDossier(r2.dossierId, rita))!.creditClient).toBe(5000);
      await devisSvc.modifierDevis(devisId, { nombres: [10], conserverDeduction: false }, rita);
      expect((await devis()).deductionCredit).toBe(0);
      await devisSvc.modifierDevis(devisId, { nombres: [10], conserverDeduction: true }, rita);
      expect((await devis()).deductionCredit).toBe(5000);

      // RG-06 : 20 000 encaissés avant l'acceptation (devis envoyé), puis acceptation.
      await getDb().update(schema.devis).set({ statut: 'envoye', envoyeLe: new Date(), expireLe: new Date(Date.now() + 15 * JOUR) }).where(eq(schema.devis.id, devisId));
      await getDb().update(schema.dossier).set({ statut: 'devis_envoye' }).where(eq(schema.dossier.id, r2.dossierId));
      await getDb().insert(schema.encaissement).values({ dossierId: r2.dossierId, devisId, nature: 'acompte', montant: 20000, moyen: 'especes', recuLe: HIER });
      await getDb().transaction((tx) => effets.accepterDevis(tx, devisId, { mode: 'suivi', signataireNom: 'Paul Kamga', signataireFonction: 'Gérant' }, { type: 'client' }));
      const [imputation] = await getDb().select().from(schema.encaissement).where(and(eq(schema.encaissement.dossierId, r2.dossierId), eq(schema.encaissement.type, 'credit')));
      expect(imputation).toMatchObject({ montant: 5000, nature: 'acompte', moyen: 'credit_client', devisId });
      const mouvements = await getDb().select().from(schema.mouvementCredit).where(eq(schema.mouvementCredit.clientId, dos.clientId)).orderBy(asc(schema.mouvementCredit.id));
      expect(mouvements.map((m) => [m.montant, m.devisId])).toEqual([
        [5000, null],
        [-5000, devisId],
      ]);
      expect(await creditDisponible(getDb(), dos.clientId)).toBe(0);
      expect((await dossier(r2.dossierId)).statut).toBe('acompte_recu');
      expect((await situationFinanciere(r2.dossierId))!.etatAcompte).toMatchObject({ etat: 'complet', encaisse: 25000 });
    }, 240_000);
  });

  describe('RG-09 : impayés', () => {
    it('relance à J+15 puis J+22 (pas à J+21), référent et Finances notifiés ; modèle « Relance solde » proposé', async () => {
      const d = await nouveauDossier();
      await devisAccepteEtAcompte(d);
      await placementsConfirmes(d, 7);
      const r = await svc.cloturerRecherche(d.id, 'Fin de la recherche', rita);
      const [f] = await getDb().select().from(schema.facture).where(eq(schema.facture.id, r.facturation.facture!.id));
      const t0 = f!.emiseLe.getTime();
      const relances = async () => (await notifications(d.id, 'solde_impaye')).length;

      // Modèle proposé tant que le solde est impayé.
      const ctx = await modeles.contexteDossier(d.id, { id: rita.id, nom: 'Rita' });
      expect(ctx['solde.facture']).toBe(f!.numero);
      expect(ctx['solde.reste']).toBe('10 000 FCFA');
      const proposes = await modeles.listerModeles({ type: 'REC', actifsSeulement: true, soldeImpaye: !!ctx['solde.facture'] });
      const relance = proposes.find((m) => m.nom === 'Relance solde');
      expect(relance).toBeDefined();
      expect(rendreMessage(relance!.texte, ctx)).toContain(`${f!.numero}`);
      expect((await modeles.listerModeles({ type: 'REC', actifsSeulement: true })).some((m) => m.nom === 'Relance solde')).toBe(false);

      await reg.relancerSoldesImpayes(new Date(t0 + 14 * JOUR));
      expect(await relances()).toBe(0);
      await reg.relancerSoldesImpayes(new Date(t0 + 15 * JOUR + 60_000));
      expect(await relances()).toBe(2); // référent + Responsable finances
      expect((await dossier(d.id)).derniereRelanceSoldeLe?.getTime()).toBe(t0 + 15 * JOUR + 60_000);
      await reg.relancerSoldesImpayes(new Date(t0 + 21 * JOUR + 60_000));
      expect(await relances()).toBe(2);
      await reg.relancerSoldesImpayes(new Date(t0 + 22 * JOUR + 60_000));
      expect(await relances()).toBe(4);

      // Solde payé : plus de relance, plus de modèle.
      await getDb().insert(schema.encaissement).values({ dossierId: d.id, nature: 'solde', montant: 10000, moyen: 'especes', recuLe: HIER });
      await reg.relancerSoldesImpayes(new Date(t0 + 40 * JOUR));
      expect(await relances()).toBe(4);
      expect((await modeles.contexteDossier(d.id, { id: rita.id, nom: 'Rita' }))['solde.facture']).toBeUndefined();
    }, 240_000);
  });

  describe('Cas limite : « Sans suite » après acompte', () => {
    it('clôture anticipée financière : placements confirmés dus, trop-perçu à régulariser, propositions retirées', async () => {
      const d = await nouveauDossier();
      await devisAccepteEtAcompte(d);
      await placementsConfirmes(d, 2);
      const enCours = await retenue(d.id, d.ligneId);
      const r = await getDb().transaction((tx) => reg.regulariserSansSuite(tx, d.id, 'Le client abandonne', { type: 'collaborateur', id: rita.id }));
      expect(r!.issue).toEqual({ issue: 'trop_percu', montant: 15000 });
      expect(r!.factureId).not.toBeNull();
      const [avoir] = await getDb().select().from(schema.facture).where(eq(schema.facture.id, r!.factureId!));
      expect(avoir).toMatchObject({ type: 'avoir', totalTtc: 15000 });
      expect(await dossier(d.id)).toMatchObject({ montantFinalTtc: 10000, placementsRetenus: 2, rechercheClotureMotif: 'Sans suite : Le client abandonne' });
      expect((await dossier(d.id)).rechercheClotureLe).not.toBeNull();
      expect((await getDb().select().from(schema.proposition).where(eq(schema.proposition.id, enCours)))[0]!.statut).toBe('retiree');
      expect(await notifications(d.id, 'trop_percu')).toHaveLength(1);
      // Déjà clôturée : sans effet.
      expect(await getDb().transaction((tx) => reg.regulariserSansSuite(tx, d.id, 'Encore', { type: 'systeme' }))).toBeNull();
    }, 240_000);

    it('sans encaissement : sans effet', async () => {
      const d = await nouveauDossier();
      await devisAccepteEtAcompte(d, 0);
      expect(await getDb().transaction((tx) => reg.regulariserSansSuite(tx, d.id, 'Abandon', { type: 'systeme' }))).toBeNull();
      expect((await dossier(d.id)).rechercheClotureLe).toBeNull();
    }, 120_000);
  });
});
