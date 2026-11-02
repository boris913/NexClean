# ADR 0016 – Authentification : téléphone + mot de passe (candidats), e-mail + mot de passe + 2FA (collaborateurs)

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

L'authentification est intégrée à l'application (ADR 0002). Pas d'OTP SMS / WhatsApp automatique en V1 (ADR 0005). Les candidats n'ont pas toujours d'e-mail ; les collaborateurs accèdent à des données personnelles et financières.

## Décision

### Candidats
- Identifiant : **numéro de téléphone** (normalisé international) + **mot de passe** (≥ 8 caractères, ou code à 6 chiffres).
- **Réinitialisation** :
  - par lien e-mail si une adresse est renseignée ;
  - sinon **réinitialisation assistée** : la demande arrive dans le Back-Office, le référent vérifie l'identité (appel / WhatsApp, questions sur le profil) et envoie par WhatsApp un **lien de réinitialisation à usage unique** (expiration 30 min). L'opération est journalisée.
- OTP SMS : lot ultérieur.

### Collaborateurs
- **E-mail + mot de passe + 2FA TOTP** (application d'authentification), **obligatoire** pour les rôles ayant accès aux données financières, aux exports ou à l'administration ; recommandée pour les autres.
- **Comptes créés par l'administrateur**, pas d'inscription libre ; départ = **désactivation**, jamais suppression.

### Commun
- Expiration des sessions après inactivité ; limitation des tentatives ; journalisation des connexions et échecs ; mots de passe hachés (algorithme moderne type Argon2 / bcrypt).

## Conséquences

- La réinitialisation assistée crée une charge pour les référents et un vecteur d'usurpation (ingénierie sociale) : procédure de vérification à documenter.
- Le numéro de téléphone devient identifiant unique du Candidat ; changement de numéro = procédure assistée.
