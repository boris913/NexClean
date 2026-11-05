# Audit design et direction artistique du site public NEXCLEAN

> Établi le 2026-11-05 sur `feat/refonte-positionnement` (e4c9498), à partir du site lancé en local et capturé en 1440 px et en 390 px (accueil, service « Nettoyage de bureaux », recrutement, contact, à propos, blog).
> Le formulaire `/recrutement/demander-du-personnel` a été audité depuis le code seulement : la base PostgreSQL n'était pas démarrée.
> Périmètre : site public. Le Back-Office partage les tokens (voir « Risques »).

---

## 1. Résumé de l'audit

| Axe | Note | Constat principal |
|---|---|---|
| Identité & cohérence | 3/5 | Tokens solides, mais l'accueil empile environ 25 cartes blanches sur le même modèle (pastille d'icône, titre, coches). La pastille de surtitre revient environ 8 fois. Effet « template ». |
| Couleurs | 4/5 | Contrastes AA documentés. Trois verts se concurrencent sur les boutons (lime `#84CC45`, WhatsApp `#25D366`, forêt `#2C4B1A`). Recrutement (`ocean-600`) et Emploi (`ocean-700`) sont presque identiques. |
| Typographie | 3/5 | `display` : Outfit 800 avec −0,035 em d'interlettrage et 1,02 d'interlignage. Les mots se touchent presque (« Vosespaces ») et les accents frôlent la ligne du dessus. Outfit et Plus Jakarta Sans sont deux géométriques trop proches pour créer un contraste. |
| Espacement & grille | 4/5 | `py-section` fluide et cohérent. L'alignement passe de gauche (sections 1 à 7) à centré (zones, FAQ, CTA). Sur les pages service, les cartes sont étirées à la hauteur de la carte « Tarif » et gardent un grand vide en bas. |
| Composants | 4/5 | États, focus et cibles de 44 px soignés. Trop d'appels à l'action : 6 liens dans les 3 portes, 3 boutons dans le CTA final. Sur les pages service, l'action principale est le bouton WhatsApp, ailleurs c'est le bouton lime. |
| Imagerie | 2/5 | Une seule photo sur l'accueil, masquée sur mobile (`HeroSection.tsx:68`, `hidden lg:block`). Aucune image sur les pages service. La seule preuve visuelle est un « Avant / Pendant », sans photo « Après ». Les équipes portent des polos bleus, le site est vert. |
| Mouvement | 4/5 | Animations sobres, réglage « réduire les animations » respecté deux fois (CSS et `MotionConfig`). En revanche, le contenu reste à `opacity: 0` hors de l'écran : une capture sans défilement montre des blocs vides. |
| Responsive | 4/5 | Aucun débordement à 390 px. Les trois portes tiennent au-dessus de la ligne de flottaison. La barre mobile est bien compensée par `pb-20` dans le pied de page. |
| Accessibilité | 4/5 | Lien d'évitement, menus utilisables au clavier, focus contrasté sur fond clair et sombre, `tap-target`. |
| Performance perçue | 4/5 | Polices locales en woff2 variable, `next/image` en AVIF puis WebP. framer-motion est chargé sur tout le site pour de simples apparitions. Les PNG source du blog font environ 2 Mo (sans effet à l'affichage). |
| Dette de style | 4/5 | Très peu de valeurs arbitraires. Utilitaires morts dans `globals.css` : `.fade-up`, `.gradient-text`, `.delay-*`, et dans `tailwind.config.ts` les animations `float` et `marquee`. Les variantes de bouton historiques sont encore présentes. |

**Points forts**
1. Un vrai design system : rôles sémantiques, ratios calculés, échelle typographique et espacements fluides.
2. Une accessibilité au-dessus de la moyenne.
3. Un premier écran efficace : la promesse et les trois portes sont visibles sans défiler, y compris sur mobile.

**Problèmes prioritaires (par impact)**
1. Le site montre trop peu les personnes et le travail réel. C'est l'imagerie la plus faible, alors que la confiance est l'enjeu principal.
2. L'accueil répète des cartes identiques, et les cinq piliers redisent ce que les trois portes viennent de dire.
3. Le titre d'accueil est trop serré, et la paire de polices manque de caractère.
4. La hiérarchie des appels à l'action est confuse : trois verts différents, et une action principale qui change selon les pages.
5. Il n'y a pas de preuve sociale : la section témoignages est vide (choix légitime de n'afficher que des avis vérifiés), sans chiffres ni logos pour la remplacer.

