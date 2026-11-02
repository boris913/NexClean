# MVP2-01 – Espace candidat

ADR de référence : 0003, 0005, 0015, 0016, 0017, 0021.

## 1. User stories

- En tant que **demandeur d'emploi**, je veux m'inscrire gratuitement depuis mon téléphone afin d'être contacté pour des emplois qui me correspondent.
- En tant que **candidat**, je veux mettre à jour mon profil, mon CV et ma disponibilité afin de rester visible pour les bons postes.
- En tant que **candidat**, je veux accepter ou refuser d'être présenté à un employeur afin de garder le contrôle de mes informations.
- En tant que **candidat**, je veux pouvoir demander la suppression de mes données afin d'exercer mes droits.

## 2. Inscription

**RG-01** Inscription gratuite, sans aucun paiement à aucune étape (mention visible : « L'inscription, la candidature et la mise en relation sont 100 % gratuites »).

**RG-02** Formulaire en étapes, brouillon conservé localement (comme MVP1-03) :

| Étape | Champs (obligatoires en **gras**) |
|---|---|
| 1. Identité | **nom**, **prénom**, **téléphone** (identifiant, E.164), numéro WhatsApp (case « identique au téléphone » cochée par défaut), e-mail |
| 2. Localisation | **ville**, arrondissement, **quartier** (référentiel + « Autre »), point de repère, **zones de travail acceptées** (≥ 1 arrondissement ou quartier, ou « toute la ville ») |
| 3. Recherche | **métiers recherchés** (1 à 5, liste paramétrable + saisie libre), secteurs souhaités (plusieurs), **types de contrat** (plusieurs : CDI, CDD, stage, job étudiant, temps partiel, alternance, mission ponctuelle, saisonnier), prétentions salariales (FCFA, fourchette, facultatif) |
| 4. Parcours | **niveau d'études** (liste), qualifications / diplômes, expériences (0 à 10 : poste, employeur, ville, durée, missions), compétences (étiquettes) |
| 5. Disponibilité | **disponibilité** (immédiate / à partir du … / en poste avec préavis), horaires possibles (jour, nuit, week-end) |
| 6. Documents | CV (PDF/DOCX/JPEG/PNG ≤ 5 Mo), justificatifs (0 à 5) — facultatifs |
| 7. Compte et consentements | **mot de passe** (≥ 8 caractères ou code à 6 chiffres), **consentement (a)** traitement du profil pour la recherche d'emploi, **consentement (b)** prise de contact par NEXCLEAN — deux cases distinctes, non précochées |

**RG-03** Les consentements sont enregistrés avec horodatage, version du texte et canal. Sans les deux, l'inscription est impossible.

**RG-04** Un téléphone déjà inscrit ne peut pas créer un second compte : message « Ce numéro a déjà un compte » + lien « Mot de passe oublié ».

**RG-05** À la fin : candidat créé au statut « nouveau », entrée dans la file **Nouveaux candidats** et attribution (MVP2-02). Écran de confirmation + bouton « Recevoir la confirmation sur WhatsApp » (lien `wa.me` prérempli vers NEXCLEAN).

## 3. Connexion et mot de passe (ADR 0016)

**RG-06** Connexion par téléphone + mot de passe ; 5 échecs en 15 min → blocage 15 min ; session 30 jours avec « rester connecté » (smartphone personnel), 24 h sinon.

**RG-07** Mot de passe oublié :
- e-mail renseigné → lien à usage unique (30 min) ;
- sinon → **demande de réinitialisation assistée** : le candidat saisit son téléphone ; une tâche apparaît chez son référent (ou Non attribués). Le référent vérifie l'identité (au moins 2 informations du profil : date ou lieu d'une expérience, quartier, métier recherché), puis génère un lien à usage unique (30 min) qu'il envoie par « Envoyer sur WhatsApp ». Vérification et génération journalisées.

**RG-08** Changement de numéro de téléphone : procédure assistée uniquement (référent), journalisée.

## 4. Espace personnel

**RG-09** Tableau de bord du candidat : complétude du profil (%), statut « en recherche / plus en recherche », propositions en attente d'accord, candidatures et leur statut, dernière mise à jour.

