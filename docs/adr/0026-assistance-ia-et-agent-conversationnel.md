# ADR 0026 – Assistance IA et agent conversationnel encadré

- **Statut :** proposé
- **Date :** 2026-11-10
- **Décideur :** Ange

## Contexte

NEXCLEAN veut utiliser une API d'IA pour qualifier les demandes, préparer les réponses, proposer des relances, rédiger les comptes rendus hebdomadaires et **converser seule avec les prospects** sur WhatsApp. Exigence de la direction : devis, engagements commerciaux, paiements et messages sensibles restent soumis aux autorisations définies par NEXCLEAN.

## Décision

1. **Appels côté serveur uniquement**, via l'API officielle d'un fournisseur (Claude par défaut), derrière une interface interne `lib/ia/` pour pouvoir changer de fournisseur. Clé en variable d'environnement sur le VPS, compte au nom de NEXCLEAN.
2. **Deux modes, livrés dans cet ordre** :
   - **Copilote** (COM3-01) : l'IA propose (extraction, brouillon, résumé), un humain valide et envoie.
   - **Agent conversationnel** (COM3-02) : l'IA répond seule dans un **périmètre fermé**, avec reprise humaine.
3. **Périmètre de l'agent** — autorisé : accueillir, qualifier (service, ville, quartier, effectif, dates), répondre à partir d'une base de connaissances validée (services, zones, délais), donner l'**Estimation** issue de la grille (non engageante), proposer un rappel ou un rendez-vous. **Interdit** : émettre ou modifier un Devis, accorder une remise, prendre un engagement de date ou de résultat, parler de paiement autrement qu'en renvoyant vers le référent, promettre un candidat précis.
4. **Garde-fous techniques** (dans le code, pas seulement dans le prompt) : liste blanche d'actions (outils) ; tout montant sorti par l'agent est recalculé par le serveur ; détection de passage à l'humain ; interrupteur global et par conversation ; plafond de messages par conversation et par jour ; l'agent se présente comme assistant virtuel de NEXCLEAN.
5. **Traçabilité** : chaque message produit par l'IA est enregistré avec le modèle, la version du prompt et les outils appelés. Les changements de prompt ou de base de connaissances sont journalisés (journal d'audit).
6. **Minimisation** : on n'envoie au fournisseur que ce qui sert à la tâche ; jamais de CV, de pièce d'identité ni de données de paiement. Le CA et les données financières restent calculés en SQL ; l'IA ne fait que les commenter.
7. **Rien en production sans évaluation** : un jeu de conversations de test (y compris des tentatives de faire déraper l'agent) doit passer avant chaque mise en service et chaque changement de prompt.

## Conséquences

- L'agent reste **spécifique aux services NEXCLEAN** : les conditions WhatsApp Business de Meta n'autorisent plus les assistants IA généralistes, mais acceptent un assistant dédié aux services de l'entreprise.
- Mise en service progressive de l'agent : mode fantôme (brouillons seulement) → réponses hors heures ouvrées → réponses permanentes avec reprise.
- Coût proportionnel au volume, marginal à 50–300 dossiers/mois ; à chiffrer dans le devis selon les modèles retenus.
