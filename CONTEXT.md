# CONTEXT – NEXCLEAN : Recrutement, Espace Candidats et Back-Office

Langage commun du projet. Chaque terme a **un seul sens**. En cas de doute, ce fichier fait foi ; les décisions qui le justifient sont dans `docs/adr/`.

> Statut : glossaire figé à l'issue de la session de cadrage du 2026-11-02 (ADR 0001–0023).

## Contexte technique (résumé)

- Application Next.js unique : site public, espace candidat, Back-Office (ADR 0001).
- Hébergement complet sur VPS Contabo UE, PostgreSQL auto-hébergé (ADR 0002).
- Documents stockés en interne, accès contrôlé par l'application (ADR 0003).
- Encaissements enregistrés manuellement en V1, agrégateur Mobile Money en L5 (ADR 0004).
- Messages clients/candidats par WhatsApp en un clic, e-mail en complément (ADR 0005).
- Langue : **français uniquement en V1** ; chaque modèle de document / message porte une langue, pour pouvoir produire une version anglaise sans développement.
- Formulaires du site : « enregistrer d'abord, puis WhatsApp », avec repli (ADR 0022). Boutique hors Back-Office en V1.
- Villes couvertes en V1 : Douala et Yaoundé (ADR 0021).

## Glossaire

| Terme | Définition | À ne pas confondre avec |
|---|---|---|
| **Client** | Entreprise, organisation ou particulier qui demande du personnel ou une prestation. Identifié de façon unique par son numéro WhatsApp. | Candidat |
| **Demande** | Soumission unique et immuable (formulaire du site ou saisie par un collaborateur), horodatée, avec son canal d'origine. Rattachée à exactement un Dossier. | Dossier |
| **Dossier** | Unité de travail du Back-Office : un type, un Client, un référent, un statut, un historique, des documents, devis et encaissements. Regroupe une ou plusieurs Demandes. Son numéro est celui communiqué au Client. | Demande |
| **Type de dossier** | Nature du Dossier : recrutement/placement, nettoyage ponctuel, abonnement, espaces verts, partenariat, réclamation… | |
| **Numéro de dossier** | Identifiant communiqué au Client, préfixé par type et séquencé par année (ex. `REC-2026-00042`). | |
| **Ligne de poste** | Dans un Dossier de recrutement, un poste demandé (ex. « serveur ») avec son nombre de personnes et ses conditions (missions, salaire, contrat, horaires…). | Offre |
| **Rattachement** | Action d'un collaborateur qui associe une Demande à un Dossier existant (relance, doublon, complément). | Attribution |
| **Encaissement** | Fait qu'une somme a été reçue pour un Dossier, quel que soit le moyen (espèces, Orange Money, MTN MoMo, virement). Enregistré avec montant, moyen, référence, date, auteur. Déclenche un reçu. | Facture, paiement en ligne |
| **Paiement en ligne** | Canal de collecte via un agrégateur Mobile Money (lot L5). Produit un Encaissement une fois confirmé. | Encaissement |
| **Modèle de message** | Texte prérempli (WhatsApp / e-mail) administrable, alimenté par les données du Dossier. | Modèle de document |
| **Lien d'accès temporaire** | Lien expirant et révocable permettant à un destinataire d'ouvrir un document d'un Dossier. Jamais d'URL publique permanente. | |

### Argent (ADR 0004, 0008, 0009, 0010)

