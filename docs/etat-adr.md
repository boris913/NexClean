# État des ADR et plan du reste à faire

Point au 2026-11-13, après le lot « Offres administrables » (ADR 0013, PR #42). Mis à jour le 2026-11-17 avec le lot POST-01 « Finitions ».

**Méthode.** Les décisions de chaque ADR ont été comparées au code : schéma, `lib/`, écrans, tâches planifiées, scripts. Les ADR couverts par des lots déjà fusionnés (specs MVP1-*, MVP2-*, COM*) sont marqués comme faits d'après ces lots. Ils n'ont pas été revérifiés critère par critère. Les ADR partiels ou non faits ont été vérifiés un par un.

Légende : ✅ fait · 🟡 partiel · ❌ à faire · ⏸ dépend d'un tiers ou d'une décision extérieure.

## 1. État par ADR

| ADR | Sujet | État | Ce qui manque |
|---|---|---|---|
| 0001 | Application unique Next.js | ✅ | Le service du Back-Office sur `app.nexclean.xyz` est prévu en option (« pourra »). Il n'est pas fait et n'est pas nécessaire. |
| 0002 | Hébergement VPS / Coolify | ✅ | Sauvegarde, test de restauration, surveillance et alertes sont présents (`scripts/vps/`). `vercel.json` est retiré (POST-01). Le durcissement du serveur (pare-feu, fail2ban, SSH par clé) se vérifie sur le VPS, pas dans le dépôt. La page Mentions légales cite encore Vercel comme hébergeur. |
| 0003 | Stockage interne des documents | ✅ | — |
| 0004 | Encaissement manuel, paiement en ligne plus tard | 🟡 | La saisie manuelle est faite (MVP2-05). **Manque l'interface de prestataire de paiement (§3)**, prévue dès la V1 mais absente du code. Reste aussi l'agrégateur Orange Money / MTN MoMo (§4). |
| 0005 | Messagerie V1 | ✅ | WhatsApp API livrée par l'ADR 0025. Reste : SMS (hors V1). L'« interface de canal de notification » n'est pas formalisée en tant que telle, ce qui reste sans impact tant qu'il n'y a pas de SMS. |
| 0006 | Demande / Dossier / Client | ✅ | — |
| 0007 | Cycles de statuts | ✅ | — |
| 0008 | Commission de placement | ✅ | — |
| 0009 | Acompte | ✅ | — |
| 0010 | Placements partiels, ajustements | ✅ | — |
| 0011 | Placement confirmé | ✅ | — |
| 0012 | Mise à disposition | ✅ V1 · ⏸ suite | Le type de dossier existe. Le modèle métier attend l'agrément et son cadre juridique. |
| 0013 | Offres publiées | ✅ | **Livré sur cette branche.** Voir § 3. |
| 0014 | Suivi client par lien | ✅ | — |
| 0015 | Candidat, Candidature, Proposition | ✅ | §3 livré par POST-01 : les candidatures aux offres liées aux lignes de poste s'affichent dans l'onglet Postes du Dossier (accès au vivier requis). |
| 0016 | Authentification | ✅ | Reste l'OTP par SMS (lot ultérieur prévu par l'ADR). |
| 0017 | Données personnelles candidats | 🟡 | **§4 : relance à 24 mois d'inactivité puis anonymisation automatique**, absente. **§6 : export des données du candidat (PDF / JSON)**, absent. Le reste est fait : consentements, accord par proposition, suppression à la demande, journalisation. |
| 0018 | Rôles et permissions | ✅ | — |
| 0019 | Attribution automatique | ✅ | — |
| 0020 | Dépenses et indicateurs financiers | ✅ | Livré par POST-03 (`specs/POST-03-depenses-tableau-direction.md`) : module Dépenses (`/admin/depenses`, catégories paramétrables, justificatif, annulation motivée), tableau de bord direction (`/admin/pilotage`) avec les définitions du §2, export CSV pour le comptable. Reste l'import CSV des dépenses (« plus tard » dans l'ADR). Catégories initiales, tranches d'impayés et exclusion du crédit client de l'Encaissé : valeurs par défaut à confirmer par la Direction. |
| 0021 | Référentiel géographique | ✅ | — |
| 0022 | Formulaires « enregistrer puis WhatsApp » | ✅ | §2 livré par POST-02 (`specs/POST-02-formulaire-abonnement.md`) : le formulaire de `/abonnements` crée un Dossier ABO, affiche le numéro puis ouvre WhatsApp. |
| 0023 | Phasage | — | Voir la liste « Après les MVP » au § 2. |
| 0024 | Sessions candidats séparées | ✅ | — |
| 0025 | WhatsApp Cloud API | ✅ code · ⏸ mise en service | Le passage sur le numéro commercial dépend de Meta et de l'accord écrit de NEXCLEAN. |
| 0026 | Assistance IA, agent | ✅ | — |
| 0027 | Veille prospects | ✅ | — |

