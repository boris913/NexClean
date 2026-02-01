# 🚀 Guide de Déploiement NexClean

Ce guide vous explique comment déployer le site NexClean en production.

## 📋 Pré-requis

- Compte GitHub (gratuit)
- Compte Vercel (gratuit)
- Node.js 18+ installé localement (pour tester)

## 🎯 Option 1: Déploiement Rapide sur Vercel (Recommandé)

### Étape 1: Préparer le Code

1. **Créez un repository GitHub :**
   - Allez sur [GitHub](https://github.com)
   - Créez un nouveau repository (ex: `nexclean-website`)
   - Copiez l'URL du repository

2. **Initialisez Git localement :**
   ```bash
   cd nexclean-website
   git init
   git add .
   git commit -m "Initial commit - Site NexClean"
   git branch -M main
   git remote add origin https://github.com/VOTRE-USERNAME/nexclean-website.git
   git push -u origin main
   ```

### Étape 2: Connecter à Vercel

1. **Créez un compte Vercel :**
   - Allez sur [vercel.com](https://vercel.com)
   - Inscrivez-vous avec GitHub

2. **Importez le projet :**
   - Cliquez sur "Add New Project"
   - Sélectionnez votre repository `nexclean-website`
   - Configurez les paramètres :
     - Framework Preset: **Next.js**
     - Build Command: `npm run build`
     - Output Directory: `.next`
     - Install Command: `npm install`

3. **Variables d'environnement (optionnel) :**
   Ajoutez dans Vercel > Settings > Environment Variables :
   ```
   NEXT_PUBLIC_SITE_URL=https://nexclean.cm
   NEXT_PUBLIC_PHONE=+237682434962
   NEXT_PUBLIC_WHATSAPP=+237682434962
   NEXT_PUBLIC_EMAIL=contact@nexclean.cm
   ```

4. **Déployez :**
   - Cliquez sur "Deploy"
   - Attendez 2-3 minutes
   - ✅ Votre site est en ligne !

### Étape 3: Configurer le Domaine (Optionnel)

1. **Achetez un domaine :**
   - Recommandé: [Namecheap](https://www.namecheap.com) ou [GoDaddy](https://www.godaddy.com)
   - Suggestions: `nexclean.cm`, `nexclean-douala.com`, `nexclean.africa`

2. **Configurez dans Vercel :**
   - Allez dans Settings > Domains
   - Ajoutez votre domaine
   - Suivez les instructions DNS fournies par Vercel

## 🎯 Option 2: Déploiement Manuel

### Avec Vercel CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Déployer
vercel deploy --prod
```

### Avec d'autres plateformes

**Netlify :**
```bash
npm install -g netlify-cli
netlify deploy --prod
```

**Railway :**
```bash
npm install -g railway
railway login
railway up
```

## 📱 Optimisations Post-Déploiement

### 1. Vérifier la Performance

Testez sur [PageSpeed Insights](https://pagespeed.web.dev/) :
- Objectif: Score >90 sur mobile
- Vérifiez les Core Web Vitals

### 2. Configurer Analytics

**Google Analytics 4 :**

1. Créez une propriété GA4
2. Obtenez votre ID (GA_MEASUREMENT_ID)
3. Ajoutez dans `app/layout.tsx` :

```typescript
import Script from 'next/script';

// Dans le component RootLayout, avant </body>
<Script
  src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
  strategy="afterInteractive"
/>
<Script id="google-analytics" strategy="afterInteractive">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
  `}
</Script>
```

4. Redéployez

### 3. Configurer le Suivi WhatsApp

Ajoutez des événements de conversion pour tracer les clics WhatsApp :

```typescript
// Dans getWhatsAppLink()
const trackWhatsAppClick = () => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'whatsapp_click', {
      event_category: 'engagement',
      event_label: 'WhatsApp Button Click'
    });
  }
};
```

### 4. SEO Final

1. **Soumettez le sitemap à Google :**
   - Allez sur [Google Search Console](https://search.google.com/search-console)
   - Ajoutez votre propriété
   - Soumettez `https://votre-site.com/sitemap.xml`

2. **Vérifiez les balises Open Graph :**
   - Utilisez [Facebook Debugger](https://developers.facebook.com/tools/debug/)

3. **Schema.org pour LocalBusiness :**
   Ajoutez dans `app/layout.tsx` :

```typescript
<Script type="application/ld+json" id="schema-local-business">
  {JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "NexClean",
    "description": "Service de nettoyage professionnel à Douala",
    "telephone": "+237682434962",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Douala",
      "addressCountry": "CM"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "4.0511",
      "longitude": "9.7679"
    },
    "url": "https://nexclean.cm",
    "priceRange": "8000-60000 FCFA"
  })}
</Script>
```

## 🔄 Mises à Jour

### Déployer des changements :

```bash
# 1. Modifier le code localement
# 2. Tester en local
npm run dev

# 3. Commit et push
git add .
git commit -m "Description des changements"
git push origin main

# 4. Vercel redéploie automatiquement !
```

### Rollback en cas de problème :

1. Allez sur Vercel Dashboard
2. Sélectionnez "Deployments"
3. Trouvez le déploiement précédent
4. Cliquez sur "..." > "Promote to Production"

## 📊 Monitoring

### Performance

- **Vercel Analytics** : Inclus gratuitement
- **Google Lighthouse** : Tests réguliers
- **WebPageTest** : Tests depuis différentes localisations

### Erreurs

Vérifiez les logs dans :
- Vercel Dashboard > Logs
- Browser Console (F12)

## 🔒 Sécurité

### Certificat SSL

- ✅ Automatique avec Vercel
- ✅ HTTPS forcé

### Headers de Sécurité

Déjà configurés dans `vercel.json` :
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection

## 💡 Tips Pro

1. **Preview Deployments** : Chaque push sur une branche crée un aperçu
2. **Environment Variables** : Différenciez dev/prod
3. **Branch Protection** : Protégez la branche `main`
4. **Automatic Previews** : Activez dans Vercel pour tester avant déploiement

## 🆘 Problèmes Courants

### Build Fails

```bash
# Vérifier localement
npm run build

# Nettoyer le cache
rm -rf .next node_modules
npm install
npm run build
```

### Images ne chargent pas

Vérifiez que les images sont dans `/public/images/`

### Erreur 404

Vérifiez la configuration du routing dans `next.config.ts`

## 📞 Support

En cas de problème :
- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation Vercel](https://vercel.com/docs)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/next.js)

---

✅ **Votre site est maintenant en ligne et optimisé !**

URL de production : À configurer selon votre domaine
