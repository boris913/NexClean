// ADR 0013 : règles pures des offres publiées.
import { describe, expect, it } from 'vitest';
import { brouillonDepuisLigne, categorieProbable, lignePourvue, manquesPourPublier, schemaOffre, slugifier, transitionOffrePermise, versPublique, type EntreeOffre } from '@/lib/offres/domaine';

const base: EntreeOffre = {
  slug: 'agent-de-caisse-akwa',
  titre: 'Agent de caisse (H/F)',
  categorie: 'Agent de caisse',
  origine: 'interne',
  lignePosteId: null,
  lieu: 'Akwa, Douala',
  contrat: 'CDI',
  secteur: null,
  postes: 2,
  description: 'Accueillir les clients et tenir la caisse avec rigueur.',
  exigences: ['Honnêteté', ''],
  intro: '',
  missions: ['Encaisser'],
  profil: [],
  horaires: [],
  salaire: { base: '50 000 FCFA/mois', bonus: '', target: null, note: null, fixed: true },
  valableJusquau: '',
};

describe('Offres — validation', () => {
  it('nettoie les listes, les textes vides et le salaire', () => {
    const d = schemaOffre.parse(base);
    expect(d.exigences).toEqual(['Honnêteté']);
    expect(d.intro).toBeNull();
    expect(d.valableJusquau).toBeNull();
    expect(d.salaire).toEqual({ base: '50 000 FCFA/mois', fixed: true });
  });

  it('refuse une adresse invalide ou un résumé trop court', () => {
    expect(schemaOffre.safeParse({ ...base, slug: 'Agent Caisse' }).success).toBe(false);
    expect(schemaOffre.safeParse({ ...base, description: 'court' }).success).toBe(false);
  });

  it('ADR 0013 §4 : salaire d’une offre de placement publié seulement avec l’accord du client', () => {
    expect(schemaOffre.safeParse({ ...base, origine: 'placement' }).success).toBe(false);
    expect(schemaOffre.safeParse({ ...base, origine: 'placement', accordSalaireClient: true }).success).toBe(true);
    expect(schemaOffre.safeParse({ ...base, origine: 'placement', salaire: null }).success).toBe(true);
  });

  it('une offre interne n’est liée à aucune ligne de poste', () => {
    expect(schemaOffre.safeParse({ ...base, lignePosteId: 4 }).success).toBe(false);
  });
});

describe('Offres — règles', () => {
  it('génère une adresse lisible', () => {
    expect(slugifier('Agent de caisse (H/F) — 2 postes')).toBe('agent-de-caisse-h-f-2-postes');
    expect(slugifier("Chef(fe) d'équipe à Yaoundé")).toBe('chef-fe-dequipe-a-yaounde');
  });

  it('transitions : publier, fermer, rouvrir ; jamais revenir en brouillon', () => {
    expect(transitionOffrePermise('brouillon', 'publiee')).toBe(true);
    expect(transitionOffrePermise('publiee', 'fermee')).toBe(true);
    expect(transitionOffrePermise('fermee', 'publiee')).toBe(true);
    expect(transitionOffrePermise('brouillon', 'fermee')).toBe(false);
    expect(transitionOffrePermise('publiee', 'brouillon')).toBe(false);
    expect(transitionOffrePermise('publiee', 'publiee')).toBe(false);
  });

  it('exige exigences et missions ou profil pour publier', () => {
    expect(manquesPourPublier({ description: 'x', exigences: [], missions: [], profil: [] })).toHaveLength(2);
    expect(manquesPourPublier({ description: 'x', exigences: ['a'], missions: [], profil: ['b'] })).toEqual([]);
  });

  it('ligne pourvue quand les placements confirmés atteignent le nombre de postes', () => {
    expect(lignePourvue(2, 1)).toBe(false);
    expect(lignePourvue(2, 2)).toBe(true);
  });

  it('déduit la catégorie de l’intitulé', () => {
    expect(categorieProbable('Caissière')).toBe('Agent de caisse');
    expect(categorieProbable('Jardinier')).toBe('Agent espaces verts');
    expect(categorieProbable('Ménagère')).toBe('Agent de nettoyage');
  });
});

describe('Offres — brouillon depuis une ligne de poste (ADR 0013 §3–4)', () => {
  const ligne = { id: 7, intitule: 'Caissière', nombre: 2, missions: 'Encaisser\nTenir la caisse', competences: 'Honnêteté; Rigueur', experience: '1 an', typeContrat: null, horaires: '8h-18h', secteur: 'Restauration', ville: 'Douala', quartier: 'Akwa' };

  it('pré-remplit sans nom de client ni salaire, et passe la validation', () => {
    const b = brouillonDepuisLigne(ligne);
    expect(b.origine).toBe('placement');
    expect(b.lignePosteId).toBe(7);
    expect(b.titre).toBe('Caissière (H/F) — 2 postes');
    expect(b.lieu).toBe('Akwa, Douala');
    expect(b.missions).toEqual(['Encaisser', 'Tenir la caisse']);
    expect(b.salaire).toBeNull();
    expect(b.description).toContain('secteur restauration');
    expect(schemaOffre.safeParse(b).success).toBe(true);
  });
});

describe('Offres — vue publique', () => {
  const ligne = { slug: 's', titre: 'T', categorie: 'Commercial', lieu: 'Douala', contrat: 'CDI', description: 'd', exigences: ['e'], intro: null, missions: [], profil: [], horaires: [], salaire: null, secteur: null, postes: 1, publieeLe: '2026-11-13', valableJusquau: null };

  it('n’expose jamais un brouillon', () => {
    expect(versPublique({ ...ligne, statut: 'brouillon' })).toBeNull();
  });

  it('publiée → open, fermée → closed, champs vides omis', () => {
    const o = versPublique({ ...ligne, statut: 'publiee' })!;
    expect(o.status).toBe('open');
    expect(o.datePosted).toBe('2026-11-13');
    expect(o).not.toHaveProperty('missions');
    expect(o).not.toHaveProperty('positions');
    expect(versPublique({ ...ligne, statut: 'fermee' })!.status).toBe('closed');
  });
});
