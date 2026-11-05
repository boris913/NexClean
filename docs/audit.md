# Audit du site public NEXCLEAN — état des lieux avant refonte « offre globale »

> Périmètre : `app/(site)/**`, `components/{navigation,sections,ui,forms}`, `content/`, `lib/seo.ts`, `lib/og-image.tsx`, `lib/constants.ts`, `app/layout.tsx`, `app/*.ts(x)`, `public/`, `tailwind.config.ts`, `app/globals.css`, tests `e2e/` et `tests/`.
> Back-Office (`app/(backoffice)/`) hors périmètre, sauf partage de tokens (§5.6).
> Aucun fichier de code modifié. Numéros de ligne relevés le 2026-11-04 sur `main` (a2871a1).

---

## 1. Inventaire des pages publiques

Toutes les pages sont rendues dans `app/(site)/layout.tsx` : Header, Footer, `WhatsAppButton` (desktop), `MobileCTABar` (mobile), Analytics, et 3 JSON-LD globaux (LocalBusiness, ItemList services, WebSite) sur **toutes** les pages, y compris suivi/candidat.

`pageMetadata()` (`lib/seo.ts:53-78`) pose title, description, canonical et OG, **mais pas `twitter`** : toutes les pages héritent du titre/description Twitter par défaut de `app/layout.tsx:62-67` (« Nettoyage professionnel & entretien… »).

| Route | Rôle | Sections / composants | Metadata | Hn |
|---|---|---|---|---|
| `/` (`page.tsx`) | Accueil | Hero, ServicesMarquee, ServicesSection, AudienceSection, BeforeAfterSection, WhyUsSection, ProcessSection, SubscriptionsSection, ProductsSection, TestimonialsSection, CoverageSection, FAQSection, CTASection + FAQ JSON-LD | `generateMetadata` L19-43 : titre absolu `titreParDefaut` (nettoyage), canonical, OG ; pas de twitter propre | 1 h1 (Hero L44) |
| `/services` | Index des services | PageHero, ServicesSection, ProcessSection, CoverageSection, CTASection | L13-20 « Nettoyage professionnel à {villes} » | 1 h1 (PageHero) |
| `/services/[slug]` (5 slugs statiques) | Fiche service nettoyage | PageHero, 3 cartes (inclus/pour qui/tarif), ProcessSection, ServicesSection (autres), CTASection, JSON-LD Service + Breadcrumb | L20-25 depuis `services-data.seo` | 1 h1 ; cartes en h2 |
| `/particuliers` | Audience particuliers (nettoyage) | PageHero, 3 étapes, ServicesSection filtrée, PricingSection, FAQSection, CTASection | L15-22 « Nettoyage maison et appartement… — Particuliers » | 1 h1 |
| `/professionnels` | Audience pro (nettoyage) + encart personnel | PageHero, secteurs, ServicesSection, SubscriptionsSection, encart « Besoin de personnel » L71-85, formulaire `#devis-pro` (WhatsAppForm), CTASection | L14-21 « Nettoyage professionnel pour entreprises… » | 1 h1 |
| `/abonnements` | Formules d'entretien | PageHero, SubscriptionsSection, PricingSection, FAQSection, CTASection | L11-18 « Abonnement nettoyage et entretien régulier… » | 1 h1 |
| `/espaces-verts` | Espaces verts | PageHero, prestations, Avant/Après (vide : aucune réalisation EV), formulaire `#devis-espaces-verts`, FAQ, CTA, JSON-LD Service + FAQ | L18-25 | 1 h1 |
| `/tarifs` | Tarifs | PageHero, PricingSection, ClientProcess, CTASection | L9-16 « Tarifs nettoyage à {villes} » | 1 h1 |
| `/realisations` | Avant/après | PageHero, RealisationsGallery (1 seule réalisation), photos terrain, CTASection | L10-17 | 1 h1 |
| `/a-propos` | Entreprise | PageHero, piliers, engagement qualité, WhyUsSection, ClientProcess, CTASection | L11-18 | 1 h1 ; piliers en h2 |
| `/contact` | Contact / devis | PageHero, ContactSection (ContactForm = devis général), CoverageSection, FAQSection | L9-16 | 1 h1 |
| `/boutique` | Catalogue (1 produit) | PageHero, ProductCard, infos paiement/livraison/pro | `metadata` L10-14 | 1 h1 |
| `/boutique/[slug]` | Fiche produit | Breadcrumb (sans PageHero), galerie, ProductOrder (WhatsApp), InfoList, JSON-LD Product + Breadcrumb | L16-26 (image produit) | 1 h1 (L72) |
| `/recrutement` | Offres + placement + candidat | PageHero, encart `#placement` L43-60, valeurs, liste d'offres (`content/jobs-data.ts`), encart `#candidature` | `metadata` L10-15 | 1 h1 |
| `/recrutement/[slug]` | Fiche offre + candidature | PageHero, barre méta, missions/profil/horaires, aside salaire, `Postuler`, autres offres | L35-51 (noindex si offre fermée) — **pas de JSON-LD JobPosting** | 1 h1 |
| `/recrutement/demander-du-personnel` | Formulaire placement 4 étapes | Section ad hoc (pas de PageHero ni breadcrumb), `FormulairePersonnel` | `metadata` L10-15 | 1 h1 (L23) |
| `/candidat/inscription` | Inscription candidat (7 étapes) | `Coque` + `FormulaireCandidat` | L14-19 (indexable) | 1 h1 (Coque) |
| `/candidat/connexion` | Connexion | Coque + FormulaireConnexion | title seul, noindex (L10) | 1 h1 |
| `/candidat/espace` | Tableau de bord candidat | Coque + cartes | title, noindex (L18) | 1 h1 |
| `/candidat/espace/profil`, `/supprimer` | Profil, suppression | Coque | title, noindex | 1 h1 |
| `/candidat/mot-de-passe-oublie` | Mot de passe oublié | Coque | **absente** → hérite du titre nettoyage par défaut **et reste indexable** | 1 h1 |
| `/candidat/reinitialiser/[jeton]` | Nouveau mot de passe | Coque | title, noindex (L9) | 1 h1 |
| `/suivi/[jeton]` | Page de suivi client (sans compte) | Section ad hoc `max-w-lg`, SectionDevis/Paiements/Profils/Documents | title, noindex, `no-referrer` (L17-21) | 1 h1 (L34 ou L54) |
| `/profil/[jeton]` | Lien temporaire profil/attestation | Section ad hoc | noindex (L12-16) | 1 h1 |
| `/blog` | Liste d'articles | `BlogClient` (pas de PageHero, `max-w-7xl`) | `metadata` brut L5-9, **pas de canonical** | 1 h1 (BlogClient L35) |
| `/blog/[slug]` | Article | `BlogPostClient` | L15-49 : titre « {titre} \| Blog NexClean » **+ template** → double suffixe ; **pas de canonical** ; image de repli `https://nexclean.xyz/og-image.png` **inexistante** dans `public/` | 1 h1 (L64) |
| `/mentions-legales`, `/confidentialite`, `/cgv` | Légal | `LegalPage` (PageHero + prose) | pageMetadata | 1 h1 |

