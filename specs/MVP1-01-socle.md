# MVP1-01 – Socle

ADR de référence : 0001, 0002, 0003, 0016, 0018, 0021.

## 1. Hébergement et exploitation

### Exigences

| ID | Exigence |
|---|---|
| M1-SOC-01 | L'application (site public, Back-Office) et PostgreSQL tournent sur le VPS Contabo (UE), déployés via Coolify depuis la branche `main` du dépôt Git. |
| M1-SOC-02 | PostgreSQL n'est joignable que depuis le réseau Docker interne ; aucun port base de données exposé publiquement. |
| M1-SOC-03 | Pare-feu : seuls 22 (SSH par clé uniquement), 80 et 443 sont ouverts ; fail2ban actif ; mises à jour de sécurité Ubuntu automatiques. |
| M1-SOC-04 | HTTPS sur `nexclean.xyz` et `www.nexclean.xyz` ; redirection HTTP → HTTPS ; en-têtes de sécurité actuels (`next.config.ts`) conservés. |
| M1-SOC-05 | Sauvegarde quotidienne chiffrée de la base (dump) et du répertoire des documents vers un stockage objet externe ; rétention 30 jours. |
| M1-SOC-06 | Supervision externe : disponibilité du site (contrôle toutes les 5 min), alerte e-mail en cas d'indisponibilité, d'espace disque < 20 % ou d'échec de sauvegarde. |
| M1-SOC-07 | Variables secrètes (base, Resend, clés de chiffrement des sauvegardes) uniquement dans les variables d'environnement Coolify, jamais dans le dépôt. |
| M1-SOC-08 | `vercel.json` est retiré du dépôt après bascule DNS. |

### Critères d'acceptation

- **M1-SOC-02** — *Étant donné* le VPS en production, *quand* on tente une connexion PostgreSQL depuis Internet sur l'IP publique, *alors* la connexion est refusée.
- **M1-SOC-05** — *Étant donné* une sauvegarde de la veille, *quand* on la restaure sur un serveur vierge en suivant la documentation, *alors* l'application redémarre avec les mêmes dossiers, comptes et documents.
- **M1-SOC-06** — *Étant donné* une sauvegarde qui échoue, *quand* le job se termine en erreur, *alors* un e-mail d'alerte part vers l'adresse d'exploitation dans les 15 minutes.

### Cas limites

- Bascule DNS depuis Vercel : prévoir une fenêtre de bascule avec TTL abaissé à l'avance ; le site public ne doit pas être indisponible plus de 15 minutes.
- Disque plein : l'application doit refuser les téléversements avec un message clair plutôt que corrompre des fichiers.

## 2. Comptes collaborateurs et authentification

### User stories

- En tant qu'**administrateur**, je veux créer, modifier et désactiver des comptes collaborateurs afin de contrôler qui accède au Back-Office.
- En tant que **collaborateur**, je veux me connecter de façon sécurisée depuis mon smartphone afin de traiter mes dossiers.

### Exigences

| ID | Exigence |
|---|---|
| M1-AUT-01 | Connexion collaborateur par e-mail + mot de passe (≥ 10 caractères), hachage Argon2id ou bcrypt. |
| M1-AUT-02 | 2FA TOTP **obligatoire** pour les rôles Direction, Responsable finances et Administrateur ; proposée aux Référents. Codes de secours (10, usage unique) générés à l'activation. |
| M1-AUT-03 | Pas d'inscription libre au Back-Office. Les comptes sont créés par un Administrateur ; le collaborateur reçoit un lien d'activation par e-mail (validité 48 h) pour définir son mot de passe. |
| M1-AUT-04 | Désactivation d'un compte : connexion impossible, sessions en cours révoquées immédiatement, historique conservé. Aucune suppression de compte. |
| M1-AUT-05 | Session expirée après 8 h d'inactivité ; « se souvenir de moi » non proposé. |
| M1-AUT-06 | Après 5 échecs de connexion en 15 min pour un même compte ou une même IP, blocage de 15 min. |
| M1-AUT-07 | Réinitialisation du mot de passe par lien e-mail à usage unique (validité 30 min). |
| M1-AUT-08 | Connexions réussies, échecs, activations 2FA, réinitialisations et désactivations sont inscrits au journal d'audit. |
| M1-AUT-09 | Le premier compte Administrateur + Direction est créé par une commande d'initialisation exécutée sur le serveur (pas d'écran public). |

### Critères d'acceptation

- **M1-AUT-02** — *Étant donné* un collaborateur au rôle Direction sans 2FA activée, *quand* il se connecte, *alors* il est redirigé vers l'activation de la 2FA et ne peut accéder à aucune autre page avant de l'avoir terminée.
- **M1-AUT-04** — *Étant donné* un référent connecté sur son téléphone, *quand* l'administrateur désactive son compte, *alors* sa requête suivante le renvoie à la page de connexion et la connexion lui est refusée.
- **M1-AUT-06** — *Étant donné* 5 mots de passe erronés en 10 min, *quand* un 6e essai est fait avec le bon mot de passe, *alors* il est refusé avec un message indiquant un délai d'attente.

### Cas limites

- Perte du téléphone portant la 2FA : utilisation d'un code de secours, ou réinitialisation de la 2FA par un Administrateur (journalisée).
- Dernier Administrateur : il est impossible de désactiver le dernier compte Administrateur actif.
- Changement d'e-mail d'un collaborateur : par l'Administrateur uniquement, journalisé.

## 3. Rôles, attributs et contrôle d'accès

### Exigences

