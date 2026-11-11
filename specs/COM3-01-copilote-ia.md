# COM3-01 – Copilote IA : qualification, brouillons, résumés, rapport

ADR de référence : 0026. Dépend de COM2-01 (messages entrants) et COM1-02 (rapport). L'IA **propose**, l'humain valide.

## 1. User stories

- En tant que **référent**, je veux que la demande écrite en texte libre ou en note vocale soit transformée en fiche structurée afin de ne pas tout ressaisir.
- En tant que **référent**, je veux un brouillon de réponse adapté au client que je corrige puis envoie.
- En tant que **direction**, je veux un commentaire lisible du rapport hebdomadaire.

## 2. Socle technique

**RG-01** Module `lib/ia/` : interface fournisseur unique (`extraire`, `rediger`, `resumer`), implémentation Claude par défaut (modèle léger pour extraction et classification, modèle intermédiaire pour la rédaction). Clé `IA_API_KEY` en variable d'environnement.

**RG-02** Toute sortie structurée est validée par un schéma zod ; sortie invalide → une nouvelle tentative, puis abandon silencieux (la fonction reste utilisable sans IA).

**RG-03** Journal IA : tâche, modèle, version du prompt, jetons, durée, Dossier concerné, collaborateur. Prompts versionnés dans le dépôt.

**RG-04** Minimisation (ADR 0026 §6) : on n'envoie que le fil de la conversation et les champs utiles du Dossier ; jamais de CV, pièce d'identité, salaire de candidat ou donnée de paiement.

**RG-05** Panne ou dépassement de délai du fournisseur (> 20 s) : l'interface affiche « suggestion indisponible », le travail continue manuellement.

## 3. Fonctions

**RG-06** **Qualification** à l'arrivée d'une Demande WhatsApp ou formulaire : extraction service, type de dossier, ville, quartier (rapproché du référentiel ADR 0021), effectif, dates, urgence, budget mentionné. Les champs extraits sont **proposés** (pré-remplis, surlignés) ; le référent valide. Les notes vocales sont transcrites avant extraction.

**RG-07** **Classification** du prospect : chaud / tiède / froid, avec justification en une phrase. Indicatif, affiché dans la liste des Dossiers, jamais utilisé pour l'attribution automatique.

**RG-08** **Brouillon de réponse** : bouton dans le fil ; l'IA rédige à partir de la conversation, du Dossier et de la base de connaissances (COM3-02 RG-03). Le brouillon arrive dans la zone de réponse, rien n'est envoyé sans clic humain.

**RG-09** **Proposition de relance** : pour les Dossiers « À relancer » (MVP1-05), message de relance suggéré et moment recommandé.

**RG-10** **Résumé de dossier** : synthèse en 5 lignes affichée en tête du Dossier, régénérée sur demande.

**RG-11** **Rapport hebdomadaire** (COM1-02 RG-10) : paragraphe de commentaire rédigé à partir des **seuls agrégats calculés en SQL**, passés en entrée. Contrôle : tout nombre cité dans le commentaire doit figurer dans les agrégats fournis, sinon le commentaire est rejeté.

## 4. Critères d'acceptation

- **RG-06** — *Étant donné* le message « il me faut 2 agents d'entretien pour mes bureaux à Akwa dès lundi », *alors* la fiche propose type NET, ville Douala, quartier Akwa, effectif 2, date au lundi suivant.
- **RG-05** — *Étant donné* le fournisseur IA injoignable, *quand* une Demande arrive, *alors* le Dossier est créé et attribué normalement, sans champs proposés.
- **RG-11** — *Étant donné* un commentaire généré citant « 18 devis » alors que les agrégats en donnent 12, *alors* le commentaire est rejeté et le rapport part sans lui.
