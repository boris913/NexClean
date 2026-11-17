// POST-03 (ADR 0020) sur une vraie base PostgreSQL : catégories semées par la migration, saisie,
// modification, annulation et justificatif des dépenses ; indicateurs du tableau de bord direction
// (facturé, encaissé, impayés par ancienneté, dépenses, résultat, trésorerie, marges) ; export CSV.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Dépenses et tableau de bord direction (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-depenses-'));

  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const svc = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');
  const dep = await import('@/lib/depenses/service');
  const ind = await import('@/lib/depenses/indicateurs');
  const { getStockage } = await import('@/lib/fichiers/stockage');

  type R = 'referent' | 'direction' | 'finances' | 'admin';
  type A = { id: string; roles: R[]; ip: string | null };
  const maintenant = new Date('2026-11-20T10:00:00Z');
  const novembre = { du: '2026-11-01', au: '2026-11-30' };
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  const PDF = new TextEncoder().encode('%PDF-1.4 facture fournisseur');

  let fin: A;
  let dir: A;
  let ref: A;
  let adm: A;
  let douala: number;
  let cat: Record<string, number>;
  let seq = 0;
  type D = { id: number; numero: string };
  let a: D; // REC : acompte de septembre payé, solde de novembre impayé
  let b: D; // REC : acompte du 1er novembre (émis le 31/10 à 23 h 30 UTC), encaissement partiel, annulation, avoir
  let c: D; // NET : vieille facture, réglée à moitié par crédit client
  const ids: Record<string, number> = {};

  async function nouveauDossier(type: 'REC' | 'NET'): Promise<D> {
    const r = await svc.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: `Société ${++seq}`, contact: 'M. Ekané', whatsapp: `+23769900${String(seq).padStart(4, '0')}` },
      villeId: null,
      villeAutre: 'Kribi',
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: null,
      description: null,
      lignes: [{ intitule: 'Agent', nombre: 2 }],
      donnees: { test: 1 },
    });
    if (type !== 'REC') await getDb().update(schema.dossier).set({ type }).where(eq(schema.dossier.id, r.dossierId));
    const [d] = await getDb().select({ id: schema.dossier.id, numero: schema.dossier.numero }).from(schema.dossier).where(eq(schema.dossier.id, r.dossierId));
    return d!;
  }

  const facturer = (d: D, o: { type: 'acompte' | 'solde' | 'avoir'; ht: number; tva: number; emiseLe: string }) =>
    getDb()
      .insert(schema.facture)
      .values({
        numero: `FAC-2026-${String(++seq).padStart(5, '0')}`,
        type: o.type,
        dossierId: d.id,
        libelle: o.type === 'avoir' ? 'Avoir de correction' : 'Facture',
        lignes: [{ libelle: 'Prestation', quantite: 1, prixUnitaire: o.ht, montantHt: o.ht }],
        tauxTva: o.tva ? 19 : 0,
        totalHt: o.ht,
        montantTva: o.tva,
        totalTtc: o.ht + o.tva,
        client: { nom: 'Société', contact: null, whatsapp: '+237', email: null, ville: 'Douala' },
        mentionsLegales: 'M',
        emiseLe: new Date(o.emiseLe),
      })
      .returning({ id: schema.facture.id, numero: schema.facture.numero })
      .then((r) => r[0]!);

  const encaisser = (d: D, o: { montant: number; recuLe: string; type?: 'encaissement' | 'annulation' | 'remboursement' | 'credit'; annule?: number }) =>
    getDb()
      .insert(schema.encaissement)
      .values({
        dossierId: d.id,
        type: o.type ?? 'encaissement',
        nature: 'acompte',
        montant: o.montant,
        moyen: o.type === 'credit' ? 'credit_client' : 'mtn_momo',
        reference: `MP-${++seq}`,
        recuLe: o.recuLe,
        annuleEncaissementId: o.annule ?? null,
        motif: o.annule ? 'Erreur' : null,
        recuNumero: (o.type ?? 'encaissement') === 'encaissement' ? `REÇ-2026-${String(seq).padStart(5, '0')}` : null,
      })
      .returning({ id: schema.encaissement.id })
      .then((r) => r[0]!.id);

  const saisie = (o: Partial<Parameters<typeof dep.creerDepense>[0]> & { categorie: string }) => ({
    depenseLe: '2026-11-04',
    categorieId: cat[o.categorie]!,
    libelle: 'Dépense de test',
    montant: 1000,
    moyen: 'especes' as const,
    reference: null,
    villeId: null,
    dossierNumero: null,
    service: null,
    commentaire: null,
    ...o,
  });

  const journal = async (action: string, objetId?: number) =>
    getDb()
      .select()
      .from(schema.journalAudit)
      .where(objetId === undefined ? eq(schema.journalAudit.action, action) : and(eq(schema.journalAudit.action, action), eq(schema.journalAudit.objetId, String(objetId))));

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    douala = (await geo.listesLieux()).find((v) => v.nom === 'Douala')!.id;
    const mk = async (nom: string, roles: R[]): Promise<A> => ({ id: (await collab.creerCollaborateur({ nom, email: `${nom.toLowerCase().split(' ')[0]}-dep@nexclean.test`, roles }, { id: null })).userId, roles, ip: '41.202.1.9' });
    fin = await mk('Fanny Finances', ['finances']);
    dir = await mk('Diane Direction', ['direction']);
    ref = await mk('Rita Référente', ['referent']);
    adm = await mk('Alain Admin', ['admin']);
    cat = Object.fromEntries((await dep.listerCategories()).map((k) => [k.libelle, k.id]));

    a = await nouveauDossier('REC');
    b = await nouveauDossier('REC');
    c = await nouveauDossier('NET');

    // A : acompte de septembre (TTC 29 813) payé ; solde de novembre (TTC 11 925) impayé.
    await facturer(a, { type: 'acompte', ht: 25_000, tva: 4_813, emiseLe: '2026-09-01T09:00:00Z' });
    await encaisser(a, { montant: 29_813, recuLe: '2026-09-10' });
    ids.soldeA = (await facturer(a, { type: 'solde', ht: 10_000, tva: 1_925, emiseLe: '2026-11-03T09:00:00Z' })).id;

    // B : acompte de 20 000 émis le 31/10 à 23 h 30 UTC, soit le 1er novembre à Douala ; 15 000 encaissés,
    // 5 000 encaissés puis annulés ; avoir de 2 000 → 3 000 impayés.
    ids.acompteB = (await facturer(b, { type: 'acompte', ht: 20_000, tva: 0, emiseLe: '2026-10-31T23:30:00Z' })).id;
    await encaisser(b, { montant: 15_000, recuLe: '2026-11-05' });
    const errone = await encaisser(b, { montant: 5_000, recuLe: '2026-11-06' });
    await encaisser(b, { montant: -5_000, recuLe: '2026-11-07', type: 'annulation', annule: errone });
    await facturer(b, { type: 'avoir', ht: 2_000, tva: 0, emiseLe: '2026-11-10T09:00:00Z' });

    // C : facture d'août de 8 000, réglée à moitié par un crédit client (pas un mouvement d'argent).
    ids.factureC = (await facturer(c, { type: 'solde', ht: 8_000, tva: 0, emiseLe: '2026-08-01T10:00:00Z' })).id;
    await encaisser(c, { montant: 4_000, recuLe: '2026-11-08', type: 'credit' });
  });

  it('RG-02 : la migration sème les 10 catégories, actives, « Autre » en dernier', async () => {
    const k = await dep.listerCategories();
    expect(k).toHaveLength(10);
    expect(k.every((x) => x.actif && x.depenses === 0)).toBe(true);
    expect(k.at(-1)!.libelle).toBe('Autre');
  });

  it('RG-01 : saisie par Finances et Direction, avec justificatif ; refus pour le Référent et l’Administrateur', async () => {
    ids.d1 = await dep.creerDepense(saisie({ categorie: 'Transport', libelle: 'Taxi entretiens candidats', montant: 3_500, depenseLe: '2026-11-04', dossierNumero: a.numero.toLowerCase(), villeId: douala }), { nom: 'reçu-taxi.png', octets: PNG }, fin, maintenant);
    ids.d2 = await dep.creerDepense(saisie({ categorie: 'Matériel', libelle: 'Aspirateur', montant: 10_000, depenseLe: '2026-11-12', service: 'NET', moyen: 'orange_money', reference: 'OM-77' }), null, dir, maintenant);
    ids.d3 = await dep.creerDepense(saisie({ categorie: 'Loyer et charges', libelle: 'Loyer bureau', montant: 50_000, depenseLe: '2026-11-01', moyen: 'virement' }), { nom: 'quittance.pdf', octets: PDF }, fin, maintenant);
    ids.d4 = await dep.creerDepense(saisie({ categorie: 'Transport', libelle: 'Moto (doublon)', montant: 2_000, depenseLe: '2026-11-15' }), null, fin, maintenant);
    ids.d5 = await dep.creerDepense(saisie({ categorie: 'Transport', libelle: 'Taxi d’octobre', montant: 7_000, depenseLe: '2026-10-30' }), null, fin, maintenant);

    const d1 = (await getDb().select().from(schema.depense).where(eq(schema.depense.id, ids.d1)))[0]!;
    // Le service suit le Dossier (REC), pas le choix du formulaire.
    expect(d1).toMatchObject({ dossierId: a.id, service: 'REC', villeId: douala, montant: 3_500, justificatifMime: 'image/png', justificatifNom: 'reçu-taxi.png', auteurId: fin.id });
    expect(d1.justificatifCle).toMatch(/^depenses\/2026-11\/.+\.png$/);
    expect((await getDb().select().from(schema.depense).where(eq(schema.depense.id, ids.d2)))[0]).toMatchObject({ dossierId: null, service: 'NET', moyen: 'orange_money' });
    expect(await journal('depense.creee', ids.d1)).toHaveLength(1);

    await expect(dep.creerDepense(saisie({ categorie: 'Transport' }), null, ref, maintenant)).rejects.toThrow(/Réservé/);
    await expect(dep.creerDepense(saisie({ categorie: 'Transport' }), null, adm, maintenant)).rejects.toThrow(/Réservé/);
  });

  it('RG-01 : refuse date future, Dossier inconnu, justificatif non conforme — sans fichier orphelin', async () => {
    const avant = (await getDb().select().from(schema.depense)).length;
    await expect(dep.creerDepense(saisie({ categorie: 'Transport', depenseLe: '2026-11-21' }), null, fin, maintenant)).rejects.toThrow(/futur/);
    await expect(dep.creerDepense(saisie({ categorie: 'Transport', dossierNumero: 'REC-2026-99999' }), { nom: 'x.png', octets: PNG }, fin, maintenant)).rejects.toThrow(/introuvable/);
    await expect(dep.creerDepense(saisie({ categorie: 'Transport' }), { nom: 'virus.pdf', octets: new TextEncoder().encode('MZ exécutable') }, fin, maintenant)).rejects.toThrow(/Justificatif/);
    expect((await getDb().select().from(schema.depense)).length).toBe(avant);
    const fichiers = await fs.readdir(path.join(process.env.STORAGE_DIR!, 'depenses', '2026-11'));
    expect(fichiers).toHaveLength(2); // d1 et d3 seulement
  });

  it('RG-07 : justificatif lu après contrôle des droits, lectures et refus journalisés', async () => {
    const f = await dep.lireJustificatif(ids.d1, fin);
    expect(f).toMatchObject({ nom: 'reçu-taxi.png', mime: 'image/png' });
    expect([...f!.octets]).toEqual([...PNG]);
    expect(await dep.lireJustificatif(ids.d2, dir)).toBeNull();
    await expect(dep.lireJustificatif(ids.d1, ref)).rejects.toBeInstanceOf(dep.ErreurAccesDepense);
    expect(await journal('depense.justificatif_telecharge', ids.d1)).toHaveLength(1);
    expect((await journal('acces.refuse', ids.d1)).filter((j) => j.acteurId === ref.id)).toHaveLength(1);
  });

  it('RG-03 : modification journalisée (avant / après), remplacement du justificatif', async () => {
    const [ancien] = await getDb().select({ cle: schema.depense.justificatifCle }).from(schema.depense).where(eq(schema.depense.id, ids.d3));
    await dep.modifierDepense(ids.d3, saisie({ categorie: 'Loyer et charges', libelle: 'Loyer bureau Akwa', montant: 50_000, depenseLe: '2026-11-01', moyen: 'virement' }), { nom: 'quittance-signée.pdf', octets: PDF }, dir, maintenant);
    const [apres] = await getDb().select().from(schema.depense).where(eq(schema.depense.id, ids.d3));
    expect(apres).toMatchObject({ libelle: 'Loyer bureau Akwa', justificatifNom: 'quittance-signée.pdf', majParId: dir.id });
    expect(apres!.justificatifCle).not.toBe(ancien!.cle);
    await expect(getStockage().lire(ancien!.cle!)).rejects.toThrow();
    const [j] = await journal('depense.modifiee', ids.d3);
    expect(j).toMatchObject({ avant: { libelle: 'Loyer bureau' }, apres: { libelle: 'Loyer bureau Akwa' }, details: { justificatif: 'remplace' } });
  });

  it('RG-06 : annulation motivée, définitive, sans suppression', async () => {
    await expect(dep.annulerDepense(ids.d4, ' ', fin, maintenant)).rejects.toThrow(/motif/);
    await dep.annulerDepense(ids.d4, 'Saisie en double', fin, maintenant);
    expect((await getDb().select().from(schema.depense).where(eq(schema.depense.id, ids.d4)))[0]).toMatchObject({ motifAnnulation: 'Saisie en double', annuleeParId: fin.id });
    await expect(dep.annulerDepense(ids.d4, 'Encore', fin, maintenant)).rejects.toThrow(/déjà annulée/);
    await expect(dep.modifierDepense(ids.d4, saisie({ categorie: 'Transport', montant: 1 }), null, fin, maintenant)).rejects.toThrow(/annulée/);
    expect(await journal('depense.annulee', ids.d4)).toHaveLength(1);
  });

  it('RG-05 : liste filtrée par période et catégorie, total hors annulées', async () => {
    const nov = await dep.listerDepenses(novembre, fin);
    expect(nov.lignes.map((l) => l.id).sort()).toEqual([ids.d1, ids.d2, ids.d3].sort());
    expect(nov.total).toBe(63_500);
    const avecAnnulees = await dep.listerDepenses({ ...novembre, annulees: true }, fin);
    expect(avecAnnulees.lignes).toHaveLength(4);
    expect(avecAnnulees.total).toBe(63_500);
    const transport = await dep.listerDepenses({ ...novembre, categorieId: cat.Transport }, fin);
    expect(transport.lignes.map((l) => l.id)).toEqual([ids.d1]);
    expect(transport.lignes[0]).toMatchObject({ numeroDossier: a.numero, ville: 'Douala', aJustificatif: true, categorie: 'Transport' });
    await expect(dep.listerDepenses(novembre, ref)).rejects.toThrow(/Réservé/);
  });

  it('RG-02 : catégories — Direction et Admin ; désactivation plutôt que suppression d’une catégorie utilisée', async () => {
    await expect(dep.creerCategorie({ libelle: 'Formation' }, fin)).rejects.toThrow(/Réservé/);
    const formation = await dep.creerCategorie({ libelle: 'Formation', ordre: 95 }, adm);
    await expect(dep.creerCategorie({ libelle: 'formation' }, dir)).rejects.toThrow(/déjà/);
    await dep.supprimerCategorie(formation, dir);
    await expect(dep.supprimerCategorie(cat.Transport!, dir)).rejects.toThrow(/désactivez-la/);

    await dep.changerActivationCategorie(cat.Transport!, false, dir);
    expect((await dep.listerCategories({ actives: true })).map((k) => k.libelle)).not.toContain('Transport');
    await expect(dep.creerDepense(saisie({ categorie: 'Transport' }), null, fin, maintenant)).rejects.toThrow(/désactivée/);
    // Une dépense existante garde sa catégorie désactivée et reste modifiable.
    await dep.modifierDepense(ids.d1, saisie({ categorie: 'Transport', libelle: 'Taxi entretiens candidats', montant: 3_500, depenseLe: '2026-11-04', dossierNumero: a.numero, villeId: douala }), null, fin, maintenant);
    await dep.changerActivationCategorie(cat.Transport!, true, dir);
    expect(await journal('categorie_depense.desactivee', cat.Transport)).toHaveLength(1);
  });

  it('ADR 0020 §2 : facturé, encaissé, dépenses, résultat estimé et trésorerie de novembre', async () => {
    const t = await ind.tableauDirection(novembre, maintenant);
    // Facturé : solde A (10 000 HT / 11 925 TTC) + acompte B (20 000, émis le 1er novembre à Douala) − avoir B (2 000).
    expect(t.sommes).toEqual({ facturesHt: 30_000, facturesTtc: 31_925, avoirsHt: 2_000, avoirsTtc: 2_000, encaisse: 15_000, depenses: 63_500 });
    expect(t.indicateurs).toEqual({ factureHt: 28_000, factureTtc: 29_925, encaisse: 15_000, depenses: 63_500, resultatEstime: -35_500, tresorerie: -48_500 });
    expect(t.depensesParCategorie.map((d) => [d.libelle, d.montant, d.nombre])).toEqual([
      ['Loyer et charges', 50_000, 1],
      ['Matériel', 10_000, 1],
      ['Transport', 3_500, 1],
    ]);
    // Octobre : seule la dépense du 30/10 ; l'acompte B (31/10 23 h 30 UTC) n'y est pas.
    const octobre = await ind.sommesPeriode({ du: '2026-10-01', au: '2026-10-31' });
    expect(octobre).toMatchObject({ facturesTtc: 0, depenses: 7_000, encaisse: 0 });
  });

  it('RG-11 : impayés par ancienneté, au jour d’arrêté (aujourd’hui si la période n’est pas finie)', async () => {
    const t = await ind.tableauDirection(novembre, maintenant);
    expect(t.impayes.arrete).toBe('2026-11-20');
    expect(t.impayes.factures.map((f) => [f.factureId, f.restant, f.ancienneteJours])).toEqual([
      [ids.factureC, 4_000, 111],
      [ids.acompteB, 3_000, 19],
      [ids.soldeA, 11_925, 17],
    ]);
    expect(t.impayes.total).toBe(18_925);
    expect(t.impayes.tranches.map((x) => [x.code, x.montant, x.nombre])).toEqual([
      ['0_30', 14_925, 2],
      ['31_60', 0, 0],
      ['61_90', 0, 0],
      ['plus_90', 4_000, 1],
    ]);
    // Arrêté au 31 octobre : ni le solde A ni l'avoir B n'existent encore ; B n'a rien reçu.
    const oct = await ind.facturesImpayees({ du: '2026-10-01', au: '2026-10-31' }, maintenant);
    expect(oct.arrete).toBe('2026-10-31');
    expect(oct.factures.map((f) => [f.factureId, f.restant])).toEqual([[ids.factureC, 8_000]]);
  });

  it('RG-14 : marge par dossier et par service (dépenses rattachées seulement)', async () => {
    const t = await ind.tableauDirection(novembre, maintenant);
    expect(t.margesDossiers.map((m) => [m.dossierId, m.factureHt, m.depenses, m.marge])).toEqual([
      [b.id, 18_000, 0, 18_000],
      [a.id, 10_000, 3_500, 6_500],
    ]);
    expect(t.margesServices).toEqual([
      { service: 'REC', factureHt: 28_000, depenses: 3_500, marge: 24_500, taux: 88 },
      { service: 'NET', factureHt: 0, depenses: 10_000, marge: -10_000, taux: null },
    ]);
  });

  it('RG-15 : export comptable — factures, avoirs et dépenses non annulées, journalisé', async () => {
    const csv = await ind.exporterComptable(novembre, { id: fin.id, ip: fin.ip });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lignes = csv.slice(1).trim().split('\r\n');
    expect(lignes).toHaveLength(1 + 3 + 3);
    // Par date (jour de Douala) ; à date égale, les factures avant les dépenses.
    expect(lignes.slice(1).map((l) => l.split(';').slice(0, 2).join(' '))).toEqual(['Facture 2026-11-01', 'Dépense 2026-11-01', 'Facture 2026-11-03', 'Dépense 2026-11-04', 'Avoir 2026-11-10', 'Dépense 2026-11-12']);
    expect(lignes.find((l) => l.startsWith('Avoir'))).toMatch(/;-2000;0;-2000;$/);
    expect(lignes.find((l) => l.includes('Taxi entretiens candidats'))).toMatch(/^Dépense;2026-11-04;DEP-\d{5};/);
    expect(csv).not.toContain('Moto (doublon)');
    expect(csv).not.toContain('Taxi d’octobre');
    const [j] = await journal('finances.export_comptable');
    expect(j).toMatchObject({ acteurId: fin.id, details: { du: '2026-11-01', au: '2026-11-30', lignes: 6 } });
  });
});
