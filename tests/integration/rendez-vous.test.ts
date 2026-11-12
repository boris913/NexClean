// Rendez-vous (specs/COM1-02 RG-01..03) sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Rendez-vous (intégration)', async () => {
  const { and, eq, like } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const svc = await import('@/lib/dossiers/service');
  const rdv = await import('@/lib/rendezvous/service');
  const { instantDouala } = await import('@/lib/rendezvous/domaine');
  const collab = await import('@/lib/collaborateurs/service');
  const geo = await import('@/lib/geo/service');

  type A = { id: string; roles: ('referent' | 'direction')[] };
  let referent: A;
  let autre: A;
  let direction: A;
  let villeId: number;
  let n = 0;

  // « Maintenant » fixe : mardi 10 novembre 2026, 8 h à Douala.
  const MARDI = instantDouala('2026-11-10', '08:00')!;
  const saisie = (jour = '2026-11-12', heure = '10:00', participants: string[] = []) => ({ type: 'visite_site' as const, jour, heure, dureeMinutes: 60, lieu: 'Akwa, immeuble Socar', participants });

  async function nouveauDossier() {
    const r = await svc.creerDemande(
      {
        type: 'NET',
        canal: 'telephone',
        source: 'bouche_a_oreille',
        formulaire: 'saisie',
        client: { type: 'particulier', nom: `Client RDV ${++n}`, contact: null, whatsapp: `6920000${String(n).padStart(2, "0")}` },
        villeId,
        villeAutre: null,
        quartierId: null,
        quartierAutre: null,
        lieu: null,
        secteur: null,
        description: 'Visite pour devis',
        donnees: {},
      },
      referent,
    );
    await getDb().update(schema.dossier).set({ referentId: referent.id, statut: 'attribuee' }).where(eq(schema.dossier.id, r.dossierId));
    return r.dossierId;
  }
  const notifs = (cle: string) => getDb().select().from(schema.notification).where(like(schema.notification.cle, cle));

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    villeId = (await geo.listesLieux()).find((l) => l.nom === 'Douala')!.id;
    const mk = async (email: string, roles: ('referent' | 'direction')[]) => ({ id: (await collab.creerCollaborateur({ nom: email, email, roles }, { id: null })).userId, roles });
    referent = await mk('ref-rdv@nexclean.test', ['referent']);
    autre = await mk('autre-rdv@nexclean.test', ['referent']);
    direction = await mk('dir-rdv@nexclean.test', ['direction']);
  });

  it('RG-01 : planification historisée, journalisée, participants prévenus', async () => {
    const dossierId = await nouveauDossier();
    const id = await rdv.planifierRendezVous(dossierId, saisie('2026-11-12', '10:00', [direction.id]), referent, MARDI);
    const [r] = await getDb().select().from(schema.rendezVous).where(eq(schema.rendezVous.id, id));
    expect(r).toMatchObject({ type: 'visite_site', statut: 'prevu', debut: new Date('2026-11-12T09:00:00Z'), participants: [direction.id] });
    const evs = await getDb().select().from(schema.evenementDossier).where(and(eq(schema.evenementDossier.dossierId, dossierId), eq(schema.evenementDossier.type, 'rendez_vous')));
    expect(evs[0]!.commentaire).toMatch(/^Rendez-vous planifié : Visite sur site le jeudi 12 novembre à 10:00/);
    expect((await notifs(`rdv:${id}:planifie`)).map((x) => x.destinataireId)).toEqual([direction.id]);
  });

  it('RG-01 : refus dans le passé, sur le dossier d’un autre, ou avec un participant inconnu', async () => {
    const dossierId = await nouveauDossier();
    await expect(rdv.planifierRendezVous(dossierId, saisie('2026-11-09'), referent, MARDI)).rejects.toThrow(/futur/);
    await expect(rdv.planifierRendezVous(dossierId, saisie(), autre, MARDI)).rejects.toThrow(/Accès refusé/);
    await expect(rdv.planifierRendezVous(dossierId, saisie('2026-11-12', '10:00', ['inconnu']), referent, MARDI)).rejects.toThrow(/Participant/);
  });

  it('RG-02 : rappels la veille à 18 h puis 1 h avant, une seule fois chacun, e-mail compris', async () => {
    const dossierId = await nouveauDossier();
    const id = await rdv.planifierRendezVous(dossierId, saisie('2026-11-12', '10:00', [direction.id]), referent, MARDI);
    await rdv.rappelerRendezVous(instantDouala('2026-11-11', '17:45')!);
    expect(await notifs(`rdv:${id}:veille:%`)).toHaveLength(0);

    await rdv.rappelerRendezVous(instantDouala('2026-11-11', '18:00')!);
    await rdv.rappelerRendezVous(instantDouala('2026-11-11', '18:15')!);
    const veille = await notifs(`rdv:${id}:veille:%`);
    expect(veille.map((x) => x.destinataireId).sort()).toEqual([referent.id, direction.id].sort());
    expect(veille.every((x) => x.email && x.titre.startsWith('Demain à 10:00'))).toBe(true);

    await rdv.rappelerRendezVous(instantDouala('2026-11-12', '09:00')!);
    expect(await notifs(`rdv:${id}:h-1:%`)).toHaveLength(2);
  });

  it('RG-02 : une replanification réarme les rappels', async () => {
    const dossierId = await nouveauDossier();
    const id = await rdv.planifierRendezVous(dossierId, saisie('2026-11-12', '10:00'), referent, MARDI);
    await rdv.rappelerRendezVous(instantDouala('2026-11-11', '18:00')!);
    await rdv.modifierRendezVous(id, saisie('2026-11-13', '15:00'), referent, instantDouala('2026-11-11', '19:00')!);
    await rdv.rappelerRendezVous(instantDouala('2026-11-12', '18:00')!);
    expect(await notifs(`rdv:${id}:veille:%`)).toHaveLength(2);
  });

  it('clôture : « fait » exige un compte rendu et un rendez-vous passé ; annulé coupe les rappels', async () => {
    const dossierId = await nouveauDossier();
    const id = await rdv.planifierRendezVous(dossierId, saisie('2026-11-12', '10:00'), referent, MARDI);
    await expect(rdv.cloturerRendezVous(id, 'fait', 'RAS', referent, MARDI)).rejects.toThrow(/pas encore eu lieu/);
    await expect(rdv.cloturerRendezVous(id, 'fait', '', referent, instantDouala('2026-11-12', '12:00')!)).rejects.toThrow(/compte rendu/);
    await rdv.cloturerRendezVous(id, 'fait', 'Surface 120 m², devis à envoyer', referent, instantDouala('2026-11-12', '12:00')!);
    await expect(rdv.cloturerRendezVous(id, 'annule', null, referent)).rejects.toThrow(/déjà clôturé/);

    const id2 = await rdv.planifierRendezVous(dossierId, saisie('2026-11-14', '10:00'), referent, MARDI);
    await rdv.cloturerRendezVous(id2, 'annule', null, referent, MARDI);
    await rdv.rappelerRendezVous(instantDouala('2026-11-13', '18:00')!);
    expect(await notifs(`rdv:${id2}:%:%`)).toHaveLength(0);
  });

  it('RG-02 : rendez-vous resté « prévu » 24 h après → « À relancer » et notification unique', async () => {
    const dossierId = await nouveauDossier();
    const id = await rdv.planifierRendezVous(dossierId, saisie('2026-11-16', '10:00'), referent, MARDI);
    const apres = instantDouala('2026-11-17', '11:30')!;
    expect((await rdv.rendezVousACloturer(referent, apres)).map((r) => r.id)).toContain(id);
    expect((await rdv.rendezVousACloturer(autre, apres)).map((r) => r.id)).not.toContain(id);
    await rdv.rappelerRendezVous(apres);
    await rdv.rappelerRendezVous(apres);
    expect(await notifs(`rdv:${id}:a_cloturer`)).toHaveLength(1);
  });

  it('RG-03 : agenda de la semaine, limité aux dossiers du référent, filtrable par ville', async () => {
    const dossierId = await nouveauDossier();
    const id = await rdv.planifierRendezVous(dossierId, saisie('2026-11-19', '14:30'), referent, MARDI);
    const semaine = { du: instantDouala('2026-11-16', '00:00')!, au: instantDouala('2026-11-23', '00:00')! };
    expect((await rdv.agenda(semaine, referent)).map((r) => r.id)).toContain(id);
    expect((await rdv.agenda(semaine, autre)).map((r) => r.id)).not.toContain(id);
    expect((await rdv.agenda({ ...semaine, referentId: referent.id }, direction)).map((r) => r.id)).toContain(id);
    expect((await rdv.agenda({ ...semaine, villeId: villeId + 999 }, direction)).map((r) => r.id)).not.toContain(id);
  });
});
