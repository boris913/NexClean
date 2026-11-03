# ADR 0007 – Cycles de statuts : phases communes + statuts détaillés par type de dossier

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le brief décrit deux cycles concurrents : recrutement (7 étapes) et suivi commercial générique (11 étapes). Le tableau de bord direction doit comparer des Dossiers de types différents, tandis que chaque type a ses étapes métier propres.

## Décision

1. **Phases communes** à tous les types de dossier, utilisées pour le pilotage :
   `Nouveau → En qualification → Devis → Accepté → En exécution → Terminé → Clôturé`, plus les issues `Refusé` et `Sans suite / Annulé`.
2. **Statuts détaillés par type**, chacun rattaché à une phase.

   Recrutement / placement :

   | Statut | Phase |
   |---|---|
   | Nouvelle demande | Nouveau |
   | Attribuée | Nouveau |
   | En qualification | En qualification |
   | À compléter | En qualification |
   | Devis prêt | Devis |
   | Devis envoyé | Devis |
   | Accepté (devis et contrat) | Accepté |
   | Acompte reçu | En exécution |
   | Recherche en cours | En exécution |
   | Candidats proposés | En exécution |
   | Placements confirmés | Terminé |
   | Solde reçu | Terminé |
   | Clôturé | Clôturé |
   | Refusé / Sans suite | issues |

   Autres types (nettoyage, abonnement, espaces verts…) : cycle commercial du brief, `En cours` remplaçant les statuts de recherche.
3. Les **transitions autorisées sont définies dans le code** (pas administrables en V1).
4. **Conditions de passage** (gardes), par exemple : `Devis envoyé` exige un devis validé ; `Acompte reçu` exige un Encaissement d'acompte ; aucun devis ne sort d'un dossier `À compléter`.
5. **Chaque transition est journalisée** (auteur, horodatage, ancien/nouveau statut, commentaire).
6. Le statut est porté par le **Dossier** ; l'avancement par ligne de poste s'exprime par le décompte des placements, pas par des statuts par poste.

## Conséquences

- Tableau de bord homogène par phase, détail métier par type.
- Ajouter un type de dossier ou modifier un cycle demande une évolution du code (acceptable : rare et porteur de règles).
- Les cas partiels (ex. 7 placements sur 10) se traitent par les règles de placement et d'ajustement, pas par le cycle de statuts.
