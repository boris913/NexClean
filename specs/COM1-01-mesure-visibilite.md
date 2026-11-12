# COM1-01 – Mesure, source d'acquisition et visibilité

ADR de référence : 0006, 0021, 0022. Phase COM-1, sans dépendance externe lourde : livrable en premier.

## 1. User stories

- En tant que **direction**, je veux savoir d'où vient chaque prospect (Google, Facebook, TikTok, WhatsApp, site, prospection) afin d'investir là où ça rapporte.
- En tant que **visiteur mobile**, je veux pouvoir appeler, écrire sur WhatsApp ou demander un devis depuis n'importe quelle page de service, en un geste.
- En tant que **direction**, je veux mesurer les appels, clics WhatsApp, formulaires et demandes de devis.

## 2. Source d'acquisition

**RG-01** Nouveau champ `source` sur la Demande, distinct du `canal` (le canal dit *par où* la demande est arrivée, la source dit *ce qui a amené* le prospect). Valeurs : `google_naturel`, `google_ads`, `google_maps`, `facebook`, `instagram`, `tiktok`, `whatsapp_direct`, `bouche_a_oreille`, `prospection` (veille, COM4-01), `partenaire`, `autre`, `inconnue`.

**RG-02** Sur le site, la source est déduite automatiquement, par ordre de priorité : paramètres `utm_source` / `utm_medium` / `utm_campaign` → `gclid` / `fbclid` / `ttclid` → referrer → `inconnue`. Elle est mémorisée 30 jours (cookie de première partie, première source conservée) et envoyée avec chaque formulaire. Les UTM bruts sont stockés à côté de la source.

**RG-03** En saisie manuelle (MVP1-02), la source est **obligatoire** (liste déroulante, défaut « inconnue » interdit si le canal est `telephone` ou `visite` : le collaborateur demande « comment nous avez-vous connus ? »).

**RG-04** La source d'une Demande peut être corrigée par le référent ; la correction est historisée.

**RG-05** Liens `wa.me` publiés (site, réseaux, publicités, veille) : le texte prérempli contient une référence courte (`[FB]`, `[TT]`, `[P-0042]`…) que COM2-01 sait lire pour déduire la source.

## 3. Boutons d'action

**RG-06** Chaque page de service et chaque page ville affiche le trio **Appeler** (`tel:`), **WhatsApp** (`wa.me` avec texte prérempli propre au service) et **Demander un devis** (formulaire). Sur mobile, barre fixe en bas d'écran.

**RG-07** Liens Facebook et TikTok renseignés dans `SOCIAL_MEDIA` ; un lien vide n'est pas affiché.

## 4. Mesure

**RG-08** GA4 activé via `NEXT_PUBLIC_GA_ID` (déjà câblé : `lib/analytics.ts`). Les événements existants deviennent des **conversions clés** dans GA4 : `whatsapp_click`, `phone_click`, `quote_form_submit`, `staff_request_submit`.

**RG-09** Google Search Console : propriété de domaine `nexclean.xyz` validée par DNS, sitemap soumis.

**RG-10** Fiches **Google Business Profile** Douala et Yaoundé (gérées par NEXCLEAN) avec lien vers la page ville portant des UTM `google_maps`.

## 5. Référencement local

**RG-11** Une page par ville couverte (référentiel ADR 0021) : services disponibles, quartiers desservis, trio d'actions, données structurées `LocalBusiness` / `Service` avec `areaServed`.

**RG-12** Budget de performance mobile : LCP < 2,5 s et CLS < 0,1 sur les pages de service (mesuré en 4G simulée) ; contrôle intégré à la QA.

## 6. Cas limites

- Visiteur venu de Facebook puis revenu par Google : on garde la **première** source (RG-02), la dernière est stockée en complément.
- Cookies refusés : la source est calculée pour la session uniquement.
- Demande rattachée à un Dossier existant : le Dossier garde la source de sa première Demande.

## 7. Critères d'acceptation

- **RG-02** — *Étant donné* un visiteur arrivé par `?utm_source=facebook&utm_campaign=menage-nov`, *quand* il soumet un devis 3 jours plus tard, *alors* la Demande porte `source = facebook` et la campagne `menage-nov`.
- **RG-03** — *Étant donné* une saisie manuelle au canal `telephone`, *quand* la source est « inconnue », *alors* l'enregistrement est refusé.
- **RG-06** — *Étant donné* une page de service sur un écran de 375 px, *alors* les trois boutons sont visibles sans défilement.
