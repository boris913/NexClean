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

## MVP-2 – « Cycle recrutement complet » (ADR 0023)

| Fichier | Contenu |
|---|---|
| [MVP2-01-espace-candidat.md](MVP2-01-espace-candidat.md) | Inscription, consentements, connexion et réinitialisation assistée, espace personnel, accord aux propositions, suppression des données |
| [MVP2-02-vivier-candidatures.md](MVP2-02-vivier-candidatures.md) | File Nouveaux candidats, statuts candidat, candidatures aux offres existantes, recherche et filtres |
| [MVP2-03-propositions-placements.md](MVP2-03-propositions-placements.md) | Propositions avec accord, transmission au client, entretiens, placements, garantie, clôture de la recherche |
| [MVP2-04-tarification-documents.md](MVP2-04-tarification-documents.md) | Grille tarifaire, devis et avenants, « Valider et envoyer », acceptation en ligne, PDF, factures et avoirs |
| [MVP2-05-encaissements.md](MVP2-05-encaissements.md) | Encaissements manuels, gardes de statut, montant final, solde, trop-perçu, remboursement, crédit client |

Le MVP-2 remplace, pour les Dossiers `REC` uniquement, le mode transitoire de MVP1-02 RG-16. Les autres types de dossier le conservent jusqu'à l'arrivée de la grille des prestations.

## Acquisition commerciale – lots COM (ADR 0025, 0026, 0027)

Demande de la direction du 2026-11-10 : acquisition, suivi et transformation des prospects, avec WhatsApp Business et assistance IA. Les lots **réutilisent** Dossiers, Devis, Factures et Encaissements : un prospect est un Dossier en phase *Nouveau*, *En qualification* ou *Devis*. Chaque phase est utilisable en production seule.

| Phase | Fichier | Contenu | Dépend de | Taille |
|---|---|---|---|---|
| **COM-1** Mesurer et piloter | [COM1-01-mesure-visibilite.md](COM1-01-mesure-visibilite.md) | Source d'acquisition + UTM, boutons Appeler / WhatsApp / Devis, GA4, Search Console, Google Business, pages villes | — | S |
| | [COM1-02-pilotage-commercial.md](COM1-02-pilotage-commercial.md) | Rendez-vous, tableau de bord commercial, rapport hebdomadaire | COM1-01 | M |
| **COM-2** Centraliser WhatsApp | [COM2-01-whatsapp-reception.md](COM2-01-whatsapp-reception.md) | Cloud API en coexistence, webhook, messagerie, création automatique des Demandes | Accès Meta, vérification d'entreprise | M |
| | [COM2-02-whatsapp-reponses.md](COM2-02-whatsapp-reponses.md) | Réponses depuis le Back-Office, modèles Meta, accusés automatiques, reprise manuelle, opt-out | COM2-01 | M |
| **COM-3** Assister par l'IA | [COM3-01-copilote-ia.md](COM3-01-copilote-ia.md) | Qualification, classification, brouillons, relances, résumés, commentaire du rapport | COM2-01, COM1-02 | M |
| | [COM3-02-agent-conversationnel.md](COM3-02-agent-conversationnel.md) | Agent IA autonome encadré, passage à l'humain, mise en service progressive, évaluation | COM2-02, COM3-01 | L |
| **COM-4** Aller chercher les clients | [COM4-01-veille-prospects.md](COM4-01-veille-prospects.md) | Pistes, collecte automatique et assistée, messages d'approche, conversion | COM1-01, COM3-02 | L |

Tailles indicatives : S ≈ moins d'une semaine, M ≈ 1 à 2 semaines, L ≈ 2 à 4 semaines de développement, tests compris. Les délais Meta (vérification d'entreprise, approbation des modèles) s'ajoutent à COM-2 et ne dépendent pas de nous : à lancer dès l'accord sur le devis, en parallèle de COM-1.

**Ordre de mise en production** : COM-1 → COM2-01 (numéro de test, puis numéro commercial après accord) → COM2-02 → COM3-01 → COM3-02 en mode fantôme, puis hors heures, puis permanent → COM4-01. La saisie assistée de COM4-01 (sans collecte automatique) peut démarrer dès COM3-01.

## Hypothèses de dimensionnement (ADR 0023)

5 collaborateurs au démarrage ; 50–300 dossiers / mois ; 1 000–5 000 candidats la première année ; fichiers ≤ 5 Mo.

## Définition de « terminé » (MVP-1)

- Tous les critères d'acceptation des fichiers MVP1-* passent en tests automatisés (unitaires / intégration / bout en bout sur les parcours principaux, sur mobile 375 px).
- Restauration d'une sauvegarde testée sur un environnement vierge.
- Documentation d'exploitation à jour (déploiement, sauvegarde/restauration, création de comptes).
