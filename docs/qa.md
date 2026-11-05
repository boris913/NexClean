# QA — Refonte positionnement (site public)

> Branche `feat/refonte-positionnement` (HEAD `a65a654`), build de production déjà présent dans `.next` (`next start`, base jetable `nexclean_e2e`, port 54331). Date : 2026-11-05.
> Contrainte D-16 respectée : un serveur et un navigateur à la fois (Chrome headless, `channel: 'chrome'`), arrêtés en fin de session ; le port 3000 est libre.
> Contrôles déjà faits par l'Orchestrateur, non refaits ici : typecheck, build, 482/482 tests, 20/20 e2e à 375 px.

## Méthode

- **Statique** : recherches dans `app/(site)`, `components`, `content`, `lib/seo.ts`, `lib/constants.ts`, `lib/og-image.tsx`, `public/site.webmanifest`, `app/layout.tsx`. Les affirmations sont recoupées avec `CONTEXT.md` et le code métier (`lib/devis`, `lib/encaissements`, `lib/candidats`, `lib/parametres.ts`).
- **HTML servi** : crawl HTTP depuis 24 pages d'entrée, en suivant tous les liens internes (header, footer, contenus) : 55 URL. Relevés : statut, title, description, canonical, robots, OG, Twitter, JSON-LD (parse et types), ancres internes, termes interdits dans le texte visible, les `alt`, le `<head>` et le JSON-LD.
- **Navigateur** : 25 pages × 4 largeurs (375, 768, 1024, 1440), soit 100 rendus, avec `prefers-reduced-motion: reduce`. Mesures : débordement horizontal, h1, sauts de titres, console, requêtes en échec, requêtes externes, images cassées, `alt`, labels, cibles < 44 px, contraste calculé sur chaque nœud texte.
- **Captures examinées** (375 et 1440, haut de page et page entière) : accueil, `/professionnels`, `/recrutement`, `/contact`, `/a-propos`, `/blog`, menus desktop et mobile, `/candidat/connexion`, `/admin/connexion`.
- **Clavier** : lien d'évitement, ordre de tabulation du header, ouverture d'un sous-menu avec Entrée, fermeture avec Échap et retour du focus, menu mobile (ouverture, Échap).

## Résultat brut des mesures automatiques

| Mesure (100 rendus) | Résultat |
|---|---|
| Débordement horizontal | **0** |
| h1 unique | 100/100 |
| Erreurs console / exceptions | **0** |
| Requêtes en échec (hors préchargements RSC annulés par la navigation) | **0** |
| Requêtes externes | **0** |
| Images cassées / `alt` absents | 0 / 0 |
| Champs sans label accessible | 0 |
| Liens internes (55 URL) | tous 200 ; aucune redirection inattendue ; toutes les ancres internes existent (`#placement`, `#devis-pro`, `#devis-espaces-verts`, `#contact`, `#candidature`…) |
| Seuls 404 | `/favicon.ico` (voir m14) ; `/manifest.webmanifest` et `/feed.xml` ne sont pas référencés (normal) |
| Contrastes < AA | uniquement des chiffres décoratifs `aria-hidden` (voir m9) ; aucun texte porteur de sens |
| Sauts de titres | `/realisations` h1 → h3 (m10) |
| Mouvement réduit | toutes les classes `animate-*` ont `animation-name: none` |
| Clavier | lien d'évitement en 1ʳᵉ tabulation, il envoie le focus sur `#main-content` ; anneau de focus présent sur tous les éléments tabulés ; sous-menu Services : `aria-expanded` passe à true, Tab entre dans le sous-menu, Échap le ferme et rend le focus au bouton ; menu mobile : Échap le ferme |
| Barre mobile `/candidat/connexion` | « Nous écrire » (WhatsApp) + « Appeler NEXCLEAN » uniquement ✔ ; `/` : WhatsApp · Faire une demande · Appeler ✔ |
| Promo | visible dans le bloc Propreté de l'accueil, avec sa condition (« -20% Offre de Lancement… Pour les 50 premiers clients. ») ✔ |
| Décor Propreté | `decor` utilisé seulement sur `app/(site)/services/page.tsx:29` ✔ |
| Blog SSR | les 8 liens d'articles sont dans le HTML initial de `/blog` ✔ ; canonical `/blog` ✔ |
| JSON-LD | tout est valide (JSON parsé) ; `JobPosting` sur les 4 offres ouvertes, absent des offres pourvues (noindex) ✔ ; `Service` + `BreadcrumbList` sur les fiches, `Product` sur le produit, `FAQPage` sur l'accueil et `/espaces-verts` ✔ |
| noindex | `/candidat/connexion`, `/candidat/mot-de-passe-oublie`, `/suivi/*`, offres pourvues ✔ |

