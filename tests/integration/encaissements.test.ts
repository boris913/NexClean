// MVP2-05 (lot A) : Encaissements du Back-Office — enregistrement (RG-01), anti-doublon (RG-03),
// gardes de statut (RG-05, RG-06), immuabilité et annulation (RG-02), droits, clôture (RG-13).
// Vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Encaissements — Back-Office (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-enc-'));

  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const dossiers = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');
  const enc = await import('@/lib/encaissements/service');
  const effets = await import('@/lib/encaissements/effets');
  const { accepterDevis } = await import('@/lib/devis/effets');
  const { situationFinanciere } = await import('@/lib/encaissements/lecture');
  const { dateDuJour } = await import('@/lib/encaissements/domaine');
  const { MESSAGE_ENCAISSEMENTS } = await import('@/lib/dossiers/statuts');
  const { calculerDevis } = await import('@/lib/devis/domaine');

  type Acteur = { id: string; roles: ('referent' | 'direction' | 'finances')[] };
  let rita: Acteur;
  let bob: Acteur;
  let fanny: Acteur;
  let dora: Acteur;
  let n = 0;

  const PDF = { nom: 'recu-operateur.pdf', octets: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, ...new Array(64).fill(0x20)]) };
  const AUJOURDHUI = dateDuJour();
  const momo = (montant: number, reference: string, extra: Partial<Parameters<typeof enc.enregistrerEncaissement>[1]> = {}) => ({ nature: 'acompte' as const, montant, moyen: 'mtn_momo' as const, reference, recuLe: AUJOURDHUI, ...extra });
  const dossier = async (id: number) => (await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, id)))[0]!;

  /** Dossier REC de 10 serveurs à 5 000 (acompte 50 % = 25 000), référent Rita. */
  async function preparer(statutDevis: 'accepte' | 'envoye' = 'accepte') {
    n++;
    const r = await dossiers.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: `Hôtel ${n}`, contact: 'M. Kamga', whatsapp: `+2376990011${String(n).padStart(2, '0')}` },
      villeId: null,
      villeAutre: 'Kribi',
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: null,
      description: null,
      lignes: [{ intitule: 'Serveur', nombre: 10 }],
      donnees: { test: n },
    });
    const d = await dossier(r.dossierId);
    const t = calculerDevis([{ lignePosteId: null, intitule: 'Serveur', nombre: 10 }], { commission: 5000, commissionsParCategorie: {}, tauxTva: 0 }, 50);
    const [dv] = await getDb()
      .insert(schema.devis)
      .values({
        dossierId: d.id,
        clientId: d.clientId,
        numero: `DEV-2026-${String(n).padStart(5, '0')}`,
        statut: statutDevis,
        lignes: t.lignes,
        tauxTva: 0,
        totalHt: t.totalHt,
        montantTva: 0,
        totalTtc: t.totalTtc,
        tauxAcompte: 50,
        acompte: t.acompte,
        delaiRechercheJours: 45,
        garantieJours: 15,
        validiteJours: 15,
        conditions: 'C',
        mentionsLegales: 'M',
        accepteLe: statutDevis === 'accepte' ? new Date() : null,
      })
      .returning({ id: schema.devis.id });
    await getDb().update(schema.dossier).set({ referentId: rita.id, statut: statutDevis === 'accepte' ? 'accepte' : 'devis_envoye' }).where(eq(schema.dossier.id, d.id));
    return { dossierId: d.id, devisId: dv!.id };
  }

  beforeAll(async () => {
    await reinitialiserBase();
    const mk = async (email: string, roles: Acteur['roles']): Promise<Acteur> => ({ id: (await collab.creerCollaborateur({ nom: email, email, roles }, { id: null })).userId, roles });
    rita = await mk('rita@nexclean.test', ['referent']);
    bob = await mk('bob@nexclean.test', ['referent']);
    fanny = await mk('fanny@nexclean.test', ['finances']);
    dora = await mk('dora@nexclean.test', ['direction']);
  });

  it('RG-05 : 15 000 → reste « Accepté », acompte partiel 15 000 / 25 000 ; +10 000 → « Acompte reçu »', async () => {
    const { dossierId, devisId } = await preparer();
    const r1 = await enc.enregistrerEncaissement(dossierId, momo(15000, 'MP-RG05-1'), PDF, rita);
    expect(r1.transition).toBeNull();
    expect(r1.encaissements).toEqual([expect.objectContaining({ nature: 'acompte', montant: 15000, recuNumero: expect.stringMatching(/^REÇ-\d{4}-\d{5}$/) })]);
    expect(r1.informations.join(' ')).toContain('compte partiel : 15 000 / 25 000');
    expect((await dossier(dossierId)).statut).toBe('accepte');
    expect((await situationFinanciere(dossierId))!.etatAcompte).toMatchObject({ etat: 'partiel', libelle: 'acompte partiel : 15 000 / 25 000' });

    const r2 = await enc.enregistrerEncaissement(dossierId, momo(10000, 'MP-RG05-2'), PDF, rita);
    expect(r2.transition).toBe('acompte_recu');
    const d = await dossier(dossierId);
    expect(d.statut).toBe('acompte_recu');
    expect(d.acompteCompletLe).not.toBeNull();
    // Rattachement au devis, justificatif stocké comme document `justificatif` du Dossier, reçus numérotés sans trou.
    const lignes = await getDb().select().from(schema.encaissement).where(eq(schema.encaissement.dossierId, dossierId));
    expect(lignes.every((l) => l.devisId === devisId && l.justificatifDocumentId !== null && l.auteurId === rita.id)).toBe(true);
    const [doc] = await getDb().select().from(schema.document).where(eq(schema.document.id, lignes[0]!.justificatifDocumentId!));
    expect(doc).toMatchObject({ dossierId, categorie: 'justificatif', mime: 'application/pdf' });
    const num = (s: string) => Number(s.slice(-5));
    expect(num(r2.encaissements[0]!.recuNumero)).toBe(num(r1.encaissements[0]!.recuNumero) + 1);
    // Historique et journal d'audit.
    const evs = await getDb().select().from(schema.evenementDossier).where(eq(schema.evenementDossier.dossierId, dossierId));
    expect(evs.filter((e) => e.commentaire?.startsWith('Encaissement enregistré'))).toHaveLength(2);
    expect(evs.some((e) => e.versStatut === 'acompte_recu')).toBe(true);
    const audit = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'encaissement.enregistre'));
    expect(audit.length).toBeGreaterThanOrEqual(2);
    // « Acompte reçu » ne se pose plus à la main sur un dossier intégré.
    await getDb().update(schema.dossier).set({ statut: 'accepte' }).where(eq(schema.dossier.id, dossierId));
    await expect(dossiers.changerStatut(dossierId, 'acompte_recu', '25 000 MoMo', rita)).rejects.toThrow(MESSAGE_ENCAISSEMENTS);
  });

  it('RG-01 : contrôles de saisie (référence, justificatif, date future, moyen « autre ») ; espèces sans référence ni justificatif', async () => {
    const { dossierId } = await preparer();
    await expect(enc.enregistrerEncaissement(dossierId, momo(5000, ''), PDF, rita)).rejects.toThrow(/référence/);
    await expect(enc.enregistrerEncaissement(dossierId, momo(5000, 'MP-X1'), null, rita)).rejects.toThrow(/justificatif/);
    await expect(enc.enregistrerEncaissement(dossierId, momo(5000, 'MP-X1', { recuLe: '2999-01-01' }), PDF, rita)).rejects.toThrow(/futur/);
    await expect(enc.enregistrerEncaissement(dossierId, momo(5000, 'MP-X1', { moyen: 'autre' }), PDF, rita)).rejects.toThrow(/commentaire/);
    await expect(enc.enregistrerEncaissement(dossierId, momo(0, 'MP-X1'), PDF, rita)).rejects.toThrow(/montant/);
    await expect(enc.enregistrerEncaissement(dossierId, momo(5000, 'MP-X1'), { nom: 'x.docx', octets: new Uint8Array([1, 2, 3]) }, rita)).rejects.toThrow(/Format/);
    const r = await enc.enregistrerEncaissement(dossierId, { nature: 'acompte', montant: 5000, moyen: 'especes', recuLe: AUJOURDHUI }, null, rita);
    expect(r.encaissements).toHaveLength(1);
    expect(await getDb().select().from(schema.encaissement).where(eq(schema.encaissement.dossierId, dossierId))).toHaveLength(1);
  });

  it('RG-03 : MTN MoMo `MP2611.1234.A` saisi deux fois → refus avec lien vers le premier ; libre après annulation', async () => {
    const a = await preparer();
    const b = await preparer();
    const premier = await enc.enregistrerEncaissement(a.dossierId, momo(10000, 'MP2611.1234.A'), PDF, rita);
    const id = premier.encaissements[0]!.id;
    const erreur = await enc.enregistrerEncaissement(b.dossierId, momo(10000, ' mp2611.1234.a'), PDF, fanny).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(enc.ErreurDoublon);
    expect(erreur).toMatchObject({ dossierId: a.dossierId, encaissementId: id, recuNumero: premier.encaissements[0]!.recuNumero });
    expect((erreur as InstanceType<typeof enc.ErreurDoublon>).lien).toBe(`/admin/dossiers/${a.dossierId}?onglet=finances#encaissement-${id}`);
    // Aucun justificatif orphelin en base pour la saisie refusée.
    expect(await getDb().select().from(schema.document).where(eq(schema.document.dossierId, b.dossierId))).toHaveLength(0);
    // Même référence, autre moyen : pas un doublon.
    await enc.enregistrerEncaissement(b.dossierId, momo(10000, 'MP2611.1234.A', { moyen: 'orange_money' }), PDF, rita);
    // Après annulation du premier, la référence peut être ressaisie.
    await enc.annulerEncaissement(id, 'Montant erroné', fanny);
    await enc.enregistrerEncaissement(a.dossierId, momo(12000, 'MP2611.1234.A'), PDF, rita);
  });

  it('RG-03 : deux saisies simultanées de la même référence → une seule enregistrée', async () => {
    // Deux Dossiers distincts : seul le verrou sur (moyen, référence) sérialise les saisies.
    const a = await preparer();
    const b = await preparer();
    const res = await Promise.allSettled([enc.enregistrerEncaissement(a.dossierId, momo(5000, 'MP-SIMUL-1'), PDF, rita), enc.enregistrerEncaissement(b.dossierId, momo(5000, 'MP-SIMUL-1'), PDF, fanny)]);
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejet = res.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejet.reason).toBeInstanceOf(enc.ErreurDoublon);
    const lignes = await getDb().select().from(schema.encaissement).where(eq(schema.encaissement.referenceNormalisee, 'MP-SIMUL-1'));
    expect(lignes).toHaveLength(1);
  });

  it('Droits : le référent d’un autre dossier est refusé ; Finances et Direction autorisés (référent notifié)', async () => {
    const { dossierId } = await preparer();
    await expect(enc.enregistrerEncaissement(dossierId, momo(5000, 'MP-DROITS-1'), PDF, bob)).rejects.toThrow(dossiers.ErreurAccesDossier);
    await enc.enregistrerEncaissement(dossierId, momo(5000, 'MP-DROITS-2'), PDF, fanny);
    await enc.enregistrerEncaissement(dossierId, momo(5000, 'MP-DROITS-3'), PDF, dora);
    const notes = await getDb().select().from(schema.notification).where(and(eq(schema.notification.destinataireId, rita.id), eq(schema.notification.type, 'encaissement'), eq(schema.notification.dossierId, dossierId)));
    expect(notes).toHaveLength(2);
    await expect(enc.lireEncaissementsDossier(dossierId, bob)).rejects.toThrow(dossiers.ErreurAccesDossier);
    expect(await enc.lireEncaissementsDossier(dossierId, fanny)).toHaveLength(2);
  });

  it('RG-02 : pas de modification ; annulation réservée Finances / Direction ; demande du référent traitée par Finances', async () => {
    const { dossierId } = await preparer();
    const r = await enc.enregistrerEncaissement(dossierId, momo(25000, 'MP-RG02-1'), PDF, rita);
    expect((await dossier(dossierId)).statut).toBe('acompte_recu');
    const id = r.encaissements[0]!.id;
    // Immuable en base (déclencheur) et aucune fonction de modification exposée.
    await expect(getDb().update(schema.encaissement).set({ montant: 20000 }).where(eq(schema.encaissement.id, id))).rejects.toThrow();
    expect(Object.keys(enc).some((k) => /^modifier/i.test(k))).toBe(false);
    // Le référent ne peut pas annuler, ni un autre référent demander.
    await expect(enc.annulerEncaissement(id, 'erreur', rita)).rejects.toThrow(enc.MESSAGE_ANNULATION_RESERVEE);
    await expect(enc.demanderAnnulation(id, 'erreur', bob)).rejects.toThrow(dossiers.ErreurAccesDossier);
    await expect(enc.annulerEncaissement(id, '  ', fanny)).rejects.toThrow(/motif/);
    // Demande du référent → Finances et Direction notifiés.
    const { demandeId } = await enc.demanderAnnulation(id, 'Montant saisi au lieu de 20 000', rita);
    await expect(enc.demanderAnnulation(id, 'encore', rita)).rejects.toThrow(/déjà en cours/);
    const notifs = await getDb().select().from(schema.notification).where(eq(schema.notification.cle, `demande_annulation:${demandeId}`));
    expect(notifs.map((x) => x.destinataireId).sort()).toEqual([fanny.id, dora.id].sort());
    expect((await enc.lireEncaissementsDossier(dossierId, rita))[0]!.demandeEnCours).toMatchObject({ id: demandeId });
    // Refus sans réponse impossible ; acceptation par Finances → écriture inverse, demande traitée, demandeur notifié.
    await expect(enc.traiterDemandeAnnulation(demandeId, 'refuser', '', fanny)).rejects.toThrow(/refus/);
    await expect(enc.traiterDemandeAnnulation(demandeId, 'accepter', null, rita)).rejects.toThrow(enc.MESSAGE_ANNULATION_RESERVEE);
    const res = await enc.traiterDemandeAnnulation(demandeId, 'accepter', null, fanny);
    // Le Dossier a avancé (« Acompte reçu ») : pas de recul automatique, avertissement.
    expect(res!.avertissement).toMatch(/inférieur à l’acompte dû/);
    expect((await dossier(dossierId)).statut).toBe('acompte_recu');
    const lignes = await enc.lireEncaissementsDossier(dossierId, fanny);
    expect(lignes).toHaveLength(2);
    expect(lignes.find((l) => l.id === id)).toMatchObject({ annule: true, demandeEnCours: null });
    expect(lignes.find((l) => l.type === 'annulation')).toMatchObject({ montant: -25000, nature: 'acompte', moyen: 'mtn_momo', annuleEncaissementId: id, recuNumero: null });
    const [dem] = await getDb().select().from(schema.demandeAnnulation).where(eq(schema.demandeAnnulation.id, demandeId));
    expect(dem).toMatchObject({ statut: 'acceptee', traiteeParId: fanny.id });
    expect(await getDb().select().from(schema.notification).where(and(eq(schema.notification.destinataireId, rita.id), eq(schema.notification.cle, `annulation_effectuee:${id}`)))).toHaveLength(1);
    expect((await situationFinanciere(dossierId))!.nets).toBe(0);
    // Une écriture déjà annulée ne s'annule pas deux fois.
    await expect(enc.annulerEncaissement(id, 'encore', dora)).rejects.toThrow(/déjà annulé/);
  });

  it('Cas limite « tout payé au départ » : acompte plafonné, excédent en « Autre » avec son propre reçu', async () => {
    const { dossierId } = await preparer();
    const r = await enc.enregistrerEncaissement(dossierId, momo(40000, 'MP-TOUT-1'), PDF, rita);
    expect(r.encaissements.map((e) => [e.nature, e.montant])).toEqual([
      ['acompte', 25000],
      ['autre', 15000],
    ]);
    expect(new Set(r.encaissements.map((e) => e.recuNumero)).size).toBe(2);
    expect(r.transition).toBe('acompte_recu');
    const s = (await situationFinanciere(dossierId))!;
    expect(s).toMatchObject({ nets: 40000, acompteEncaisse: 25000, resteAPayer: 10000 });
    // Acompte déjà complet : tout part en « Autre ».
    const r2 = await enc.enregistrerEncaissement(dossierId, momo(5000, 'MP-TOUT-2'), PDF, rita);
    expect(r2.encaissements.map((e) => e.nature)).toEqual(['autre']);
  });

  it('RG-06 : acompte avant acceptation → rattaché au devis envoyé, pas de transition tant que non accepté', async () => {
    const { dossierId, devisId } = await preparer('envoye');
    const r = await enc.enregistrerEncaissement(dossierId, momo(25000, 'MP-RG06-1'), PDF, rita);
    expect(r.devis).toMatchObject({ id: devisId, statut: 'envoye' });
    expect(r.transition).toBeNull();
    expect(r.informations.join(' ')).toMatch(/acceptation/);
    expect((await dossier(dossierId)).statut).toBe('devis_envoye');
    const [e] = await getDb().select().from(schema.encaissement).where(eq(schema.encaissement.dossierId, dossierId));
    expect(e!.devisId).toBe(devisId);
    // Pas de « Acompte reçu » à la main sans devis accepté sur le circuit intégré non plus.
    await expect(dossiers.changerStatut(dossierId, 'acompte_recu', 'payé', rita)).rejects.toThrow();
    // Acceptation enregistrée → le Dossier peut avancer.
    await getDb().transaction((tx) => accepterDevis(tx, devisId, { mode: 'suivi', signataireNom: 'M. Kamga', signataireFonction: 'Gérant' }, { type: 'client' }));
    await getDb().transaction((tx) => effets.appliquerGardeAcompte(tx, dossierId));
    expect((await dossier(dossierId)).statut).toBe('acompte_recu');
  });

  it('RG-13 : clôture refusée tant que le solde n’est pas nul', async () => {
    const { dossierId } = await preparer();
    await enc.enregistrerEncaissement(dossierId, momo(25000, 'MP-CLOT-1'), PDF, rita);
    await getDb().update(schema.dossier).set({ statut: 'solde_recu', montantFinalTtc: 35000 }).where(eq(schema.dossier.id, dossierId));
    await expect(dossiers.changerStatut(dossierId, 'cloture', null, rita)).rejects.toThrow(/Il reste 10 000 FCFA à encaisser/);
    await expect(dossiers.changerStatut(dossierId, 'cloture', null, dora)).rejects.toThrow(/à encaisser/);
    // Solde nul, mais reçus sans PDF archivé (rendu du lot C) : documents non émis.
    await getDb().update(schema.dossier).set({ statut: 'placements_confirmes' }).where(eq(schema.dossier.id, dossierId));
    const r = await enc.enregistrerEncaissement(dossierId, { nature: 'solde', montant: 10000, moyen: 'especes', recuLe: AUJOURDHUI }, null, rita);
    expect(r.transition).toBe('solde_recu');
    const recus = await getDb().select().from(schema.recuPdf);
    if (recus.length === 0) await expect(dossiers.changerStatut(dossierId, 'cloture', null, rita)).rejects.toThrow(/Documents non émis/);
  });
});
