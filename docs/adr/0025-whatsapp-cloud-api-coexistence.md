# ADR 0025 – WhatsApp Business Platform (Cloud API) en coexistence sur le numéro commercial

- **Statut :** proposé (en attente de l'accord de NEXCLEAN sur le devis technique)
- **Date :** 2026-11-10
- **Décideur :** Ange
- **Remplace partiellement :** ADR 0005 (ligne « Hors V1 : API WhatsApp Business ») ; avance le point 7 de l'ADR 0023

## Contexte

La direction demande une messagerie centralisée : les demandes WhatsApp reçues sur le numéro commercial (+237 696 370 479, géré par Stéphanie) doivent arriver dans le Back-Office, avec réponses automatiques et reprise manuelle. Contraintes posées : **aucune perturbation de l'activité**, **aucune migration de numéro sans accord**.

L'ADR 0005 écartait l'API pour trois raisons : vérification d'entreprise, coût, immobilisation du numéro. Le mode **coexistence** de Meta lève la troisième : le numéro reste utilisable dans l'application WhatsApp Business du téléphone **et** est branché sur la Cloud API ; les messages sont synchronisés dans les deux sens.

## Décision

1. **Cloud API officielle de Meta**, sans fournisseur intermédiaire (BSP) imposé : webhooks reçus par l'application Next.js, envoi via l'API Graph. Jeton système stocké en variable d'environnement sur le VPS, jamais en base ni dans le code.
2. **Coexistence** sur le numéro commercial, **après** validation complète sur le **numéro de test Meta**. Aucun branchement du numéro réel sans accord écrit de NEXCLEAN.
3. **Vérifications préalables (bloquantes)** avant tout branchement du numéro réel :
   - le numéro est sur l'application **WhatsApp Business** (pas WhatsApp classique) ;
   - la coexistence est disponible pour un numéro camerounais ;
   - liste des fonctions perdues côté application (listes de diffusion, etc.) validée par Stéphanie ;
   - vérification de l'entreprise dans le Meta Business Manager de NEXCLEAN.
4. **Compte Meta Business détenu par NEXCLEAN** ; le développeur y est ajouté avec un rôle limité. Aucun mot de passe partagé.
5. **Repli** : si la coexistence n'est pas possible, on garde le fonctionnement actuel (wa.me, ADR 0005) et on étudie un **second numéro** dédié à l'API. Pas de migration du numéro commercial.
6. Livraison en **deux étapes** : réception seule (COM2-01), puis réponses depuis le Back-Office (COM2-02).

## Conséquences

- Facturation Meta au message (modèles marketing / utilitaires payants ; réponses dans la fenêtre de service ouverte par le client, en principe gratuites). Grille Cameroun à vérifier au moment du devis.
- Tout message à l'initiative de NEXCLEAN hors fenêtre de 24 h passe par un **modèle approuvé** et exige l'**accord préalable** du destinataire (opt-in). Le contact à froid sur WhatsApp est exclu (voir ADR 0027) : il dégrade la note de qualité du numéro et peut mener à sa suspension.
- L'interface de canal de notification prévue par l'ADR 0005 reçoit une implémentation « WhatsApp API » ; le canal « WhatsApp-lien » reste disponible en repli.

## Complément (novembre 2026) : voie de raccordement

La documentation Meta réserve l'inscription des numéros de l'application WhatsApp Business (coexistence) à l'**inscription intégrée** (Embedded Signup), ouverte aux *Tech Providers* et *Solution Partners*. Un numéro de l'application ne peut pas être raccordé depuis la console comme le numéro de test : « Ajouter un numéro de téléphone » impose de supprimer le compte de l'application.

Option retenue (A) : l'application Meta de NEXCLEAN suit le parcours *Tech Provider* et le Back-Office porte sa propre page d'inscription (Messagerie > Raccorder un numéro). Avant examen de l'application, Meta permet 10 inscriptions par semaine, réalisables par les administrateurs de l'application : suffisant pour le numéro commercial. Le jeton d'entreprise issu de l'inscription sert uniquement à finaliser (abonnement des webhooks, synchronisation des contacts et de l'historique dans les 24 h) et n'est pas conservé ; l'exploitation continue avec le jeton de l'utilisateur système, auquel le nouveau compte est attribué.

Options écartées pour l'instant : partenaire officiel (abonnement mensuel), second numéro dédié (reste le repli du point 5).
