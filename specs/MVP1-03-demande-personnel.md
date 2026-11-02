# MVP1-03 – Formulaire « Demander du personnel »

ADR de référence : 0006, 0008, 0014, 0021, 0022.

## 1. User stories

- En tant que **client**, je veux décrire sur mon téléphone, en quelques minutes, le personnel dont j'ai besoin (un ou plusieurs postes) afin que NEXCLEAN me rappelle avec une proposition.
- En tant que **client**, je veux recevoir immédiatement un numéro de dossier et une estimation afin de savoir à quoi m'attendre.
- En tant que **référent recrutement**, je veux recevoir des demandes complètes et structurées afin de qualifier le besoin sans tout redemander.

## 2. Point d'entrée

**RG-01** Rubrique « Recrutement & Placement de personnel » sur la page `/recrutement` (au-dessus des offres) et dans la navigation, avec un bouton visible **« Demander du personnel »** menant à `/recrutement/demander-du-personnel`. Lien également depuis `/professionnels`.

**RG-02** La page est rendue côté serveur, légère (objectif : interactive en < 3 s sur 3G simulée), et fonctionne sans compte.

## 3. Formulaire

Formulaire en **étapes** sur mobile (barre de progression), toutes les données conservées localement en cas de retour arrière ou de perte de réseau (brouillon dans le navigateur).

### Étape 1 – Vous

| Champ | Obligatoire | Règle |
|---|---|---|
| Vous êtes | oui | Entreprise / organisation, ou Particulier |
| Entreprise / organisation | oui si entreprise | ≤ 120 car. |
| Nom du contact | oui | ≤ 80 car. |
| Numéro WhatsApp | oui | Normalisé E.164, +237 par défaut |
| Autre téléphone | non | idem |
| E-mail | non | format e-mail |

### Étape 2 – Lieu

| Champ | Obligatoire | Règle |
|---|---|---|
| Ville | oui | Référentiel (villes couvertes en tête) + « Autre ville » (texte) |
| Arrondissement | non | Référentiel filtré par ville |
| Quartier | oui | Référentiel filtré, ou « Autre quartier » (texte) |
| Lieu d'affectation / point de repère | non | ≤ 200 car. |
| Secteur d'activité | oui | Liste : hôtellerie, restauration, commerce, industrie, logistique, administration, santé, immobilier, services à domicile, autre |

### Étape 3 – Postes (répétable, 1 à 10 lignes de poste)

| Champ | Obligatoire | Règle |
|---|---|---|
| Intitulé du poste | oui | Saisie libre avec suggestions (liste de métiers paramétrable) |
| Nombre de personnes | oui | entier 1 à 100 |
| Missions principales | oui | ≤ 1 000 car. |
| Compétences souhaitées | non | ≤ 500 car. |
| Expérience souhaitée | oui | Débutant accepté / < 1 an / 1–3 ans / 3–5 ans / > 5 ans |
| Salaire / budget mensuel (FCFA) | non | entier ou fourchette ; mention « confidentiel, non publié sans votre accord » |
| Type de contrat | oui | CDI, CDD, stage, job étudiant, temps partiel, alternance, mission ponctuelle, saisonnier |
| Durée du contrat | si CDD / mission / saisonnier / stage | texte court |
| Horaires | non | texte court |
| Jours de repos | non | sélection multiple des jours |
| Avantages | non | ≤ 300 car. (logement, repas, transport…) |
| Date de prise de fonction souhaitée | oui | date ≥ aujourd'hui, ou « Dès que possible » |

Boutons « Ajouter un autre poste » et « Dupliquer ce poste ».

### Étape 4 – Récapitulatif et envoi

