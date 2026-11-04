# Décisions — Refonte positionnement & identité (site public)

> Branche : `feat/refonte-positionnement`. Base factuelle : `docs/audit.md`.
> Statut : **Phase 1 — proposé, en attente de validation** (D-01 à D-12).
> Périmètre : site public `app/(site)/`, composants partagés, SEO, marque. Le back-office (`app/(backoffice)/`) n'est pas redessiné. Il n'est touché que si un token partagé l'impose.

## D-01 — Fonctionnalités présentées : uniquement celles qui existent dans le code
Le brief ne liste aucune fonctionnalité nouvelle. Le site ne mettra donc en avant que les activités **déjà livrées dans le dépôt** (audit §3), sans rien inventer :

| Pilier | Ce qui existe | Pour qui |
|---|---|---|
| **Propreté & hygiène** | Nettoyage maison, bureaux, fin de chantier, vitres, désinfection, abonnements d'entretien | Particuliers, entreprises |
| **Recrutement & placement** | Demande de personnel en ligne, estimation de la commission, devis, propositions de profils, placements | Entreprises, particuliers employeurs |
| **Espaces verts** | Tonte, débroussaillage, haies | Particuliers, entreprises |
| **Emploi** | Offres publiées, candidature, profil candidat gratuit, espace candidat | Demandeurs d'emploi |
| **Boutique** | Produits d'entretien commandés via WhatsApp | Tous |
| *Transversal* : **suivi de dossier en ligne** | Page de suivi par lien sécurisé : statut, devis à accepter, factures, reçus, profils proposés | Clients |

Ne seront **pas** présentés, car hors V1 ou non confirmés : mise à disposition de personnel, paiement en ligne Mobile Money (lot L5), garantie de remplacement et non-contournement (marqués « à confirmer » dans CONTEXT.md). S'il en faut une mention, elle portera un placeholder `[À CONFIRMER]`.

## D-02 — Nom de marque inchangé, mais le logotype équilibre « NEX » et « CLEAN »
On garde le nom NEXCLEAN : le renommage relève du juridique et sort du périmètre. Pour ne plus le lire comme « nettoyage », le logotype composera **NEX** en gras et **CLEAN** en poids régulier : la marque se lit « Nex », et « clean » prend le sens d'un service soigné. « SARL » sort du logotype et reste dans les mentions légales, le JSON-LD et le footer.

## D-03 — Message de marque
- **Promesse (proposition de h1)** : « Vos espaces et vos équipes, entre de bonnes mains. »
- **Sous-titre** : « Propreté, recrutement de personnel et espaces verts à {villes}, avec un suivi de chaque demande en ligne. »
- **Signature courte (meta, OG, footer)** : « Services aux entreprises et aux particuliers ».
- **Ton** : professionnel, rassurant, concret. Phrases courtes, pas de superlatifs. On parle des prix en FCFA et de délais réels.
- **Titre par défaut (SEO)** : `NEXCLEAN — Propreté, recrutement & espaces verts à {villes}, Cameroun`. On garde `{villes}`, dont dépend le test e2e « Douala et Yaoundé ».

## D-04 — L'accueil ouvre trois portes dès le premier écran
Le critère des 5 secondes impose ceci : sous le h1, **trois cartes d'entrée** sont visibles sans défiler, sur mobile comme sur desktop.
1. « J'ai besoin d'un service » : propreté, espaces verts, abonnement.
2. « Je recrute du personnel » : demande de personnel.
3. « Je cherche un emploi » : offres et profil candidat.

Ordre des sections proposé :
1. Hero + 3 portes
2. Piliers : une carte par pilier de D-01
3. Comment ça marche : un parcours commun (demande → devis → exécution → suivi en ligne)
4. Focus Recrutement : la commission par personne, un placement facturé seulement une fois confirmé
5. Focus Propreté : avant/après et abonnements, condensé
6. Suivi de dossier en ligne
7. Emploi / offres récentes
8. Témoignages
9. Zones
10. FAQ, élargie aux nouveaux sujets
11. CTA final