| ID | Exigence |
|---|---|
| M1-ROL-01 | Rôles combinables : Référent, Responsable finances, Direction, Administrateur. La matrice des droits de l'ADR 0018 est implémentée dans le code (pas d'éditeur). |
| M1-ROL-02 | Attributs d'un collaborateur, modifiables par Administrateur ou Direction : services traités (types de dossier), villes couvertes, disponibilité (actif / absent du … au …), capacité maximale optionnelle. |
| M1-ROL-03 | Chaque requête serveur (page, action, API, téléchargement) vérifie les droits ; une interface qui masque un bouton ne constitue pas un contrôle. |
| M1-ROL-04 | Un Référent ne voit que les Dossiers qui lui sont attribués ; la Direction voit tout ; le Responsable finances voit tout en lecture ; l'Administrateur seul ne voit aucun Dossier. |
| M1-ROL-05 | Modification des rôles et attributs journalisée (avant / après). |

### Critères d'acceptation

- **M1-ROL-04** — *Étant donné* un Référent A et un Dossier attribué au Référent B, *quand* A ouvre l'URL directe du Dossier, *alors* il reçoit une réponse « accès refusé » (403) et la tentative est journalisée.
- **M1-ROL-04** — *Étant donné* un collaborateur ayant uniquement le rôle Administrateur, *quand* il ouvre la liste des Dossiers, *alors* la liste ne lui est pas accessible.

## 4. Journal d'audit

| ID | Exigence |
|---|---|
| M1-AUD-01 | Table en ajout seul : aucun rôle applicatif ne peut modifier ni supprimer une entrée (droits SQL restreints sur la table). |
| M1-AUD-02 | Chaque entrée : horodatage, auteur (collaborateur, client via page de suivi, système), action, objet visé, données avant / après si pertinent, adresse IP. |
| M1-AUD-03 | Actions journalisées en MVP-1 : authentification (cf. M1-AUT-08), gestion des comptes, rôles et attributs, création / rattachement / transition / attribution / réaffectation de Dossier, téléversement / téléchargement / suppression de document, accès refusés, régénération de lien de suivi, modification des modèles de messages et des paramètres. |
| M1-AUD-04 | Consultation du journal par Direction et Administrateur, filtrable par période, auteur, objet. |

*Étant donné* un utilisateur applicatif, *quand* il exécute un `UPDATE` ou `DELETE` sur la table d'audit, *alors* la base refuse l'opération.

## 5. Référentiel géographique

| ID | Exigence |
|---|---|
| M1-GEO-01 | Tables Ville → Arrondissement → Quartier ; indicateur « couverte » sur la Ville ; coordonnées approximatives optionnelles sur le Quartier. |
| M1-GEO-02 | Données initiales : Douala (Douala I à V) et Yaoundé (Yaoundé I à VII) avec leurs principaux quartiers, dont au moins ceux de `content/zones-coverage.ts`. Douala et Yaoundé « couvertes ». |
| M1-GEO-03 | Administration (Administrateur, Direction) : ajouter / renommer / désactiver ville, arrondissement, quartier ; une entrée référencée n'est jamais supprimée, seulement désactivée. |
| M1-GEO-04 | Les saisies « Autre quartier » sont listées dans une vue de revue ; l'administrateur peut les convertir en Quartier et les rattacher (les Dossiers concernés sont mis à jour). |
| M1-GEO-05 | Le site public lit les villes couvertes depuis le référentiel ; `CITIES` et `zones-coverage.ts` sont retirés ou alimentés par la base. |

Cas limite : une demande d'une ville hors référentiel (« Autre ville ») est acceptée ; elle part en file Non attribués (cf. MVP1-05).

## 6. Stockage des documents

| ID | Exigence |
|---|---|
| M1-DOC-01 | Fichiers stockés hors racine web, derrière une interface de stockage compatible S3 (implémentation disque en V1). Nom de fichier interne aléatoire ; nom d'origine conservé en métadonnée. |
| M1-DOC-02 | Formats acceptés : PDF, JPEG, PNG, WEBP, DOCX ; taille ≤ 5 Mo ; contrôle du type réel par signature binaire (comme l'API candidature actuelle) ; DOCX contenant des macros refusés. |
| M1-DOC-03 | Chaque document est rattaché à un Dossier, avec catégorie (pièce client, devis externe, justificatif, autre), auteur et date. |
| M1-DOC-04 | Téléchargement uniquement via une route applicative qui vérifie les droits sur le Dossier et journalise l'accès ; pas d'URL publique. |
| M1-DOC-05 | Suppression réservée à l'auteur (dans les 24 h) et à la Direction ; suppression logique journalisée, purge physique après 30 jours. |
| M1-DOC-06 | Onglet « Documents » dans chaque Dossier, utilisable sur mobile (téléversement depuis l'appareil photo). |

- *Étant donné* un fichier `cv.pdf` dont le contenu réel est un exécutable, *quand* il est téléversé, *alors* il est refusé avec le message « Format de fichier non accepté ».
- *Étant donné* un référent sans droit sur le Dossier, *quand* il appelle l'URL de téléchargement d'un document de ce Dossier, *alors* il reçoit un 403 et l'accès est journalisé.

## Notes d'implémentation (non contractuelles)

Recommandations à confirmer au démarrage : ORM typé (Drizzle ou Prisma), Better Auth pour l'authentification (TOTP inclus), sauvegardes via `pg_dump` + restic vers Backblaze B2 ou Contabo Object Storage, supervision externe gratuite (UptimeRobot / Better Stack).