---

## 2. Direction retenue : « Institution claire + Opérations » (mélange A + B)

**Base A, Institution claire.** Fonds blancs et gris bleuté, une idée par section, beaucoup d'espace vide. Le premier écran reste clair. C'est la retenue d'Apple et la sobriété de Bitcoin.org.

**Signature B, Opérations.** Le « produit » de NEXCLEAN, c'est le processus : demande, estimation, devis, suivi, placement. On le met en scène comme Terminal Industries met en scène son calculateur :
- un mini-simulateur d'estimation dans le premier écran ;
- un aperçu de la page de suivi, avec une frise d'étapes et un numéro du type `REC-2026-00042` en police mono ;
- des chiffres réels, en mono, comme preuves.

Une seule section bleu nuit (recrutement) rythme la page.

**Pourquoi cette direction**
- **Ton sérieux et institutionnel** demandé : le bleu marine rassure les entreprises qui recrutent.
- **Pas d'autres photos disponibles** : on montre le service sous forme d'interface et de chiffres plutôt qu'en photo. Les quatre ou cinq photos existantes sont mises en valeur, en grand et traitées en duotone bleu.
- **Rapprochement avec le bleu des polos**.
- **Logo conservé** : son lime devient l'unique accent du site, ce qui garde la continuité de marque.

**Directions écartées**
- **C, Éditorial sportif** : contraire au ton institutionnel et au passage au bleu, et dépendante de visuels forts.
- **Monde 3D à la Bruno Simon** : trop lourd sur les réseaux mobiles, inaccessible, ton ludique.
- **B seule (premier écran bleu nuit)** : votre préférence va au clair. Le bleu nuit est réservé à une section.

---

## 3. Design tokens proposés

### Couleurs (ratios WCAG 2.x calculés, texte sur fond)

| Rôle | Valeur | Usage | Contraste |
|---|---|---|---|
| `surface` | `#FFFFFF` | Fond principal | n/a |
| `surface-muted` | `#F5F7FA` | Sections alternées | n/a |
| `line` | `#DDE3EA` | Bordures, séparateurs | décoratif |
| `ink` (`navy-950`) | `#0A1626` | Texte principal, section nuit, pied de page | 18,17:1 sur blanc, 16,93:1 sur `surface-muted` |
| `navy-800` | `#12355B` | Surfaces fortes secondaires | blanc dessus : 12,46:1 |
| `muted` | `#4A5B70` | Texte secondaire | 6,95:1 sur blanc, 6,48:1 sur `surface-muted` |
| `on-dark-muted` | `#C9D6E8` | Texte secondaire sur fond nuit | 12,35:1 sur `#0A1626` |
| `action` | `#1F5FD1` | Boutons principaux (texte blanc), liens | 5,81:1 (dans les deux sens) |
| `action-hover` | `#1A4FB0` | Survol | 7,53:1 |
| `action-soft` | `#EAF1FD` | Fonds de pastille | `action` dessus : 5,12:1 |
| `signal` | `#2E7CF6` | **Décor uniquement** (filets, points de frise) | 3,94:1, interdit pour le texte |
| `signal-on-dark` | `#5B9BFF` | Liens et icônes sur fond nuit | 6,56:1 |
| `accent` (lime du logo) | `#84CC45` | **Accent unique** : puce active, surlignage de chiffre, bouton sur fond nuit (texte `ink`) | `ink` dessus : 9,26:1. Jamais de texte blanc. |
| `whatsapp` | `#25D366` | Uniquement en icône ou en bouton secondaire | `ink` dessus : 9,16:1 |