Les sections Marquee, WhyUs et Products sont fusionnées ou supprimées de l'accueil. Les produits restent sur `/boutique`.

## D-05 — Arborescence : aucune URL ne change
Toutes les routes restent en place, pour le SEO, les tests e2e et les liens WhatsApp déjà envoyés. Seuls changent la navigation, les libellés et le contenu.
- **Header** : `Services ▾` (Propreté, Espaces verts, Abonnements, Particuliers, Professionnels) · `Recrutement` (→ `/recrutement/demander-du-personnel` + `/recrutement`) · `Emploi ▾` (Offres, Créer mon profil, Espace candidat) · `Boutique` · `Réalisations` · `À propos`. CTA principal : « Faire une demande » (→ `/contact`, qui oriente selon le besoin). Blog et Tarifs passent dans le footer et dans les pages concernées.
- Le menu desktop s'affiche dès `lg` (1024 px) au lieu de `xl`. Ajout de la touche Échap et de la gestion du focus dans les sous-menus.
- **Footer** : 4 colonnes (Services, Recrutement & emploi, Entreprise, Contact), logo blanc, signature D-03.
- **Message WhatsApp par défaut** : il devient neutre (« Bonjour NEXCLEAN, j'ai une demande… »). Chaque page garde son message spécifique. Le préfixe `Bonjour NexClean,\n\n*{subject}*` des formulaires ne change pas, car les tests en dépendent.

## D-06 — Direction artistique : « service de confiance »
- **Couleur dominante** : un vert profond, de la famille `brand-800/900` à `ink-900`. Il remplace le vert clair pour les surfaces fortes (header actif, footer, hero) et donne une image plus institutionnelle, moins « produit ménager ».
- **Le vert lime (`brand-400`) devient un accent** : CTA, puces, focus. Il reste toujours avec du texte encre, jamais avec du texte blanc.
- **Code couleur des piliers**, limité aux pictos et aux filets : propreté = brand, recrutement & emploi = `ocean` (déjà dans les tokens), espaces verts = un vert feuille plus froid, défini par l'Agent Design System.
- **Décor « étincelles » et blobs** : supprimés hors de la page Propreté, car ils signalent « ménage ».
- **Typographies conservées** : Outfit pour les titres, Plus Jakarta Sans pour le texte. Elles sont déjà embarquées en local, ce qui ne crée aucune dépendance et ne fait aucune requête externe (un test e2e l'exige).
- **Icônes** : `lucide-react` uniquement. On retire `react-icons`, qui n'est jamais importé. La mise à jour de lucide est envisagée si elle ne casse pas les imports ; sinon, elle est reportée.
- **Bouton WhatsApp** : le texte blanc sur `#25D366` est en échec de contraste (1,98:1). Il passera en texte encre sur `#25D366`, ou sur un vert WhatsApp foncé `#128C7E` avec texte blanc, au choix du Design System selon la mesure AA.

## D-07 — Logo : on remplace le symbole, avec 3 pistes
Le logo actuel (le N et l'étincelle sur un carré dégradé) est propre, mais l'étincelle l'enferme dans le nettoyage. On garde la continuité par la couleur et le nom, et on change de symbole. Les trois pistes ci-dessous sont des constructions géométriques originales, sans imitation d'un logo existant :
- **Piste A — « N relais »** : un N formé de deux montants et d'une diagonale qui les relie par deux points. Il évoque la mise en relation (client ↔ prestataire, entreprise ↔ candidat). Construit sur une grille 24×24, il reste lisible en favicon.
- **Piste B — « N en avant »** : un N dont la diagonale se prolonge en flèche vers le haut à droite. Il fait écho à « Nex » (next) et évoque le progrès et la prise en charge. Très lisible, mais plus générique.
- **Piste C — « Trois modules »** : trois formes simples (carré, cercle, feuille) assemblées en N, une par pilier. C'est la piste la plus narrative, mais elle tient moins bien sous 32 px.

**Recommandation : la piste A.** C'est la plus mémorable des trois, elle colle au cœur du nouveau métier (mettre en relation) et tient en monochrome.

Livrables dans `assets/brand/` : symbole, logotype, horizontal et vertical, chacun en couleur, blanc et mono. S'y ajoutent `favicon.svg`, `icon-192/512.png`, `apple-icon.png`, `palette.md` et `typographie.md`. Une copie va dans `public/images/brand/` pour le service. On garde les mêmes noms de fichiers que l'actuel, pour que `Logo.tsx` et les métadonnées basculent sans casse.

## D-08 — SEO
- On repositionne `lib/seo.ts` : titre, description, mots-clés, alt OG et JSON-LD (`Organization` + `LocalBusiness`, avec `knowsAbout` et `hasOfferCatalog` multi-piliers). On repositionne aussi `lib/og-image.tsx`, `site.webmanifest` et `classification`.
- On ajoute `JobPosting` sur `/recrutement/[slug]`, les balises `twitter` par page, le canonical du blog et le `noindex` de `/candidat/mot-de-passe-oublie`. On corrige le double suffixe des titres d'articles et l'OG de repli manquant.
- Le rendu serveur du blog (aujourd'hui vide côté SSR) est **corrigé s'il ne coûte pas plus d'un lot**. Sinon, il passe en « points restants ».

## D-09 — Contraintes de non-régression, issues de l'audit §9
Ne changent pas : les ids `#dp-*` et `#devis-pro-*`, les libellés et boutons cités par les tests (`Demander du personnel`, `Continuer`, `Envoyer ma demande`, `Créer mon profil candidat`, `Postuler`, etc.), les `name` de services qui déterminent le type de dossier (`Entretien Espaces Verts`, `Entretien Régulier (Abonnement)`…), la clé `localStorage` et l'absence de requêtes externes. Si un libellé testé doit évoluer, le test est mis à jour dans le même commit, avec justification.

## D-10 — Organisation des agents et propriété des fichiers
Pour éviter les conflits, chaque agent a son périmètre de fichiers. L'Orchestrateur fusionne.

| Phase | Agent | Fichiers |
|---|---|---|
| 2 (parallèle) | Contenu | `content/*.ts`, `lib/seo.ts`, `lib/constants.ts` (textes), `docs/contenu.md` (copy de toutes les pages) |
| 2 (parallèle) | Identité / Logo | `assets/brand/**`, `public/images/brand/**`, `app/icon.svg`, `app/apple-icon.png`, `lib/og-image.tsx` (visuel) |
| 2 (parallèle) | Design System | `tailwind.config.ts`, `app/globals.css`, `components/ui/**` (Button, Card, Section, Container, PillarBadge…), `docs/design-system.md` |
| 3a | Intégration Accueil | `app/(site)/page.tsx`, `components/sections/**`, `components/navigation/**` |
| 3b (parallèle, worktrees) | Intégration Pages | lot 1 : services, particuliers, professionnels, espaces-verts, abonnements, tarifs · lot 2 : recrutement, candidat, suivi · lot 3 : boutique, réalisations, à propos, blog, contact, légales |
| 4 | QA | lecture seule + rapport. L'Orchestrateur renvoie les corrections aux agents d'intégration |

Chaque lot passe `npm run typecheck`, `npm run lint`, `npm test` et `npm run test:e2e` (en local, avec l'e-mail ci@) avant la fusion. Les commits sont atomiques, en français, préfixés `feat(site)`, `style(ds)`, `feat(marque)`, `content(site)`.

## D-11 — Dépendances
Aucune nouvelle dépendance n'est prévue. Les animations restent sur framer-motion, déjà présent, en respectant `prefers-reduced-motion`. On retire `react-icons`, qui n'est pas utilisé.

## D-12 — Placeholders
Toute information manquante (chiffres clés, témoignages réels sur le recrutement, photos d'équipes placées, délais garantis) apparaît sous la forme `[À COMPLÉTER : …]`, dans le code et dans le rapport final. Aucun lorem ipsum.
