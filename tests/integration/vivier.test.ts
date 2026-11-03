// Vivier et file « Nouveaux candidats » (specs/MVP2-02, lot A) sur une vraie base PostgreSQL :
// RG-01 (inscription → file du référent), RG-02 (traitement depuis la file), RG-03 (escalade,
// alerte « non traités »), RG-13 (403 journalisé), RG-14..16 (recherche, rayon, pré-filtrage).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

// Session Back-Office simulée : le collaborateur « connecté » est choisi par chaque test.
const session = vi.hoisted(() => ({ courant: null as null | { id: string; nom: string; email: string; roles: ('referent' | 'direction')[]; deuxFacteurs: boolean; ip: string | null } }));
vi.mock('@/lib/authz/session', () => ({
  exigerCollaborateur: async () => {
    if (!session.courant) throw new Error('non connecté');
    return session.courant;
  },
}));
vi.mock('next/navigation', () => ({
  forbidden: () => {
    throw Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;403'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;403' });
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT;${url}`);
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

describe.skipIf(!baseDisponible)('Vivier et file Nouveaux candidats (intégration)', async () => {
  const { and, desc, eq, ne } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const collab = await import('@/lib/collaborateurs/service');
  const svc = await import('@/lib/candidats/service');
  const vivier = await import('@/lib/candidats/vivier');
  const escalade = await import('@/lib/candidats/escalade');
  const { lireFiltres, lienTrouverCandidats } = await import('@/lib/candidats/recherche');
  const { changerStatutCandidat } = await import('@/lib/candidats/attribution');
  const { exigerAccesVivier } = await import('@/lib/candidats/acces-page');
  const { traiterDepuisFile } = await import('@/app/(backoffice)/admin/(prive)/candidats/actions');
  const { brouillonCandidatVide } = await import('@/lib/candidats/domaine');

  type R = 'referent' | 'direction';
  type Personne = { id: string; nom: string; roles: R[] };
  const douala1 = (s: string) => new Date(`${s}+01:00`);
  let douala: number;
  let yaounde: number;
  const q: Record<string, number> = {};
  let dir: Personne;
  let recYao: Personne;
  let recDla: Personne;
  let refNet: Personne;
  let seq = 0;

  const connecter = (p: Personne) => {
    session.courant = { id: p.id, nom: p.nom, email: `${p.id}@nexclean.test`, roles: p.roles, deuxFacteurs: true, ip: '10.0.0.9' };
  };
  const candidat = async (id: number) => (await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, id)))[0]!;

  /** Candidat inséré directement (recherche) ; attribué à recDla par défaut pour ne pas polluer la file Non attribués. */
  async function inserer(v: Partial<typeof schema.candidat.$inferInsert> & { experiences?: string[]; cv?: boolean } = {}) {
    const { experiences = [], cv = false, ...champs } = v;
    const [c] = await getDb()
      .insert(schema.candidat)
      .values({ nom: `Test${++seq}`, prenom: 'Candidat', telephone: `+2376910${String(seq).padStart(5, '0')}`, villeId: douala, referentId: recDla.id, statut: 'a_contacter', ...champs })
      .returning({ id: schema.candidat.id });
    for (const [i, duree] of experiences.entries()) await getDb().insert(schema.candidatExperience).values({ candidatId: c!.id, ordre: i + 1, poste: 'Poste', duree });
    if (cv) await getDb().insert(schema.candidatDocument).values({ candidatId: c!.id, categorie: 'cv', cle: `cv-${c!.id}`, nomOrigine: 'cv.pdf', mime: 'application/pdf', taille: 100 });
    return c!.id;
  }
  const chercher = async (p: Record<string, string>) => vivier.rechercherCandidats(lireFiltres(p));
  const ids = (r: { lignes: { id: number }[] }) => r.lignes.map((l) => l.id);

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    const villes = await geo.listesLieux();
    douala = villes.find((v) => v.nom === 'Douala')!.id;
    yaounde = villes.find((v) => v.nom === 'Yaoundé')!.id;
    for (const v of villes) for (const x of v.quartiers) q[x.nom] ??= x.id;
    // Centroïdes approximatifs (ADR 0021 §4) ; Deido reste sans centroïde.
    const centroides: Record<string, [number, number]> = { Akwa: [4.0511, 9.7], Bonapriso: [4.035, 9.69], 'Bonabéri': [4.07, 9.63], Bonamoussadi: [4.089, 9.742], Makepe: [4.075, 9.755] };
    for (const [nom, [latitude, longitude]] of Object.entries(centroides)) await getDb().update(schema.quartier).set({ latitude, longitude }).where(eq(schema.quartier.id, q[nom]!));

    const mk = async (nom: string, roles: R[], services: ('NET' | 'REC')[], villeIds: number[]): Promise<Personne> => {
      const id = (await collab.creerCollaborateur({ nom, email: `${nom.toLowerCase().replace(/\s/g, '.')}@nexclean.test`, roles }, { id: null })).userId;
      if (services.length) await collab.definirAttributs(id, { services, villeIds, telephone: '+237690000099', capacite: null, absentDu: null, absentAu: null }, { id: null });
      return { id, nom, roles };
    };
    dir = await mk('Diane Direction', ['direction'], [], []);
    recYao = await mk('Yasmine Recrutement', ['referent'], ['REC'], [yaounde]);
    recDla = await mk('Didier Recrutement', ['referent'], ['REC'], [douala]);
    refNet = await mk('Nadia Nettoyage', ['referent'], ['NET'], [douala]);
  }, 60_000);

  const brouillon = (telephone: string, villeId: number | null, extra: Partial<ReturnType<typeof brouillonCandidatVide>> = {}) => ({
    ...brouillonCandidatVide(),
    nom: 'Essomba',
    prenom: 'Lucie',
    telephone,
    villeId,
    villeAutre: villeId ? '' : 'Kribi',
    quartierAutre: 'Centre',
    zonesTouteVille: true,
    metiers: ['Caissière'],
    typesContrat: ['CDI'],
    niveauEtudes: 'BEPC / CAP',
    disponibilite: 'immediate' as const,
    consentementTraitement: true,
    consentementContact: true,
    consentementMajorite: true,
    ...extra,
  });

  describe('File « Nouveaux candidats » (RG-01, RG-02)', () => {
    let lucie: number;

    it('RG-01 : une inscription à Yaoundé arrive dans la file du référent recrutement couvrant Yaoundé', async () => {
      lucie = (await svc.inscrireCandidat(brouillon('690200001', yaounde), 'motdepasse-1', { ip: null })).candidatId;
      expect(await candidat(lucie)).toMatchObject({ referentId: recYao.id, statut: 'nouveau', enFileDepuis: null });
      expect((await candidat(lucie)).attribueLe).toBeInstanceOf(Date);
      const file = await vivier.fileNouveauxCandidats(recYao);
      expect(ids(file)).toEqual([lucie]);
      expect(file.total).toBe(1);
      expect(file.lignes[0]).toMatchObject({ prenom: 'Lucie', villeNom: 'Yaoundé', referentNom: 'Yasmine Recrutement' });
      expect(await vivier.compterNouveauxCandidats(recYao.id)).toBe(1);
      // Pas dans la file d'un autre référent ; la Direction voit toutes les files.
      expect(ids(await vivier.fileNouveauxCandidats(recDla))).not.toContain(lucie);
      expect(ids(await vivier.fileNouveauxCandidats(dir))).toContain(lucie);
      expect(ids(await vivier.fileNouveauxCandidats(dir, { referentId: recDla.id }))).not.toContain(lucie);
    });

    it('les plus anciens d’abord', async () => {
      const second = (await svc.inscrireCandidat(brouillon('690200002', yaounde, { prenom: 'Paul' }), 'motdepasse-1', { ip: null })).candidatId;
      await getDb().update(schema.candidat).set({ creeLe: douala1('2026-01-01T08:00:00') }).where(eq(schema.candidat.id, second));
      expect(ids(await vivier.fileNouveauxCandidats(recYao))).toEqual([second, lucie]);
      await changerStatutCandidat(second, 'indisponible', recYao);
    });

    it('RG-02 : un autre référent ne peut pas traiter ; le statut posé fait sortir de la file (journalisé)', async () => {
      connecter(recDla);
      expect(await traiterDepuisFile(lucie, 'a_contacter')).toEqual({ ok: false, erreur: 'Ce candidat est suivi par un autre référent.' });
      connecter(recYao);
      expect(await traiterDepuisFile(lucie, 'place')).toMatchObject({ ok: false });
      expect(await traiterDepuisFile(lucie, 'nouveau')).toMatchObject({ ok: true });
      expect(ids(await vivier.fileNouveauxCandidats(recYao))).toEqual([lucie]);
      expect(await traiterDepuisFile(lucie, 'preselectionne')).toMatchObject({ ok: true });
      expect((await candidat(lucie)).statut).toBe('preselectionne');
      expect(ids(await vivier.fileNouveauxCandidats(recYao))).toEqual([]);
      const [j] = await getDb()
        .select()
        .from(schema.journalAudit)
        .where(and(eq(schema.journalAudit.action, 'candidat.statut_modifie'), eq(schema.journalAudit.objetId, String(lucie))))
        .orderBy(desc(schema.journalAudit.id));
      expect(j).toMatchObject({ acteurId: recYao.id, avant: { statut: 'nouveau' }, apres: { statut: 'preselectionne' } });
    });

    it('sans référent éligible : file « Non attribués » de la Direction', async () => {
      const id = (await svc.inscrireCandidat(brouillon('690200003', null), 'motdepasse-1', { ip: null })).candidatId;
      expect(await candidat(id)).toMatchObject({ referentId: null });
      expect((await candidat(id)).enFileDepuis).toBeInstanceOf(Date);
      expect(ids(await vivier.fileCandidatsNonAttribues())).toContain(id);
      expect(await vivier.compterCandidatsNonAttribues()).toBeGreaterThanOrEqual(1);
      expect(ids(await vivier.fileNouveauxCandidats(dir))).not.toContain(id);
    });
  });

  describe('Escalade (RG-03)', () => {
    it('non attribué depuis 4 h ouvrées : relance groupée de la Direction, puis chaque jour ouvré à 8 h', async () => {
      const id = (await svc.inscrireCandidat(brouillon('690200004', null, { prenom: 'Escalade' }), 'motdepasse-1', { ip: null })).candidatId;
      // Seul ce candidat est en file pour ce test.
      await getDb().update(schema.candidat).set({ enFileDepuis: null }).where(ne(schema.candidat.id, id));
      await getDb().update(schema.candidat).set({ enFileDepuis: douala1('2026-11-06T17:00:00'), derniereRelanceLe: null }).where(eq(schema.candidat.id, id));
      const relances = () => getDb().select().from(schema.notification).where(eq(schema.notification.type, 'escalade_candidats'));

      expect(await escalade.escaladerCandidatsNonAttribues(douala1('2026-11-07T09:59:00'))).toBe(0);
      expect(await escalade.escaladerCandidatsNonAttribues(douala1('2026-11-07T10:00:00'))).toBe(1);
      const [n] = await relances();
      expect(n).toMatchObject({ destinataireId: dir.id, email: true, inApp: false, lien: '/admin/candidats?onglet=non_attribues' });
      expect(n!.texte).toContain('Escalade Essomba');
      expect(await escalade.escaladerCandidatsNonAttribues(douala1('2026-11-07T16:00:00'))).toBe(0);
      expect(await escalade.escaladerCandidatsNonAttribues(douala1('2026-11-08T12:00:00'))).toBe(0);
      expect(await escalade.escaladerCandidatsNonAttribues(douala1('2026-11-09T08:00:00'))).toBe(1);
      expect(await relances()).toHaveLength(2);
    });

    it('« N nouveaux candidats non traités depuis 5 jours ouvrés » : une alerte par candidat et par période', async () => {
      const a = await inserer({ statut: 'nouveau', referentId: recDla.id, attribueLe: douala1('2026-11-02T09:00:00') });
      const b = await inserer({ statut: 'nouveau', referentId: recDla.id, attribueLe: douala1('2026-11-02T09:30:00') });
      // Seuls ces deux candidats sont « nouveaux » pour ce test.
      await getDb().update(schema.candidat).set({ statut: 'a_contacter' }).where(and(eq(schema.candidat.statut, 'nouveau'), ne(schema.candidat.id, a), ne(schema.candidat.id, b)));
      const alertes = () => getDb().select().from(schema.notification).where(and(eq(schema.notification.type, 'candidats_non_traites'), eq(schema.notification.destinataireId, recDla.id)));

      // Samedi 7 novembre, 9 h 15 : 5 jours ouvrés (mardi → samedi) écoulés pour les deux.
      expect(await escalade.alerterCandidatsNonTraites(douala1('2026-11-07T09:15:00'))).toBe(1);
      expect(await escalade.alerterCandidatsNonTraites(douala1('2026-11-07T09:40:00'))).toBe(1);
      expect(await escalade.alerterCandidatsNonTraites(douala1('2026-11-07T10:00:00'))).toBe(0);
      const liste = await alertes();
      expect(liste).toHaveLength(2);
      expect(liste.every((x) => x.email && x.inApp && x.lien === '/admin/candidats')).toBe(true);
      expect(liste.map((x) => x.titre)).toEqual(['1 nouveau(x) candidat(s) non traité(s) depuis 5 jours ouvrés', '1 nouveau(x) candidat(s) non traité(s) depuis 5 jours ouvrés']);
      // Dimanche non ouvré ; lundi : la période suivante n'est pas échue.
      expect(await escalade.alerterCandidatsNonTraites(douala1('2026-11-08T12:00:00'))).toBe(0);
      expect(await escalade.alerterCandidatsNonTraites(douala1('2026-11-09T12:00:00'))).toBe(0);
      // Traité entre-temps : plus d'alerte.
      await getDb().update(schema.candidat).set({ statut: 'a_contacter' }).where(eq(schema.candidat.id, b));
      expect(await escalade.alerterCandidatsNonTraites(douala1('2026-11-13T09:30:00'))).toBe(1);
      expect((await candidat(a)).alerteNonTraiteLe).toEqual(douala1('2026-11-13T09:30:00'));
    });

    it('les tâches planifiées comptent les escalades de candidats', async () => {
      const { executerTaches } = await import('@/lib/taches');
      const r = await executerTaches(douala1('2026-11-14T09:00:00'));
      expect(r).toHaveProperty('escaladesCandidats');
      expect(r).toHaveProperty('candidatsNonTraites');
    });
  });

  describe('Accès (RG-13)', () => {
    // La page /admin/candidats (et toute page ou action du vivier) commence par exigerAccesVivier().
    it('Référent sans service Recrutement : 403 sur /admin/candidats, tentative journalisée', async () => {
      connecter(refNet);
      await expect(exigerAccesVivier()).rejects.toThrow(/403/);
      const [j] = await getDb()
        .select()
        .from(schema.journalAudit)
        .where(and(eq(schema.journalAudit.action, 'acces.refuse'), eq(schema.journalAudit.acteurId, refNet.id)))
        .orderBy(desc(schema.journalAudit.id));
      expect(j?.details).toMatchObject({ permission: 'candidat.voir', vivier: true });
      expect(j?.ip).toBe('10.0.0.9');
      // L'action de la file est gardée de la même façon.
      await expect(traiterDepuisFile(1, 'a_contacter')).rejects.toThrow(/403/);
    });

    it('Référent recrutement et Direction : accès accordé ; réaffectation réservée à la Direction', async () => {
      connecter(recDla);
      await expect(exigerAccesVivier()).resolves.toMatchObject({ id: recDla.id });
      await expect(exigerAccesVivier('candidat.reaffecter')).rejects.toThrow(/403/);
      connecter(dir);
      await expect(exigerAccesVivier('candidat.reaffecter')).resolves.toMatchObject({ id: dir.id });
    });
  });

  describe('Recherche (RG-14, RG-15, RG-06)', () => {
    let akwa: number;
    let bonapriso: number;
    let bonaberi: number;
    let deido: number;

    beforeAll(async () => {
      const vendeur = { metiers: ['Vendeur en boutique'], typesContrat: ['CDI'] };
      akwa = await inserer({ ...vendeur, quartierId: q.Akwa });
      bonapriso = await inserer({ ...vendeur, quartierId: q.Bonapriso });
      bonaberi = await inserer({ ...vendeur, quartierId: q['Bonabéri'] });
      deido = await inserer({ ...vendeur, quartierId: q.Deido });
    });

    it('RG-14 rayon : à 5 km d’Akwa → Akwa (0 km) et Bonapriso (≈ 2 km), pas Bonabéri (≈ 8 km)', async () => {
      const r = await chercher({ quartier: String(q.Akwa), rayon: '5', metier: 'vendeur' });
      expect(ids(r).sort()).toEqual([akwa, bonapriso].sort());
      const dist = Object.fromEntries(r.lignes.map((l) => [l.id, l.distanceKm]));
      expect(dist[akwa]).toBe(0);
      expect(dist[bonapriso]).toBeGreaterThan(1.5);
      expect(dist[bonapriso]).toBeLessThan(2.5);
      // Le tri par défaut met les plus proches en tête.
      expect(ids(r)).toEqual([akwa, bonapriso]);
      // Cas limite : quartier sans centroïde exclu, avec la mention « afficher quand même ».
      expect(r.nonGeolocalises).toBe(1);
      const tous = await chercher({ quartier: String(q.Akwa), rayon: '5', metier: 'vendeur', nongeo: '1' });
      expect(ids(tous).sort()).toEqual([akwa, bonapriso, deido].sort());
      expect(ids(await chercher({ quartier: String(q.Akwa), rayon: '10', metier: 'vendeur' })).sort()).toEqual([akwa, bonapriso, bonaberi].sort());
    });

    it('quartier du centre sans centroïde : filtre sur le quartier lui-même', async () => {
      const r = await chercher({ quartier: String(q.Deido), rayon: '5', metier: 'vendeur' });
      expect(ids(r)).toEqual([deido]);
      expect(r.centreSansCentroide).toBe(true);
    });

    it('ville, arrondissement, quartier', async () => {
      expect(ids(await chercher({ ville: String(yaounde), metier: 'vendeur' }))).toEqual([]);
      expect(ids(await chercher({ quartier: String(q.Bonapriso), metier: 'vendeur' }))).toEqual([bonapriso]);
      const [douala4] = await getDb().select({ id: schema.arrondissement.id }).from(schema.arrondissement).where(eq(schema.arrondissement.nom, 'Douala IV'));
      expect(ids(await chercher({ arrondissement: String(douala4!.id), metier: 'vendeur' }))).toEqual([bonaberi]);
    });

    it('zones de travail acceptées couvrant un lieu (« toute la ville » = tout lieu de la ville)', async () => {
      const toute = await inserer({ metiers: ['Gardien'], zonesTouteVille: true });
      const precis = await inserer({ metiers: ['Gardien'], zonesQuartierIds: [q.Akwa!] });
      const arr = await inserer({ metiers: ['Gardien'], zonesArrondissementIds: [(await getDb().select().from(schema.quartier).where(eq(schema.quartier.id, q.Bonapriso!)))[0]!.arrondissementId!] });
      const ailleurs = await inserer({ metiers: ['Gardien'], villeId: yaounde, zonesTouteVille: true });
      expect(ids(await chercher({ zone: String(q.Akwa), metier: 'gardien' })).sort()).toEqual([toute, precis, arr].sort());
      expect(ids(await chercher({ zone: String(q['Bonabéri']), metier: 'gardien' }))).toEqual([toute]);
      expect(ids(await chercher({ metier: 'gardien' }))).toContain(ailleurs);
    });

    it('RG-15 : plein texte insensible aux accents et à la casse (métiers, compétences, expériences, qualifications)', async () => {
      const p1 = await inserer({ metiers: ['Aide-cuisinière'], competences: ['Pâtisserie fine'] });
      const p2 = await inserer({ metiers: ['Commis'], qualifications: 'CAP Électricité bâtiment' });
      const p3 = await inserer({ metiers: ['Commis'] });
      await getDb().insert(schema.candidatExperience).values({ candidatId: p3, ordre: 1, poste: 'Réceptionniste', missions: 'Accueil hôtel' });
      expect(ids(await chercher({ q: 'PATISSERIE' }))).toEqual([p1]);
      expect(ids(await chercher({ q: 'cuisiniere patisserie' }))).toEqual([p1]);
      expect(ids(await chercher({ q: 'electricite' }))).toEqual([p2]);
      expect(ids(await chercher({ q: 'receptionniste hotel' }))).toEqual([p3]);
      expect(ids(await chercher({ q: 'pâtisserie électricité' }))).toEqual([]);
      expect(ids(await chercher({ q: '100%' }))).toEqual([]);
    });

    it('expérience, contrat, secteur, compétences, disponibilité, prétentions, CV, profil complet', async () => {
      const m = { metiers: ['Chauffeur'] };
      const exp = await inserer({ ...m, experiences: ['18 mois', '1 an'], typesContrat: ['CDD'], secteurs: ['Logistique'], competences: ['Permis C'], disponibilite: 'immediate', salaireMin: 90000, cv: true });
      const court = await inserer({ ...m, experiences: ['6 mois'], typesContrat: ['CDI'], disponibilite: 'a_partir_du', disponibleLe: '2026-12-15', salaireMin: 150000 });
      const sans = await inserer({ ...m, disponibilite: 'preavis' });
      expect(ids(await chercher({ metier: 'chauffeur', exp: '2' }))).toEqual([exp]);
      expect(ids(await chercher({ metier: 'chauffeur', contrat: 'CDD' }))).toEqual([exp]);
      expect(ids(await chercher({ metier: 'chauffeur', secteur: 'Logistique' }))).toEqual([exp]);
      expect(ids(await chercher({ metier: 'chauffeur', competences: 'permis c' }))).toEqual([exp]);
      expect(ids(await chercher({ metier: 'chauffeur', dispo: 'immediate' }))).toEqual([exp]);
      expect(ids(await chercher({ metier: 'chauffeur', dispoAvant: '2026-12-31' })).sort()).toEqual([exp, court].sort());
      expect(ids(await chercher({ metier: 'chauffeur', pretention: '100000' })).sort()).toEqual([exp, sans].sort());
      expect(ids(await chercher({ metier: 'chauffeur', cv: '1' }))).toEqual([exp]);
      expect(ids(await chercher({ metier: 'chauffeur', complet: '1' }))).toEqual([]);
      await getDb()
        .update(schema.candidat)
        .set({ email: 'c@x.cm', repere: 'Carrefour', qualifications: 'Permis', horaires: ['jour'] })
        .where(eq(schema.candidat.id, exp));
      expect(ids(await chercher({ metier: 'chauffeur', complet: '1' }))).toEqual([exp]);
      expect((await chercher({ metier: 'chauffeur', exp: '2' })).lignes[0]!.experienceAnnees).toBeCloseTo(2.5);
    });

    it('RG-06 : placés et indisponibles exclus par défaut ; comptes supprimés jamais affichés', async () => {
      const m = { metiers: ['Jardinier'] };
      const actif = await inserer(m);
      const place = await inserer({ ...m, statut: 'place' });
      const indispo = await inserer({ ...m, statut: 'indisponible' });
      const supprime = await inserer({ ...m, supprimeLe: new Date(), telephone: null });
      expect(ids(await chercher({ metier: 'jardinier' }))).toEqual([actif]);
      expect(ids(await chercher({ metier: 'jardinier', inactifs: '1' })).sort()).toEqual([actif, place, indispo].sort());
      expect(ids(await chercher({ metier: 'jardinier', statut: 'place' }))).toEqual([place]);
      expect(ids(await chercher({ metier: 'jardinier', inactifs: '1' }))).not.toContain(supprime);
      expect(ids(await vivier.fileCandidatsNonAttribues())).not.toContain(supprime);
    });

    it('pagination par 20', async () => {
      for (let i = 0; i < 23; i++) await inserer({ metiers: ['Manutentionnaire'] });
      const p1 = await chercher({ metier: 'manutentionnaire' });
      expect(p1).toMatchObject({ total: 23, page: 1, suivante: true });
      expect(p1.lignes).toHaveLength(20);
      const p2 = await chercher({ metier: 'manutentionnaire', page: '2' });
      expect(p2).toMatchObject({ total: 23, page: 2, suivante: false });
      expect(p2.lignes).toHaveLength(3);
    });
  });

  describe('« Trouver des candidats » depuis un Dossier REC (RG-16)', () => {
    it('ligne « Serveur, CDD, Bonamoussadi » : recherche pré-remplie, triée par pertinence', async () => {
      const [client] = await getDb().insert(schema.client).values({ type: 'entreprise', nom: 'Hôtel du Wouri', whatsapp: '+237699000123' }).returning();
      const [dossier] = await getDb()
        .insert(schema.dossier)
        .values({ numero: 'REC-2026-99001', type: 'REC', clientId: client!.id, villeId: douala, quartierId: q.Bonamoussadi, jetonSuivi: `jeton-vivier-${Date.now()}` })
        .returning();
      const [ligne] = await getDb().insert(schema.lignePoste).values({ dossierId: dossier!.id, ordre: 1, intitule: 'Serveur', nombre: 2, typeContrat: 'CDD', experience: '1 à 3 ans' }).returning();

      const parfait = await inserer({ metiers: ['Serveur'], typesContrat: ['CDD'], experiences: ['2 ans'], quartierId: q.Bonamoussadi, disponibilite: 'immediate' });
      const deux = await inserer({ metiers: ['Serveur en restauration'], typesContrat: ['CDI'], experiences: ['3 ans'], quartierId: q.Makepe });
      const un = await inserer({ metiers: ['Cuisinier'], typesContrat: ['CDD'], quartierId: q.Bonamoussadi });
      const loin = await inserer({ metiers: ['Serveur'], typesContrat: ['CDD'], experiences: ['2 ans'], quartierId: q['Bonabéri'] });
      const aucun = await inserer({ metiers: ['Comptable'], typesContrat: ['Stage'], quartierId: q.Bonamoussadi });

      const geoloc = await vivier.quartiersGeolocalises([dossier!.quartierId!]);
      const lien = lienTrouverCandidats(ligne!, { villeId: dossier!.villeId, quartierId: dossier!.quartierId, quartierGeolocalise: geoloc.has(dossier!.quartierId!) });
      const p = Object.fromEntries(new URLSearchParams(lien.split('?')[1]));
      expect(p).toMatchObject({ onglet: 'vivier', ville: String(douala), quartier: String(q.Bonamoussadi), rayon: '5', metier: 'Serveur', contrat: 'CDD', exp: '1', tri: 'pertinence' });

      const r = await chercher(p);
      const miens = ids(r).filter((id) => [parfait, deux, un, loin, aucun].includes(id));
      expect(miens).toEqual([parfait, deux, un]);
      expect(r.criteres).toBe(3);
      expect(r.lignes.find((l) => l.id === parfait)!.pertinence).toBe(3);
      expect(r.lignes.find((l) => l.id === deux)!.pertinence).toBe(2);
      // Filtres modifiables : en correspondance stricte, seul le profil complet reste.
      const strict = await chercher({ ...p, souple: '' });
      expect(ids(strict).filter((id) => [parfait, deux, un].includes(id))).toEqual([parfait]);
    });
  });
});
