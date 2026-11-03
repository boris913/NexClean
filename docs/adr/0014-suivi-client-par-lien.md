# ADR 0014 – Pas de compte client en V1 : page de suivi par lien sécurisé

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le Client doit suivre son Dossier, consulter devis / contrats / reçus / factures, accepter un devis et, à terme, payer en ligne. Les clients sont souvent ponctuels, utilisent WhatsApp et ne gèrent pas de mots de passe ; aucun OTP SMS n'est disponible en V1 (ADR 0005).

## Décision

- **Pas de compte client en V1.**
- Chaque Dossier dispose d'une **page de suivi** accessible par un **lien unique non devinable** (jeton aléatoire long), envoyé par WhatsApp avec l'accusé de réception.
- La page affiche : statut et historique simplifié, documents destinés au Client, bouton **« J'accepte le devis »**, et en L5 le paiement en ligne.
- **Vérification légère** : saisie des **4 derniers chiffres du numéro WhatsApp** du Client avant d'afficher les documents ou d'accepter un devis ; limitation du nombre d'essais.
- **Preuve d'acceptation** : nom et fonction saisis, horodatage, adresse IP, version du devis acceptée — enregistrés dans l'historique.
- Le lien est **révocable et régénérable** par le référent ; chaque consultation est journalisée.

## Conséquences

- Zéro friction pour le Client ; preuve d'acceptation exploitable.
- Sécurité dépendante de la confidentialité du lien : atténuée par la vérification, la révocation, l'expiration à la clôture du Dossier (+ délai) et la journalisation.
- Un espace client avec compte (multi-dossiers, historique) pourra venir plus tard sans remettre en cause ce mécanisme.
