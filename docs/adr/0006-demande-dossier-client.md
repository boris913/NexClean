# ADR 0006 – Modèle Demande / Dossier / Client

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le brief emploie « demande » et « dossier » de façon interchangeable. Le Back-Office doit centraliser tous les flux (recrutement, nettoyage, abonnements, espaces verts, partenariats, réclamations), attribuer, tracer et facturer. Ce choix structure tout le schéma de données.

## Décision

- **Demande** : soumission unique et **immuable** (formulaire du site ou saisie par un collaborateur après un appel / message), horodatée, avec canal d'origine.
- **Dossier** : unité de travail du Back-Office, d'un **type** donné, attribuée à un référent, porteuse du cycle de statuts, de l'historique, des documents, devis et encaissements.
- **Client** : entreprise ou particulier, **dédoublonné par numéro WhatsApp** (normalisé au format international).
- Règles :
  1. Toute nouvelle Demande **crée automatiquement un Dossier**.
  2. Un collaborateur peut **rattacher** une Demande à un Dossier existant (relance, doublon, complément) ; un Dossier peut donc regrouper plusieurs Demandes.
  3. Une Demande de personnel à plusieurs postes donne **un seul Dossier** contenant plusieurs **lignes de poste**.
  4. L'inscription d'un candidat n'est pas une Demande (voir décision dédiée).
- Le **numéro communiqué au client est celui du Dossier** (ex. `REC-2026-00042`, préfixe par type, séquence annuelle).

## Conséquences

- La donnée soumise est conservée telle quelle (preuve) ; les corrections se font sur le Dossier, pas sur la Demande.
- Le numéro est attribué à la création du Dossier, donc affichable immédiatement après soumission.
- Le rattachement d'une Demande à un autre Dossier peut laisser un Dossier vide : il est alors clos « sans suite / fusionné » plutôt que supprimé (traçabilité).
- Un même numéro WhatsApp partagé (standard d'entreprise, proche) peut regrouper à tort deux clients : fusion/séparation manuelle de clients à prévoir.