**Piliers** (texte ou icône sur blanc) : chaque public a une teinte distincte.

| Pilier | Valeur | Contraste |
|---|---|---|
| Propreté | `#0B7285` (bleu-vert « eau ») | 5,59:1 |
| Recrutement | `#1F5FD1` | 5,81:1 |
| Espaces verts | `#0F6B40` | 6,57:1 |
| Emploi | `#B54708` (orange, plus chaleureux pour les candidats) | 5,43:1 |
| Boutique | `#4A5B70` (neutre) | 6,95:1 |

**Règle de hiérarchie** : sur fond clair, un seul bouton plein par bloc, en `action`. WhatsApp passe en bouton contour avec l'icône verte. Sur fond nuit, le bouton principal est lime avec un texte `ink`.

### Typographie
- **IBM Plex Sans**, variable, poids 400 à 700 : titres et texte.
- **IBM Plex Mono**, poids 500 : chiffres, montants en FCFA, numéros de dossier, étapes.
- Les deux polices sont sous licence OFL et seront intégrées en local dans `app/fonts/`, comme aujourd'hui.

| Token | Taille | Interlignage | Interlettrage | Graisse |
|---|---|---|---|---|
| `display` | clamp(2.5rem → 4.25rem) | 1,08 | −0,02 em | 600 |
| `h1` | clamp(2.25rem → 3.5rem) | 1,1 | −0,02 em | 600 |
| `h2` | clamp(1.75rem → 2.5rem) | 1,15 | −0,015 em | 600 |
| `h3` | clamp(1.25rem → 1.5rem) | 1,3 | −0,01 em | 600 |
| `lead` | inchangé | | | |
| `body` | inchangé | | | |
| `small` | inchangé | | | |
| `eyebrow` | 0,75rem, en mono | | 0,08 em | |
| `figure` (nouveau) | clamp(2rem → 3rem), en mono | | tabular-nums | |

Longueur de ligne : `max-w-[65ch]` pour le texte courant.

### Espacements, rayons, ombres
- **Espacements** : base 8 px, `section` et `section-sm` conservés.
- **Rayons** : `card` passe de 1,5rem à **0,75rem** et les boutons de `rounded-full` à **0,5rem**. C'est un rendu plus institutionnel, moins « app grand public ».
- **Ombres** : on garde `card` et on supprime l'ombre colorée lime `btn-hover`. Le survol passe par un changement de fond et une bordure `action`.

---

## 4. Plan d'amélioration priorisé

### Quick wins (moins d'une heure chacun, indépendants de la nouvelle palette)

| # | Action | Fichiers | Gain |
|---|---|---|---|
| Q1 | Desserrer `display` et `h1` (interlettrage −0,02 em, interlignage 1,08) | `tailwind.config.ts` | Titre d'accueil lisible, accents dégagés |
| Q2 | Afficher la photo d'équipe sur mobile (bande sous le titre) | `components/sections/HeroSection.tsx` | Un visage humain dès le premier écran mobile |
| Q3 | WhatsApp en bouton contour quand un bouton principal est voisin | `components/sections/CTASection.tsx`, `app/(site)/services/[slug]/page.tsx` | Une action principale claire |
| Q4 | Cartes service non étirées (`items-start`) | `app/(site)/services/[slug]/page.tsx` | Plus de grands vides |
| Q5 | Supprimer les utilitaires et animations morts | `app/globals.css`, `tailwind.config.ts` | Dette réduite |
| Q6 | Remplacer l'encart avis isolé par un bandeau de 3 chiffres réels (à fournir) | `components/sections/TestimonialsSection.tsx`, `content/home-data.ts` | Preuve sociale |

### Impact moyen

