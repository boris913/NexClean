# Spécifications – NEXCLEAN Recrutement & Back-Office

Spécifications par lot, base de l'implémentation pilotée par les specs. Elles s'appuient sur le vocabulaire de [`CONTEXT.md`](../CONTEXT.md) et les décisions de [`docs/adr/`](../docs/adr/). En cas de conflit, un ADR accepté prime ; toute divergence découverte pendant l'implémentation donne lieu à une révision de la spec ou à un nouvel ADR, jamais à un écart silencieux.

## Conventions

- **Identifiants** : chaque exigence a un identifiant stable (`M1-SOC-03`, `M1-DOS-12`…) cité dans les tests et les commits.
- **User stories** : « En tant que … je veux … afin de … ».
- **Critères d'acceptation** : format Given / When / Then (en français : *Étant donné / Quand / Alors*), chacun automatisable.
- **Règles métier** : numérotées `RG-xx` dans chaque fichier.
- **Cas limites** : listés explicitement ; un cas limite non listé est une question, pas une liberté.
- **Fuseau horaire** : `Africa/Douala` (UTC+1, sans heure d'été) pour tout horodatage affiché et tout calcul d'heures ouvrées.
- **Montants** : entiers en FCFA (pas de décimales), stockés HT.
- **Téléphones** : stockés au format E.164 ; pays par défaut Cameroun (+237).

## MVP-1 – « Tout arrive dans le Back-Office » (ADR 0023)

| Fichier | Contenu |
|---|---|
| [MVP1-01-socle.md](MVP1-01-socle.md) | Hébergement, sauvegardes, supervision, comptes collaborateurs, rôles, journal d'audit, référentiel géographique, stockage des documents |
| [MVP1-02-dossiers.md](MVP1-02-dossiers.md) | Client, Demande, Dossier, numérotation, statuts et transitions, historique, saisie manuelle, rattachement, page de suivi |
| [MVP1-03-demande-personnel.md](MVP1-03-demande-personnel.md) | Formulaire « Demander du personnel », lignes de poste, estimation, confirmation |
| [MVP1-04-formulaires-devis.md](MVP1-04-formulaires-devis.md) | Migration des formulaires de devis en « enregistrer puis WhatsApp » |
| [MVP1-05-attribution-notifications.md](MVP1-05-attribution-notifications.md) | Attribution automatique, Non attribués, réaffectation, notifications, modèles de messages, compteurs |

## Hypothèses de dimensionnement (ADR 0023)

5 collaborateurs au démarrage ; 50–300 dossiers / mois ; 1 000–5 000 candidats la première année ; fichiers ≤ 5 Mo.

## Définition de « terminé » (MVP-1)

- Tous les critères d'acceptation des fichiers MVP1-* passent en tests automatisés (unitaires / intégration / bout en bout sur les parcours principaux, sur mobile 375 px).
- Restauration d'une sauvegarde testée sur un environnement vierge.
- Documentation d'exploitation à jour (déploiement, sauvegarde/restauration, création de comptes).
