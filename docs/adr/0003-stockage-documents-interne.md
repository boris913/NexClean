# ADR 0003 – Stockage interne des documents (« Drive central » intégré au Back-Office)

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le brief demande un « Drive central » : classement automatique des documents de chaque dossier (CV, justificatifs, devis, contrats, factures, reçus), accès selon les droits, et jamais de document RH, de donnée personnelle ou d'information financière public. Les candidats ont un droit à la suppression de leurs données. L'hébergement est un VPS unique (ADR 0002).

## Options envisagées

- **A. Stockage interne** contrôlé par l'application.
- **B. Google Drive / OneDrive** via API.
- **C. A + synchronisation vers Google Drive.**

## Décision

Option **A**.

- Les fichiers sont stockés hors de la racine web, sur le disque du VPS, et ne sont servis que par l'application après **contrôle des droits à chaque téléchargement** (pas d'URL publique permanente).
- Chaque document est **rattaché à un dossier** (et/ou à un candidat) et classé automatiquement ; le « Drive » est une vue de l'application (onglet Documents par dossier + vue globale filtrable selon les droits).
- Les téléchargements et suppressions de documents sont **journalisés**.
- L'accès au stockage passe par une **abstraction compatible S3**, pour permettre une migration ultérieure vers un stockage objet sans réécriture.
- Les documents sont inclus dans les **sauvegardes externes quotidiennes** (ADR 0002).
- Pas de Google Drive en V1.

## Conséquences

- Droits, traçabilité et suppression effective des données candidat maîtrisés en un seul endroit.
- Les collaborateurs n'ont pas d'interface « explorateur de fichiers » familière : l'ergonomie de l'onglet Documents doit compenser.
- La suppression d'un candidat doit aussi purger ses fichiers ; les sauvegardes conservent une copie jusqu'à leur rotation (durée de rétention à fixer et à mentionner dans la politique de confidentialité).
- Surveillance de l'espace disque nécessaire.
