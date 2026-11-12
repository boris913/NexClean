// Rapport commercial hebdomadaire (specs/COM1-02 RG-09..11) sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Rapport hebdomadaire (intégration)', async () => {
  const { eq, like } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const svc = await import('@/lib/dossiers/service');
  const collab = await import('@/lib/collaborateurs/service');
  const geo = await import('@/lib/geo/service');
  const { genererRapportsHebdomadaires, listerRapports, lireRapport } = await import('@/lib/commercial/rapport-service');

  type A = { id: string; roles: ('referent' | 'direction')[] };
  let ref: A;
  let autre: A;
  let dir: A;
  let n = 0;
  const t = (iso: string) => new Date(`${iso}+01:00`);
  const LUNDI_7H = t('2026-11-16T07:00:00');

  async function dossier(referent: A, creeLe: string) {
    const villeId = (await geo.listesLieux()).find((l) => l.nom === 'Douala')!.id;
    const r = await svc.creerDemande(
      {
        type: 'NET',
        canal: 'telephone',
        source: 'bouche_a_oreille',
        formulaire: 'saisie',
        client: { type: 'particulier', nom: `Client RH ${++n}`, contact: null, whatsapp: `6940000${String(n).padStart(2, '0')}` },
        villeId,
        villeAutre: null,
        quartierId: null,
        quartierAutre: null,
        lieu: null,
        secteur: null,
        description: 'Ménage',
        donnees: {},
      },
      dir,
    );
    await getDb().update(schema.dossier).set({ creeLe: t(creeLe), referentId: referent.id, statut: 'nouvelle_demande', derniereActionLe: t(creeLe) }).where(eq(schema.dossier.id, r.dossierId));
    return r.dossierId;
  }

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    const mk = async (email: string, roles: A['roles']) => ({ id: (await collab.creerCollaborateur({ nom: email, email, roles }, { id: null })).userId, roles });
    ref = await mk('ref-rh@nexclean.test', ['referent']);
    autre = await mk('autre-rh@nexclean.test', ['referent']);
    dir = await mk('dir-rh@nexclean.test', ['direction']);
    await dossier(ref, '2026-11-10T09:00:00');
    await dossier(ref, '2026-11-12T09:00:00');
    await dossier(autre, '2026-11-13T09:00:00');
    await dossier(ref, '2026-11-04T09:00:00'); // semaine précédente
  });

  it('rien avant le lundi 7 h', async () => {
    expect(await genererRapportsHebdomadaires(t('2026-11-16T06:45:00'))).toBe(0);
  });

  it('RG-09 : Direction (vue globale) et chaque référent (ses dossiers), envoyés une seule fois', async () => {
    expect(await genererRapportsHebdomadaires(LUNDI_7H)).toBe(3);
    expect(await genererRapportsHebdomadaires(t('2026-11-16T07:15:00'))).toBe(0);

    const notifs = await getDb().select().from(schema.notification).where(like(schema.notification.cle, 'rapport:2026-11-09:%'));
    expect(notifs).toHaveLength(3);
    expect(notifs.every((x) => x.email && x.lien === '/admin/commercial/rapports/2026-11-09')).toBe(true);
    expect(notifs.find((x) => x.destinataireId === dir.id)!.titre).toBe('Rapport commercial du 9 novembre au 15 novembre');
  });

  it('RG-10 : contenu par périmètre, avec la semaine précédente', async () => {
    const global = (await lireRapport('2026-11-09', dir))!.contenu;
    expect(global).toMatchObject({ portee: 'direction', actuel: { nouveaux: 3 }, precedent: { nouveaux: 1 } });
    expect(global.topSources).toEqual([{ libelle: 'Bouche-à-oreille', nouveaux: 3, acceptes: 0 }]);
    expect(global.enSouffrance).toHaveLength(4); // tous en attente, jamais répondus

    const duRef = (await lireRapport('2026-11-09', ref))!.contenu;
    expect(duRef).toMatchObject({ portee: 'referent', actuel: { nouveaux: 2 }, precedent: { nouveaux: 1 } });
    expect((await lireRapport('2026-11-09', autre))!.contenu.actuel.nouveaux).toBe(1);
  });

  it('consultation : chacun ne lit que son périmètre', async () => {
    expect((await listerRapports(ref)).map((r) => r.semaine)).toEqual(['2026-11-09']);
    expect(await lireRapport('2026-11-02', dir)).toBeNull();
    expect(await lireRapport('../../etc', dir)).toBeNull();
  });

  it('RG-11 : l’e-mail ne contient aucun nom de client', async () => {
    const notifs = await getDb().select().from(schema.notification).where(like(schema.notification.cle, 'rapport:%'));
    for (const x of notifs) expect(x.texte).not.toMatch(/Client RH/);
  });
});
