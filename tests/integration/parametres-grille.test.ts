// Écran Paramètres — historique de la grille tarifaire (specs/MVP2-04 RG-01, RG-02) : valeur, date
// d'effet, auteur (jointure `user`), sur une vraie base PostgreSQL.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();
vi.spyOn(console, 'info').mockImplementation(() => {});

describe.skipIf(!baseDisponible)('Paramètres — historique de la grille (intégration)', async () => {
  const collab = await import('@/lib/collaborateurs/service');
  const params = await import('@/lib/parametres');
  const { historiqueParametres, CLES_GRILLE, commissionsDepuisPaires } = await import('@/app/(backoffice)/admin/(prive)/parametres/grille');

  let direction: string;

  beforeAll(async () => {
    await reinitialiserBase();
    direction = (await collab.creerCollaborateur({ nom: 'Diane Direction', email: 'diane@nexclean.test', roles: ['direction'] }, { id: null })).userId;
  });

  it('RG-01 : historique par paramètre, du plus récent au plus ancien, avec l’auteur ; valeur courante lue', async () => {
    expect(await historiqueParametres(CLES_GRILLE)).toEqual({});
    await params.definirParametre('commission_par_personne', 6000, { id: direction });
    await params.definirParametre('commission_par_personne', 7000, { id: direction });
    await params.definirParametre('tva_taux', 19, { id: null });
    await params.definirParametre('commissions_par_categorie', commissionsDepuisPaires([{ intitule: 'Nounou', montant: '4000' }]), { id: direction });
    await params.definirParametre('heures_ouvrees', params.HEURES_OUVREES_PAR_DEFAUT, { id: direction });

    const h = await historiqueParametres(CLES_GRILLE);
    expect(h.commission_par_personne!.map((e) => [e.valeur, e.auteur])).toEqual([
      ['7 000 FCFA HT / personne', 'Diane Direction'],
      ['6 000 FCFA HT / personne', 'Diane Direction'],
    ]);
    expect(h.commission_par_personne![0]!.effetLe).toBeInstanceOf(Date);
    expect(h.tva_taux).toEqual([expect.objectContaining({ valeur: '19 %', auteur: 'Système' })]);
    expect(h.commissions_par_categorie![0]!.valeur).toBe('Nounou : 4 000 FCFA');
    // Seules les clés demandées.
    expect(Object.keys(h)).not.toContain('heures_ouvrees');
    expect(await params.lireParametre('commission_par_personne')).toBe(7000);
    expect(await params.lireParametre('commissions_par_categorie')).toEqual({ Nounou: 4000 });
  });

  it('limite le nombre d’entrées par paramètre', async () => {
    for (const n of [10, 20, 30]) await params.definirParametre('garantie_jours', n, { id: direction });
    const h = await historiqueParametres(['garantie_jours'], 2);
    expect(h.garantie_jours!.map((e) => e.valeur)).toEqual(['30 jours', '20 jours']);
  });

  it('cas limite QO-3 : minimum de facturation prévu mais désactivé par défaut', async () => {
    expect(await params.lireParametre('minimum_facturation')).toBeNull();
  });
});
