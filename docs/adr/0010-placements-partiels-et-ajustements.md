# ADR 0010 – Placements partiels, trop-perçu et ajustements

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Une demande de personnel peut n'être que partiellement satisfaite (ex. 10 demandées, 7 placées), ou dépassée. L'acompte (ADR 0009) est calculé sur le devis initial ; le brief exige que le solde ne soit dû qu'après confirmation des placements effectifs.

## Décision

1. **Montant final** = commission figée × nombre de **placements confirmés**.
2. **Délai de recherche** contractuel, **30 jours par défaut** à compter de l'encaissement de l'acompte (paramètre de la grille), prolongeable par avenant. À son terme (ou plus tôt si tous les postes sont pourvus), le référent **clôture la recherche** ; le montant final est alors calculé automatiquement.
3. **Solde** = montant final − acompte encaissé :
   - positif → solde dû par le Client ;
   - négatif → **trop-perçu**.
4. **Trop-perçu** : au choix du Client, **remboursement** (enregistré comme un Encaissement négatif avec référence) ou **avoir** imputable sur un futur Dossier du même Client. Le référent prépare l'**ajustement** ; **tout remboursement est validé par la direction**.
5. **Placements au-delà du devis** : **avenant** au devis ; le montant final porte sur le nombre réel.
6. **L'acompte est intégralement imputable** en V1 (pas de part non remboursable). Un paramètre « part non remboursable de l'acompte » pourra être ajouté si la direction le décide (impact CGV).

## Exemples (devis 10 × 5 000, acompte 25 000)

| Placements confirmés | Montant final | Résultat |
|---|---|---|
| 10 | 50 000 | solde 25 000 |
| 7 | 35 000 | solde 10 000 |
| 4 | 20 000 | trop-perçu 5 000 |
| 0 | 0 | trop-perçu 25 000 |

## Conséquences

- Promesse commerciale claire : « vous ne payez que les personnes placées ».
- Risque : travail de recherche non rémunéré si aucun placement ; à surveiller dans le tableau de bord (taux de dossiers à 0 placement).
- Les CGV et le modèle de contrat doivent mentionner le délai de recherche, le calcul du solde, le remboursement / avoir.
- Nouvelles notions : Avoir, Avenant, Clôture de la recherche.
