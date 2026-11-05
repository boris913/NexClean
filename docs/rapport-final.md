# Rapport final — Refonte du positionnement du site public NEXCLEAN

> Branche : `feat/refonte-positionnement`, partie de `main` (`a2871a1`). Ni poussée, ni fusionnée.
> Documents de référence : `docs/audit.md` (état des lieux), `docs/decisions.md` (D-01 à D-17), `docs/contenu.md` (copy), `docs/design-system.md`, `docs/qa.md`.

## 1. Ce qui a changé

**Positionnement.** NEXCLEAN est maintenant présenté comme un prestataire de services aux entreprises et aux particuliers, organisé en cinq activités : Propreté & hygiène, Recrutement & placement, Espaces verts, Emploi, Boutique. Le suivi de dossier en ligne est mis en avant à côté. Le nettoyage reste détaillé sur ses propres pages, comme une activité parmi les autres.

- **Accueil.** Promesse : « Vos espaces et vos équipes, entre de bonnes mains. » Elle est suivie de trois portes d'entrée (« J'ai besoin d'un service », « Je recrute du personnel », « Je cherche un emploi »), visibles sans défiler de 360 à 1440 px. Viennent ensuite les sections : activités, parcours commun, focus recrutement, focus propreté (avec la promo), suivi en ligne, offres d'emploi récentes, avis, zones, FAQ, CTA final.
- **Navigation.** Le header propose les menus Services, Recrutement et Emploi, puis Boutique, Réalisations, À propos, et le CTA « Faire une demande ». Les menus déroulants sont accessibles au clavier, et le menu complet s'affiche dès 1024 px (1280 px avant). Le footer passe à 4 colonnes. La barre mobile s'adapte à la page. Aucune URL n'a changé.
- **Référencement.** Titre, description, mots-clés, image de partage, manifest, JSON-LD `Organization`, `LocalBusiness` multi-activités et `JobPosting` sur les offres. Balises `twitter` par page, canonical du blog. Le blog est désormais rendu côté serveur, donc ses articles figurent dans le HTML.
- **Messages WhatsApp.** Le message par défaut est neutre. Chaque contexte a le sien : service, recrutement, emploi, suivi.
- **Design system unique.**
  - Couleurs : vert profond pour les surfaces fortes, lime pour l'accent, une couleur par activité.
  - Typographie : une seule échelle, fluide.
  - Mise en page : une seule largeur de conteneur, plus une variante étroite, et un rythme vertical commun.
  - Composants partagés : `Container`, `Section`, `SectionHeader`, `Card`, `PillarCard`, `IconBadge`, `Button` (6 variantes, état de chargement).
  - Pages : toutes migrées.
- **Accessibilité.**
  - Le bouton WhatsApp est passé de 1,98:1 à 8,94:1 de contraste.
  - Les couleurs d'état, l'accent et les gris de texte respectent le niveau AA.
  - Le focus est visible partout.
  - Les animations sont coupées pour les visiteurs qui ont demandé moins de mouvement.
  - Un lien d'évitement permet d'aller directement au contenu.
- **Graphie.** La marque s'écrit « NEXCLEAN » dans les textes visibles.
- **Dépendance.** `react-icons` est retiré : il n'était importé nulle part. Aucune dépendance n'a été ajoutée.

## 2. Vérifications

| Contrôle | Résultat |
|---|---|
| `npm run typecheck` | réussi |
| `npm run build` | réussi |
| `npm test`, intégration comprise, sur PostgreSQL jetable | **482/482** (avant les corrections QA) ; 221/221 tests unitaires après |
| Parcours e2e Playwright (375 px, build de production, base vierge) | **20/20** (avant les corrections QA) |
| QA : 25 pages × 4 largeurs, 55 URL | 0 débordement, 0 erreur console, 0 requête externe, h1 unique partout, liens et ancres valides, JSON-LD valide |

**Ce qui n'a pas été relancé ou vérifié :**
- Après les corrections QA (textes et graphie uniquement), les tests d'intégration et l'e2e n'ont pas été relancés. Typecheck, tests unitaires et build l'ont été.
- Non vus : les pages connectées (espace candidat, suivi avec un jeton valide, `/profil`), le back-office privé et l'envoi réel des formulaires.
- Pas de test sur d'autres navigateurs que Chrome, ni avec un lecteur d'écran.
- **`npm run lint` ne vérifie rien** : ESLint n'est pas configuré dans le projet (D-13).

