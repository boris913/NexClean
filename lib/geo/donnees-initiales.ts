// Données initiales du référentiel géographique (M1-GEO-02).
// ⚠ Rattachement des quartiers aux arrondissements à vérifier sur le terrain :
// la liste est administrable et sera corrigée / enrichie depuis le Back-Office.
// Les quartiers de content/zones-coverage.ts sont tous repris.

export interface VilleInitiale {
  nom: string;
  couverte: boolean;
  ordre: number;
  arrondissements: Record<string, string[]>;
}

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