## Anomalies

Aucun **Bloquant** : aucune page, aucune métadonnée et aucun JSON-LD ne réduit la **marque** au nettoyage. Toutes les occurrences de « nettoyage » relevées dans les pages décrivent légitimement le service Propreté (fiches `/services/*`, `/services`, tarifs).

### Majeur

| # | Fichier:ligne | Page | Largeur | Constat | Correction proposée |
|---|---|---|---|---|---|
| M1 | `content/home-data.ts:157`, `:167`, `:210-211` ; `lib/constants.ts:92`, `:97`, `:141` (`WHY_US`, `FAQ_SUIVI`) | `/`, `/a-propos`, `/contact` (FAQ) | toutes | **Promesse non tenue.** « Un même parcours pour chaque demande… Service, espaces verts ou recrutement » annonce un « devis à accepter en ligne », ainsi que des « factures et reçus » sur la page de suivi, pour toute demande. Dans le code, devis, factures et paiements ne s'affichent que pour un dossier **REC** (`lib/devis/client.ts:125,132`, `lib/encaissements/suivi.ts:45`). Le devis d'un dossier propreté ou espaces verts est externe (`lib/devis/service.ts:7,135`, RG-03). | Restreindre à « pour un recrutement » (comme le fait déjà le point « Profils proposés, pour un recrutement »), ou formuler « devis écrit, transmis par WhatsApp » pour les services. |
| M2 | `lib/parametres.ts:46-47` (`CONDITIONS_DEVIS_PAR_DEFAUT`) ; `app/(site)/suivi/[jeton]/SectionDevis.tsx:120-121` | `/suivi/[jeton]` (devis REC, après vérification) | toutes | **Garantie de remplacement et non-contournement (6 mois) affichés au client** dans le devis : ligne « Garantie de remplacement : N jours » et conditions par défaut. Or ces deux clauses sont « à confirmer » (CONTEXT.md) et exclues par D-01. Le contenu existait avant la refonte (back-office), mais il est servi sur une page publique. | À arbitrer par la direction : soit valider les clauses (et lever le « à confirmer » de CONTEXT.md), soit retirer les deux lignes des conditions par défaut et masquer la ligne quand `garantieJours = 0`. |
| M3 | `content/blog/bien-choisir-nettoyage-professionnel.md:39`, `comment-redonner-vie-a-votre-interieur.md:131`, `taches-tenaces.md:151`, `zones-oubliees-menage.md:153`, `comment-lutter-contre-la-moisissure.md:130`, `l-importance-de-l-evaluation-sur-site.md:132` | `/blog/*` | toutes | **Promesses non confirmées dans les articles** : « satisfaction garantie », « garantie de propreté : nous repassons… sans frais », « une garantie de résultat », « Santé garantie », « diagnostic gratuit à Douala », « nous nous déplaçons gratuitement ». S'y ajoutent les superlatifs proscrits par `docs/contenu.md` §1 (« impeccable », « irréprochable »). | Retirer les garanties, ou les placer derrière `[À CONFIRMER]` non affiché ; remplacer les superlatifs par des faits. |
| M4 | `content/blog/presentation-savon-argan.md:3`, `:16`, `:47`, `:49` | `/blog` (1ʳᵉ carte, la plus visible) et l'article | toutes | **Identité de marque erronée** : « Maison NexClean Paris présente son innovation exclusive… Édition Luxe Numérotée ». Une entité parisienne et une édition de luxe contredisent la marque (SARL camerounaise) et la boutique. C'est aussi la description meta et OG de l'article. | Réécrire la description et l'introduction au nom de NEXCLEAN SARL, sans « Paris » ni « Édition Luxe Numérotée » (sauf si c'est réel), en cohérence avec `content/products-data.ts`. |
| M5 | Graphie « NexClean » visible : `content/blog/*.md:5` (`author: "Équipe NexClean"`, affiché sur les 8 cartes de `/blog`, `BlogClient.tsx:56`) et corps des articles ; `content/services-data.ts:42,80,116` (meta description des fiches maison, fin de chantier, désinfection) ; `content/products-data.ts:40,42,43` (texte et `alt` du produit) ; `content/jobs-data.ts:218,286` (offres `commercial`, `prospection-commerciale-terrain`) ; `app/(site)/cgv/page.tsx:39,55` ; `app/(site)/confidentialite/page.tsx:41` ; `content/realisations-data.ts:44-56` (`alt` de 7 photos, dont « Intervention NexClean », « Nettoyage par NexClean ») ; `lib/seo.ts:298` (`Product.brand`) ; `public/site.webmanifest:21` | `/blog`, `/blog/*`, `/services/*`, `/boutique/savon-liquide-argan`, `/realisations`, `/cgv`, `/confidentialite`, offres | toutes | La graphie publique n'est pas alignée sur « NEXCLEAN ». Les préfixes de messages WhatsApp `Bonjour NexClean,` sont figés (D-05, D-09) et restent hors champ. | Remplacer par « NEXCLEAN » dans tous ces textes, `alt` et métadonnées. Côté réalisations, préférer des `alt` descriptifs (« Agent NEXCLEAN dépoussiérant… ») à « Intervention NexClean ». |
| M6 | `content/jobs-data.ts` (pas de `datePosted` sur les 4 offres ouvertes ; `contract: 'À préciser'` l.67, 109, 159) | `/recrutement/agent-caisse-akwa`, `community-manager`, `community-manager-prospection`, `prospection-commerciale-terrain` | — | Le `JobPosting` est émis sans `datePosted`, champ **requis** par Google : l'offre n'est pas éligible aux résultats enrichis. `employmentType` est absent faute de contrat. Le placeholder `[À COMPLÉTER]` est connu, mais tant qu'il n'est pas rempli, l'objectif de D-08 n'est pas atteint. | Renseigner `datePosted` (et `validThrough`) ; ou n'émettre le `JobPosting` que si `datePosted` est présent. |

### Mineur

| # | Fichier:ligne | Page | Largeur | Constat | Correction proposée |
|---|---|---|---|---|---|
| m1 | `lib/seo.ts:45` | toutes (`<meta name="keywords">`) | — | Mot-clé « entreprise de nettoyage Douala », formulation que `docs/contenu.md` §1 interdit pour la marque. Les moteurs ignorent la balise, l'impact est faible. | Remplacer par « société de propreté Douala », ou supprimer. |
| m2 | `app/(site)/suivi/[jeton]/page.tsx:20-24` | `/suivi/*` | — | Pas de description propre : la page hérite de la description, de l'OG et du Twitter de l'accueil (seule description dupliquée du site). Elle est noindex, mais un lien partagé en aperçu affiche le titre de l'accueil. | Ajouter une description et un `openGraph.title` « Suivi de votre demande ». |
| m3 | `public/site.webmanifest:8` ; `app/layout.tsx:35` | — | mobile | `theme_color` / `themeColor` restent sur le lime `#84CC45` : la barre d'adresse mobile est lime, alors que D-06 fait du vert profond la couleur dominante et du lime un accent. Le raccourci du manifest (l.21) porte encore « Bonjour NexClean, je souhaite un devis » au lieu du message neutre de D-05. | `#2C4B1A` (`forest`) ; raccourci → `WHATSAPP_MESSAGE_DEFAUT`. |
| m4 | `components/sections/ClientProcess.tsx:7-17` | `/a-propos`, `/tarifs` | toutes | « De la demande au suivi » : les 9 étapes (État des lieux, Intervention, Contrôle qualité, Satisfaction…) et les 3 cartes (ponctuelle, abonnement, produits) ne décrivent que la propreté. Sur `/a-propos`, cela contredit la promesse multi-piliers ; le parcours commun existe déjà (`PARCOURS`). | Sur `/a-propos`, utiliser `ParcoursSection` (4 étapes communes) ; garder `ClientProcess` pour `/tarifs`, en y ajoutant une carte « Recrutement » (`PAYMENT_TERMS.placement`). |
| m5 | `app/(site)/professionnels/page.tsx:89` | `/professionnels` | toutes | La section « Propreté de vos locaux » contient la carte « Entretien Espaces Verts » et « Entretien Régulier (Abonnement) ». Le titre ne correspond pas au contenu. | Retitrer « Propreté et espaces verts de vos locaux », ou exclure l'entrée `/espaces-verts`. |
| m6 | `app/(site)/recrutement/page.tsx:74` | `/recrutement` | toutes | Badges « Ouvert » / « Pourvue » : accord incohérent pour « offre ». | « Ouverte » / « Pourvue ». |
| m7 | `components/ui/PageHero.tsx:43-44` | `/professionnels`, `/contact`, `/a-propos`, `/blog`, `/recrutement`… | 1024, 1440 | Le hero clair occupe la moitié gauche ; la moitié droite reste un dégradé vide. Le rendu fait inachevé à côté du hero sombre et photographique de l'accueil. Ce n'est pas cassé. | Visuel ou carte d'appui (pictos de pilier) à droite à partir de `lg`, ou hero centré. |
| m8 | `app/(site)/contact/page.tsx` (cartes d'orientation) | `/contact` | 1024, 1440 | Les 4 cartes d'orientation ont des boutons à des hauteurs différentes. La 4ᵉ (« Nous écrire », vert WhatsApp) et la 2ᵉ (bouton seul, sans lien secondaire) cassent l'alignement de la rangée. | `mt-auto` sur le bloc d'actions ; un emplacement de lien secondaire réservé. |
| m9 | `components/sections/ParcoursSection.tsx:25` (`text-brand-200`, 1,32:1) ; `components/sections/ProcessSection.tsx:41` (`text-brand-100`, 1,15:1) | `/`, `/services`, `/services/*` | toutes | Chiffres d'étapes décoratifs (`aria-hidden`, donc conformes) presque invisibles sur blanc, surtout « 1 » : effet délavé. | `text-brand-300`, ou chiffre dans la pastille `IconBadge`. |
| m10 | `components/ui/RealisationCard.tsx:43` sous `app/(site)/realisations/page.tsx:26` | `/realisations` | toutes | Saut h1 → h3 : la carte de réalisation est en h3 sans h2 au-dessus (le h2 « Nos équipes… » vient après). | Prop `headingAs` sur `RealisationCard` (h2 sur `/realisations`, h3 sur l'accueil), ou h2 visuellement masqué « Avant / après ». |
| m11 | `components/navigation/Footer.tsx` (liens de colonnes) ; `components/ui/Breadcrumb.tsx` ; `components/sections/HeroSection.tsx` (liens des portes) ; `components/ui/Logo` dans `Header.tsx` ; `app/(site)/candidat/FormulaireCandidat.tsx:366` (étapes) | toutes | 375-1440 | Cibles < 44 px de haut : liens du footer 32 px (768, 1024, 1440), fil d'Ariane 16 px, liens des portes 20 px à 375 et 32 px au-delà, logo 36 px, étapes de l'inscription 25 px. Le seuil WCAG 2.2 AA (24 px, ou espacement suffisant) est atteint, sauf pour le fil d'Ariane, qui passe par l'exception d'espacement. Le design system vise 44 px. | `min-h-tap inline-flex items-center` sur les liens du footer et des portes ; `py-2` sur le fil d'Ariane ; `min-h-tap` sur les étapes. |
| m12 | `app/(site)/candidat/espace/Propositions.tsx:117` ; `app/(site)/candidat/espace/supprimer/FormulaireSuppression.tsx:68` ; `app/(site)/suivi/[jeton]/InteractionsDevis.tsx:115` | espace candidat, suivi | — | Migration de `variant="secondary"` : les 5 appels ont été relus et aucun ne visait un bouton blanc bordé (tous sont des confirmations, donc le vert plein est acceptable). En revanche, 2 appels forcent le rouge (`!bg-danger hover:!bg-danger`, sans état de survol) et le refus de devis (`InteractionsDevis`) reste vert : la même action « Confirmer le refus » a deux couleurs selon l'espace. | Ajouter une variante `danger` au `Button` et l'utiliser pour les 3 confirmations de refus et de suppression. |
| m13 | `app/(site)/boutique/[slug]/ProductOrder.tsx:46,65,75` ; `app/(site)/realisations/RealisationsGallery.tsx:17` ; `app/(site)/recrutement/demander-du-personnel/FormulairePersonnel.tsx:479,484` | boutique, réalisations, demande de personnel | — | Boutons encore stylés à la main (choix de format, quantité ±, filtres de galerie, actions de lignes). Le rendu est cohérent, mais la règle 8 du design system n'est pas respectée. Les boutons quantité font 48 px : conforme. | `buttonClasses({ variant: 'outline', size: 'sm' })` ou un composant `Chip`. |
| m14 | `app/icon.svg` seul | toutes | — | `/favicon.ico` renvoie 404 : certains navigateurs et robots le demandent directement. | Fournir `app/favicon.ico` (hors périmètre D-07 si c'est un fichier de marque : à transmettre à la conversation logo). |
| m15 | `components/sections/TestimonialsSection.tsx:38` | `/` | 1024, 1440 | L'encart « Vous avez fait appel à NEXCLEAN ? » flotte seul et étroit dans une grande zone blanche entre Emploi et Zones. La section paraît vide. | Le placer en bandeau `spacing="sm"`, ou le rattacher à la section Zones / FAQ. |
| m16 | `lib/og-image.tsx:24,48,55-56` | image OG | — | Hex en dur (`#142A08`, `#3D701C`, `#84CC45`, `#E2F6CF`…). Toléré : Satori ne lit pas les variables CSS. Le dégradé finit sur `#66B32B`, hors des tokens de surface. | Importer les valeurs depuis `tailwind.config.ts` (objet `brand`) plutôt que les recopier. |
| m17 | `components/backoffice/ui.tsx:24`, `:62` | back-office | — | Pour mémoire (hors refonte) : `red-*` reste utilisé, faute de token, alors que `danger` existe désormais. | Migrer vers `danger` lors d'un prochain lot back-office. |

### Points vérifiés sans anomalie
- **Hex en dur** dans le code public : aucun (les seules correspondances sont du texte : « #8F3A », une adresse postale).
- **Couleurs Tailwind par défaut** : seulement `text-red-700`, l'exception e2e (`FormulaireCandidat.tsx:43`, `FormulairePersonnel.tsx:41`, `Postuler.tsx:48`).
- **`import * as`** : seulement des modules de service (`lib/candidats/service`, `lib/devis/client`…), aucune icône.
- **`text-ink-400`** : uniquement sur des icônes et des placeholders, jamais sur du texte.
- **`max-w-*`** hors tokens : uniquement des mesures de ligne internes aux composants du design system (`PageHero`, `SectionHeader`, `CTASection`) et le `max-w-md` interne de `Coque`, que le design system autorise.
- **Commission, acompte, gratuité candidat** : `/tarifs` lit `commission_par_personne` en base (rien en dur). Acompte « dont le taux figure sur le devis » et montant final calculé sur les placements confirmés, conformes à CONTEXT.md. « 100 % gratuites » pour le candidat conforme. Les 4 étapes de `/recrutement/demander-du-personnel` sont conformes au cycle REC. Aucune mention publique de paiement en ligne, de mise à disposition ni de non-contournement. Aucun `[À COMPLÉTER` ni `[À CONFIRMER` dans le HTML servi : ils restent en commentaires de code.
- **Back-office** : `brand`, `ink` et `primary` ont exactement les mêmes valeurs qu'au point de fusion avec `main` (`primary` = brand-700, inchangé). `success` et `accent` ne sont **pas** utilisés dans `app/(backoffice)` ni dans `components/backoffice`. Les seuls effets partagés sont l'anneau global `:focus-visible` et la règle de mouvement réduit de `globals.css`, sans régression visible. `/admin/connexion` (375 et 1440) : titre, champs et bouton « Se connecter » (blanc sur brand-700, 5,94:1) lisibles.

## Critères d'acceptation de la mission

| Critère | Verdict | Preuve |
|---|---|---|
| **5 secondes : un visiteur comprend que l'offre dépasse le nettoyage** | ✅ Atteint | À 375 comme à 1440, sans défiler : h1 « Vos espaces et vos équipes, entre de bonnes mains. », sous-titre « Propreté, recrutement de personnel et espaces verts… », et 3 portes « J'ai besoin d'un service / Je recrute du personnel / Je cherche un emploi » (captures `accueil-375-top.png`, `accueil-1440-top.png`). Title, description, OG, Twitter, manifest, `classification` et JSON-LD (`knowsAbout`, `hasOfferCatalog` à 5 piliers) sont multi-piliers. |
| **Même design system et même navigation partout** | ✅ Atteint, avec réserves mineures | Header, footer à 4 colonnes, barre mobile et conteneur 72rem identiques sur les 25 pages. Navigation clavier conforme. Aucun hex ni couleur par défaut hors exceptions. Réserves : m7, m8, m12, m13. |
| **Responsive sans régression** | ✅ Atteint | 100 rendus (25 pages × 375/768/1024/1440) : 0 débordement, 0 erreur console, 0 requête en échec ou externe, 0 image cassée, h1 unique partout. Cibles tactiles perfectibles (m11). |
| **Aucun ancien texte « nettoyage uniquement »** | ⚠️ Atteint sur les pages, pas sur le blog | Pages, métadonnées et JSON-LD : aucune formulation qui réduit la marque au nettoyage (reste le mot-clé m1). Le **blog** reste mono-activité : 8 articles sur 8 portent sur le nettoyage ou le savon (placeholder `[À COMPLÉTER]` connu), la 1ʳᵉ carte annonce « Maison NexClean Paris » (M4), les articles contiennent des garanties non confirmées (M3) et l'ancienne graphie (M5). |

Critère logo : hors périmètre (D-07).

## Non vérifié

- **Pages connectées** : `/candidat/espace*`, `/suivi/[jeton]` avec un jeton valide (devis, paiements, profils), `/profil/[jeton]`, back-office privé (`/admin/(prive)`). Revues seulement à la lecture du code ; aucune donnée de test n'a été créée.
- **Envoi des formulaires** (déjà couvert par l'e2e à 375 px) ; ouverture réelle de WhatsApp.
- **Captures à 768 et 1024** : mesurées automatiquement, pas regardées. Les pages autres que les 6 demandées n'ont pas été regardées à 375 et 1440 (mesures seulement).
- **Navigateurs** autres que Chrome (Safari iOS, Firefox) ; lecteur d'écran réel ; mode Contraste élevé de Windows.
- **Image OG rendue** (`/opengraph-image` répond 200, image non regardée).
- Contrastes calculés sur fond uni uniquement : un texte posé sur une photo ou un dégradé est ignoré par la mesure (cas des badges « Avant / Pendant » : `bg-ink-900/80`, jugés lisibles à l'œil).
