// Données initiales du référentiel géographique (M1-GEO-02).
// ⚠ Rattachement des quartiers aux arrondissements à vérifier sur le terrain :
// la liste est administrable et sera corrigée / enrichie depuis le Back-Office.
// Reprend les quartiers de l'ancien content/zones-coverage.ts.

export interface VilleInitiale {
  nom: string;
  couverte: boolean;
  ordre: number;
  arrondissements: Record<string, string[]>;
}

/** Quartiers affichés d'office dans « Où intervenons-nous ? » (M1-GEO-05), modifiable dans Référentiel. */
export const QUARTIERS_AFFICHES_INITIAUX: Record<string, string[]> = {
  Douala: ['Bonapriso', 'Akwa', 'Bonanjo', 'Bali', 'Makepe', 'Bonamoussadi', 'Deido', 'New Bell'],
};

export const VILLES_INITIALES: VilleInitiale[] = [
  {
    nom: 'Douala',
    couverte: true,
    ordre: 1,
    arrondissements: {
      'Douala I': ['Akwa', 'Bonanjo', 'Bonapriso', 'Bali', 'Deido', 'Koumassi'],
      'Douala II': ['New Bell', 'Nkololoun', 'Kassalafam', 'Ngangue'],
      'Douala III': ['Ndokoti', 'Logbaba', 'Nyalla', 'Japoma', 'Yassa', 'PK8', 'PK10', 'PK12'],
      'Douala IV': ['Bonabéri', 'Bojongo', 'Sodiko'],
      'Douala V': ['Bonamoussadi', 'Makepe', 'Kotto', 'Logpom', 'Ndogbong', 'Bépanda', 'Cité des Palmiers'],
      'Douala VI': ['Manoka'],
    },
  },
  {
    nom: 'Yaoundé',
    couverte: true,
    ordre: 2,
    arrondissements: {
      'Yaoundé I': ['Bastos', 'Etoudi', 'Nlongkak', 'Omnisport', 'Emana', 'Ekoudou'],
      'Yaoundé II': ['Tsinga', 'Briqueterie', 'Mokolo', 'Madagascar', 'Cité Verte'],
      'Yaoundé III': ['Efoulan', 'Nsam', 'Obili', 'Ngoa-Ekellé', 'Mvolyé', 'Ahala'],
      'Yaoundé IV': ['Kondengui', 'Ekounou', 'Mimboman', 'Odza', 'Nkomo', 'Mvog-Mbi'],
      'Yaoundé V': ['Essos', 'Nkolmesseng', 'Ngousso', 'Mvog-Ada'],
      'Yaoundé VI': ['Biyem-Assi', 'Mendong', 'Etoug-Ebe', 'Simbock', 'Melen'],
      'Yaoundé VII': ['Nkolbisson', 'Oyom-Abang', 'Etetak'],
    },
  },
];

/**
 * Centroïdes approximatifs [latitude, longitude] pour le filtre par rayon (ADR 0021 §4,
 * MVP2-02 RG-14). Source : OpenStreetMap / Nominatim, novembre 2026 ; Ngoa-Ekellé repéré sur le
 * lycée de Ngoa-Ekellé, Kassalafam sur la rue du même nom. Kotto et PK12 ne sont pas localisés
 * correctement par OpenStreetMap : à saisir dans le Référentiel. Valeurs reprises par la migration
 * 0008 (test : tests/unit/centroides.test.ts) ; corrigeables depuis le Référentiel.
 */
export const CENTROIDES_INITIAUX: Record<string, Record<string, [number, number]>> = {
  'Douala': {
    'Akwa': [4.05254, 9.69633],
    'Bonanjo': [4.04302, 9.68650],
    'Bonapriso': [4.02562, 9.69302],
    'Bali': [4.03999, 9.69305],
    'Deido': [4.06376, 9.71518],
    'Koumassi': [4.03579, 9.69328],
    'New Bell': [4.03148, 9.70576],
    'Nkololoun': [4.03346, 9.71953],
    'Kassalafam': [4.03391, 9.71283],
    'Ngangue': [4.02077, 9.70682],
    'Ndokoti': [4.04343, 9.74368],
    'Logbaba': [4.03285, 9.76032],
    'Nyalla': [4.03341, 9.77442],
    'Japoma': [4.03233, 9.82269],
    'Yassa': [3.99133, 9.81038],
    'PK8': [4.04701, 9.75781],
    'PK10': [4.04911, 9.77270],
    'Bonabéri': [4.08221, 9.66497],
    'Bojongo': [4.08661, 9.61904],
    'Sodiko': [4.09774, 9.66236],
    'Bonamoussadi': [4.09435, 9.73937],
    'Makepe': [4.06381, 9.74096],
    'Logpom': [4.07691, 9.77118],
    'Ndogbong': [4.06447, 9.75213],
    'Bépanda': [4.05654, 9.72272],
    'Cité des Palmiers': [4.05427, 9.76406],
    'Manoka': [3.86125, 9.62358],
  },
  'Yaoundé': {
    'Bastos': [3.89402, 11.51088],
    'Etoudi': [3.91498, 11.52528],
    'Nlongkak': [3.88701, 11.51897],
    'Omnisport': [3.95088, 11.54059],
    'Emana': [3.93283, 11.52233],
    'Ekoudou': [3.87828, 11.50785],
    'Tsinga': [3.88742, 11.49926],
    'Briqueterie': [3.87495, 11.50828],
    'Mokolo': [3.87563, 11.49841],
    'Madagascar': [3.87946, 11.49785],
    'Cité Verte': [3.87453, 11.48902],
    'Efoulan': [3.83435, 11.50644],
    'Nsam': [3.82902, 11.50904],
    'Obili': [3.85398, 11.48853],
    'Ngoa-Ekellé': [3.85874, 11.50596],
    'Mvolyé': [3.84392, 11.50441],
    'Ahala': [3.80365, 11.50097],
    'Kondengui': [3.85455, 11.54411],
    'Ekounou': [3.84162, 11.53409],
    'Mimboman': [3.86299, 11.55924],
    'Odza': [3.79860, 11.52912],
    'Nkomo': [3.84049, 11.55140],
    'Mvog-Mbi': [3.85140, 11.52029],
    'Essos': [3.87590, 11.54345],
    'Nkolmesseng': [3.88694, 11.56328],
    'Ngousso': [3.90262, 11.54908],
    'Mvog-Ada': [3.86352, 11.52839],
    'Biyem-Assi': [3.84047, 11.48648],
    'Mendong': [3.83464, 11.47270],
    'Etoug-Ebe': [3.85214, 11.47590],
    'Simbock': [3.80987, 11.47617],
    'Melen': [3.86459, 11.49640],
    'Nkolbisson': [3.87459, 11.45259],
    'Oyom-Abang': [3.87595, 11.47300],
    'Etetak': [3.87722, 11.48237],
  },
};
