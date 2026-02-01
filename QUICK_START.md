# ⚡ Démarrage Rapide NexClean

## 🎯 En 3 Minutes Chrono

### 1️⃣ Installation (30 secondes)

```bash
cd nexclean-website
npm install
```

### 2️⃣ Lancement (10 secondes)

```bash
npm run dev
```

Ouvrez http://localhost:3000 dans votre navigateur

### 3️⃣ C'est Prêt ! ✅

Votre site tourne en local. Testez toutes les fonctionnalités.

---

## 🚀 Déploiement Express (5 minutes)

### Méthode la Plus Rapide : Vercel

1. **Créez un compte** : [vercel.com](https://vercel.com) (gratuit)

2. **Installez Vercel CLI** :
   ```bash
   npm i -g vercel
   ```

3. **Connectez-vous** :
   ```bash
   vercel login
   ```

4. **Déployez** :
   ```bash
   vercel deploy --prod
   ```

5. **C'est en ligne !** 🎉
   - Vercel vous donne une URL (ex: nexclean.vercel.app)
   - Partagez-la immédiatement sur WhatsApp

---

## 📝 Personnalisation Rapide

### Changer le Numéro de Téléphone

**Fichier :** `lib/constants.ts`

```typescript
export const CONTACT = {
  phone: "+237682434962",        // ← Changez ici
  whatsapp: "+237682434962",     // ← Et ici
  email: "contact@nexclean.cm",  // ← Et ici
};
```

### Modifier les Tarifs

**Fichier :** `content/pricing-data.ts`

Changez les prix dans `pricingParticuliers` et `pricingProfessionnels`

### Ajouter des Témoignages

**Fichier :** `content/testimonials-data.ts`

Ajoutez un nouvel objet dans le tableau :

```typescript
{
  id: 6,
  name: "Nouveau Client",
  location: "Bonapriso",
  rating: 5,
  comment: "Excellent service !",
  service: "Nettoyage maison",
  date: "2026-02-01"
}
```

### Modifier la Promo

**Fichier :** `lib/constants.ts`

```typescript
export const PROMO = {
  active: true,              // true/false pour activer/désactiver
  title: "Offre de Lancement",
  discount: "-20%",          // ← Changez le pourcentage
  description: "sur votre première prestation",
  condition: "Pour les 50 premiers clients",
};
```

---

## 🎨 Changements Visuels Rapides

### Couleurs

**Fichier :** `tailwind.config.ts`

```typescript
colors: {
  primary: '#0A5ED7',    // ← Bleu principal
  secondary: '#2ECC71',  // ← Vert
  accent: '#FF6B35',     // ← Orange
}
```

Utilisez un [color picker](https://colorhunt.co/) pour choisir vos couleurs.

### Logo

Remplacez le composant Sparkles dans :
- `components/navigation/Header.tsx`
- `components/sections/HeroSection.tsx`

Par votre logo :
```typescript
<img src="/images/logo.png" alt="NexClean" className="w-8 h-8" />
```

---

## 📱 Test Mobile

### En Local

1. Trouvez votre IP locale :
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig
   ```

2. Sur votre téléphone, allez sur :
   ```
   http://VOTRE-IP:3000
   ```
   Exemple : `http://192.168.1.100:3000`

### Avec Vercel (après déploiement)

- Scannez le QR code que Vercel génère
- Ou partagez le lien directement

---

## ✅ Checklist Avant Lancement

- [ ] Numéro de téléphone correct
- [ ] Email correct
- [ ] WhatsApp fonctionne
- [ ] Tarifs à jour
- [ ] Zones de couverture correctes
- [ ] Témoignages authentiques
- [ ] Testé sur mobile
- [ ] Testé clics WhatsApp
- [ ] Formulaire de contact fonctionne
- [ ] Aucune erreur en console (F12)

---

## 🆘 Problèmes Fréquents

### "Module not found"
```bash
rm -rf node_modules
npm install
```

### Port 3000 déjà utilisé
```bash
npm run dev -- -p 3001
```
Puis allez sur http://localhost:3001

### Le site ne charge pas
```bash
# Arrêter le serveur (Ctrl+C)
# Redémarrer
npm run dev
```

### Build échoue
```bash
npm run build
# Lisez les erreurs affichées
```

---

## 🎓 Ressources Utiles

- **Aide Next.js** : https://nextjs.org/docs
- **Aide Tailwind** : https://tailwindcss.com/docs
- **Icons Lucide** : https://lucide.dev/icons
- **Guide Vercel** : https://vercel.com/docs

---

## 📞 Support Technique NexClean

WhatsApp : +237 6 82 43 49 62

---

**🎉 Félicitations ! Vous êtes prêt à lancer NexClean en ligne !**

💡 **Pro Tip** : Commencez par tester en local, puis déployez sur Vercel avec un sous-domaine gratuit. Une fois validé, configurez votre domaine personnalisé.