Routes non-page : `suivi/[jeton]/documents/{accuse-reception,devis/[id],factures/[id],recus/[id]}`, `suivi/[jeton]/{attestation,cv}/…`, `profil/[jeton]/{attestation,cv}/…`, `candidat/espace/documents/[id]` (route handlers, à ne pas toucher).

Remarque Hn transverse : le Footer utilise des `h4` (`Footer.tsx:81,95,109`) directement après des `h2` → saut de niveau sur toutes les pages.

---

## 2. Positionnement « nettoyage uniquement »

### 2.1 Textes qui positionnent la **marque entière** sur le nettoyage (à revoir)

| Fichier:ligne | Texte exact | Portée |
|---|---|---|
| `lib/seo.ts:19` | `NEXCLEAN SARL — Nettoyage professionnel & entretien à ${villes}, Cameroun` | Titre accueil, titre par défaut, OG/Twitter de toutes les pages |
| `lib/seo.ts:20-21` | `NEXCLEAN SARL : nettoyage de maisons et bureaux, fin de chantier, vitres, entretien d'espaces verts et produits d'entretien à ${villes}. Devis gratuit sur WhatsApp.` | Description par défaut + JSON-LD LocalBusiness (L89) et WebSite (L204) |
| `lib/seo.ts:26-41` | 12 mots-clés « nettoyage … Douala » / « désinfection » / « produit nettoyage » ; seul lien emploi : `recrutement agent de nettoyage Douala` | `keywords` global |
| `lib/seo.ts:49` | alt OG `NEXCLEAN SARL — Nettoyage professionnel & entretien au Cameroun` | OG de toutes les pages |
| `lib/seo.ts:144` | ItemList `Services NexClean` = uniquement `services-data` (5 nettoyage + EV + abonnement) | JSON-LD global |
| `lib/og-image.tsx:5` | `OG_ALT = 'NEXCLEAN SARL — Nettoyage professionnel & entretien au Cameroun'` | `opengraph-image.tsx`, `twitter-image.tsx` |
| `lib/og-image.tsx:43` | `Nettoyage professionnel & entretien` (titre de l'image) | Image de partage |
| `lib/og-image.tsx:45` | `${villes}, Cameroun · Particuliers & entreprises` | idem |
| `lib/og-image.tsx:48` | badges `'Devis gratuit sur WhatsApp', 'Espaces verts', 'Produits NexClean'` (aucun recrutement) | idem |
| `app/layout.tsx:97-98` | `category: 'services'`, `classification: 'Nettoyage professionnel'` | metadata globale |
| `public/site.webmanifest:2` | `"NEXCLEAN SARL — Nettoyage professionnel & entretien"` | PWA |
| `public/site.webmanifest:4` | `"Nettoyage professionnel, entretien des espaces verts et produits d'entretien à Douala, Cameroun."` (Douala seule) | PWA |
| `components/navigation/Footer.tsx:52` | `Nettoyage professionnel, entretien des espaces verts et produits d'entretien à {villes}, Cameroun.` | Toutes les pages |
| `Footer.tsx:81-90` | Colonne « Nos services » = `services-data` (aucun recrutement/placement) | Toutes les pages |
| `components/sections/HeroSection.tsx:44-46` | h1 `Nettoyage professionnel & entretien au Cameroun` | Accueil |
| `HeroSection.tsx:48-50` | `Maisons, bureaux, fins de chantier et espaces verts à {villes}. Envoyez vos photos, recevez votre devis.` | Accueil |
| `HeroSection.tsx:63` | `'Devis gratuit', 'Matériel & produits fournis', 'Particuliers & entreprises'` | Accueil |
| `HeroSection.tsx:53-59` | CTA `Devis gratuit sur WhatsApp` (message nettoyage par défaut) + `Voir nos services` | Accueil |
| `components/sections/ServicesMarquee.tsx:5` | bandeau = noms des services + `Produits NexClean` | Accueil |
| `components/sections/ServicesSection.tsx:17-18` | `Des solutions adaptées à chaque besoin` / `Nettoyage, espaces verts, fins de chantier, vitres et entretien régulier.` | Accueil, /services |
| `components/sections/AudienceSection.tsx:10,19` | parcours Particuliers/Professionnels décrits uniquement en nettoyage (« entretien, grand nettoyage, emménagement, vitres ») | Accueil |
| `components/sections/WhyUsSection.tsx:41` + `lib/constants.ts:63-84` | `Chaque intervention suit la même méthode : état des lieux, devis clair, planification, intervention et contrôle.` ; WHY_US « Matériel professionnel », « Contrôle qualité »… | Accueil, /a-propos |
| `components/sections/ProcessSection.tsx:8-15,26` | 6 étapes d'intervention ; `De la première demande au suivi après intervention.` | Accueil, /services, /services/[slug] |
| `components/sections/CTASection.tsx:16-17` | `Prêt à nous confier votre espace ?` / `Envoyez-nous quelques photos sur WhatsApp…` (défaut) | Accueil, services, tarifs, à propos, réalisations… |
| `lib/constants.ts:122-124` | `WHATSAPP_MESSAGE` = `Bonjour NexClean, je souhaite obtenir un devis pour un service de nettoyage.` | Tous les `getWhatsAppLink()` sans argument (Hero, Process, Contact, Footer, CTA…) |
| `lib/constants.ts:149` | défaut de `getPageWhatsAppMessage` = même phrase nettoyage | FAB + MobileCTABar sur `/`, `/contact`, `/blog`, **`/candidat/*`, `/suivi/*`, `/profil/*`** |
| `lib/constants.ts:86-120` | FAQ globale 100 % prestations (zones, matériel, intervention, produits) ; L90 « Nous intervenons principalement à Douala » (incohérent avec Douala + Yaoundé) | Accueil, /contact, /particuliers |
| `components/navigation/Header.tsx:19-29` | menu « Services » = nettoyage/EV/abonnements uniquement ; « Recrutement » relégué en 7e position (L34-43) | Toutes les pages |
| `Header.tsx:162-170` ; `MobileCTABar.tsx:23,27,31` | CTA permanents `Demander un devis` / `Devis gratuit` / `WhatsApp / Devis` / `Devis` → `/contact` (formulaire nettoyage) | Toutes les pages, y compris espace candidat |
| `app/(site)/services/page.tsx:16,28` | `Nettoyage professionnel à ${villes}` (index de **tous** les services) | /services |
| `app/(site)/a-propos/page.tsx:15` | `entreprise camerounaise de nettoyage professionnel et d'entretien des espaces verts` | meta /a-propos |
| `a-propos/page.tsx:51-52` | `NexClean, la propreté organisée` ; `…dans le nettoyage de leurs espaces, l'entretien de leurs espaces verts et, désormais, avec nos propres produits` | /a-propos |
| `a-propos/page.tsx:24,29` | mission « service de propreté » ; vision « référence camerounaise de la propreté et de l'entretien » | /a-propos |
| `app/(site)/tarifs/page.tsx:12,22-24` | `Tarifs nettoyage à ${villes}` ; page générique « Nos tarifs » sans commission de placement | /tarifs |
| `components/forms/quote-forms.ts:15` | options « Service souhaité » = services nettoyage + `Autre` (pas de recrutement) | /contact |
| `app/(site)/blog/page.tsx:8` ; `BlogClient.tsx:40` | `articles sur le nettoyage professionnel…` ; `pour un intérieur toujours impeccable` | /blog |
| `app/(site)/recrutement/page.tsx:13` | `NexClean recrute à Douala : agents de nettoyage, chefs d'équipe…` (Douala seule, mélange recrutement interne / placement) | meta /recrutement |
| `recrutement/page.tsx:19-21` | valeurs « Nos clients comptent sur nous à l'heure prévue », « Chaque chantier est un travail collectif » (cadre d'un employé de nettoyage, pas d'un candidat placé) | /recrutement |
| `public/images/brand/logo-horizontal.svg:5-6,14` | étincelle (« spark ») sur la tuile + mot « CLEAN » vert | Identité (cf. §6) |
| Décor `SectionLabel.tsx:14`, `ServicesMarquee.tsx:14`, `CTASection.tsx:27-32` | étincelles « propreté » partout | Identité visuelle |

### 2.2 Textes qui décrivent **légitimement** le service nettoyage (à garder, dans les pages nettoyage)

- `content/services-data.ts` (noms, `seo.title/description/h1/intro`, `includes`, `idealFor`) — fiches `/services/[slug]`.
- `content/pricing-data.ts` et `PricingSection.tsx` (tarifs logements/bureaux).
- `/particuliers`, `/professionnels` (sauf encart personnel), `/abonnements`, `/espaces-verts` : contenu métier correct, mais leurs **titres** (« Nettoyage maison… — Particuliers », « Nettoyage professionnel pour entreprises ») font des pages d'audience des pages nettoyage.
- `content/realisations-data.ts`, `BeforeAfterSection.tsx` (« Nos équipes sur le terrain ») : preuve nettoyage.
- `content/products-data.ts`, `/boutique` (« Produits de nettoyage ») : légitime pour la boutique.
- Articles `content/blog/*.md` (8 articles, tous nettoyage/produit).
- `getPageWhatsAppMessage` branches spécifiques (`lib/constants.ts:137-148`).

---

## 3. Activités / fonctionnalités réellement présentes

| Activité | Où elle vit (code) | Visible depuis l'accueil ? | Navigation | Mise en avant |
|---|---|---|---|---|
| Nettoyage ponctuel | `/services`, `/services/[slug]` ×5, `/particuliers`, `/professionnels`, `/contact` (dossier `NET`), `content/services-data.ts` | Oui : h1, Hero, marquee, ServicesSection, Audience, Process, FAQ, CTA | Header « Services », Footer « Nos services » | **Dominante** |
| Abonnements | `/abonnements`, `SubscriptionsSection`, service `abonnement-entretien-regulier` (dossier `ABO`) | Oui (section dédiée) | Header Services > Abonnements, Footer | Moyenne |
| Espaces verts | `/espaces-verts` + formulaire `devis-espaces-verts` (dossier `EV`) | Oui (badge flottant Hero L142-145, marquee, carte service) | Header Services > Espaces verts, Footer | Moyenne |
| Recrutement / placement (« Demander du personnel ») | `/recrutement/demander-du-personnel` (`FormulairePersonnel`, 4 étapes, estimation = commission × personnes, dossier `REC`, lien de suivi) | **Non** | Header Recrutement > 4e sous-lien ; encart `/recrutement#placement` ; encart `/professionnels` L71-85 ; **absent du Footer** | **Faible** alors que c'est le cœur du Back-Office (CONTEXT.md) |
| Offres d'emploi + candidature | `/recrutement`, `/recrutement/[slug]` + `Postuler.tsx` ; offres **statiques** dans `content/jobs-data.ts` (8 offres : 4 ouvertes, 4 pourvues) | Non | Header Recrutement ; Footer « Recrutement » | Faible |
| Espace candidat | `/candidat/{inscription,connexion,espace,espace/profil,espace/supprimer,mot-de-passe-oublie,reinitialiser}` | Non | Header Recrutement > 2 liens ; Footer « Espace candidat » | Faible |
| Page de suivi client | `/suivi/[jeton]` (statut, devis à accepter, paiements, profils proposés, documents), `/profil/[jeton]` | Non (par conception : lien sécurisé, noindex) | Aucune ; seul accès : lien du message WhatsApp ou « Suivre ma demande » après formulaire (`WhatsAppForm.tsx:166-170`) | Invisible ; aucune page publique n'explique que le client suivra son dossier en ligne |
| Boutique | `/boutique`, `/boutique/[slug]` (1 produit), commande WhatsApp (`ProductOrder.tsx`), hors Back-Office | Oui (lien Hero L74-81, carte flottante prix L154-163, ProductsSection) | Header, Footer, manifest shortcut | Moyenne à forte (pour 1 produit) |
| Devis | 3 formulaires « enregistrer puis WhatsApp » : `devis` (/contact), `devis-pro`, `devis-espaces-verts` (`components/forms/quote-forms.ts`) + liens WhatsApp directs | Oui (CTA permanents) | Header CTA, MobileCTABar, `/contact` | Forte, mais 100 % nettoyage |
| Tarifs | `/tarifs` = tarifs nettoyage ; commission de placement visible seulement dans l'estimation du formulaire personnel (`lireParametre('commission_par_personne')`) | Non (section tarifs absente de l'accueil) | Header, Footer | Moyenne, nettoyage seul |
| Réalisations | `/realisations` (1 réalisation), `BeforeAfterSection` | Oui | Header, Footer | Moyenne |
| Blog | `/blog`, `/blog/[slug]` (Markdown) | Non | Header, Footer | Faible |
| Types de dossier sans entrée publique | `MAD` Mise à disposition, `PAR` Partenariat, `RCL` Réclamation (`lib/domain/referentiels.ts:7-15`) | — | — | Aucune page / aucun formulaire |