## 2. Liste « Après les MVP » de l'ADR 0023

| # | Lot | État |
|---|---|---|
| 1 | Offres administrables (0013) | ✅ cette branche |
| 2 | Formulaire abonnement (0022) | ✅ POST-02 |
| 3 | Tableau de bord direction, dépenses, exports (0020) | ✅ POST-03 |
| 4 | Éditeur complet de modèles de documents | ✅ POST-05 (`specs/POST-05-editeur-modeles-documents.md`) : blocs de texte, ordre des sections (montants et éléments réglementaires verrouillés), variables, versions avec retour arrière, aperçu PDF, onglet « Documents PDF » de l'écran Modèles. Hors périmètre : mise en page libre (polices, couleurs, logo, colonnes). |
| 5 | Paiement en ligne Orange Money / MTN MoMo (0004) | ❌ |
| 6 | Anonymisation automatique, export des données candidat (0017) | ❌ |
| 7 | API WhatsApp Business, SMS (0005) | ✅ WhatsApp (COM2) · ❌ SMS |
| 8 | Mise à disposition (0012) | ⏸ agrément |
| 9 | Traduction anglaise | ❌ |

## 3. Lot livré : offres administrables (ADR 0013)

- Écran **Offres d'emploi** (`/admin/offres`). On peut créer une offre, qui naît en brouillon, la modifier, la publier, la fermer avec un motif, la rouvrir, ou supprimer un brouillon. Accès : Direction et Référents du service Recrutement.
- **Brouillon pré-rempli depuis une ligne de poste**, via l'onglet Postes du Dossier REC. Il est anonymisé et le salaire n'est pas repris.
- **Fermeture automatique** dans quatre cas : la ligne est pourvue, le Dossier est fermé, la recherche est clôturée, ou la date limite est passée.
- **Reprise des 8 offres** de `content/jobs-data.ts` par la migration `0024_offres` (4 publiées, 4 fermées). Le fichier est supprimé.
- Le site public (`/recrutement`, fiche d'offre, accueil, sitemap, JSON-LD) lit la base. Il se met à jour aussitôt après une action manuelle.
- Écart à l'ADR et règles de mise en œuvre : voir la section « Mise en œuvre » de l'ADR 0013.

**Au déploiement :** la migration s'applique d'elle-même au démarrage du conteneur (`docker-entrypoint.sh`). Ensuite, vérifier que `/recrutement` affiche les 4 offres ouvertes et que `/admin/offres` les liste.

## 4. Plan du reste à faire

Chaque lot commence par une spec dans `specs/` (convention du dépôt), validée avant le code. Tailles indicatives (convention de `specs/README.md`) : S < 1 semaine, M 1–2 semaines, L 2–4 semaines, tests compris.

| Ordre | Lot | ADR | Taille | Dépend de | Contenu |
|---|---|---|---|---|---|
| 1 | **POST-01 Finitions** ✅ | 0002, 0015 | S | — | Fait : candidatures aux offres liées visibles dans l'onglet Postes du Dossier ; `vercel.json` retiré ; tests d'intégration de la fermeture automatique liée au Dossier. |
| 2 | **POST-02 Formulaire abonnement** ✅ | 0022 §2 | S | — | Fait. Même circuit que les devis MVP1-04 : formulaire sur `/abonnements` qui crée Demande et Dossier de type abonnement, affiche le numéro puis ouvre WhatsApp, avec repli WhatsApp en cas d'échec. Le type de dossier et `SERVICE_ABO` existent déjà. |
| 3 | **POST-03 Dépenses et tableau de bord direction** ✅ | 0020 | L | Liste des catégories de dépenses (Direction) | Fait. Saisie des dépenses avec justificatif par Finances et Direction (`depense.saisir`), catégories gérées par Direction et Admin (`depense.categories`, liste initiale semée par la migration `0025_depenses`), annulation motivée plutôt que suppression. Page *Pilotage* : facturé (avoirs déduits), encaissé, impayés par ancienneté, dépenses, résultat estimé, trésorerie, marge par dossier et par service, calculés en SQL. Export CSV comptable (`export.donnees`, journalisé). À confirmer par la Direction : catégories, tranches d'ancienneté, crédit client exclu de l'Encaissé. |
| 4 | **POST-04 Données candidats** | 0017 §4, §6 | M | Texte de relance validé | Tâche planifiée : relance à 24 mois d'inactivité (WhatsApp ou e-mail), puis anonymisation et suppression des fichiers à 30 jours sans réponse, en conservant les placements et pièces financières pseudonymisés. Ajout de l'export « Mes données » en JSON et PDF depuis l'espace candidat. Aucun profil n'atteint 24 mois avant fin 2028, mais l'export est une obligation dès maintenant. |
| 5 | **POST-05 Éditeur de modèles de documents** ✅ | 0023 #4 | M | — | Fait. Pour les six documents PDF : blocs de texte (en-tête, introduction, titres, consignes, complément de pied de page…) avec les variables `{{…}}`, ordre des sections déplaçables, sections de montants et réglementaires verrouillées. Chaque enregistrement crée une version journalisée, avec retour arrière et aperçu PDF sur données d'exemple. Un document utilise la version en vigueur à sa date de référence (émission pour factures et avoirs, ADR 0020 §3) : un PDF émis ou archivé ne change pas. Migration `0025_modeles_documents`. |
| 6 | **POST-06 Paiement en ligne** | 0004 §3–4 | L | Choix de l'agrégateur, contrat, KYC NEXCLEAN | Commence par l'interface prestataire (demande de paiement, notification signée), qui manque depuis la V1. Viennent ensuite le branchement d'un agrégateur Orange Money / MTN MoMo et le paiement depuis la page de suivi. Un paiement confirmé crée l'Encaissement de façon idempotente. |
| 7 | **POST-07 SMS / OTP** | 0005, 0016 | M | Choix du fournisseur SMS | Canal SMS derrière une interface de canal de notification, et OTP candidat en complément du mot de passe. |
| 8 | **POST-08 Traduction anglaise** | 0023 #9 | L | Textes traduits fournis | Site public d'abord : routage `/en`, contenus, métadonnées et `hreflang`. Le Back-Office reste en français. |
| — | Mise à disposition | 0012 | à chiffrer | Agrément | Attend la confirmation du cadre juridique. |
| — | Sous-domaine `app.` | 0001 | S | Décision | Facultatif. |

**Ordre conseillé.** Les lots 1 et 2 sont rapides et sans dépendance. Le lot 3 répond au besoin de pilotage de la direction. Le lot 4 couvre une obligation sur les données personnelles. Les lots 6 et 7 dépendent de choix de fournisseurs, à lancer en parallèle dès maintenant pour ne pas attendre le développement.

**Décisions à prendre avant de démarrer :**
- Lot 3 : liste initiale des catégories de dépenses, et qui saisit les dépenses (Finances seule, ou Direction aussi comme le prévoit l'ADR).
- Lot 6 : agrégateur retenu. La comparaison porte sur les commissions, les délais de reversement, le KYC et la qualité des webhooks.
- Lot 7 : fournisseur SMS et budget mensuel.