## 3. Critères d'acceptation

| Critère | Verdict |
|---|---|
| L'offre se comprend en moins de 5 s | ✅ h1, sous-titre et 3 portes sont visibles sans défiler sur mobile comme sur desktop |
| Même design system, même navigation | ✅ avec des réserves mineures (`docs/qa.md`) |
| Logo SVG intégré | ⏸ hors périmètre (D-07), refait dans une autre conversation, sur `feat/ux-backoffice`. `Logo.tsx` et les noms de fichiers n'ont pas changé, et le header a été testé avec la largeur du nouveau logo |
| Responsive, sans régression | ✅ |
| Aucun texte « nettoyage uniquement » | ✅ sur les pages, ⚠ sur le blog : les 8 articles portent sur le nettoyage (voir §4) |

## 4. Points restants, qui demandent une décision

1. **Garantie de remplacement et non-contournement dans les devis envoyés aux clients** (`lib/parametres.ts:46-47`, `suivi/[jeton]/SectionDevis.tsx:120`). Le site public n'en parle plus, mais ces clauses apparaissent dans les devis alors que CONTEXT.md les note « à confirmer ». C'est une question contractuelle ; je n'ai pas modifié la logique.
2. **Blog** :
   - promesses commerciales à valider ou à retirer : « satisfaction garantie », « garantie de résultat », « garantie de propreté », « Santé garantie », « diagnostic gratuit » ;
   - l'article sur le savon parle d'une « Maison NEXCLEAN Paris » et d'une « Édition Luxe Numérotée », ce qui ressemble à un texte d'origine extérieure ;
   - aucun article ne porte sur le recrutement ni sur l'emploi.
3. **Promo -20 % « Offre de lancement »** : toujours active. Elle est affichée dans le bloc Propreté et se désactive avec `PROMO.active`.
4. **Placeholders à compléter.** Aucun ne s'affiche au public : chaque bloc concerné est masqué tant qu'il n'est pas rempli. La liste détaillée est dans `docs/contenu.md`.
   - `datePosted` des offres, exigé par Google pour `JobPosting` ;
   - RCCM, NIU et dirigeant (`COMPANY`) ;
   - chiffres clés réels ;
   - photos avant/après des espaces verts ;
   - autres réalisations ;
   - avis vérifiés, dont sur le recrutement ;
   - articles sur le recrutement et l'emploi ;
   - section CGV « Recrutement & placement » ;
   - formulation de la vision ;
   - canal d'envoi du lien « mot de passe oublié ».
5. **Mineurs QA non traités** :
   - cibles tactiles sous 44 px dans le footer et le fil d'Ariane ;
   - pas de variante `danger` pour `Button` ;
   - processus de `/a-propos` centré sur la propreté ;
   - espace vide dans le hero clair à partir de 1024 px ;
   - le mot-clé « entreprise de nettoyage ».
6. **Environnement local** :
   - `.env.local` vise le port 54330, où rien n'écoute ;
   - sans `DATABASE_URL_TEST`, 261 tests sont ignorés sans avertissement ;
   - ESLint n'est pas configuré.
7. **Fusion avec le logo** : `feat/ux-backoffice` et cette branche modifient toutes deux `lib/og-image.tsx`, sur des lignes distinctes.

## 5. Décisions clés (détail dans `docs/decisions.md`)
- **D-01 :** on ne présente que ce qui existe dans le code. La mise à disposition, le paiement en ligne et les garanties « à confirmer » sont exclus.
- **D-02 :** le nom est conservé.
- **D-05 :** aucune URL ne change.
- **D-06 :** direction « service de confiance ».
- **D-07 :** le logo est hors périmètre.
- **D-09 :** les chaînes testées sont figées.
- **D-15 :** promo conservée, barre mobile simplifiée, adresse retirée du footer.
- **D-16 :** une seule tâche lourde à la fois sur ce poste, après la saturation de la RAM.
- **D-17 :** arbitrages issus de la QA.
