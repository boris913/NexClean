# ADR 0019 – Attribution automatique : algorithme fixe à paramètres administrables

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le brief demande une attribution automatique « selon des règles configurables » (ville, service, compétence, disponibilité, charge), avec notification, vision globale et réaffectation par la direction. Deux files sont concernées : Dossiers et Nouveaux candidats (ADR 0015).

## Décision

Pas de moteur de règles générique. **Algorithme fixe** alimenté par des **attributs administrables** du collaborateur : services, villes couvertes, disponibilité (actif / absent du … au …), capacité maximale optionnelle.

Ordre d'application :
1. **Continuité client** : même référent que le dernier Dossier du Client (ouvert ou clos depuis < 12 mois) s'il est disponible et qualifié.
2. Filtre **service** et **ville**.
3. Exclusion des **absents** et des référents à **capacité** atteinte.
4. **Charge minimale** (Dossiers ouverts, phases antérieures à « Terminé »).
5. Égalité → **tour de rôle** (dernière attribution la plus ancienne).

Aucun candidat éligible (ou ville hors couverture) → file **« Non attribués »**, notification immédiate à la direction, relance si non traité sous un délai paramétrable (défaut : 4 heures ouvrées).

Autres règles :
- **Réaffectation** par la direction, avec motif, journalisée ; notification au nouveau référent.
- Chaque attribution enregistre la **règle appliquée** (continuité, charge minimale, tour de rôle, manuelle).
- Les **Nouveaux candidats** suivent le même algorithme (service « Recrutement », ville du candidat).

## Conséquences

- Comportement prévisible et explicable ; paramétrage limité aux attributs, délai d'escalade et fenêtre de continuité.
- Ajouter un critère d'attribution nécessite une évolution du code.
- Les heures ouvrées doivent être paramétrées (cf. `BUSINESS_HOURS` existant dans `lib/constants.ts`).