- Récapitulatif lisible de toutes les lignes, avec modification possible par étape.
- **Estimation affichée avant envoi** (RG-05).
- Case obligatoire : « J'accepte que NEXCLEAN traite ces informations pour répondre à ma demande et me contacte sur WhatsApp » (lien vers la politique de confidentialité).
- Protection anti-robot invisible (champ piège + limitation de débit par IP : 10 envois / 10 min, comme l'API actuelle).

## 4. Règles métier

**RG-03** L'envoi crée en une transaction : Client (ou rattachement, MVP1-02 RG-03), Demande immuable, Dossier `REC` avec ses lignes de poste, puis déclenche l'attribution (MVP1-05).

**RG-04** Le nombre total de personnes = somme des lignes de poste.

**RG-05** Estimation = commission par personne en vigueur × nombre total de personnes. En MVP-1, la commission est un **paramètre unique** administrable par Direction / Administrateur (défaut 5 000 FCFA), sans grille tarifaire complète (MVP-2). Affichage : « Estimation indicative : 50 000 FCFA (10 personnes × 5 000 FCFA). Montant définitif sur devis, payable selon les placements effectivement réalisés. » La TVA n'est pas mentionnée dans l'estimation (régime fiscal en attente, QO-2).

**RG-06** L'estimation affichée et le tarif utilisé sont enregistrés dans la Demande (preuve de ce qui a été montré).

**RG-07** Le salaire / budget saisi est une donnée confidentielle : visible uniquement par le référent du Dossier et la Direction (ADR 0018), jamais affiché sur la page de suivi.

## 5. Écran de confirmation

**RG-08** Après envoi : numéro de dossier en grand, estimation, délai de rappel annoncé (« Un conseiller vous contacte sous 24 h ouvrées »), lien de la page de suivi, et deux boutons :
- « Recevoir le récapitulatif sur WhatsApp » : ouvre WhatsApp vers le numéro NEXCLEAN avec un message prérempli (numéro, nombre de personnes, postes, lien de suivi) ;
- « Copier le lien de suivi ».

**RG-09** Si un e-mail a été saisi, un accusé de réception est envoyé par e-mail (Resend) avec les mêmes informations.

## 6. Critères d'acceptation

- **RG-03 / RG-04** — *Étant donné* un formulaire valide avec 2 lignes (3 serveurs, 2 cuisiniers), *quand* le client l'envoie, *alors* un seul Dossier `REC` est créé avec 2 lignes de poste et un total de 5 personnes.
- **RG-05** — *Étant donné* une commission paramétrée à 5 000 FCFA, *quand* le client arrive au récapitulatif avec 5 personnes, *alors* il voit « Estimation indicative : 25 000 FCFA ».
- **RG-06** — *Étant donné* une Demande envoyée avec une commission de 5 000, *quand* la Direction modifie ensuite la commission à 6 000, *alors* la Demande conserve « 5 000 × 5 = 25 000 ».
- **RG-07** — *Étant donné* un Dossier avec un budget de 80 000 FCFA, *quand* un Référent non attribué ou le client via la page de suivi le consulte, *alors* le budget n'apparaît pas.
- **Brouillon** — *Étant donné* un client à l'étape 3 qui perd le réseau et recharge la page, *quand* la page revient, *alors* les étapes 1 à 3 sont pré-remplies.
- **Validation** — *Étant donné* une ligne de poste en CDD sans durée, *quand* le client passe à l'étape suivante, *alors* le champ durée est signalé comme obligatoire.
- **Mobile** — *Étant donné* un écran de 375 px, *quand* le client remplit le formulaire, *alors* aucun défilement horizontal n'apparaît et les champs numériques ouvrent le clavier numérique.

## 7. Cas limites

- Plus de 100 personnes sur une ligne, ou plus de 10 lignes : message « Pour un besoin de cette taille, contactez-nous directement » + bouton WhatsApp ; l'envoi reste possible en saisissant la valeur maximale et un commentaire.
- Échec serveur à l'envoi : message d'erreur et bouton de repli « Envoyer ma demande sur WhatsApp » avec le récapitulatif complet (aucune donnée perdue).
- Particulier qui cherche une aide à domicile : même parcours, secteur « services à domicile ».
- Ville « Autre » : Dossier créé normalement, attribution en Non attribués (MVP1-05).
