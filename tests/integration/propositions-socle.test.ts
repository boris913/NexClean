// Socle MVP2-03 : effets partagés (accord, refus, confirmation) et lignes de poste mises à jour
// en place, sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Propositions — socle (intégration)', async () => {
  const { and, eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const svc = await import('@/lib/dossiers/service');
  const effets = await import('@/lib/propositions/effets');
  const collab = await import('@/lib/collaborateurs/service');

  type R = 'referent' | 'direction';
  let ref: { id: string; roles: R[] };
  let dossierId: number;
  let ligneId: number;
  let clientId: number;
  let seq = 0;

  const nouveauCandidat = async () => {
    const [c] = await getDb()
      .insert(schema.candidat)
      .values({ nom: 'Ngo', prenom: 'Awa', telephone: `+2376902000${String(++seq).padStart(2, '0')}`, statut: 'preselectionne' })
      .returning();
    return c!.id;
  };
  const proposer = async (candidatId: number) => {
    const [p] = await getDb().insert(schema.proposition).values({ dossierId, lignePosteId: ligneId, candidatId, clientId, auteurId: ref.id }).returning();
    return p!.id;
  };
  const tx = <T,>(f: (t: import('@/lib/propositions/effets').Tx) => Promise<T>) => getDb().transaction(f);
  const dossier = async () => (await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, dossierId)))[0]!;

  beforeAll(async () => {
    await reinitialiserBase();
    const id = (await collab.creerCollaborateur({ nom: 'Rita Recrutement', email: 'rita@nexclean.test', roles: ['referent'] }, { id: null })).userId;
    ref = { id, roles: ['referent'] };
    const r = await svc.creerDemande({
      type: 'REC',
      canal: 'site',
      formulaire: 'test',
      client: { type: 'entreprise', nom: 'Hôtel du Lac', contact: 'M. Kamga', whatsapp: '+237699001122' },
      villeId: null,
      villeAutre: 'Kribi',
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: null,
      description: null,
      lignes: [
        { intitule: 'Serveur', nombre: 2 },
        { intitule: 'Cuisinier', nombre: 1 },
      ],
      donnees: { test: 1 },
    });
    dossierId = r.dossierId;
    await getDb().update(schema.dossier).set({ referentId: ref.id, statut: 'recherche_en_cours' }).where(eq(schema.dossier.id, dossierId));
    const lignes = await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId)).orderBy(schema.lignePoste.ordre);
    ligneId = lignes[0]!.id;
    clientId = (await dossier()).clientId;
  });

  it('RG-05 : une seule Proposition active par candidat et par ligne', async () => {
    const c = await nouveauCandidat();
    const p = await proposer(c);
    await expect(proposer(c)).rejects.toThrow();
    await getDb().update(schema.proposition).set({ statut: 'retiree' }).where(eq(schema.proposition.id, p));
    await expect(proposer(c)).resolves.toBeTypeOf('number');
  });

  it('RG-03 : accord WhatsApp sans capture refusé', async () => {
    const p = await proposer(await nouveauCandidat());
    await expect(tx((t) => effets.enregistrerAccord(t, p, { mode: 'whatsapp', le: new Date() }, { type: 'collaborateur', id: ref.id }))).rejects.toThrow('capture');
  });

  it('RG-03, RG-06 : l’accord du candidat rend la Proposition « proposée » et le Dossier « Candidats proposés » (automatique)', async () => {
    const c = await nouveauCandidat();
    const p = await proposer(c);
    await tx((t) => effets.enregistrerAccord(t, p, { mode: 'espace', le: new Date(), numeroCommunicable: true }, { type: 'candidat', candidatId: c }));
    const [prop] = await getDb().select().from(schema.proposition).where(eq(schema.proposition.id, p));
    expect(prop).toMatchObject({ statut: 'proposee', accordMode: 'espace', numeroCommunicable: true });
    expect((await dossier()).statut).toBe('candidats_proposes');
    const transitions = await getDb()
      .select()
      .from(schema.evenementDossier)
      .where(and(eq(schema.evenementDossier.dossierId, dossierId), eq(schema.evenementDossier.type, 'transition')));
    expect(transitions.at(-1)).toMatchObject({ deStatut: 'recherche_en_cours', versStatut: 'candidats_proposes', auteurId: null });
    expect((await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, c)))[0]!.statut).toBe('propose');
    const notifs = await getDb().select().from(schema.notification).where(eq(schema.notification.destinataireId, ref.id));
    expect(notifs.some((n) => n.type === 'proposition_accord')).toBe(true);
    // Un second accord ne refait pas la transition.
    await expect(tx((t) => effets.enregistrerAccord(t, p, { mode: 'espace', le: new Date() }, { type: 'candidat', candidatId: c }))).rejects.toThrow('n’attend plus');
  });

  it('RG-04 : refus du candidat, définitif', async () => {
    const c = await nouveauCandidat();
    const p = await proposer(c);
    await tx((t) => effets.enregistrerRefusCandidat(t, p, 'Trop loin', { type: 'candidat', candidatId: c }));
    const [prop] = await getDb().select().from(schema.proposition).where(eq(schema.proposition.id, p));
    expect(prop).toMatchObject({ statut: 'refusee_candidat', motif: 'Trop loin' });
    await expect(tx((t) => effets.enregistrerAccord(t, p, { mode: 'espace', le: new Date() }, { type: 'candidat', candidatId: c }))).rejects.toThrow();
  });

  it('RG-16, RG-17 : confirmation par le client → placement confirmé, proposition placée, candidat placé et notifié', async () => {
    const c = await nouveauCandidat();
    const p = await proposer(c);
    await tx((t) => effets.enregistrerAccord(t, p, { mode: 'espace', le: new Date() }, { type: 'candidat', candidatId: c }));
    await getDb().update(schema.proposition).set({ statut: 'retenue' }).where(eq(schema.proposition.id, p));
    const [pl] = await getDb().insert(schema.placement).values({ propositionId: p, dossierId, lignePosteId: ligneId, candidatId: c, datePrevue: '2026-11-10', poste: 'Serveur' }).returning();
    await expect(tx((t) => effets.confirmerPlacement(t, pl!.id, { mode: 'client', datePriseDePoste: '2026-11-10' }, { type: 'client' }))).rejects.toThrow('signataire');
    await tx((t) => effets.confirmerPlacement(t, pl!.id, { mode: 'client', datePriseDePoste: '2026-11-10', signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', ip: '1.2.3.4' }, { type: 'client', ip: '1.2.3.4' }));
    expect((await getDb().select().from(schema.placement).where(eq(schema.placement.id, pl!.id)))[0]).toMatchObject({ statut: 'confirme', confirmationMode: 'client', signataireNom: 'Paul Kamga', datePriseDePoste: '2026-11-10' });
    expect((await getDb().select().from(schema.proposition).where(eq(schema.proposition.id, p)))[0]!.statut).toBe('placee');
    expect((await getDb().select().from(schema.candidat).where(eq(schema.candidat.id, c)))[0]!.statut).toBe('place');
    expect(await getDb().select().from(schema.notificationCandidat).where(eq(schema.notificationCandidat.candidatId, c))).toHaveLength(1);
    await expect(tx((t) => effets.confirmerPlacement(t, pl!.id, { mode: 'preuve', datePriseDePoste: '2026-11-10', preuveCle: 'x' }, { type: 'collaborateur', id: ref.id }))).rejects.toThrow('plus à confirmer');
  });

  it('Lignes de poste mises à jour en place ; un poste avec propositions ne peut pas être supprimé', async () => {
    const avant = await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId)).orderBy(schema.lignePoste.ordre);
    await svc.remplacerLignes(dossierId, [{ intitule: 'Serveur(se)', nombre: 3 }, { intitule: 'Cuisinier', nombre: 1 }, { intitule: 'Plongeur', nombre: 1 }], ref);
    const apres = await getDb().select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId)).orderBy(schema.lignePoste.ordre);
    expect(apres.map((l) => l.id).slice(0, 2)).toEqual(avant.map((l) => l.id));
    expect(apres.map((l) => [l.intitule, l.nombre])).toEqual([['Serveur(se)', 3], ['Cuisinier', 1], ['Plongeur', 1]]);
    // Retirer « Plongeur » (sans proposition) : permis.
    await svc.remplacerLignes(dossierId, [{ intitule: 'Serveur(se)', nombre: 3 }, { intitule: 'Cuisinier', nombre: 1 }], ref);
    // Retirer « Cuisinier » quand il porte une proposition : refusé.
    await getDb().insert(schema.proposition).values({ dossierId, lignePosteId: avant[1]!.id, candidatId: await nouveauCandidat(), clientId, auteurId: ref.id });
    await expect(svc.remplacerLignes(dossierId, [{ intitule: 'Serveur(se)', nombre: 3 }], ref)).rejects.toThrow('« Cuisinier » a des propositions');
  });
});
