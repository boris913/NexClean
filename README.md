# 🧹 NexClean - Site Web Officiel

**La propreté nouvelle génération à Douala**

Site web moderne et responsive pour NexClean, service de nettoyage professionnel au Cameroun.

## 🚀 Caractéristiques

- ✅ **Next.js 15** avec App Router
- ✅ **TypeScript** pour la sécurité du code
- ✅ **Tailwind CSS** pour un design moderne
- ✅ **Lucide React** pour les icônes
- ✅ **Mobile-first** et entièrement responsive
- ✅ **Performance optimisée** pour connexions 3G/4G
- ✅ **SEO optimisé** pour le marché camerounais
- ✅ **WhatsApp intégré** pour conversion maximale

## 📦 Installation

```bash
# Cloner le projet
git clone https://github.com/votre-repo/nexclean-website.git
cd nexclean-website

# Installer les dépendances
npm install

# Lancer en développement
npm run dev
```

Le site sera accessible sur `http://localhost:3000`

## 🏗️ Structure du Projet

```
nexclean-website/
├── app/                      # App Router Next.js
│   ├── layout.tsx           # Layout principal
│   ├── page.tsx             # Page d'accueil
│   └── globals.css          # Styles globaux
├── components/
│   ├── ui/                  # Composants réutilisables
│   │   ├── Button.tsx
│   │   ├── ServiceCard.tsx
│   │   ├── TestimonialCard.tsx
│   │   └── WhatsAppButton.tsx
│   ├── sections/            # Sections de page
│   │   ├── HeroSection.tsx
│   │   ├── ServicesSection.tsx
│   │   ├── ProcessSection.tsx
│   │   ├── PricingSection.tsx
│   │   ├── TestimonialsSection.tsx
│   │   ├── CoverageSection.tsx
│   │   ├── FAQSection.tsx
│   │   └── ContactSection.tsx
│   ├── navigation/          # Navigation
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── forms/               # Formulaires
│       └── ContactForm.tsx
├── content/                 # Données structurées
│   ├── services-data.ts
│   ├── zones-coverage.ts
│   ├── pricing-data.ts
│   └── testimonials-data.ts
├── lib/                     # Utilitaires
│   └── constants.ts
└── public/                  # Fichiers statiques
    ├── images/
    └── documents/
```

## 🎨 Personnalisation

### Couleurs

Les couleurs sont définies dans `tailwind.config.ts` :

```typescript
colors: {
  primary: '#0A5ED7',    // Bleu royal
  secondary: '#2ECC71',  // Vert clair
  accent: '#FF6B35',     // Orange
  dark: '#2C2C2C',       // Texte
  light: '#F8F9FA',      // Fond
}
```

### Contact

Modifiez les informations de contact dans `lib/constants.ts` :

```typescript
export const CONTACT = {
  phone: "+237682434962",
  whatsapp: "+237682434962",
  email: "contact@nexclean.cm",
  address: "Douala, Cameroun",
};
```

### Services

Ajoutez ou modifiez les services dans `content/services-data.ts`

### Tarifs

Personnalisez les tarifs dans `content/pricing-data.ts`

## 🌐 Déploiement

### Déploiement sur Vercel (Recommandé)

1. Créez un compte sur [Vercel](https://vercel.com)
2. Installez Vercel CLI :
   ```bash
   npm i -g vercel
   ```
3. Déployez :
   ```bash
   vercel deploy
   ```

### Build de Production

```bash
npm run build
npm run start
```

## 📱 Fonctionnalités Principales

### 1. Section Hero
- Message d'accroche percutant
- CTA WhatsApp et téléphone
- Badge promo dynamique
- Design gradient moderne

### 2. Services
- 6 services principaux
- Cards interactives
- Prix indicatifs
- Détails et inclusions

### 3. Processus (4 étapes)
- Visualisation du parcours client
- Icons animées
- CTA à chaque étape

### 4. Tarifs
- Grilles particuliers et professionnels
- Prix transparents
- Options d'abonnement
- Moyens de paiement

### 5. Témoignages
- Avis clients authentiques
- Notes 5 étoiles
- Localisation des clients
- Statistiques de satisfaction

### 6. Zone de Couverture
- Quartiers actifs
- Zones à venir
- Carte visuelle

### 7. FAQ
- Accordéon interactif
- 6 questions fréquentes
- Lien WhatsApp direct

### 8. Contact
- Formulaire intelligent
- Redirection WhatsApp
- Coordonnées complètes
- Horaires d'intervention

### 9. WhatsApp Flottant
- Bouton fixe en bas à droite
- Tooltip informatif
- Animation pulse
- Toujours accessible

## 🎯 Optimisations SEO

- Métadonnées complètes
- Structure sémantique HTML5
- Schema.org LocalBusiness (à ajouter)
- Sitemap XML automatique
- Images optimisées (WebP)
- Performance 90+ Lighthouse

## 📊 Analytics (À configurer)

Ajoutez Google Analytics dans `app/layout.tsx` :

```typescript
<Script src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID" />
<Script id="google-analytics">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'GA_MEASUREMENT_ID');
  `}
</Script>
```

## 🔧 Support Technique

- Node.js 18+ requis
- Compatible tous navigateurs modernes
- Optimisé Opera Mini et navigateurs africains
- Support offline partiel (PWA)

## 📝 Licence

© 2026 NexClean. Tous droits réservés.

## 👥 Équipe

Développé avec ❤️ pour NexClean - La propreté nouvelle génération

---

**Contact Développement:**
- WhatsApp: +237 6 82 43 49 62
- Email: contact@nexclean.cm

**Site Production:** https://nexclean.cm (à configurer)
