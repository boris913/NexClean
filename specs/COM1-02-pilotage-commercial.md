# COM1-02 – Pilotage commercial : rendez-vous, tableau de bord, rapport hebdomadaire

ADR de référence : 0007, 0018, 0020. Réutilise Dossiers, Devis, Factures et Encaissements existants : **aucune entité « prospect » parallèle**. Un prospect est un Dossier en phase *Nouveau*, *En qualification* ou *Devis*.

## 1. User stories

- En tant que **référent**, je veux planifier un rendez-vous (visite, appel, entretien) sur un Dossier et en être rappelé.
- En tant que **direction**, je veux voir en un écran les nouveaux prospects, les demandes en attente, les devis envoyés, les contrats signés, les prestations réalisées et le chiffre d'affaires.
- En tant que **direction et Stéphanie**, je veux recevoir chaque lundi un rapport hebdomadaire exploitable.

## 2. Rendez-vous

**RG-01** Entité **Rendez-vous** rattachée à un Dossier : type (`visite_site`, `appel`, `entretien`, `reunion`), date et heure (Africa/Douala), lieu ou lien, participants (collaborateurs), statut (`prevu`, `fait`, `annule`, `non_honore`), compte rendu.

**RG-02** Rappel in-app + e-mail au référent la veille à 18 h et 1 h avant. Un rendez-vous passé resté `prevu` 24 h après remonte dans « À relancer ».

**RG-03** Vue agenda (jour / semaine) filtrable par référent et par ville.

## 3. Contrat

**RG-04** « Contrat signé » = **Devis accepté** (MVP2-04), y compris l'abonnement. On n'introduit pas de nouvelle entité ; un document signé peut être joint au Dossier (ADR 0003). « Prestation réalisée » = Dossier entré en phase *Terminé*.

## 4. Tableau de bord commercial

**RG-05** Page `/admin/commercial` (permission `commercial.tableau_de_bord` : direction ; référent limité à ses Dossiers). Période sélectionnable comme MVP1-05 RG-18.

**RG-06** Indicateurs, tous calculés en SQL sur les phases (ADR 0007) et les définitions de l'ADR 0020 :

| Indicateur | Définition |
|---|---|
| Nouveaux prospects | Dossiers créés sur la période |
| Demandes en attente | Dossiers en phase *Nouveau* ou *En qualification*, avec ancienneté |
| Sans réponse > 24 h | Dossiers sans action humaine depuis leur création |
| Devis envoyés / acceptés | Devis au statut envoyé / accepté sur la période ; taux de transformation |
| Prestations réalisées | Dossiers passés en *Terminé* |
| CA facturé / encaissé | ADR 0020 |
| Délai moyen de première réponse | Création du Dossier → première action sortante |

**RG-07** Ventilation de chaque indicateur par **source** (COM1-01), **ville**, **service** et **référent**. Entonnoir source → Dossier → Devis → Accepté → Encaissé.

**RG-08** Export CSV (permission `export.donnees`, journalisé).

## 5. Rapport hebdomadaire

**RG-09** Généré chaque lundi à 7 h (tâche planifiée `scripts/taches.ts`) pour la semaine écoulée, envoyé par e-mail aux collaborateurs Direction et aux destinataires désignés (paramètre), consultable dans le Back-Office.

**RG-10** Contenu : indicateurs RG-06 avec l'écart par rapport à la semaine précédente, top 3 sources, Dossiers en souffrance (liste), relances à faire, rendez-vous de la semaine à venir. En COM3-01, un paragraphe de commentaire rédigé par l'IA s'ajoute, **sans jamais remplacer les chiffres**.

**RG-11** L'e-mail ne contient ni salaire ni montant individuel par client ; uniquement des agrégats et des liens (connexion requise).

## 6. Critères d'acceptation

- **RG-02** — *Étant donné* un rendez-vous prévu demain à 10 h, *alors* le référent reçoit un rappel aujourd'hui à 18 h et demain à 9 h.
- **RG-06** — *Étant donné* 10 Dossiers créés et 4 devis acceptés sur la période, *alors* le taux de transformation affiché est 40 %.
- **RG-09** — *Étant donné* le lundi 7 h, *alors* le rapport de la semaine du lundi au dimanche précédents est envoyé une seule fois (relance idempotente).
