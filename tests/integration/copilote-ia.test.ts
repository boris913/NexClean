// Copilote IA (specs/COM3-01) sur une vraie base PostgreSQL ; fournisseur IA simulé (aucun appel réel).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
process.env.IA_API_KEY = 'cle-de-test';
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Copilote IA (intégration)', async () => {
  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const svc = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');
  const geo = await import('@/lib/geo/service');
  const { definirFournisseur } = await import('@/lib/ia/client');
  const copilote = await import('@/lib/ia/copilote');
  type Fournisseur = import('@/lib/ia/client').Fournisseur;

  // Fournisseur simulé : réponses programmables par test.
  let extraction: unknown = null;
  let redaction: string | null = null;
  let panne = false;
  const appels: { tache: string; contenu: string }[] = [];
  const simule: Fournisseur = {
    async extraire(_p, contenu, schemaSortie, ctx) {
      appels.push({ tache: ctx.tache, contenu });
      if (panne) return null;
      const r = schemaSortie.safeParse(extraction);
      return r.success ? r.data : null;
    },
    async rediger(_p, contenu, ctx) {
      appels.push({ tache: ctx.tache, contenu });
      return panne ? null : redaction;
    },
  };

  let ref: { id: string; roles: ('referent' | 'direction')[] };
  let villeDouala: number;
  let n = 0;

  async function demandeSite(texte: string) {
    const r = await svc.creerDemande({
      type: 'NET',
      canal: 'site',
      formulaire: 'devis-pro',
      client: { type: 'entreprise', nom: `ACME ${++n}`, contact: 'M. Talla', whatsapp: `6950000${String(n).padStart(2, '0')}` },
      villeId: null,
      villeAutre: null,
      quartierId: null,
      quartierAutre: null,
      lieu: null,
      secteur: null,
      description: texte,
      donnees: { valeurs: { company: `ACME ${n}`, phone: '690 22 33 44', need: texte } },
    });
    await getDb().update(schema.dossier).set({ referentId: ref.id, statut: 'attribuee' }).where(eq(schema.dossier.id, r.dossierId));
    const [dem] = await getDb().select().from(schema.demande).where(eq(schema.demande.dossierId, r.dossierId));
    return { dossierId: r.dossierId, demandeId: dem!.id };
  }

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    villeDouala = (await geo.listesLieux()).find((l) => l.nom === 'Douala')!.id;
    ref = { id: (await collab.creerCollaborateur({ nom: 'Réf IA', email: 'ref-ia@nexclean.test', roles: ['referent'] }, { id: null })).userId, roles: ['referent'] };
    definirFournisseur(simule);
  });
  afterAll(() => definirFournisseur(null));

  it('RG-06 (critère) : « 2 agents d’entretien pour mes bureaux à Akwa dès lundi » → NET, Douala / Akwa, 2, lundi suivant', async () => {
    const { dossierId, demandeId } = await demandeSite('il me faut 2 agents d’entretien pour mes bureaux à Akwa dès lundi');
    extraction = { type: 'NET', ville: null, quartier: 'Akwa', effectif: 2, date_debut: '2026-11-16', urgence: 'normale', budget: null, besoin: 'Deux agents d’entretien pour des bureaux', temperature: 'chaud', raison: 'Besoin précis et date proche.' };
    expect(await copilote.qualifierDemande(demandeId, new Date('2026-11-12T10:00:00+01:00'))).toBe(true);
    // Minimisation : ni nom d'entreprise ni téléphone envoyés ; date du jour fournie pour « lundi ».
    const envoye = appels.at(-1)!.contenu;
    expect(envoye).toContain('jeudi 12 novembre 2026');
    expect(envoye).not.toMatch(/ACME|690 22/);
    const s = await copilote.suggestionsDuDossier(dossierId);
    expect(s.qualification!.contenu).toMatchObject({ type: 'NET', villeId: villeDouala, effectif: 2, date_debut: '2026-11-16', demandeId });
    expect((s.qualification!.contenu as { quartierId: number | null }).quartierId).not.toBeNull();
    expect(s.classification!.contenu).toMatchObject({ temperature: 'chaud' });
  });

  it('RG-06 : appliquer → lieu renseigné, détail en note, suggestion « appliquée »', async () => {
    const [dossier] = await getDb().select().from(schema.dossier).orderBy(schema.dossier.id).limit(1);
    const s = await copilote.suggestionsDuDossier(dossier!.id);
    await copilote.appliquerQualification(s.qualification!.id, ref);
    const [apres] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, dossier!.id));
    expect(apres!.villeId).toBe(villeDouala);
    const notes = await getDb().select().from(schema.evenementDossier).where(eq(schema.evenementDossier.dossierId, dossier!.id));
    expect(notes.map((e) => e.commentaire).join('\n')).toMatch(/Effectif : 2/);
    await expect(copilote.appliquerQualification(s.qualification!.id, ref)).rejects.toThrow(/déjà traitée/);
  });

  it('RG-05 (critère) : fournisseur injoignable → dossier créé et attribué normalement, sans champs proposés', async () => {
    panne = true;
    const { dossierId } = await demandeSite('Nettoyage de vitres');
    expect(await copilote.qualifierEnAttente(10)).toBe(0);
    const s = await copilote.suggestionsDuDossier(dossierId);
    expect(s.qualification).toBeNull();
    const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, dossierId));
    expect(d!.referentId).toBe(ref.id);
    panne = false;
  });

  it('RG-02 : sortie hors schéma → aucune suggestion', async () => {
    const { dossierId, demandeId } = await demandeSite('Bonjour');
    extraction = { type: 'INCONNU', besoin: 1 };
    expect(await copilote.qualifierDemande(demandeId)).toBe(false);
    expect((await copilote.suggestionsDuDossier(dossierId)).qualification).toBeNull();
  });

  it('RG-11 (critère) : commentaire citant « 18 devis » pour 12 → rejeté, journalisé', async () => {
    const tot = { nouveaux: 10, enAttente: 2, sansReponse: 0, devisEnvoyes: 12, devisAcceptes: 4, tauxTransformation: 40, prestationsRealisees: 1, facture: 0, encaisse: 0, delaiPremiereReponseMin: 30 };
    const contenu = { semaine: '2026-11-09', fin: '2026-11-15', portee: 'direction' as const, actuel: tot, precedent: tot, topSources: [], enSouffrance: [], sansAction: [], joursSansAction: 3, aCloturer: [], aVenir: [] };
    redaction = 'Semaine solide : 18 devis envoyés.';
    expect(await copilote.commentaireRapport(contenu)).toBeNull();
    const [j] = await getDb().select().from(schema.journalIa).where(eq(schema.journalIa.issue, 'rejete'));
    expect(j!.erreur).toMatch(/18/);
    redaction = 'Semaine solide : 12 devis envoyés et 4 acceptés, soit 40 % de transformation.';
    expect(await copilote.commentaireRapport(contenu)).toBe(redaction);
  });

  it('RG-08 : brouillon sans montant ; un brouillon qui annonce un prix est écarté ; accès contrôlé', async () => {
    await getDb().insert(schema.conversation).values({ numero: '+237695000001', dossierId: (await getDb().select().from(schema.dossier).orderBy(schema.dossier.id).limit(1))[0]!.id, dernierEntrantLe: new Date() });
    const [c] = await getDb().select().from(schema.conversation).where(eq(schema.conversation.numero, '+237695000001'));
    redaction = 'Bonjour Monsieur, nous pouvons passer lundi pour voir les bureaux. Quel horaire vous convient ?';
    expect(await copilote.brouillonReponse(c!.id, ref)).toBe(redaction);
    redaction = 'Le tarif est de 50 000 FCFA par mois.';
    expect(await copilote.brouillonReponse(c!.id, ref)).toBeNull();
    const autre = { id: (await collab.creerCollaborateur({ nom: 'Autre', email: 'autre-ia@nexclean.test', roles: ['referent'] }, { id: null })).userId, roles: ['referent' as const] };
    await expect(copilote.brouillonReponse(c!.id, autre)).rejects.toThrow(/Accès refusé/);
  });

  it('RG-10 : résumé enregistré et relu en tête du dossier', async () => {
    const [d] = await getDb().select().from(schema.dossier).orderBy(schema.dossier.id).limit(1);
    redaction = 'ACME veut deux agents d’entretien à Akwa.\nDébut souhaité lundi.\nProchaine action : appeler le client.';
    await copilote.resumerDossier(d!.id, ref);
    expect(((await copilote.suggestionsDuDossier(d!.id)).resume!.contenu as { texte: string }).texte).toBe(redaction);
  });
});
