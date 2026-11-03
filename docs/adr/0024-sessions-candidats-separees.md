# ADR 0024 – Sessions candidats séparées de celles des collaborateurs

- **Statut :** accepté
- **Date :** 2026-11-03
- **Décideur :** Ange (sur proposition technique)
- **Précise :** ADR 0016 (authentification)

## Contexte

L'ADR 0016 fixe deux publics aux règles opposées.
- **Collaborateurs :** e-mail, mot de passe, double authentification obligatoire selon le rôle, session de 8 h glissante (M1-AUT-05). Ils sont gérés par Better Auth, avec les tables `user`, `session` et `account`.
- **Candidats :** téléphone, mot de passe d'au moins 8 caractères ou code à 6 chiffres, pas de double authentification, session de 30 jours avec « rester connecté » ou de 24 h sinon (MVP2-01 RG-06). Ils peuvent se réinitialiser sans e-mail, de façon assistée.

Faire entrer les candidats dans l'instance Better Auth existante obligerait à :
- partager la table `user`, et donc à garantir partout qu'un compte candidat n'obtient jamais un rôle ni l'accès au Back-Office ;
- plier une seule configuration de sessions et de mots de passe à deux politiques différentes ;
- détourner l'identifiant e-mail pour y loger un téléphone.

## Décision

1. Les candidats ont leur **propre mécanisme de session**, indépendant de Better Auth :
   - tables `candidat_session` et `candidat_jeton` ;
   - cookie `nexclean_candidat`, `HttpOnly`, `SameSite=Lax` et `Secure` en HTTPS ;
   - jeton aléatoire de 256 bits, dont seule l'empreinte SHA-256 est stockée.
2. Mots de passe hachés en **Argon2id** avec les mêmes paramètres que les collaborateurs (`lib/auth/mot-de-passe.ts`).
3. Durée de session : **30 jours** si « rester connecté », **24 h** sinon, à compter de la connexion. Les sessions d'un candidat sont supprimées à la déconnexion, au changement de mot de passe et à la demande de suppression du compte.
4. **Verrouillage :** 5 échecs en 15 min pour un même numéro ou une même adresse IP, puis blocage de 15 min. Les échecs sont comptés dans le journal d'audit, comme pour les collaborateurs (M1-AUT-06).
5. Le Back-Office ne lit jamais le cookie candidat, et l'espace candidat ne lit jamais la session Better Auth. Aucune route n'accepte les deux.

## Conséquences

- Une faille ou une erreur de configuration côté candidat ne peut pas ouvrir le Back-Office.
- Un peu de code propre est à maintenir : création et lecture de session, verrouillage, jetons. Il réutilise les briques existantes : Argon2, empreintes de jetons, journal d'audit.
- Les jetons de réinitialisation, envoyés par e-mail ou générés par un référent, vivent dans `candidat_jeton` : à usage unique, 30 min, seule l'empreinte est stockée.
