# ADR 0020 – Dépenses (saisie légère) et définitions des indicateurs financiers

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange
- **Lot :** L7 (pilotage), hors MVP

## Contexte

Le tableau de bord direction doit montrer CA facturé, encaissements, impayés, dépenses, résultat mensuel estimé et marge, en gardant distinctes facturation, encaissement, dépense et résultat. Les dépenses n'existent nulle part dans le système.

## Décision

1. **Module léger de saisie des dépenses** : date, catégorie (paramétrable), montant, moyen de paiement, justificatif (photo/PDF, stockage interne ADR 0003), ville, Dossier optionnel. Saisie par Responsable finances et Direction. **Pas de comptabilité** (ni partie double ni plan comptable) ; **export** pour le comptable. Import CSV possible plus tard.
2. **Définitions uniques** :

| Indicateur | Définition |
|---|---|
| Facturé | Somme TTC des factures émises sur la période |
| Encaissé | Somme des Encaissements de la période, remboursements déduits |
| Impayés | Facturé non encaissé, ventilé par ancienneté |
| Dépenses | Somme des dépenses saisies, par date de dépense |
| Résultat mensuel estimé | Facturé HT − Dépenses (indicatif, non comptable) |
| Trésorerie du mois | Encaissé − Dépenses payées |
| Marge (par dossier / service) | Facturé HT − Dépenses rattachées |

3. **Factures** : numérotation **séquentielle continue**, aucune suppression ni modification après émission ; correction par **avoir**.

## Conséquences

- Les indicateurs ne valent que si les dépenses sont saisies avec discipline : à intégrer dans la formation.
- Marge par dossier ou par service seulement pour les dépenses rattachées ; les charges générales restent au niveau global.
