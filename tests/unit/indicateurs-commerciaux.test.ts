// Indicateurs commerciaux (specs/COM1-02 RG-06..08).
import { describe, expect, it } from 'vitest';
import { demandesEnAttente, ecart, entonnoir, estSansReponse, libelleDuree, totaux, ventiler, versCsv, type LigneDossierCommercial } from '@/lib/commercial/indicateurs';

const du = new Date('2026-11-01T00:00:00+01:00');
const au = new Date('2026-12-01T00:00:00+01:00');
const maintenant = new Date('2026-11-20T12:00:00+01:00');
const ctx = { du, au, maintenant };

let n = 0;
const ligne = (x: Partial<LigneDossierCommercial> = {}): LigneDossierCommercial => ({
  id: ++n,
  numero: `NET-2026-${String(n).padStart(5, '0')}`,
  client: `Client ${n}`,
  type: 'NET',
  statut: 'en_cours',
  ville: 'Douala',
  source: 'facebook',
  referentId: 'r1',
  referentNom: 'Stéphanie',
  creeLe: new Date('2026-11-05T09:00:00+01:00'),
  premiereReponseLe: new Date('2026-11-05T10:00:00+01:00'),
  devisEnvoyePeriode: false,
  accepteePeriode: false,
  termineePeriode: false,
  facturePeriode: 0,
  encaissePeriode: 0,
  devisEnvoyeJamais: false,
  accepteeJamais: false,
  encaisseJamais: false,
  ...x,
});

describe('totaux (RG-06)', () => {
  it('critère d’acceptation : 10 dossiers créés, 4 devis acceptés → 40 %', () => {
    const lignes = Array.from({ length: 10 }, (_, i) => ligne({ accepteePeriode: i < 4 }));
    expect(totaux(lignes, ctx)).toMatchObject({ nouveaux: 10, devisAcceptes: 4, tauxTransformation: 40 });
  });

  it('dossiers créés avant la période : pas des nouveaux prospects, mais leurs faits comptent', () => {
    const t = totaux([ligne({ creeLe: new Date('2026-10-20T09:00:00+01:00'), accepteePeriode: true, facturePeriode: 50_000, encaissePeriode: 25_000 })], ctx);
    expect(t).toMatchObject({ nouveaux: 0, devisAcceptes: 1, tauxTransformation: null, facture: 50_000, encaisse: 25_000 });
  });

  it('délai moyen de première réponse, en minutes', () => {
    const t = totaux(
      [ligne(), ligne({ premiereReponseLe: new Date('2026-11-05T12:00:00+01:00') }), ligne({ premiereReponseLe: null, statut: 'nouvelle_demande' })],
      ctx,
    );
    expect(t.delaiPremiereReponseMin).toBe(120);
    expect(t.enAttente).toBe(1);
  });
});

describe('sans réponse > 24 h', () => {
  it('en attente, sans action humaine, créé il y a plus de 24 h', () => {
    const base = { statut: 'nouvelle_demande' as const, premiereReponseLe: null };
    expect(estSansReponse({ ...base, creeLe: new Date('2026-11-19T11:00:00+01:00') }, maintenant)).toBe(true);
    expect(estSansReponse({ ...base, creeLe: new Date('2026-11-19T13:00:00+01:00') }, maintenant)).toBe(false);
    expect(estSansReponse({ ...base, statut: 'en_cours', creeLe: new Date('2026-11-01T00:00:00+01:00') }, maintenant)).toBe(false);
  });

  it('liste des demandes en attente, la plus ancienne d’abord', () => {
    const a = demandesEnAttente(
      [ligne({ statut: 'attribuee', premiereReponseLe: null, creeLe: new Date('2026-11-19T12:00:00+01:00') }), ligne({ statut: 'en_qualification', creeLe: new Date('2026-11-10T12:00:00+01:00') }), ligne()],
      maintenant,
    );
    expect(a.map((x) => [x.ancienneteH, x.sansReponse])).toEqual([[240, false], [24, false]]);
  });
});

describe('ventilation et entonnoir (RG-07)', () => {
  const lignes = [
    ligne({ source: 'facebook', devisEnvoyeJamais: true, accepteeJamais: true, encaisseJamais: true, accepteePeriode: true, facturePeriode: 100_000 }),
    ligne({ source: 'facebook', devisEnvoyeJamais: true }),
    ligne({ source: 'google_naturel', ville: 'Yaoundé', type: 'REC', referentId: null, referentNom: null }),
  ];

  it('par source, triée par nouveaux prospects', () => {
    const v = ventiler(lignes, 'source', ctx);
    expect(v.map((x) => [x.libelle, x.nouveaux, x.tauxTransformation, x.facture])).toEqual([
      ['Facebook', 2, 50, 100_000],
      ['Google (recherche)', 1, 0, 0],
    ]);
  });

  it('par ville, service et référent', () => {
    expect(ventiler(lignes, 'ville', ctx).map((x) => x.libelle)).toEqual(['Douala', 'Yaoundé']);
    expect(ventiler(lignes, 'service', ctx).map((x) => x.cle)).toEqual(['NET', 'REC']);
    expect(ventiler(lignes, 'referent', ctx).map((x) => x.libelle)).toEqual(['Stéphanie', 'Non attribués']);
  });

  it('entonnoir de la cohorte', () => {
    const e = entonnoir([...lignes, ligne({ creeLe: new Date('2026-10-01T00:00:00+01:00'), accepteeJamais: true })], ctx);
    expect(e.total).toMatchObject({ dossiers: 3, devis: 2, acceptes: 1, encaisses: 1 });
    expect(e.parSource[0]).toMatchObject({ cle: 'facebook', dossiers: 2, devis: 2, acceptes: 1 });
  });
});

describe('export CSV (RG-08)', () => {
  it('BOM, séparateur « ; », guillemets échappés et formules neutralisées', () => {
    const csv = versCsv([ligne({ client: '=HYPERLINK("x")', ville: 'Douala; Akwa', encaissePeriode: -5000 })]);
    expect(csv.startsWith('\uFEFFDossier;Client;')).toBe(true);
    const l = csv.split('\r\n')[1]!;
    expect(l).toContain(`"'=HYPERLINK(""x"")"`);
    expect(l).toContain('"Douala; Akwa"');
    expect(l).toContain('2026-11-05 09:00');
    expect(l.endsWith(';-5000')).toBe(true);
  });
});

describe('libellés', () => {
  it('durées', () => {
    expect([libelleDuree(null), libelleDuree(45), libelleDuree(200), libelleDuree(60), libelleDuree(52 * 60)]).toEqual(['—', '45 min', '3 h 20', '1 h', '2 j 4 h']);
  });
  it('écart en %', () => {
    expect([ecart(12, 10), ecart(5, 10), ecart(0, 0), ecart(3, 0)]).toEqual([20, -50, 0, null]);
  });
});
