// Veille prospects, partie 2 (specs/COM4-01 RG-04, RG-05, RG-08, RG-12) ; IA et flux simulés.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
process.env.IA_API_KEY = 'cle-de-test';
delete process.env.WHATSAPP_ACCESS_TOKEN;
const emails: string[] = [];
vi.spyOn(console, 'info').mockImplementation((m: unknown) => {
  if (typeof m === 'string' && m.startsWith('[email non envoyé')) emails.push(m);
});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Veille : sources, collecte, e-mail, indicateurs (intégration)', async () => {
  const { eq } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const collab = await import('@/lib/collaborateurs/service');
  const veille = await import('@/lib/veille/service');
  const sources = await import('@/lib/veille/sources');
  const ind = await import('@/lib/veille/indicateurs');
  const { definirFournisseur } = await import('@/lib/ia/client');
  type Fournisseur = import('@/lib/ia/client').Fournisseur;

  // L'IA juge pertinent tout texte qui parle de ménage ou de gardien, à Douala.
  const appels: string[] = [];
  const simule: Fournisseur = {
    async extraire(_p, contenu, schemaSortie) {
      appels.push(contenu);
      const pertinent = /ménage|gardien/i.test(contenu);
      return schemaSortie.parse({ pertinent, motif_ecart: pertinent ? null : 'hors_services', type: pertinent ? 'REC' : null, postes: [], effectif: null, ville: 'Douala', quartier: null, date_publication: null, contact_nom: null, contact_email: null, contact_telephone: null, besoin: 'Besoin', score: pertinent ? 60 : 5, justification: 'Simulé.' });
    },
    async rediger() {
      return null;
    },
  };
  const flux = (items: { titre: string; lien: string; date: string; texte?: string }[]) => `<rss><channel>${items.map((i) => `<item><title>${i.titre}</title><link>${i.lien}</link><description>${i.texte ?? 'Annonce publiée à Douala, contact en message privé.'}</description><pubDate>${i.date}</pubDate></item>`).join('')}</channel></rss>`;

  let dir: { id: string; roles: ('direction' | 'referent')[] };
  let sourceId: number;

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    dir = { id: (await collab.creerCollaborateur({ nom: 'Direction', email: 'dir-veille@nexclean.test', roles: ['direction'] }, { id: null })).userId, roles: ['direction'] };
    definirFournisseur(simule);
  });
  afterAll(() => definirFournisseur(null));

  it('RG-04 : source automatisée sans adresse de flux refusée ; saisie assistée acceptée sans adresse', async () => {
    await expect(sources.enregistrerSource(null, { nom: 'Flux', type: 'rss', url: null, requetes: [], frequenceHeures: 12, actif: true }, dir)).rejects.toThrow();
    await sources.enregistrerSource(null, { nom: 'Groupes Facebook', type: 'saisie_assistee', url: null, requetes: ['ménagère Douala'], frequenceHeures: 12, actif: true }, dir);
    sourceId = await sources.enregistrerSource(null, { nom: 'Annonces Douala', type: 'rss', url: 'https://annonces.example.cm/rss', requetes: ['femme de ménage Douala', 'gardien Douala'], frequenceHeures: 12, actif: true }, dir);
    expect((await getDb().select().from(schema.journalAudit).where(eq(schema.journalAudit.action, 'veille.source_creee'))).length).toBe(2);
  });

  it('RG-05 : collecte — filtre par requête et par ancienneté, qualification, déjà vus sans nouvel appel à l’IA', async () => {
    const maintenant = new Date('2026-11-12T10:00:00+01:00');
    const xml = flux([
      { titre: 'Cherche femme de ménage à Douala, Bonapriso', lien: 'https://annonces.example.cm/a/1', date: 'Wed, 11 Nov 2026 08:00:00 +0100' },
      { titre: 'Recrute gardien pour entrepôt Douala', lien: 'https://annonces.example.cm/a/2', date: 'Tue, 10 Nov 2026 08:00:00 +0100' },
      { titre: 'Vends voiture Toyota à Douala', lien: 'https://annonces.example.cm/a/3', date: 'Tue, 10 Nov 2026 08:00:00 +0100' },
      { titre: 'Cherche femme de ménage à Douala (ancienne annonce)', lien: 'https://annonces.example.cm/a/4', date: 'Mon, 01 Sep 2026 08:00:00 +0100' },
    ]);
    const s = (await sources.listerSources()).find((x) => x.id === sourceId)!;
    const b = await sources.collecterSource(s, maintenant, async () => xml);
    expect(b).toEqual({ lus: 4, retenus: 2, pistes: 2, doublons: 0 });
    expect(appels).toHaveLength(2);
    const pistes = await getDb().select().from(schema.piste);
    expect(pistes.map((p) => [p.source, p.sourceId, p.requete, p.assigneA])).toEqual(expect.arrayContaining([['rss', sourceId, 'femme de ménage Douala', null], ['rss', sourceId, 'gardien Douala', null]]));
    // Second passage : rien de nouveau, aucun appel à l'IA.
    const b2 = await sources.collecterSource((await sources.listerSources()).find((x) => x.id === sourceId)!, maintenant, async () => xml);
    expect(b2.pistes).toBe(0);
    expect(appels).toHaveLength(2);
    expect((await sources.listerSources()).find((x) => x.id === sourceId)!.dernierResultat).toMatch(/4 élément\(s\) lu\(s\), 2 correspondant/);
  });

  it('RG-05 : flux en échec → résultat consigné, pas d’exception ; fréquence respectée', async () => {
    const s = (await sources.listerSources()).find((x) => x.id === sourceId)!;
    await sources.collecterSource(s, new Date(), async () => {
      throw new Error('HTTP 503');
    });
    expect((await sources.listerSources()).find((x) => x.id === sourceId)!.dernierResultat).toBe('Échec : HTTP 503');
    // Passage juste après : la source n'est pas échue (12 h).
    const fetchEspion = vi.spyOn(globalThis, 'fetch');
    expect(await sources.collecterSourcesDues(new Date())).toBe(0);
    expect(fetchEspion).not.toHaveBeenCalled();
    fetchEspion.mockRestore();
  });

  it('RG-08 : e-mail envoyé depuis le Back-Office à l’adresse publiée, contact enregistré ; sans adresse → refus', async () => {
    const r = await veille.ajouterPiste({ url: null, texte: 'Cherche femme de ménage à Douala. Écrire à rh@hotel-exemple.cm' }, dir);
    const id = (r as { pisteId: number }).pisteId;
    await veille.changerStatutPiste(id, 'retenue', null, dir);
    const type = await veille.envoyerEmailApproche(id, { objet: 'Votre recherche', texte: 'Bonjour, NEXCLEAN place des femmes de ménage à Douala. https://wa.me/237696370479' }, dir);
    expect(type).toBe('premier');
    expect(emails.at(-1)).toMatch(/À : rh@hotel-exemple\.cm\nObjet : Votre recherche/);
    const [c] = await getDb().select().from(schema.contactPiste).where(eq(schema.contactPiste.pisteId, id));
    expect(c).toMatchObject({ canal: 'email', type: 'premier' });

    const sans = (await getDb().select().from(schema.piste).where(eq(schema.piste.requete, 'gardien Douala')))[0]!;
    await veille.changerStatutPiste(sans.id, 'retenue', null, dir);
    await expect(veille.envoyerEmailApproche(sans.id, { objet: 'Bonjour', texte: 'Bonjour, nous pouvons vous aider rapidement.' }, dir)).rejects.toThrow(/Aucune adresse/);
    expect(await getDb().select().from(schema.contactPiste).where(eq(schema.contactPiste.pisteId, sans.id))).toHaveLength(0);
  });

  it('RG-12 : indicateurs par source et par requête ; requêtes improductives après 30 jours', async () => {
    const maintenant = new Date();
    const i = await ind.indicateursVeille({ du: new Date(maintenant.getTime() - 3600_000 * 24 * 365 * 2), au: new Date(maintenant.getTime() + 3600_000) });
    expect(i.total).toMatchObject({ trouvees: 3, retenues: 2, contactees: 1, converties: 0 });
    expect(i.parSource.find((l) => l.libelle === 'Annonces Douala')).toMatchObject({ trouvees: 2, retenues: 1 });
    expect(i.parSource.find((l) => l.libelle === 'Saisie assistée (réseaux sociaux)')).toMatchObject({ trouvees: 1, contactees: 1 });
    expect(i.parRequete.map((l) => l.libelle)).toEqual(expect.arrayContaining(['Annonces Douala — gardien Douala', 'Annonces Douala — femme de ménage Douala']));

    // Source créée il y a plus de 30 jours : « femme de ménage Douala » n'a produit aucune piste retenue.
    await getDb().update(schema.sourceVeille).set({ creeLe: new Date('2026-01-01T00:00:00Z') });
    const imp = await ind.requetesImproductives(maintenant);
    expect(imp).toEqual(expect.arrayContaining([{ sourceId, source: 'Annonces Douala', requete: 'femme de ménage Douala' }]));
    expect(imp.find((r) => r.requete === 'gardien Douala')).toBeUndefined();
  });
});