| # | Action | Fichiers | Effort |
|---|---|---|---|
| M1 | Nouveaux tokens couleur (remappage des rôles `forest` → `navy`, `cta` → `action`, piliers) | `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx` (`themeColor`), `docs/design-system.md`, `lib/og-image.tsx`, `public/site.webmanifest` | 3 à 4 h |
| M2 | Polices IBM Plex Sans et Mono, nouvelle échelle, rayons | `app/fonts/`, `app/layout.tsx`, `tailwind.config.ts`, `components/ui/Button.tsx`, `components/ui/Card.tsx` | 2 h |
| M3 | Accueil allégé : fusionner « Portes » et « Piliers » en une liste dense de 5 lignes, un surtitre sur deux en moins, alignement à gauche partout | `app/(site)/page.tsx`, `components/sections/PiliersSection.tsx`, `components/ui/SectionHeader.tsx` | 3 h |
| M4 | Photos existantes en duotone bleu, en grand (accueil, à propos, page Propreté) | `components/ui/` (nouveau `PhotoDuotone`), sections concernées | 2 h |
| M5 | Pages service : un visuel par page (photo duotone ou icône grand format) | `app/(site)/services/[slug]/page.tsx` | 2 h |

### Ambitieux (la signature « Opérations »)

| # | Action | Fichiers | Effort |
|---|---|---|---|
| A1 | **Simulateur dans le premier écran** : nombre de personnes × commission en vigueur → estimation en FCFA, puis bouton « Demander du personnel » prérempli | `components/sections/HeroSection.tsx`, réutilisation de la grille tarifaire (`lib/devis/`, paramètres) | 1 jour |
| A2 | **Suivi mis en scène** : aperçu d'interface de la page de suivi (frise d'étapes, numéro de dossier en mono, statut) | `components/sections/SuiviSection.tsx` | 0,5 jour |
| A3 | Section recrutement bleu nuit avec chiffres en mono et étapes numérotées (01, 02, 03, 04) | `components/sections/FocusRecrutementSection.tsx`, `ParcoursSection.tsx` | 0,5 jour |
| A4 | Illustrations SVG au trait pour Particuliers, Entreprises et Candidats (style Bitcoin.org, monochromes `navy` avec un point lime) | `components/illustrations/` | 1 jour |
| A5 | Apparitions en CSS (léger `IntersectionObserver`, contenu visible par défaut) à la place de framer-motion | `components/ui/Reveal.tsx` | 0,5 jour |

---

## 5. Risques

- **Back-Office** : 11 fichiers du Back-Office utilisent `forest`, `brand-*` ou `cta`. Le remappage des rôles le fera aussi passer au bleu. C'est cohérent, mais il faudra relancer les tests e2e et faire une revue visuelle. On peut aussi limiter les nouveaux rôles au site public (`(site)`) dans un premier temps.
- **Cohérence avec les supports imprimés** : devis, factures et reçus en PDF (`pdf-lib`), et image de partage. Il faut vérifier que leurs couleurs suivent.
- **Accessibilité** : `signal` (`#2E7CF6`, 3,94:1) ne doit jamais porter de texte. Le lime ne doit jamais porter de texte blanc.
- **Simulateur (A1)** : il doit lire la commission en vigueur (paramètre administrable) et rester une estimation sans engagement, conformément à la définition du glossaire.
- **Chiffres de preuve (Q6, A3)** : ils doivent être réels et vérifiables. À défaut, il vaut mieux ne rien afficher.
- **Polices** : on remplace deux familles par une famille et sa variante mono. Le poids total reste similaire, mais il faut vérifier le CLS (`display: swap`, `adjustFontFallback`).
- **Régressions** : tests Playwright existants (`e2e/`), à relancer après chaque lot.

---

## 6. Bilan de l'application (2026-11-05, branche `feat/refonte-design`)

Périmètre validé : **tout le plan**, Back-Office compris. Chaque lot a été recapturé en 1440 et 390 px.