Témoignages : les 3 avis de `content/testimonials-data.ts` sont `verified: false` → la section n'affiche que l'encart « Laisser un avis ».

---

## 4. Navigation & arborescence

**Header** (`components/navigation/Header.tsx`)
- `navLinks` L17-45 : Accueil · Services ▾ (Tous nos services, Particuliers, Professionnels, Espaces verts, Abonnements) · Réalisations · Boutique · Tarifs · À propos · Recrutement ▾ (Offres & candidature, Créer mon profil candidat, Espace candidat, Demander du personnel) · Blog. **9 entrées** de 1er niveau.
- Nav desktop seulement à partir de `xl` (1280 px, L102) ; de 768 à 1279 px : burger + bouton « Devis gratuit » (L168).
- Sous-menus : `<button aria-expanded>` (L106-116), fermeture au clic extérieur, **pas de touche Échap ni de gestion du focus**. Le menu mobile n'est rendu que s'il est ouvert.
- CTA desktop : icône téléphone + `Demander un devis` → `/contact` (L155-164). Mobile : lien final `Contact / Devis` (L216-222).

**Footer** (`Footer.tsx`) : tagline nettoyage (L52), réseaux, colonne « Nos services » (services-data), « Navigation » (`quickLinks` L8-19 : Particuliers, Professionnels, Réalisations, Boutique, Tarifs, À propos, Recrutement, Espace candidat, Blog, Contact / Devis), Contact, liens légaux (L21-25). Absents : `/services`, `/recrutement/demander-du-personnel`, `/candidat/inscription`.

