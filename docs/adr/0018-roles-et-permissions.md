# ADR 0018 – Rôles et permissions

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Décision

Quatre **rôles combinables** ; les spécialités (services, villes) sont des **attributs du collaborateur**, utilisés pour l'attribution, pas des rôles.

| Permission | Référent | Responsable finances | Direction | Administrateur |
|---|---|---|---|---|
| Voir ses dossiers attribués + file « Nouveaux candidats » de ses villes | ✅ | — | ✅ | — |
| Voir tous les dossiers | ❌ | lecture | ✅ | ❌ |
| Qualifier, préparer un devis, « Valider et envoyer » | ✅ (siens) | — | ✅ | — |
| Voir salaires / budgets des lignes de poste | ✅ (siens) | ❌ | ✅ | ❌ |
| Consulter CV / profils candidats | ✅ si service recrutement | ❌ | ✅ | ❌ |
| Enregistrer un encaissement | ✅ (siens) | ✅ | ✅ | ❌ |
| Valider remboursement / acompte hors bornes | ❌ | ❌ | ✅ | ❌ |
| Réaffecter un dossier | ❌ | ❌ | ✅ | ❌ |
| Tableau de bord financier | ❌ (ses indicateurs) | ✅ | ✅ | ❌ |
| Exporter des données | ❌ | ✅ (finances) | ✅ | ❌ |
| Modifier la grille tarifaire | ❌ | ❌ | ✅ | ✅ |
| Gérer modèles de documents / messages | ❌ | ❌ | ✅ | ✅ |
| Gérer comptes et rôles | ❌ | ❌ | ❌ | ✅ |
| Consulter le journal d'audit | ❌ | ❌ | ✅ | ✅ |

Principes :
- **Administrateur = rôle technique**, sans accès aux données métier sauf cumul de rôle (distinct de la Direction).
- **Responsable finances** conservé (enregistrement des encaissements, suivi des impayés, exports financiers).
- **Contrôle côté serveur** à chaque requête ; l'interface ne fait que refléter les droits.
- **Journalisation** des actions sensibles : consultation de CV, export, encaissement, modification de tarif, réaffectation, changement de rôle.
- Matrice **définie dans le code** ; l'administrateur attribue des rôles, pas des permissions unitaires (pas d'éditeur de permissions en V1).

## Conséquences

- Toute évolution de la matrice passe par le code et un nouvel ADR ou une révision de celui-ci.
- Un collaborateur cumulant Administrateur + Direction a un accès complet : à réserver à un nombre minimal de personnes, 2FA obligatoire (ADR 0016).
