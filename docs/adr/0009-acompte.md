# ADR 0009 – Acompte : pourcentage du devis TTC, 50 % par défaut, ajustable entre bornes

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le brief prévoit un acompte après acceptation du devis et du contrat, le solde n'étant exigible qu'après confirmation des placements effectifs. Le montant et la base de calcul n'étaient pas définis.

## Décision

1. L'**Acompte** est calculé sur le **devis accepté** (montant TTC), jamais sur l'Estimation.
2. Taux = paramètre de la grille tarifaire, **50 % par défaut** (choix de la direction), arrondi à la centaine de FCFA supérieure.
3. Le référent peut ajuster le taux dans un dossier **entre des bornes fixées par la direction** (paramètre de la grille) ; toute dérogation est justifiée et journalisée ; hors bornes, validation par la direction.
4. Le taux est **figé dans le devis**.
5. **Solde** = montant final − acompte encaissé, le montant final dépendant des placements effectifs (voir ADR suivant).

Exemple : 10 personnes × 5 000 FCFA = 50 000 FCFA (TVA non applicable) → acompte 25 000 FCFA.

## Conséquences

- Les bornes min/max du taux sont à fixer par la direction (paramètre, valeur initiale proposée : 30 %–100 %).
- La grille tarifaire porte désormais : commission par personne, taux de TVA, taux d'acompte par défaut, bornes d'acompte.
