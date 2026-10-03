// ============================================================
// BOUTIQUE NEXCLEAN — catalogue produits.
// Ajouter un produit = ajouter un objet dans `products`.
// ⚠️ Avant mise en vente publique : faire valider l'étiquetage, les
// mentions de sécurité et les obligations applicables au Cameroun.
// Ne jamais ajouter de certification ou d'allégation sanitaire non prouvée.
// ============================================================

export interface ProductFormat {
  label: string;
  /** Prix en FCFA. `null` = prix communiqué sur WhatsApp. */
  price: number | null;
}

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  images: { src: string; alt: string }[];
  formats: ProductFormat[];
  available: boolean;
  usages: string[];
  surfaces: string[];
  scent?: string;
  ingredients: string[];
  instructions: string[];
  precautions: string[];
  storage: string;
  /** Lien vers la fiche de données de sécurité (PDF) si requise. */
  safetySheetUrl?: string;
}

export const products: Product[] = [
  {
    slug: 'savon-liquide-argan',
    name: "Savon Précieux à l'Huile d'Argan",
    tagline: 'Savon liquide multi-usage : vaisselle, lessive et sols',
    description:
      "Le savon liquide NexClean, utilisé par nos équipes, est formulé pour la vaisselle, le linge et l'entretien des sols. Une petite quantité suffit grâce à sa formule concentrée.",
    images: [
      { src: '/images/blog/nexclean-savon.png', alt: "Flacons de savon liquide NexClean à l'huile d'argan, 1 L" },
      { src: '/images/blog/nexclean-savon1.png', alt: 'Savon liquide NexClean' },
    ],
    formats: [{ label: 'Flacon 1 L', price: 1500 }],
    available: true,
    usages: ['Vaisselle', 'Lessive à la main ou en machine', 'Lavage des sols'],
    surfaces: ['Carrelage', 'Marbre', 'Parquet vitrifié', 'Vaisselle', 'Textiles'],
    scent: 'Rose de Damas',
    ingredients: ["Huile d'argan (Argania spinosa)", 'Beurre de karité', 'Parfum Rose de Damas'],
    instructions: [
      "Vaisselle : quelques gouttes sur une éponge humide.",
      "Sols : un bouchon dans un seau de 5 litres d'eau tiède.",
      'Lessive : un à deux bouchons selon le volume de linge.',
    ],
    precautions: [
      'Tenir hors de portée des enfants.',
      "Éviter le contact avec les yeux. En cas de contact, rincer abondamment à l'eau.",
      'Ne pas avaler. En cas d\'ingestion, consulter un médecin et lui montrer l\'emballage.',
      'Ne pas mélanger avec d\'autres produits ménagers.',
    ],
    storage: "Conserver flacon fermé, à l'abri de la chaleur et du soleil direct.",
  },
];

export const getProductBySlug = (slug: string) => products.find((p) => p.slug === slug);

export const formatPrice = (price: number | null) =>
  price === null ? 'Prix sur demande' : `${price.toLocaleString('fr-FR')} FCFA`;

export const SHOP_INFO = {
  /** Mention affichée à côté de chaque prix. */
  priceNote: 'Livraison non incluse',
  delivery:
    'Prix hors livraison. Livraison à Douala : frais et délai confirmés sur WhatsApp selon votre quartier. Retrait possible sur rendez-vous.',
  wholesale:
    'Entreprises, revendeurs et achats en gros : tarifs dédiés sur demande.',
};