**MobileCTABar** (`components/ui/MobileCTABar.tsx`, `lg:hidden`) : `WhatsApp / Devis` (message selon la page) · `Devis` → `/contact` · appel. Affichée aussi sur l'espace candidat et la page de suivi, où « Devis » n'a pas de sens.

**WhatsAppButton** (FAB, `lg` et plus) : `animate-fade-in` et `animate-pulse-ring` (L35) se neutralisent (une seule propriété `animation`).

**Breadcrumbs** : `Breadcrumb.tsx` utilise `<a>` (L23) et non `next/link` (rechargement complet). Présents via PageHero sur toutes les pages « vitrine » + `/boutique/[slug]`. Absents de `/recrutement/demander-du-personnel`, `/candidat/*`, `/blog`, `/blog/[slug]`, `/suivi`, `/profil`. JSON-LD BreadcrumbList seulement sur `/services/[slug]` et `/boutique/[slug]`.

**Vérification des hrefs internes** : tous les liens internes du Header, Footer, MobileCTABar, sections et pages pointent vers des routes existantes (`/`, `/services`, `/services/{5 slugs}`, `/particuliers`, `/professionnels`, `/espaces-verts`, `/abonnements`, `/realisations`, `/boutique`, `/boutique/{slug}`, `/boutique#professionnels` (id présent `boutique/page.tsx:48`), `/tarifs`, `/a-propos`, `/recrutement`, `/recrutement/{slug}`, `/recrutement/demander-du-personnel`, `/candidat/inscription|connexion|espace|espace/profil|espace/supprimer`, `/blog`, `/contact`, `/mentions-legales`, `/confidentialite`, `/cgv`). Ancres OK : `#devis-pro`, `#devis-espaces-verts`, `#candidature`, `#placement`.
Liens morts / incohérences :
- `blog/[slug]/page.tsx:27` → `https://nexclean.xyz/og-image.png` : **fichier inexistant** (seul `/opengraph-image` existe).
- `ProductsSection.tsx:32` → `/boutique#professionnels` n'est rendu que si `products.length < 2` (cas actuel : oui).
- Incohérences d'arborescence : Abonnements/Espaces verts ont un fil « Services › … » mais sont des pages racines ; « Recrutement » regroupe recrutement interne, placement B2B et espace candidat sous un même libellé ; `Header` met `Particuliers`/`Professionnels` sous « Services » alors que le Footer les met en « Navigation ».
- `robots.ts:18` interdit `/_next/` (assets CSS/JS) pour `*` ; Googlebot a sa propre règle `allow: /`, mais les autres moteurs ne peuvent pas rendre les pages. `/admin` n'est pas listé en `disallow`.

---

## 5. Design system actuel

### 5.1 Tokens
- **Couleurs** (`tailwind.config.ts:10-59`) : `brand` 50→950 (vert, `brand-400 #84CC45` = CTA), `ink` 50→900 (neutres verdâtres), **`slate` = alias de `ink`** (L50), `ocean` (bleu accent, utilisé dans le Hero et le Back-Office seulement), `sun #FFB020` (**inutilisé**), rôles `primary` = brand-700, `primary-dark` = brand-800, `primary-light` = brand-100, `cta` = brand-400, `success` = brand-500, `accent #F08A24` (orange, astérisques et badge « Pendant »). `themeColor #84CC45` (`app/layout.tsx:33`, manifest).
- **Typo** : `app/fonts/` locales (OFL) — Plus Jakarta Sans (`--font-body`, 200-800) et Outfit (`--font-display`, 100-900), `app/layout.tsx:17-29`. `h1-h4` en `font-display tracking-tight` (`globals.css:17-19`). Tailles 5xl-7xl redéfinies (config L65-69).
- **Rayons** : `4xl = 2rem` (L70-72, **jamais utilisé** : on trouve `rounded-[2rem]` ×3 à la place).
- **Ombres** : `card`, `card-hover`, `btn`, `btn-hover`, `glow` (L73-79) + 9 ombres arbitraires `shadow-[…]`.
- **Animations** : fade-in, slide-up/down, float, float-slow, blob, sparkle, marquee, pulse-ring (L80-104) ; framer-motion via `Reveal`/`Stagger` (`components/ui/Reveal.tsx`, `MotionConfig reducedMotion="user"`).
- **Utilitaires CSS** (`globals.css:45-84`) : `.highlight`, `.bg-dots` (utilisés) ; `.fade-up`, `.delay-*`, `.gradient-text` et `lib/useScrollAnimation.ts` (**morts**).

### 5.2 Composants UI réutilisables
`Button` (6 variantes × 3 tailles, Link/a/button), `PageHero`, `SectionLabel`, `Breadcrumb`, `Logo`, `ServiceCard`, `ProductCard`, `RealisationCard`, `TestimonialCard`, `Reveal/Stagger`, `WhatsAppButton`, `WhatsAppIcon`, `MobileCTABar`, `JsonLd`, `LegalPage` ; formulaires : `WhatsAppForm` (exporte `inputClass`/`labelClass`, réutilisés par 9 fichiers candidat/recrutement/suivi) ; mise en page candidat : `app/(site)/candidat/Coque.tsx`.

