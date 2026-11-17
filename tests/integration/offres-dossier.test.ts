// Offres liées à une ligne de poste (ADR 0013 §5, ADR 0015 §3) sur une vraie base PostgreSQL :
// fermeture automatique quand la ligne est pourvue ou le Dossier fermé, candidatures visibles
// dans le Dossier.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Offres liées à un Dossier (intégration)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');
  process.env.STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'nexclean-offres-dossier-'));

  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const dossiers = await import('@/lib/dossiers/service');
  const svc = await import('@/lib/propositions/service');
  const collab = await import('@/lib/collaborateurs/service');
  const offres = await import('@/lib/offres/service');
  const k = await import('@/lib/candidats/candidatures');

  type R = 'referent' | 'direction';
  type Acteur = { id: string; nom: string; roles: R[]; ip: string };
  let dir: Acteur;
  let rita: Acteur;
  let nina: Acteur;
  let seq = 0;

  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)]);
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, ...new Array(64).fill(0x20)]);
  const HIER = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  async function collaborateur(nom: string, roles: R[], services: ('REC' | 'NET')[]): Promise<Acteur> {
    const { userId } = await collab.creerCollaborateur({ nom, email: `${nom.toLowerCase()}@offres-dossier.test`, roles }, { id: null });
    if (services.length) await collab.definirAttributs(userId, { services, villeIds: [], telephone: null, capacite: null, absentDu: null, absentAu: null }, { id: null });
    return { id: userId, nom, roles, ip: '10.0.0.3' };
  }

  /** Dossier REC « Recherche en cours » attribué à Rita, acompte encaissé il y a 5 jours. */
  async function nouveauDossier(nombre: number) {
    const r = await dossiers.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: `Client ${++seq}`, contact: 'M. Kamga', whatsapp: `+2376991${String(seq).padStart(5, '0')}` },
      villeId: null,
      villeAutre: 'Douala',
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: 'Restauration',
      description: null,
      lignes: [{ intitule: 'Serveur', nombre }],
      donnees: { n: seq },
    });
    await getDb().update(schema.dossier).set({ referentId: rita.id, statut: 'recherche_en_cours' }).where(eq(schema.dossier.id, r.dossierId));
    await getDb().insert(schema.evenementDossier).values({ dossierId: r.dossierId, type: 'transition', deStatut: 'accepte', versStatut: 'acompte_recu', horodatage: new Date(Date.now() - 5 * 86_400_000) });
    const [l] = await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, r.dossierId));
    return { id: r.dossierId, ligne: l!.id };
  }

  async function nouveauCandidat() {
    const [c] = await getDb()
      .insert(schema.candidat)
      .values({ nom: 'Ngo', prenom: `Awa${++seq}`, telephone: `+2376904${String(seq).padStart(5, '0')}`, statut: 'preselectionne', metiers: ['Serveur'] })
      .returning();
    return c!.id;
  }

  /** Offre pré-remplie depuis la ligne, publiée. */
  async function offrePubliee(ligne: number) {
    const brouillon = await offres.preremplirDepuisLigne(ligne, rita);
    const id = await offres.creerOffre({ ...brouillon, exigences: ['Ponctualité'], missions: ['Servir en salle'] }, rita);
    await offres.changerStatutOffre(id, 'publiee', null, rita);
    return id;
  }

  async function placementConfirme(dossierId: number, ligne: number) {
    const c = await nouveauCandidat();
    const { propositionId } = await svc.creerProposition({ dossierId, lignePosteId: ligne, candidatId: c }, rita);
    await svc.enregistrerAccordWhatsApp(propositionId, { fichier: { nom: 'capture.png', octets: PNG }, date: HIER, numeroCommunicable: false }, rita);
    await svc.changerStatutProposition(propositionId, 'retenue', {}, rita);
    const { placementId } = await svc.annoncerPlacement(propositionId, { datePrevue: HIER }, rita);
    await svc.confirmerPlacementParPreuve(placementId, { fichier: { nom: 'attestation.pdf', octets: PDF }, datePriseDePoste: HIER }, rita);
  }

  const offre = async (id: number) => (await offres.lireOffre(id))!;

  beforeAll(async () => {
    await reinitialiserBase();
    dir = await collaborateur('Dir', ['direction'], []);
    rita = await collaborateur('Rita', ['referent'], ['REC']);
    nina = await collaborateur('Nina', ['referent'], ['NET']);
  }, 120_000);

  it('brouillon pré-rempli : anonyme, lié à la ligne, sans salaire', async () => {
    const d = await nouveauDossier(1);
    const b = await offres.preremplirDepuisLigne(d.ligne, rita);
    expect(b).toMatchObject({ origine: 'placement', lignePosteId: d.ligne, salaire: null, postes: 1 });
    expect(JSON.stringify(b)).not.toContain('Client ');
  });

  it('ADR 0013 §5 : la ligne pourvue ferme l’offre, pas avant', async () => {
    const d = await nouveauDossier(2);
    const id = await offrePubliee(d.ligne);
    await placementConfirme(d.id, d.ligne);
    expect((await offre(id)).statut).toBe('publiee');
    await placementConfirme(d.id, d.ligne);
    expect(await offre(id)).toMatchObject({ statut: 'fermee', motifFermeture: 'Ligne de poste pourvue' });
    // Rouvrir une offre dont la ligne est pourvue est refusé.
    await expect(offres.changerStatutOffre(id, 'publiee', null, rita)).rejects.toThrow(/pourvue/);
  });

  it('ADR 0013 §5 : la fermeture du Dossier ferme ses offres publiées, et seulement elles', async () => {
    const d = await nouveauDossier(3);
    const autre = await nouveauDossier(1);
    const id = await offrePubliee(d.ligne);
    const idAutre = await offrePubliee(autre.ligne);
    const fermees = await getDb().transaction((tx) => offres.fermerOffresDuDossier(tx, d.id, 'Dossier fermé (test)'));
    expect(fermees).toHaveLength(1);
    expect(await offre(id)).toMatchObject({ statut: 'fermee', motifFermeture: 'Dossier fermé (test)' });
    expect((await offre(idAutre)).statut).toBe('publiee');
  });

  it('ADR 0015 §3 : les candidatures à l’offre liée sont visibles dans le Dossier, avec l’accès au vivier', async () => {
    const d = await nouveauDossier(2);
    const id = await offrePubliee(d.ligne);
    const c = await nouveauCandidat();
    await k.postuler(c, (await offre(id)).slug, 'Disponible.', null);
    const lignes = await k.candidaturesDuDossier(d.id, rita);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ candidatId: c, offreId: id, lignePosteId: d.ligne, statut: 'recue' });
    expect(await k.candidaturesDuDossier(d.id, dir)).toHaveLength(1);
    // Référent sans service Recrutement : rien.
    expect(await k.candidaturesDuDossier(d.id, nina)).toEqual([]);
  });
});
