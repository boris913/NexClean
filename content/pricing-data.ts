export interface PricingOption {
  id: string;
  name: string;
  surface: string;
  pricePonctuel: string;
  priceAbonnement?: string;
  features: string[];
  popular?: boolean;
}

export const pricingParticuliers: PricingOption[] = [
  {
    id: "studio",
    name: "Studio",
    surface: "< 30m²",
    pricePonctuel: "8 000 FCFA",
    priceAbonnement: "30 000 FCFA/mois",
    features: [
      "Nettoyage complet",
      "Sols et surfaces",
      "Sanitaires",
      "1 heure d'intervention"
    ]
  },
  {
    id: "1-chambre salon",
    name: "1 Chambre + Salon",
    surface: "30-60m²",
    pricePonctuel: "10 000 FCFA",
    priceAbonnement: "35 000 FCFA/mois",
    features: [
      "Nettoyage complet",
      "Toutes les pièces",
      "Cuisine et sanitaires",
      "1h30 d'intervention"
    ],
    popular: true
  },
  {
    id: "2-chambres salon",
    name: "2 Chambres + Salon",
    surface: "60-100m²",
    pricePonctuel: "13 000 FCFA",
    priceAbonnement: "50 000 FCFA/mois",
    features: [
      "Nettoyage complet",
      "Grande maison",
      "Toutes les surfaces",
      "2 heures d'intervention"
    ],
    popular: true
  },
  {
    id: "3-chambres salon",
    name: "3 Chambres + Salon",
    surface: "> 100m²",
    pricePonctuel: "16 000 FCFA",
    priceAbonnement: "60 000 FCFA/mois",
    features: [
      "Nettoyage complet",
      "Espaces extérieurs",
      "Plusieurs étages",
      "Sur devis personnalisé"
    ]
  }
];

export const pricingProfessionnels: PricingOption[] = [
  {
    id: "petit-bureau",
    name: "Petit Bureau",
    surface: "< 50m²",
    pricePonctuel: "15 000 FCFA",
    priceAbonnement: "50 000 FCFA/mois",
    features: [
      "2 passages/semaine",
      "Espaces de travail",
      "Sanitaires",
      "Désinfection incluse"
    ]
  },
  {
    id: "bureau-moyen",
    name: "Bureau Moyen",
    surface: "50-100m²",
    pricePonctuel: "20 000 FCFA",
    priceAbonnement: "75 000 FCFA/mois",
    features: [
      "2 passages/semaine",
      "Plusieurs bureaux",
      "Salle de réunion",
      "Désinfection renforcée"
    ],
    popular: true
  },
  {
    id: "commerce",
    name: "Commerce/Boutique",
    surface: "Variable",
    pricePonctuel: "Sur devis",
    priceAbonnement: "À partir de 70 000 FCFA/mois",
    features: [
      "Planning flexible",
      "Vitrine incluse",
      "Zone client",
      "Intervention rapide"
    ],
    popular: true
  },
  {
    id: "grande-structure",
    name: "Grande Structure",
    surface: "> 100m²",
    pricePonctuel: "Sur devis",
    priceAbonnement: "À partir de 120 000 FCFA/mois",
    features: [
      "Solution personnalisée",
      "Équipe dédiée",
      "Plusieurs passages/semaine",
      "Contrat sur mesure"
    ]
  }
];

export interface PaymentMethod {
  name: string;
  icon: string;
  available: boolean;
}

export const paymentMethods: PaymentMethod[] = [
  { name: "Cash", icon: "Banknote", available: true },
  { name: "Mobile Money", icon: "Smartphone", available: true },
  { name: "Virement Bancaire", icon: "Building2", available: true },
];