### 5.3 Incohérences (comptes sur `components/{navigation,sections,ui,forms}` + `app/(site)`)
- **Hex en dur** : `#25D366` ×11 (Button L43, ContactSection ×4, WhatsAppButton, MobileCTABar, Footer L71, WhatsAppForm L162, FormulairePersonnel ×3, FormulaireCandidat, ProductOrder) ; `#1FBE5B` ×2 ; `#84CC45` (`PricingSection.tsx:58`) ; couleurs réseaux sociaux ×6 (`BlogPostClient.tsx:120-136`) ; OG image en styles inline (`lib/og-image.tsx`). Pas de token `whatsapp`.
- **Palette Tailwind par défaut hors tokens** : `red-*` ×55, `green-*` ×19 (ex. `espaces-verts/page.tsx:84-85` `bg-green-50 text-green-700`, badge offre `recrutement/page.tsx:107`, `CoverageSection.tsx:28`), `amber-*` ×18, `blue-*` ×2.
- **Nommage neutre mélangé** : `slate-*` ×434 vs `ink-*` ×270 (même couleur via alias, deux vocabulaires).
- **Boutons dupliqués hors `Button`** : ~25 pseudo-boutons stylés à la main (ex. `MobileCTABar.tsx:20,28`, `ProductCard.tsx:38`, `BlogClient.tsx:109`, `ProductOrder.tsx:101`, `WhatsAppForm.tsx:162`, `suivi/[jeton]/page.tsx:36,93`, `profil/[jeton]/page.tsx:29,48`, `FormulaireConnexion.tsx:67`, `Postuler.tsx:152,178,239`, `FormulairePersonnel.tsx:226,512,582`, `FormulaireCandidat.tsx:335,352`, `Elements.tsx:33`, `Propositions.tsx:87`, `mot-de-passe-oublie/page.tsx:67`…) ; hauteurs `h-12`, `min-h-11`, `min-h-12`, `h-14` vs paddings du `Button`. Seuls 20 fichiers importent `Button`. 46 `<button>` natifs dans le site.
- **Cartes divergentes** : `rounded-3xl p-7 shadow-card` (ServiceCard, Process, Subscriptions) ; `rounded-2xl p-5/p-6 shadow-card` (pages internes) ; `rounded-[2rem] p-7 sm:p-10` (Audience) ; `rounded-xl` (Coverage, secteurs) ; avec/sans bordure, avec/sans ombre. Répartition des rayons : `rounded-full` 88, `2xl` 76, `lg` 47, `xl` 37, `3xl` 7, arbitraires 6.
- **Titres de section** : 3 échelles (`text-3xl sm:text-5xl` + SectionLabel dans `components/sections` ; `text-3xl sm:text-4xl` sans label dans les pages ; `text-2xl sm:text-3xl` + surtitre maison `text-xs uppercase` dans `Coque` et `demander-du-personnel`) ; `/suivi` et `/profil` : h1 `text-2xl font-semibold`.
- **Conteneurs** : `max-w-6xl` ×34 (standard), mais `max-w-7xl` (Header, Blog), `max-w-5xl` (fiche offre), `max-w-4xl` (Coverage), `max-w-3xl` (FAQ, formulaires, légal), `max-w-2xl` (demander-du-personnel, Coque large, Postuler), `max-w-md` (Coque), `max-w-lg` (suivi, profil). Header `max-w-7xl` vs Footer `max-w-6xl` vs menu mobile `max-w-6xl` : bords non alignés.
- **Espacements verticaux** : `py-20 sm:py-28`, `py-20 sm:py-24`, `py-16 sm:py-20`, `py-14`, `py-12`, `py-10` sans règle. `Coque` et `demander-du-personnel` ajoutent `pt-24 sm:pt-28` **en plus** du `pt-20` de `<main>` (≈ 176-192 px de vide sous le header).
- **Tailles arbitraires** : `text-[2.6rem]`, `text-[4.1rem]` (Hero L44), `text-[5.5rem]` (Process), `text-[15px]` (Button lg), `text-[11px]`.
- **Icônes** : uniquement `lucide-react` **0.263.1** (2023) + SVG maison (`WhatsAppIcon`, `TikTokIcon` dans Footer, étoile répétée en dur ×4). `react-icons ^5.5.0` est **dépendance déclarée mais jamais importée**. `ServiceCard.tsx:2` et `WhyUsSection.tsx:2` font `import * as LucideIcons` (résolution par nom de chaîne).
- Libellé produit en dur dans le Hero (`HeroSection.tsx:160` « Savon NexClean 1 L ») ≠ nom du produit (« Savon Précieux à l'Huile d'Argan »).

### 5.4 Back-Office et tokens partagés
Le Back-Office n'importe **aucun** composant du site (`components/ui|sections|navigation|forms`), mais partage : `tailwind.config.ts` (brand/ink/ocean/slate-alias), `app/globals.css` (base, focus, reduced-motion, scrollbars `.bo`), `app/layout.tsx` (polices, `titreParDefaut` + `TITLE_TEMPLATE` « %s | NEXCLEAN SARL »), et `components/backoffice/ui.tsx` (`classeChamp`, `ocean-*`). Toute modification de tokens ou du layout racine se répercute dans le Back-Office.

---

## 6. Logo & identité actuels

