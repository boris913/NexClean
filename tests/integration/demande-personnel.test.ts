// Formulaire public « Demander du personnel » (specs/MVP1-03) sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Demander du personnel (intégration)', async () => {
  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const { soumettreDemandePersonnel, MAX_ENVOIS_IP } = await import('@/lib/dossiers/demande-personnel');
  const { definirParametre, lireParametre } = await import('@/lib/parametres');
  const lecture = await import('@/lib/dossiers/lecture');
  const svc = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');
  const geo = await import('@/lib/geo/service');

  let douala: number;
  let akwa: number;
  let direction: { id: string; roles: ('direction' | 'referent')[] };
  let referent: { id: string; roles: ('direction' | 'referent')[] };
  let ipSuivante = 1;
  const ip = () => `10.0.0.${ipSuivante++}`;

  const ligne = (x: Record<string, unknown> = {}) => ({
    intitule: 'Serveur',
    nombre: '3',
    missions: 'Service en salle',
    competences: '',
    experience: '1 à 3 ans',
    salaire: '80 000',
    typeContrat: 'CDD',
    duree: '6 mois',
    horaires: '',
    joursRepos: ['Lundi'],
    avantages: '',
    datePriseFonction: '',
    desQuePossible: true,
    ...x,
  });
  const formulaire = (x: Record<string, unknown> = {}) => ({
    clientType: 'entreprise',
    entreprise: 'Hôtel Test Bonapriso',
    contact: 'Mme Essomba',
    whatsapp: '690 11 22 33',
    autreTelephone: '',
    email: 'essomba@exemple.cm',
    villeId: douala,
    villeAutre: '',
    arrondissementId: null,
    quartierId: akwa,
    quartierAutre: '',
    lieu: 'Face pharmacie',
    secteur: 'Hôtellerie',
    lignes: [ligne(), ligne({ intitule: 'Cuisinier', nombre: '2', typeContrat: 'CDI', duree: '', salaire: '' })],
    precisions: '',
    consentement: true,
    siteWeb: '',
    commissionAffichee: 5000,
    ...x,
  });

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    const listes = await geo.listesLieux();
    const v = listes.find((l) => l.nom === 'Douala')!;
    douala = v.id;
    akwa = v.quartiers.find((q) => q.nom === 'Akwa')!.id;
    direction = { id: (await collab.creerCollaborateur({ nom: 'Dir', email: 'dir@nexclean.test', roles: ['direction'] }, { id: null })).userId, roles: ['direction'] };
    referent = { id: (await collab.creerCollaborateur({ nom: 'Ref', email: 'ref@nexclean.test', roles: ['referent'] }, { id: null })).userId, roles: ['referent'] };
  });

  it('listes de lieux : villes couvertes en tête, arrondissements et quartiers rattachés', async () => {
    const listes = await geo.listesLieux();
    expect(listes[0]!.couverte).toBe(true);
    const v = listes.find((l) => l.nom === 'Douala')!;
    expect(v.arrondissements.length).toBeGreaterThan(0);
    expect(v.quartiers.some((q) => q.arrondissementId !== null)).toBe(true);
  });

  it('RG-03 / RG-04 : 2 lignes (3 serveurs, 2 cuisiniers) → un seul dossier REC, 5 personnes, estimation 25 000', async () => {
    const r = await soumettreDemandePersonnel(formulaire(), { ip: ip() });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.numero).toMatch(/^REC-\d{4}-\d{5}$/);
    expect(r.estimation).toEqual({ commission: 5000, personnes: 5, montant: 25000 });
    expect(r.lienSuivi).toMatch(/\/suivi\/[\w-]+$/);

    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.numero, r.numero));
    expect(d!.type).toBe('REC');
    expect(d!.statut).toBe('nouvelle_demande');
    expect(d!.secteur).toBe('Hôtellerie');
    const lignes = await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, d!.id));
    expect(lignes.map((l) => [l.intitule, l.nombre, l.typeContrat])).toEqual([
      ['Serveur', 3, 'CDD'],
      ['Cuisinier', 2, 'CDI'],
    ]);
    const [dem] = await getDb().select().from(schema.demande).where(eq(schema.demande.dossierId, d!.id));
    expect(dem!.canal).toBe('site');
    expect(dem!.formulaire).toBe('demande_personnel');
    expect((dem!.donnees as { estimation: unknown }).estimation).toEqual({ commission: 5000, personnes: 5, montant: 25000 });
    expect((dem!.donnees as { consentement: { accepte: boolean } }).consentement.accepte).toBe(true);
    const [c] = await getDb().select().from(schema.client).where(eq(schema.client.id, d!.clientId));
    expect([c!.nom, c!.contact, c!.whatsapp]).toEqual(['Hôtel Test Bonapriso', 'Mme Essomba', '+237690112233']);
  });

  it('RG-09 : accusé de réception envoyé si un e-mail est saisi', async () => {
    consoleInfo.mockClear();
    const r = await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 34', email: 'client2@exemple.cm' }), { ip: ip() });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const sortie = consoleInfo.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sortie).toContain('client2@exemple.cm');
    expect(sortie).toContain(r.numero);
    expect(sortie).toContain('Estimation indicative : 25 000 FCFA');
  });

  it('RG-06 : la Demande conserve 5 000 × 5 = 25 000 après passage de la commission à 6 000', async () => {
    const r = await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 35' }), { ip: ip() });
    if (!r.ok) throw new Error(JSON.stringify(r));
    await definirParametre('commission_par_personne', 6000, { id: direction.id });
    expect(await lireParametre('commission_par_personne')).toBe(6000);

    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.numero, r.numero));
    const [dem] = await getDb().select().from(schema.demande).where(eq(schema.demande.dossierId, d!.id));
    expect((dem!.donnees as { estimation: unknown }).estimation).toEqual({ commission: 5000, personnes: 5, montant: 25000 });

    const suivante = await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 36', commissionAffichee: 6000 }), { ip: ip() });
    if (!suivante.ok) throw new Error(JSON.stringify(suivante));
    expect(suivante.estimation.montant).toBe(30000);

    const [journal] = await getDb().select().from(schema.journalAudit).where(and(eq(schema.journalAudit.action, 'parametre.modifie'), eq(schema.journalAudit.objetId, 'commission_par_personne')));
    expect(journal!.avant).toBe(5000);
    expect(journal!.apres).toBe(6000);
    await definirParametre('commission_par_personne', 5000, { id: direction.id });
  });

  it('RG-06 : un écart entre tarif affiché et tarif en vigueur est conservé', async () => {
    const r = await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 37', commissionAffichee: 4000 }), { ip: ip() });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.numero, r.numero));
    const [dem] = await getDb().select().from(schema.demande).where(eq(schema.demande.dossierId, d!.id));
    expect((dem!.donnees as { estimation: unknown }).estimation).toEqual({ commission: 5000, personnes: 5, montant: 25000, commissionAffichee: 4000 });
  });

  it('RG-07 : le budget est caché au référent non attribué et à la page de suivi', async () => {
    const r = await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 38' }), { ip: ip() });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.numero, r.numero));
    const vueDir = await lecture.lireDossier(d!.id, direction);
    if (!vueDir || vueDir === 'interdit') throw new Error('direction');
    expect(vueDir.lignes[0]!.salaire).toBe('80 000');
    expect(await lecture.lireDossier(d!.id, referent)).toBe('interdit');
    const suivi = await svc.lireSuivi(d!.jetonSuivi, null);
    expect(JSON.stringify(suivi)).not.toContain('80 000');
  });

  it('RG-07 : Finances lit la fiche sans aucune trace du budget (demande brute, historique)', async () => {
    const finances = { id: (await collab.creerCollaborateur({ nom: 'Fin', email: 'fin@nexclean.test', roles: ['finances'] }, { id: null })).userId, roles: ['finances' as const] };
    const r = await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 60' }), { ip: ip() });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.numero, r.numero));
    await svc.remplacerLignes(d!.id, [{ intitule: 'Serveur', nombre: 3, salaire: '90 000' }], { ...direction, ip: null });
    const vueFin = await lecture.lireDossier(d!.id, finances);
    if (!vueFin || vueFin === 'interdit') throw new Error('finances');
    const json = JSON.stringify(vueFin);
    expect(json).not.toMatch(/"salaire":"/);
    expect(json).not.toMatch(/80 000|90 000/);
    const vueDir = await lecture.lireDossier(d!.id, direction);
    expect(JSON.stringify(vueDir)).toContain('90 000');
  });

  it('une durée saisie puis masquée (contrat CDI) n’est pas enregistrée', async () => {
    const r = await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 61', lignes: [ligne({ typeContrat: 'CDI', duree: '6 mois' })] }), { ip: ip() });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.numero, r.numero));
    const [l] = await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, d!.id));
    expect(l!.duree).toBeNull();
  });

  it('validation serveur : CDD sans durée refusé, aucun dossier créé', async () => {
    const avant = (await getDb().select().from(schema.dossier)).length;
    const r = await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 39', lignes: [ligne({ duree: '' })] }), { ip: ip() });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs?.['lignes.0.duree']).toBeDefined();
    expect((await getDb().select().from(schema.dossier)).length).toBe(avant);
  });

  it('anti-doublon : le même envoi deux fois → un seul dossier', async () => {
    const f = formulaire({ whatsapp: '690 11 22 40' });
    const a = await soumettreDemandePersonnel(f, { ip: ip() });
    const b = await soumettreDemandePersonnel(f, { ip: ip() });
    if (!a.ok || !b.ok) throw new Error('envoi');
    expect(b.numero).toBe(a.numero);
    expect(b.doublon).toBe(true);
  });

  it('cas limite : « Autre ville » → dossier créé normalement', async () => {
    const r = await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 41', villeId: null, villeAutre: 'Kribi', quartierId: null, quartierAutre: 'Centre', secteur: 'Services à domicile', clientType: 'particulier', entreprise: '' }), { ip: ip() });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.numero, r.numero));
    expect([d!.villeId, d!.villeAutre, d!.quartierAutre]).toEqual([null, 'Kribi', 'Centre']);
    const [c] = await getDb().select().from(schema.client).where(eq(schema.client.id, d!.clientId));
    expect([c!.type, c!.nom]).toEqual(['particulier', 'Mme Essomba']);
  });

  it('anti-robot : champ piège rempli → refusé et journalisé', async () => {
    const r = await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 42', siteWeb: 'http://spam' }), { ip: '10.9.9.9' });
    expect(r.ok).toBe(false);
    const j = await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'formulaire.robot'));
    expect(j).toHaveLength(1);
  });

  it('limitation : 10 envois / 10 min par IP, le 11e est refusé', async () => {
    const meme = '10.8.8.8';
    for (let i = 0; i < MAX_ENVOIS_IP; i++) {
      const r = await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 50', lignes: [ligne({ nombre: String(i + 1) })] }), { ip: meme });
      expect(r.ok).toBe(true);
    }
    const refuse = await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 50', lignes: [ligne({ nombre: '99' })] }), { ip: meme });
    expect(refuse.ok).toBe(false);
    if (!refuse.ok) expect(refuse.erreur).toMatch(/Trop d’envois/);
    expect((await soumettreDemandePersonnel(formulaire({ whatsapp: '690 11 22 51' }), { ip: '10.8.8.9' })).ok).toBe(true);
  });

  it('paramètres : commission invalide refusée, métiers dédoublonnés', async () => {
    await expect(definirParametre('commission_par_personne', -1, { id: direction.id })).rejects.toThrow();
    await expect(definirParametre('commission_par_personne', 12.5, { id: direction.id })).rejects.toThrow();
    await definirParametre('metiers', ['Serveur', 'Serveur', 'Cuisinier'], { id: direction.id });
    expect(await lireParametre('metiers')).toEqual(['Serveur', 'Cuisinier']);
  });
});
