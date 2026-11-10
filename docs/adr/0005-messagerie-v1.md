# ADR 0005 – Messagerie V1 : WhatsApp en clic (wa.me), e-mail transactionnel, notifications internes

- **Statut :** accepté — partiellement remplacé par l'ADR 0025 (proposé) pour l'API WhatsApp Business
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

WhatsApp est le canal principal des clients et candidats ; le site utilise déjà des liens `wa.me` préremplis. Resend est déjà intégré pour l'API candidature. L'API WhatsApp Business (Meta) impose vérification d'entreprise, modèles approuvés, coût par conversation et immobilise le numéro. Beaucoup d'utilisateurs n'ont pas d'e-mail actif.

## Décision

| Flux | V1 |
|---|---|
| **Interne** (attribution, relances) | Notification dans le Back-Office + e-mail Resend au collaborateur |
| **Vers client / candidat** | **Modèles de message WhatsApp préremplis** ouverts en un clic depuis le dossier (`wa.me`) ; envoi tracé dans l'historique du dossier ; e-mail Resend en complément si une adresse est connue |
| **Accusé de réception** | Affiché à l'écran après soumission (numéro de demande + estimation), avec option « recevoir sur WhatsApp » |

- Les **modèles de messages** font partie de la bibliothèque de modèles administrable.
- Un document envoyé par message l'est via un **lien d'accès temporaire et à portée limitée** (expiration, révocable, journalisé), jamais une URL publique permanente (ADR 0003).
- Le code expose une **interface de canal de notification** (in-app, e-mail, WhatsApp-lien, puis WhatsApp API / SMS).
- **Hors V1** : API WhatsApp Business, SMS.

## Conséquences

- Aucun envoi automatique vers les clients/candidats en V1 : « Valider et envoyer » ouvre WhatsApp, le référent appuie sur Envoyer. Le système enregistre l'intention d'envoi, pas la remise effective.
- Les relances vers clients/candidats sont des **rappels au référent**, pas des messages automatiques.
- L'authentification des candidats ne peut pas s'appuyer sur un code SMS/WhatsApp automatique en V1 : à trancher séparément.