- `components/ui/Logo.tsx` : 3 variantes SVG horizontales (`couleur`, `blanc`, `mono`), ratio 449×128, `alt="NEXCLEAN SARL"`, `unoptimized`. Utilisé **uniquement** dans le Header (L98, `height 42`, `priority`) et le Footer (L50, `variant="blanc"`).
- `public/images/brand/logo-horizontal.svg` : tuile arrondie dégradé `#A3DE6E → #4E911F` avec « N » blanc + **étincelle bleue `#2F6FE4`** (L5) et étincelle blanche ; mot « NEX » (`#131A12`) + « CLEAN » (`#4E911F`), filet `#84CC45`, « SARL ». L'étincelle et « CLEAN » ancrent l'identité dans la propreté.
- `app/icon.svg` : même tuile « N » + étincelle (favicon). `app/apple-icon.png` présent.
- `public/images/brand/` : `favicon.svg`, `icon-192.png`, `icon-512.png`, `logo-horizontal.{svg,png}`, `logo-horizontal-blanc.svg`, `logo-horizontal-mono.svg`, `logo-symbole.svg`, `logo-vertical.svg`, `logo-vertical-blanc.svg`.
- Anciens fichiers **non référencés** dans le code : `public/images/logo.png`, `nexclean-logo.png`, `nexclean-logo1.png`, `nexclean-logo-1.png`, `fav-icon.png`, `favicon.ico`, `banner.png`, `team/equipe-nexclean.jfif`.
- Autres usages : OG/Twitter image (`lib/og-image.tsx:10`, `logo-horizontal-blanc.svg`), JSON-LD `logo` = `logo-horizontal.png` (`lib/seo.ts:91`), manifest (`icon-192/512`, `favicon.svg`).
- Images : `public/images/team/` (9 photos d'équipe en intervention), `public/images/blog/` (15, dont produits et avant/pendant réutilisés comme « réalisations »). **Aucune image** liée au recrutement, aux candidats ou aux espaces verts.

---

## 7. Accessibilité

### 7.1 Contrastes (WCAG 2.x, calculés)
| Couple | Ratio | Verdict | Où |
|---|---|---|---|
| Blanc sur `#25D366` (WhatsApp) | **1,98** | Échec (même gros texte) | `Button` variante `whatsapp` (CTA principal du Hero, Process, CTA, formulaires), MobileCTABar L20, WhatsAppForm L162 |
| Blanc sur `#1FBE5B` (survol) | 2,45 | Échec | Button L43, ProductOrder |
| `ink-900` sur `brand-400` (cta) | 9,04 | OK | boutons primaires |
| Blanc sur `brand-400` | 1,96 | Échec | à proscrire (non relevé dans le code actuel) |
| `ink-900` sur `primary-dark` (brand-800) | **2,18** | Échec | survol « Voir plus d'articles » `BlogClient.tsx:109` |
| `success` (brand-500) sur blanc | **2,61** | Échec | prix abonnement `PricingSection.tsx:85`, « Disponible » `boutique/[slug]/page.tsx:88`, prime `recrutement/[slug]/page.tsx:222`, badge `CoverageSection.tsx:28` |
| `slate-400` (ink-400) sur blanc / slate-50 | **2,90 / 2,74** | Échec | 19 occurrences (prix ServiceCard L39, sous-libellés tarifs, notes de formulaire `WhatsAppForm.tsx:322`, ContactSection L45/84) |
| `slate-300` sur blanc | **1,66** | Échec | « ÉTAPE n » `particuliers/page.tsx:57`, etc. (5 occ.) |
| `accent #F08A24` sur blanc | 2,51 | Échec (astérisques « * » obligatoires, 13 occ.) | formulaires |
| `brand-400` (soulignement nav actif) sur blanc | 1,96 | Indicateur non textuel < 3:1 | `Header.tsx:144` |
| `primary` (brand-700) sur blanc | 5,94 | OK | liens |
| `slate-500` sur blanc / slate-50 | 5,02 / 4,74 | OK | |
| `brand-100/70` sur `brand-950` (Footer) | ≈ 7,3 | OK | |

### 7.2 Autres points
- **Images** : aucune `<Image>` sans `alt` ; `alt=""` seulement pour le logo décoratif de l'OG. Le Logo du Header est dans un lien vers `/` dont le nom accessible est « NEXCLEAN SARL » (pas « Accueil »).
- **Focus visible** : règle globale `:focus-visible` ring brand-500 (`globals.css:25-27`) et ring dans `Button`. Mais les champs (`inputClass`, `WhatsAppForm.tsx:31`) font `outline-none focus:ring-primary/10` (anneau à 10 % d'opacité, quasi invisible ; seule la bordure change).
- **Boutons sans libellé** : burger (`aria-label` OK), téléphone (OK), réseaux sociaux (OK), FAB WhatsApp (OK). `ServicesMarquee.tsx:9` met un `aria-label` sur un `div` sans rôle (ignoré).
- **Composants interactifs** : onglets `PricingSection.tsx:34-48` sans `role="tablist"/tab`/`aria-selected` ; accordéon FAQ sans `aria-controls` ; sous-menus Header sans Échap ni retour du focus.
- **prefers-reduced-motion** : couvert par `globals.css:29-36` (animations CSS) et `MotionConfig reducedMotion="user"` (framer-motion). Le Hero anime toujours l'opacité au chargement (acceptable).
- **Blog** : `BlogClient.tsx:13-18` initialise `visiblePosts` à `[]` et ne le remplit que dans `useEffect` → **HTML serveur sans aucun article** (problème d'accessibilité sans JS et de SEO).
- Lien d'évitement « Aller au contenu » présent (`app/(site)/layout.tsx:19-24`).

---

## 8. SEO

- **Metadata** : cf. tableau §1. Manquent : canonical sur `/blog` et `/blog/[slug]` ; metadata sur `/candidat/mot-de-passe-oublie` (titre nettoyage par défaut, indexable) ; balises `twitter` propres à chaque page (`pageMetadata` ne les pose pas). Titre `/blog/[slug]` doublement suffixé (« … | Blog NexClean | NEXCLEAN SARL »). Titre `/a-propos` = « À propos » seul (OK via template).
- **Canonical** : via `pageMetadata` (`SITE_URL + path`) ; accueil L26-28.
- **`app/sitemap.ts`** : accueil, services + 5 fiches, espaces-verts, particuliers, professionnels, abonnements, réalisations, boutique + produits, tarifs, à propos, recrutement, demander-du-personnel, offres **ouvertes** (`openJobs`), candidat/inscription, contact, blog + articles, légal. `lastModified = now` pour tout (non significatif). Priorités : services 0,9, recrutement 0,7.
- **`app/robots.ts`** : `disallow /api/ /_next/ /static/` pour `*`, groupes Googlebot / Googlebot-Image en `allow /`, `host`, sitemap. `/admin`, `/suivi`, `/profil`, `/candidat/espace` non bloqués (protégés par noindex/auth).
- **JSON-LD** : global (layout) `LocalBusiness` (description nettoyage, adresse Douala, horaires, `areaServed` depuis le référentiel, pas d'`aggregateRating`), `ItemList` « Services NexClean » (7 services nettoyage/EV/abonnement), `WebSite` (ContactAction WhatsApp). Par page : `FAQPage` (accueil, espaces-verts), `Service` + `BreadcrumbList` (`/services/[slug]`), `Service` (espaces-verts), `Product` + `BreadcrumbList` (`/boutique/[slug]`). **Absents** : `JobPosting` sur les offres, `EmploymentAgency`/service de placement, `Organization` distinct, `BreadcrumbList` ailleurs.
- **Incohérences géographiques** : couverture dynamique « Douala et Yaoundé » (référentiel) mais textes figés « Douala » : FAQ `constants.ts:90`, manifest L4, meta boutique (`boutique/page.tsx:12`), meta recrutement (L13), `SHOP_INFO.delivery`, LocalBusiness `addressLocality`.

---

## 9. Points sensibles à ne pas casser

### 9.1 Formulaires et flux
- **Devis « enregistrer puis WhatsApp »** : `components/forms/WhatsAppForm.tsx` → server action `components/forms/actions.ts` (`enregistrerDemandeDevis`, `chargerLieux`) → `lib/dossiers/demande-devis`. Ouverture d'onglet synchrone au clic (anti-popup, L99) puis redirection vers `wa.me`. Configs `quote-forms.ts` (`devis`, `devis-pro`, `devis-espaces-verts`) **partagées client/serveur** : le serveur valide sur les mêmes libellés/options.
- **Type de dossier déduit d'un libellé** : `lib/dossiers/formulaire-devis.ts:46-56` compare `valeurs.service` à `'Entretien Espaces Verts'` (EV) et `'Entretien Régulier (Abonnement)'` (ABO), qui proviennent de `services-data.ts` `name`. **Renommer ces services casse la typologie des dossiers**.
- **Demander du personnel** : `recrutement/demander-du-personnel/{actions.ts,FormulairePersonnel.tsx}` (brouillon `localStorage`, estimation, numéro `REC-AAAA-NNNNN`).
- **Candidature / espace candidat** : `candidat/actions.ts`, `FormulaireCandidat.tsx` (brouillon `localStorage` clé `nexclean:inscription-candidat:v1`), `recrutement/[slug]/Postuler.tsx`, `candidat/espace/*`.
- **Suivi client** : `suivi/[jeton]/{actions.ts,reponses.ts,Interactions*.tsx,Section*.tsx}` + route handlers de documents ; metadata noindex + `referrer: no-referrer` à préserver.
- Commande boutique : `boutique/[slug]/ProductOrder.tsx` (WhatsApp seul).
- Routes dynamiques : `services/[slug]` et `boutique/[slug]` (`generateStaticParams`), `blog/[slug]`, `recrutement/[slug]` (`force-dynamic`, session candidat), `suivi/[jeton]`, `profil/[jeton]`, `candidat/reinitialiser/[jeton]`. Slugs d'offres utilisés par les tests : `agent-nettoyage` (pourvue), `agent-caisse-akwa`, `community-manager`.
- `app/(site)/layout.tsx` : `revalidate = 600` et `lireCouverture()` (villes du référentiel) injectées dans Hero, Footer, Coverage, metadata.

### 9.2 Chaînes et sélecteurs dont dépendent les tests

**`e2e/parcours.spec.ts`** (mobile 375 px)
- L31 `page.locator('h1').first()` visible sur `/`.
- L32-33 `#zones` contient **`Nous intervenons à Douala et Yaoundé`** et **`Bonapriso`** (texte de `CoverageSection.tsx:19`, id `zones` L11).
- L34 titre de l'accueil contient **`Douala et Yaoundé`** (`titreParDefaut`).
- L35-39 `/`, `/recrutement`, `/professionnels`, `/particuliers`, `/contact`, `/services`, `/tarifs` → HTTP 200 **et aucun défilement horizontal à 375 px** (`sansDefilementHorizontal`, `e2e/outils.ts:46-49`).
- L47 sur `/recrutement` : lien **`Demander du personnel`** (`.first()`) → page avec heading **`Demander du personnel`** (L48).
- Formulaire personnel : bouton **`Continuer`** (strict : un seul sur la page), `p.text-red-700`, libellés `/Entreprise \/ organisation/` (`.last()`), `/Nom du contact/`, `/Numéro WhatsApp/`, `/^E-mail/` ; ids `#dp-villeId`, `#dp-quartierId`, `#dp-secteur`, `#dp-lignes-0-{intitule,nombre,missions,experience,typeContrat,duree,salaire}` ; libellé `Dès que possible` ; headings `Lieu`, `Postes à pourvoir`, `Récapitulatif` ; bouton **`Envoyer ma demande`** ; case `/J’accepte que NEXCLEAN/` ; texte `Demande envoyée` ; **`p.font-mono`** (unique sur la page).
- L103-118 : `/professionnels#devis-pro` ; ids `#devis-pro-location-ville`, `#devis-pro-company`, `#devis-pro-sector`, `#devis-pro-contact`, `#devis-pro-phone`, `#devis-pro-location-quartier`, `#devis-pro-need` (= `formId-name`) ; `#devis-pro form` checkbox ; bouton **`Envoyer ma demande`** (strict : unique sur `/professionnels`) ; **`getByRole('status')` unique sur la page** ; popup vers `wa.me|whatsapp.com`.
- L126 `/suivi/jeton-inexistant` : texte **`Lien invalide ou expiré`**.
- L224-226 page de suivi : **`locator('h1')` strict = un seul h1** avec texte `En cours d’étude` ; `meta[name=robots]` contient `noindex`.

**`e2e/candidature.spec.ts`**
- L31-32 `/recrutement` : premier lien **`Créer mon profil candidat`** → `href="/candidat/inscription"` ; premier lien contenant **`Se connecter`** → `href="/candidat/connexion"` (attention : un lien « Se connecter » ajouté plus haut dans le DOM, ex. Header, doit garder ce href).
- L37-39 `/recrutement/agent-nettoyage` : lien `/Offre pourvue — inscrivez-vous pour être contacté/` → `/candidat/inscription` ; aucun bouton `Envoyer ma candidature`.
- `/recrutement/agent-caisse-akwa` : heading **`Postuler à cette offre`** ; libellés `/^Métier recherché/`, `/^Prénom/`, `/^Nom/`, `/^Téléphone/`, `/^Ville/`, `/^Quartier/`, `/^Expérience/`, `/^Disponibilité/`, `/^CV/`, `/^Message de motivation/`, `/^Mot de passe de votre espace candidat/` ; bouton `Envoyer ma candidature` ; heading `Candidature envoyée` ; liens `Compléter mon profil`, `Mon espace candidat` ; heading `Bonjour Awa` ; textes `Profil incomplet.`, `Reçue` (exact), `Vous avez déjà postulé à cette offre.`.
- L64-70 : **aucune requête vers un domaine externe** pendant l'envoi (polices, CDN, images distantes, analytics chargés à ce moment feraient échouer le test).
- `/recrutement/community-manager` : texte `/Vous êtes connecté\(e\) en tant que/`, bouton `Postuler` (exact).

**`e2e/candidat.spec.ts`**
- `/candidat/inscription` : heading **`Créer mon profil candidat`** ; texte `/100 % gratuites/` (`MENTION_GRATUITE`, `lib/candidats/domaine.ts:76`) ; bouton `Continuer` (strict) ; headings `Localisation`, `Recherche`, `Parcours`, `Documents`, `Compte`, `Inscription réussie` ; nombreux libellés de formulaire ; bouton `Créer mon compte` ; lien `/Recevoir la confirmation sur WhatsApp/` (href `wa.me`) ; lien `Accéder à mon espace`.
- `/candidat/espace` : heading `Bonjour Josiane`, `role=progressbar`, boutons `Je ne cherche plus` / `Je suis toujours en recherche`, `Se déconnecter`, lien `Modifier mon profil`, bouton `Enregistrer`, `role=status` « Profil enregistré ».
- `/candidat/connexion` : `getByLabel('Téléphone', exact)` et `getByLabel('Mot de passe', exact)` uniques ; bouton `Se connecter` ; `[role=alert]` (hors annonceur Next).
- `/candidat/mot-de-passe-oublie` : bouton `Continuer`, texte `Demande enregistrée.`.
- `/candidat/espace/supprimer` : bouton `Supprimer mon compte et mes données`.
- `localStorage` `nexclean:inscription-candidat:v1`.

**Tests unitaires / intégration dépendant du contenu public**
- `tests/unit/formulaire-devis.test.ts` : libellés exacts des 3 formulaires (L7-11 : `Nom complet`, `Téléphone / WhatsApp`, `Service souhaité`, `Ville`, `Quartier`, `Date souhaitée`, `Précisions (surface, état, accès…)` ; `Entreprise`, `Secteur d'activité`, `Nom du contact`, `Téléphone`, `Ville / quartier`, `Surface approximative`, `Fréquence souhaitée`, `Nombre de sites`, `Votre besoin` ; `Nom / Entreprise`, `Type de site`, `Superficie approximative`, `Travaux souhaités`) ; préfixe du message `Bonjour NexClean,\n\n*{subject}*` ; options de service **`Entretien Espaces Verts`**, **`Entretien Régulier (Abonnement)`**, `Nettoyage de Bureaux`, `Autre` (L56-68).
- `tests/integration/demande-devis.test.ts:52-54,62,73,83` : options `Entretien Espaces Verts`, `Entretien Régulier (Abonnement)`, **`Désinfection`**, secteurs `Commerce`, `Bureaux`, type de site `Hôtel`, `formId` `devis`/`devis-pro`/`devis-espaces-verts`.
- `tests/unit/candidatures.test.ts:83-84` et `tests/integration/candidatures.test.ts:26-27,112` : slugs `agent-caisse-akwa` (ouverte), `community-manager` (ouverte), `agent-nettoyage` (**doit rester pourvue**) dans `content/jobs-data.ts`.

---

## 10. Synthèse priorisée (impact décroissant)

1. **La marque entière est définie comme « Nettoyage professionnel & entretien »** dans toutes les sources de vérité SEO/partage : `titreParDefaut`/`descriptionParDefaut` (`lib/seo.ts:19-21`), keywords, OG image et alt (`lib/og-image.tsx`), manifest, `classification` (`app/layout.tsx:98`), JSON-LD LocalBusiness/WebSite. Une seule modification de `lib/seo.ts` change le positionnement de tout le site (en gardant « Douala et Yaoundé » dans le titre de l'accueil, exigé par l'e2e).
2. **Le recrutement/placement, cœur du produit (CONTEXT.md, dossiers REC, commission, devis, suivi), est absent de l'accueil** et relégué au 4e sous-lien du 7e menu ; absent du Footer, des CTA permanents, du formulaire de contact et de la page Tarifs.
3. **Accueil 100 % nettoyage** : h1, sous-titre, marquee, Audience, WhyUs, Process, FAQ, CTA final ; aucune section candidats, offres, placement ni « suivez votre dossier ».
4. **CTA globaux mono-activité** : `Demander un devis` / `Devis` / `WhatsApp / Devis` → formulaire nettoyage, et message WhatsApp par défaut « devis pour un service de nettoyage » (`lib/constants.ts:123,149`), y compris sur l'espace candidat et la page de suivi.
5. **Contraste du bouton WhatsApp (blanc sur #25D366 = 1,98:1)**, CTA principal du Hero et de tous les formulaires ; plus `success`, `slate-400`, `slate-300`, astérisques `accent` sous 3:1.
6. **Architecture de l'information** : « Services » = nettoyage seulement ; « Recrutement » mélange recrutement interne, placement B2B et espace candidat ; pages d'audience Particuliers/Professionnels titrées « Nettoyage… » ; page de suivi sans aucune explication publique.
7. **Design system dispersé** : ~25 boutons hors `Button`, `#25D366` en dur ×11 sans token, palettes Tailwind par défaut (red/green/amber ≈ 90 occ.), `slate` vs `ink`, 3 échelles de titres, 8 largeurs de conteneur, cartes à 4 rayons/paddings différents, `Coque`/demander-du-personnel avec double marge haute.
8. **Identité « propreté »** : étincelles (logo, SectionLabel, CTA, marquee) et mot « CLEAN » ; aucune image recrutement/candidat ; anciens logos non référencés dans `public/images/`.
9. **SEO technique** : blog rendu vide côté serveur (`BlogClient.tsx:13-18`), image OG de repli inexistante (`blog/[slug]/page.tsx:27`), titre d'article doublement suffixé, pas de canonical blog, pas de `JobPosting`, `twitter` hérité du défaut nettoyage sur toutes les pages, `mot-de-passe-oublie` sans metadata et indexable.
10. **Incohérences géographiques** : textes figés « Douala » (FAQ, manifest, boutique, recrutement, livraison) alors que la couverture affichée est « Douala et Yaoundé ».
11. **Navigation** : nav desktop seulement ≥ 1280 px, sous-menus sans clavier (Échap/focus), Breadcrumb en `<a>`, liens absents du Footer (`/services`, demander du personnel, inscription candidat).
12. **Dépendances / code mort** : `react-icons` déclaré non utilisé, lucide 0.263 (2023), `.fade-up`/`.gradient-text`/`useScrollAnimation`, token `sun` et `rounded-4xl` inutilisés.
13. **Preuves sociales faibles** : 0 témoignage vérifié affiché, 1 seule réalisation, 1 seul produit mis en avant par 3 blocs de l'accueil.
14. **Contraintes de non-régression** : libellés de services `Entretien Espaces Verts`/`Entretien Régulier (Abonnement)`/`Désinfection` (typage des dossiers), ids `formId-champ`, unicité de `role=status`, `p.font-mono`, h1 unique, bouton `Continuer`/`Envoyer ma demande`, texte `Nous intervenons à …` dans `#zones`, aucune requête externe, pas de débordement horizontal à 375 px.