| Lot | Commit | Statut |
|---|---|---|
| Q3, Q4, Q5 | `e219b1c` | Fait. WhatsApp devient un canal (bouton principal + icône, ou bouton secondaire clair). Cartes de service non étirées. Utilitaires morts retirés. |
| M1 | `07d57ee`, `b01454d` | Fait. Palette bleu nuit / bleu d'action / lime accent, piliers distincts, Back-Office, e-mails, PDF et image de partage alignés. Corrige aussi les boutons WhatsApp du Back-Office (texte blanc à 1,98:1). |
| M2, Q1 | `d4b1de0` | Fait. IBM Plex Sans + Mono (poids identique), titres desserrés, surtitre mono, rayons 8 / 12 / 16 px. |
| A5 | `efa0ddc` | Fait. Apparitions en CSS, aucun bloc invisible sans JavaScript, framer-motion supprimé. Vérifié avec JS, sans JS et en mouvement réduit. |
| A1, A2, A3, M3, Q2, Q6 | `f4c24a5` | Fait. Premier écran clair avec simulateur, photo visible sur mobile, parcours + aperçu du suivi, piliers en liste, FAQ et zones en deux colonnes, bandeau de chiffres (vide). |
| A4, M4, M5 | `51332a0` | Fait. Illustrations au trait dans les en-têtes, photos traitées, listes numérotées au lieu de cartes. |

### Avant / après (accueil)

| | Avant | Après |
|---|---|---|
| Premier écran | Bandeau vert foncé, titre serré (Outfit 800, −0,035 em), photo masquée sur mobile, 3 cartes et 6 liens | Fond clair, titre IBM Plex 600 lisible, 3 portes en lignes, photo d'équipe sur tous les écrans, simulateur d'estimation chiffré |
| Corps de page | Environ 25 cartes blanches sur le même modèle, 8 pastilles de surtitre | Listes à filets numérotées, surtitres mono discrets, une seule section bleu nuit |
| Boutons | Lime, vert WhatsApp et vert forêt en concurrence | Un bouton plein bleu par bloc (lime sur fond nuit), WhatsApp en canal secondaire |
| Preuve | Encart « Laisser un avis » isolé | Aperçu de la page de suivi, simulateur chiffré, bandeau de chiffres prêt (à remplir) |
| JavaScript | framer-motion sur tout le site, blocs invisibles sans JS | Apparitions en CSS, contenu toujours visible |

### Vérifications faites
- `tsc --noEmit` et `next build` : OK.
- Tests unitaires : 221 réussis. Les 261 tests d'intégration sont ignorés : PostgreSQL n'était pas disponible localement.
- Aucun débordement horizontal à 390 px. Les trois portes tiennent au-dessus de la ligne de flottaison (bas de la 3e à 573 px sur 844). Aucune cible tactile sous 44 px sur l'accueil. Aucune erreur console. Focus visible.
- Simulateur : 7 × 5 000 = 35 000 FCFA ; lien `?personnes=7&poste=Gardien`.

### Reste à faire
1. **Tests e2e et d'intégration** à lancer avec la base démarrée (Docker Desktop était arrêté) : `npm run test`, `npm run test:e2e`.
2. **Préremplissage du formulaire** depuis le simulateur : code en place, mais non vérifié de bout en bout (la page `/recrutement/demander-du-personnel` exige la base).
3. **Chiffres de preuve** : renseigner `CHIFFRES` dans `content/home-data.ts` avec des chiffres réels (dossiers traités, placements confirmés, délai moyen de réponse…).
4. **Revue visuelle du Back-Office connecté** (tableau de bord, dossiers) : seul l'écran de connexion a été capturé, faute de base.
5. **Nouvelles photos** (équipe en intervention, avant/après complets) : le composant `PhotoTraitee` est prêt à les accueillir.
6. Pages non retouchées en profondeur (blog, boutique, espace candidat, suivi réel) : elles héritent de la palette et des polices ; à revoir page par page si besoin.