**RG-10** Le candidat peut modifier toutes les rubriques du profil, remplacer son CV, ajouter / supprimer des justificatifs, et basculer « Je suis toujours en recherche » / « Je ne cherche plus » (ce dernier passe son statut à « indisponible »).

**RG-11** Rappel de mise à jour : bandeau si le profil n'a pas été mis à jour depuis 6 mois.

**RG-12** Le candidat ne voit jamais : les notes internes, son statut interne détaillé (présélectionné…), les autres candidats, les budgets des clients.

## 5. Propositions en attente d'accord (ADR 0017)

**RG-13** Pour chaque Proposition en attente, le candidat voit : intitulé du poste, secteur, ville / quartier, type de contrat, horaires, **nom du client**, et le salaire si le client a autorisé sa communication. Boutons « J'accepte d'être présenté(e) » / « Je refuse » (motif facultatif).

**RG-14** Réponse horodatée et journalisée ; le référent est notifié. Une Proposition sans réponse sous 72 h est signalée au référent (qui peut recueillir l'accord par WhatsApp, cf. MVP2-03).

## 6. Suppression des données (ADR 0017)

**RG-15** Bouton « Supprimer mon compte et mes données », avec confirmation par mot de passe et explication de ce qui est conservé (placements et pièces financières pseudonymisés).

**RG-16** La demande bloque immédiatement le compte (connexion impossible, profil retiré des recherches et des propositions en cours, qui passent à « refusée — retrait du candidat »). Elle est exécutée **sous 30 jours** par une tâche planifiée (délai minimal 7 jours pour permettre l'annulation via le référent).

**RG-17** Exécution : suppression du profil, des expériences, des fichiers (CV, justificatifs) ; Candidatures supprimées ; Propositions et Placements conservés avec le candidat remplacé par un pseudonyme (« Candidat #8F3A ») ; journal d'audit conservé (il ne contient pas le contenu des CV). Les sauvegardes purgent la donnée à rotation (30 jours).

**RG-18** Une confirmation est affichée à la demande ; un e-mail est envoyé à l'exécution si une adresse existait.

## 7. Critères d'acceptation

- **RG-03** — *Étant donné* un formulaire complet avec seulement le consentement (a) coché, *quand* le candidat valide, *alors* l'inscription est refusée et la case (b) est signalée.
- **RG-04** — *Étant donné* un candidat inscrit avec `+237677000000`, *quand* quelqu'un tente de s'inscrire avec `677 00 00 00`, *alors* l'inscription est refusée avec le lien « Mot de passe oublié ».
- **RG-07** — *Étant donné* un candidat sans e-mail qui demande une réinitialisation, *quand* il valide son numéro, *alors* une tâche « réinitialisation assistée » apparaît chez son référent et aucun lien n'est envoyé automatiquement.
- **RG-10** — *Étant donné* un candidat qui coche « Je ne cherche plus », *quand* un référent filtre les candidats disponibles, *alors* ce candidat n'apparaît pas.
- **RG-13** — *Étant donné* une Proposition dont le client n'a pas autorisé la communication du salaire, *quand* le candidat la consulte, *alors* le salaire n'est pas affiché.
- **RG-16** — *Étant donné* un candidat qui demande la suppression, *quand* il tente de se reconnecter, *alors* la connexion est refusée avec un message indiquant la suppression en cours.
- **RG-17** — *Étant donné* un candidat placé qui a demandé la suppression, *quand* la tâche s'exécute, *alors* son CV n'existe plus sur le disque, et le Dossier client affiche le placement avec un pseudonyme.

## 8. Cas limites

- Candidat sans smartphone ou peu à l'aise : inscription assistée par un référent depuis le Back-Office (« Inscrire un candidat »), consentements recueillis oralement puis confirmés par WhatsApp (capture jointe) ; le candidat reçoit un lien d'activation pour définir son mot de passe.
- Candidat mineur : date de naissance non demandée en V1 ; case « Je certifie avoir au moins 18 ans, ou l'âge légal pour le type de contrat recherché » ajoutée aux consentements (stages / jobs étudiants à valider par la direction).
- CV photographié (JPEG) : accepté.
- Profil en double sous deux numéros : fusion par la Direction (journalisée), le numéro conservé devient l'identifiant.
