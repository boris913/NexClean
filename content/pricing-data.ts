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
    pricePonctuel: "8 000 - 10 000 FCFA",
    priceAbonnement: "30 000 FCFA/mois",
    features: [
      "Nettoyage complet",
      "Sols et surfaces",
      "Sanitaires",
      "1 heure d'intervention"
    ]
  },
  {
    id: "2-chambres",
    name: "2 Chambres",
    surface: "30-60m²",
    pricePonctuel: "12 000 - 15 000 FCFA",
    priceAbonnement: "45 000 FCFA/mois",
    features: [
      "Nettoyage complet",
      "Toutes les pièces",
      "Cuisine et sanitaires",
      "1h30 d'intervention"
    ],
    popular: true
  },
  {
    id: "3-chambres",
    name: "3 Chambres",
    surface: "60-100m²",
    pricePonctuel: "15 000 - 20 000 FCFA",
    priceAbonnement: "60 000 FCFA/mois",
    features: [
      "Nettoyage complet",
      "Grande maison",
      "Toutes les surfaces",
      "2 heures d'intervention"
    ]
  },
  {
    id: "villa",
    name: "Villa/Grande Maison",
    surface: "> 100m²",
    pricePonctuel: "20 000 - 35 000 FCFA",
    priceAbonnement: "80 000 FCFA/mois",
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
    pricePonctuel: "15 000 - 20 000 FCFA",
    priceAbonnement: "55 000 FCFA/mois",
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
    pricePonctuel: "20 000 - 30 000 FCFA",
    priceAbonnement: "80 000 FCFA/mois",
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
    pricePonctuel: "15 000 - 40 000 FCFA",
    priceAbonnement: "70 000 FCFA/mois",
    features: [
      "Planning flexible",
      "Vitrine incluse",
      "Zone client",
      "Intervention rapide"
    ]
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
