# ADR 0027 – Veille prospects assistée par IA

- **Statut :** proposé
- **Date :** 2026-11-10
- **Décideur :** Ange

## Contexte

NEXCLEAN veut que l'IA aille chercher des clients : repérer sur internet les personnes et entreprises qui expriment un besoin de personnel que NEXCLEAN fournit (agents d'entretien, ménagères, gardiens, serveurs…), leur proposer les services, puis converser avec elles.

Contraintes techniques :
- Facebook et TikTok **n'offrent pas d'API** pour rechercher les publications ou les groupes. Les aspirer automatiquement viole leurs conditions et expose les comptes NEXCLEAN au bannissement.
- WhatsApp interdit le message à froid : sans accord préalable, un premier message de NEXCLEAN dégrade la note du numéro et peut le faire suspendre (ADR 0025). C'est le numéro commercial qui serait perdu.

## Décision

1. **Nouvelle entité « Piste »** : besoin repéré lors de la veille, avant tout contact. Une Piste devient Client + Demande + Dossier quand le prospect répond.
2. **Sources automatisées** : uniquement des sources accessibles légitimement : API de recherche web, sites d'annonces et portails d'appels d'offres publics dont les conditions le permettent, flux RSS. Chaque source est déclarée dans un référentiel (nom, méthode, fréquence, active ou non).
3. **Sources assistées** (Facebook, TikTok, groupes, LinkedIn) : **pas d'aspiration**. Un collaborateur colle le lien ou le texte d'une publication dans le Back-Office ; l'IA la qualifie et prépare la réponse.
4. **Premier contact toujours validé par un humain** et fait **sur le canal d'origine** (réponse à l'annonce, commentaire, e-mail professionnel public). Le message invite à écrire sur WhatsApp via un lien `wa.me` portant une référence de Piste. C'est le prospect qui ouvre la conversation WhatsApp ; à partir de là, l'agent conversationnel (ADR 0026) prend le relais.
5. **Levier complémentaire recommandé** : publicités « clic vers WhatsApp » (Facebook / Instagram) et TikTok, dont les conversations arrivent par la même entrée que COM2-01 avec leur source d'acquisition.
6. **Qualification par l'IA** : type de besoin, ville, effectif, urgence, score de pertinence motivé. Les Pistes hors zone d'intervention (ADR 0021) sont écartées automatiquement.

## Conséquences

- La veille trouve et prépare ; l'envoi à froid reste humain, en volume raisonnable. On renonce à un « robot qui démarche tout seul ».
- Le taux de conversion Piste → Dossier est mesurable par source et alimente le rapport hebdomadaire.
- Les Pistes non converties sont purgées après un délai paramétrable (défaut 90 jours).