| Terme | Définition | À ne pas confondre avec |
|---|---|---|
| **Grille tarifaire** | Paramètres de prix administrables : commission par personne, taux de TVA, taux d'acompte par défaut et bornes, délai de recherche par défaut, tarifs des autres prestations. | Devis |
| **Commission de placement** | Seul prix payé par le Client pour un placement : montant par personne placée (défaut 5 000 FCFA), stocké HT. Le salaire est versé directement par le Client. | Salaire |
| **Estimation** | Montant indicatif affiché au Client après soumission = commission en vigueur × nombre total de personnes demandées. N'engage pas NEXCLEAN. | Devis |
| **Devis** | Proposition chiffrée validée par un référent, qui engage NEXCLEAN. Fige la commission, le taux de TVA et le taux d'acompte. | Estimation |
| **Avenant** | Modification d'un devis accepté (ex. placements supplémentaires, prolongation du délai de recherche). | |
| **Acompte** | Somme demandée après acceptation du devis : pourcentage du devis TTC (défaut 50 %), ajustable entre bornes avec justification. | Solde |
| **Délai de recherche** | Durée contractuelle (défaut 30 jours après l'acompte) pendant laquelle NEXCLEAN recherche les candidats. | |
| **Clôture de la recherche** | Acte du référent qui fige le nombre de placements confirmés et déclenche le calcul du montant final. | Clôture du dossier |
| **Montant final** | Commission figée × nombre de placements confirmés (TTC). | Montant du devis |
| **Solde** | Montant final − acompte encaissé, lorsqu'il est positif. | |
| **Trop-perçu** | Montant final − acompte encaissé, lorsqu'il est négatif. Donne lieu à un Remboursement ou un Avoir. | |
| **Ajustement** | Opération préparée par le référent qui règle un trop-perçu (remboursement ou avoir). | |
| **Remboursement** | Restitution d'un trop-perçu au Client, validée par la direction, enregistrée comme Encaissement négatif. | Avoir |
| **Avoir** | Crédit au profit d'un Client, imputable sur un futur Dossier. | Remboursement |

### Recrutement et candidats (ADR 0011–0015)

| Terme | Définition | À ne pas confondre avec |
|---|---|---|
| **Candidat** | Demandeur d'emploi inscrit gratuitement, avec un espace personnel. Entité propre, hors modèle Dossier, avec un statut candidat (nouveau, à contacter, présélectionné, entretien, proposé au client, placé, indisponible). | Client |
| **Vivier** | Ensemble des Candidats. | |
| **Offre** | Annonce publique destinée aux candidats (brouillon → publiée → fermée). Origine : une Ligne de poste d'un Dossier (anonymisée) ou un recrutement interne NEXCLEAN. Jamais publiée automatiquement. | Ligne de poste |
| **Recrutement interne** | Embauche par NEXCLEAN pour elle-même ; Offre sans Dossier client ni commission. | Placement |
| **Candidature** | Un Candidat postule à une Offre (reçue → retenue / refusée). | Proposition |
| **Proposition** | Un référent présente un Candidat pour une Ligne de poste (proposée → entretien → retenue / refusée → placée). Exige l'accord du candidat pour ce Client. | Candidature |
| **Placement** | Embauche d'un Candidat par un Client via NEXCLEAN. *Annoncé* tant que la preuve manque ; *confirmé* à la prise de poste, sur attestation confirmée par le Client. Seuls les placements confirmés comptent dans le montant final. | Mise à disposition |
| **Attestation de prise de poste** | Document prérempli confirmé par le Client, preuve d'un Placement confirmé. | |
| **Garantie de remplacement** | Si un candidat placé part dans les 15 jours (à confirmer), NEXCLEAN fournit gratuitement un remplaçant, sans nouvelle commission ni remboursement. | Remboursement |
| **Non-contournement** | Clause contractuelle : tout candidat proposé et embauché par le Client dans les 6 mois (à confirmer) est dû. | |
| **Mise à disposition** | Prestation où NEXCLEAN reste employeur et refacture le Client. Type de dossier capté en V1 avec devis manuel ; métier hors V1. | Placement |
| **Page de suivi** | Page accessible au Client par lien sécurisé (sans compte) : statut, documents, acceptation du devis. | Espace candidat |

## Modèle de domaine (provisoire)

```
Client 1 ──── * Dossier 1 ──── * Demande
                   │
                   ├── * Ligne de poste 1 ── 0..1 Offre ── * Candidature * ── 1 Candidat
                   │          └── * Proposition * ── 1 Candidat
                   │                     └── 0..1 Placement
                   ├── * Document
                   ├── * Encaissement
                   ├── 1 Page de suivi
                   └── * Événement d'historique

Offre (recrutement interne) : sans Ligne de poste ni Dossier.
```

## Cycles de statuts (ADR 0007)

- **Phase** : étape commune à tous les types de dossier, pour le pilotage : Nouveau → En qualification → Devis → Accepté → En exécution → Terminé → Clôturé ; issues : Refusé, Sans suite / Annulé.
- **Statut** : étape détaillée propre à un type de dossier, rattachée à une phase. Porté par le Dossier.
- **Transition** : passage d'un statut à un autre, autorisé par le code, soumis à des conditions de passage et journalisé.
- **À compléter** : statut d'un Dossier auquel il manque des données nécessaires au devis ; aucun devis ne peut en sortir.

Cycle recrutement : Nouvelle demande → Attribuée → En qualification ⇄ À compléter → Devis prêt → Devis envoyé → Accepté → Acompte reçu → Recherche en cours → Candidats proposés → Placements confirmés → Solde reçu → Clôturé.

## Organisation interne (ADR 0016, 0018, 0019)

| Terme | Définition | À ne pas confondre avec |
|---|---|---|
| **Collaborateur** | Employé NEXCLEAN disposant d'un compte Back-Office (créé par l'administrateur, désactivé à son départ). Porte des rôles et des attributs (services, villes, disponibilité, capacité). | Candidat |
| **Rôle** | Référent, Responsable finances, Direction, Administrateur. Combinables. Matrice des droits définie dans le code. | Service |
| **Référent** | Collaborateur auquel un Dossier ou un Candidat est attribué et qui en assure le traitement. | Direction |
| **Administrateur** | Rôle technique : comptes, rôles, paramètres, modèles. Sans accès aux données métier sauf cumul de rôle. | Direction |
| **Attribution** | Affectation automatique d'un Dossier ou d'un nouveau Candidat à un référent (continuité client → service/ville → disponibilité → charge → tour de rôle). La règle appliquée est enregistrée. | Rattachement |
| **Non attribués** | File des Dossiers / Candidats sans référent éligible ; visible par la direction, avec escalade après délai. | |
| **Réaffectation** | Changement de référent par la direction, avec motif, journalisé. | Attribution |
| **Journal d'audit** | Trace immuable des actions sensibles (transitions, encaissements, consultations de CV, exports, changements de tarifs et de rôles). | Historique du dossier |

## Phasage (ADR 0023)

MVP-1 « Tout arrive dans le Back-Office » → MVP-2 « Cycle recrutement complet » → lots ultérieurs.
