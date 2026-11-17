// Offres administrables (ADR 0013) sur une vraie base PostgreSQL : reprise des offres du fichier,
// cycle brouillon → publiée → fermée, droits, candidature refusée hors offre publiée, échéance.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Offres (intégration)', async () => {
  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const collab = await import('@/lib/collaborateurs/service');
  const o = await import('@/lib/offres/service');
  const k = await import('@/lib/candidats/candidatures');
  const { brouillonCandidatureVide, MESSAGE_OFFRE_INCONNUE, MESSAGE_OFFRE_POURVUE } = await import('@/lib/candidats/formulaire-candidature');

  type R = 'referent' | 'direction';
  let douala: number;
  let akwa: number;
  let dir: { id: string; roles: R[] };
  let awa: { id: string; roles: R[] };
  let net: { id: string; roles: R[] };

  const entree = (slug: string) => ({
    slug,
    titre: 'Serveur (H/F)',
    categorie: 'Agent de nettoyage' as const,
    origine: 'interne' as const,
    lieu: 'Bonapriso, Douala',
    contrat: 'CDD 6 mois',
    postes: 1,
    description: 'Accueillir et servir la clientèle d’un restaurant de Bonapriso.',
    exigences: ['Ponctualité'],
    missions: ['Servir en salle'],
    profil: [],
    horaires: [],
  });
  const lire = async (id: number) => (await getDb().select().from(schema.offre).where(eq(schema.offre.id, id)))[0]!;

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    const villes = await geo.listesLieux();
    douala = villes.find((v) => v.nom === 'Douala')!.id;
    akwa = villes.find((v) => v.nom === 'Douala')!.quartiers.find((q) => q.nom === 'Akwa')!.id;
    const mk = async (nom: string, roles: R[], services: ('NET' | 'REC')[]) => {
      const id = (await collab.creerCollaborateur({ nom, email: `${nom.toLowerCase().split(' ')[0]}-o@nexclean.test`, roles }, { id: null })).userId;
      if (services.length) await collab.definirAttributs(id, { services, villeIds: [douala], telephone: '+237690000098', capacite: null, absentDu: null, absentAu: null }, { id: null });
      return { id, roles };
    };
    dir = await mk('Diane Direction', ['direction'], []);
    awa = await mk('Awa Recrutement', ['referent'], ['REC']);
    net = await mk('Nadia Nettoyage', ['referent'], ['NET']);
  });

  it('ADR 0013 §6 : la migration reprend les 8 offres du fichier (4 publiées, 4 fermées)', async () => {
    const toutes = await o.listerOffres();
    expect(toutes).toHaveLength(8);
    expect(toutes.filter((x) => x.statut === 'publiee').map((x) => x.slug).sort()).toEqual(['agent-caisse-akwa', 'community-manager', 'community-manager-prospection', 'prospection-commerciale-terrain']);
    const caisse = toutes.find((x) => x.slug === 'agent-caisse-akwa')!;
    expect(caisse).toMatchObject({ origine: 'placement', postes: 2, accordSalaireClient: true });
    expect(caisse.salaire).toMatchObject({ base: '50 000 FCFA/mois', fixed: true });
  });

  it('cycle complet : brouillon, publication datée, adresse figée, fermeture, réouverture', async () => {
    const id = await o.creerOffre(entree('serveur-bonapriso'), awa);
    expect(await lire(id)).toMatchObject({ statut: 'brouillon', publieeLe: null, creePar: awa.id });

    // Brouillon : l'adresse peut encore changer.
    await o.modifierOffre(id, entree('serveur-bonapriso-2'), awa);
    expect((await lire(id)).slug).toBe('serveur-bonapriso-2');

    await o.changerStatutOffre(id, 'publiee', null, awa, new Date('2026-11-13T09:00:00Z'));
    expect(await lire(id)).toMatchObject({ statut: 'publiee', publieeLe: '2026-11-13' });
    await expect(o.modifierOffre(id, entree('autre-adresse'), awa)).rejects.toThrow(/ne peut plus changer/);

    await o.changerStatutOffre(id, 'fermee', 'Poste pourvu', dir);
    expect(await lire(id)).toMatchObject({ statut: 'fermee', motifFermeture: 'Poste pourvu' });
    await o.changerStatutOffre(id, 'publiee', null, dir, new Date('2026-12-01T09:00:00Z'));
    // La date de première publication est conservée à la réouverture.
    expect(await lire(id)).toMatchObject({ statut: 'publiee', publieeLe: '2026-11-13', fermeeLe: null });

    const journal = await getDb().select({ action: schema.journalAudit.action }).from(schema.journalAudit).where(eq(schema.journalAudit.objetId, String(id)));
    expect(journal.map((j) => j.action)).toEqual(expect.arrayContaining(['offre.creee', 'offre.modifiee', 'offre.publiee', 'offre.fermee']));
  });

  it('refuse une publication incomplète, une adresse déjà prise et un référent hors Recrutement', async () => {
    const id = await o.creerOffre({ ...entree('incomplete'), exigences: [], missions: [] }, dir);
    await expect(o.changerStatutOffre(id, 'publiee', null, dir)).rejects.toThrow(/Avant de publier/);
    await expect(o.creerOffre(entree('agent-caisse-akwa'), dir)).rejects.toThrow(/déjà utilisée/);
    await expect(o.creerOffre(entree('nettoyage-x'), net)).rejects.toThrow(/service Recrutement/);
  });

  it('supprime un brouillon jamais publié, pas une offre publiée', async () => {
    const id = await o.creerOffre(entree('a-supprimer'), awa);
    await o.supprimerBrouillon(id, awa);
    expect(await o.lireOffre(id)).toBeNull();
    const caisse = (await o.listerOffres()).find((x) => x.slug === 'agent-caisse-akwa')!;
    await expect(o.supprimerBrouillon(caisse.id, dir)).rejects.toThrow(/brouillon jamais publié/);
  });

  it('candidature : offre publiée acceptée, brouillon inconnu, offre fermée refusée', async () => {
    const court = (telephone: string) => ({
      ...brouillonCandidatureVide('Agent de nettoyage'),
      nom: 'Ngo',
      prenom: 'Awa',
      telephone,
      villeId: douala,
      quartierId: akwa,
      experience: '1 à 3 ans' as const,
      disponibilite: 'immediate' as const,
      consentementTraitement: true,
      consentementContact: true,
      consentementMajorite: true,
    });
    const r = await k.postulerAvecCompteLeger(court('677100001'), 'motdepasse-1', 'community-manager', null, { ip: null });
    expect(r.candidatureId).toBeGreaterThan(0);

    const brouillon = await o.creerOffre(entree('brouillon-cache'), awa);
    expect(brouillon).toBeGreaterThan(0);
    await expect(k.postulerAvecCompteLeger(court('677100002'), 'motdepasse-1', 'brouillon-cache', null, { ip: null })).rejects.toThrow(MESSAGE_OFFRE_INCONNUE);
    await expect(k.postulerAvecCompteLeger(court('677100003'), 'motdepasse-1', 'agent-nettoyage', null, { ip: null })).rejects.toThrow(MESSAGE_OFFRE_POURVUE);
  });

  it('ferme les offres dont la date limite est passée (tâche planifiée)', async () => {
    const id = await o.creerOffre({ ...entree('echeance-courte'), valableJusquau: '2026-11-20' }, awa);
    await o.changerStatutOffre(id, 'publiee', null, awa, new Date('2026-11-13T09:00:00Z'));
    expect(await o.fermerOffresEchues(new Date('2026-11-20T12:00:00Z'))).toBe(0);
    expect(await o.fermerOffresEchues(new Date('2026-11-21T12:00:00Z'))).toBe(1);
    expect(await lire(id)).toMatchObject({ statut: 'fermee', motifFermeture: 'Date limite de candidature passée' });
  });
});
