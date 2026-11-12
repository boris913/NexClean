# COM4-01 – Veille prospects assistée par IA

ADR de référence : 0021, 0026, 0027. Dépend de COM1-01 (source `prospection`) et COM3-02 (l'agent prend le relais quand le prospect écrit).

## 1. User stories

- En tant que **direction**, je veux que l'IA repère chaque jour les personnes et entreprises qui cherchent du personnel que nous fournissons à Douala et Yaoundé.
- En tant que **Stéphanie**, je veux une liste de pistes triées avec un message d'approche prêt à envoyer.
- En tant que **direction**, je veux savoir combien de pistes deviennent des clients, par source.

## 2. Piste

**RG-01** Entité **Piste** : source, URL ou référence de la publication, extrait du texte, date de publication, besoin détecté (type de dossier, postes, effectif), ville / quartier, contact public éventuel (nom d'entreprise, e-mail ou téléphone **publiés par l'auteur lui-même**), score (0–100) avec justification, statut, collaborateur assigné, référence courte `P-xxxx`.

**RG-02** Statuts : `nouvelle` → `retenue` / `ecartee` (motif) → `contactee` → `en_conversation` → `convertie` (Dossier créé) / `sans_suite`. Purge des pistes non converties après 90 jours (paramètre).

**RG-03** Déduplication : même URL, ou même contact et même besoin sur 30 jours → une seule Piste. Un contact déjà Client est signalé (« client existant ») et rattaché au lieu de créer une Piste.

## 3. Collecte

**RG-04** Référentiel des **sources** (Direction) : nom, type (`api_recherche`, `site_annonces`, `appels_offres`, `rss`, `saisie_assistee`), requêtes (ex. « recherche femme de ménage Douala », « besoin agent de sécurité Yaoundé »), fréquence, actif. Seules les sources dont la méthode d'accès est autorisée sont automatisables (ADR 0027 §2).

**RG-05** Collecte automatique (tâche planifiée, défaut 2 fois par jour) : récupération, filtrage par l'IA (est-ce un besoin de personnel ou de prestation que NEXCLEAN fournit ? dans une ville couverte ?), extraction RG-01, score. Hors zone ou hors services → `ecartee` automatiquement.

**RG-06** **Saisie assistée** (Facebook, TikTok, groupes, LinkedIn) : bouton « Ajouter une piste » où le collaborateur colle le lien et le texte ; même qualification par l'IA. Aucune aspiration automatique de ces plateformes.

## 4. Approche

**RG-07** Pour chaque Piste retenue, l'IA rédige un **message d'approche** adapté au canal d'origine (réponse à une annonce, commentaire, e-mail), personnalisé au besoin exprimé, contenant un lien `wa.me` avec la référence `[P-xxxx]`. Pas de prix ferme ; l'Estimation peut être mentionnée.

**RG-08** Le premier contact est **toujours envoyé par un humain** (copier, puis publier ou envoyer sur le canal d'origine ; e-mail professionnel envoyable depuis le Back-Office). Le clic « Marquer contactée » enregistre date, canal et texte. **Aucun premier message WhatsApp n'est envoyé à une Piste** (ADR 0025, conséquences).

**RG-09** Quand un prospect écrit sur WhatsApp avec la référence `[P-xxxx]`, COM2-01 rattache la conversation à la Piste, crée Client + Demande (`source = prospection`) + Dossier, passe la Piste à `convertie`, et l'agent COM3-02 prend la conversation.

**RG-10** Plafonds : nombre de pistes contactées par collaborateur et par jour (paramètre, défaut 30) ; une même Piste ne peut être relancée qu'une fois, après 5 jours minimum.

## 5. Pilotage

**RG-11** Écran « Veille » : pistes du jour triées par score, filtres source / ville / service / statut, actions retenir / écarter / contacter en un clic.

**RG-12** Indicateurs (tableau de bord commercial et rapport hebdomadaire) : pistes trouvées, retenues, contactées, converties, CA issu des pistes, par source et par requête. Une requête qui ne produit aucune piste retenue en 30 jours est signalée pour désactivation.

## 6. Critères d'acceptation

- **RG-05** — *Étant donné* une annonce « cherche gardien de nuit pour villa à Bastos », *alors* une Piste est créée avec ville Yaoundé, quartier Bastos, poste gardien, score motivé.
- **RG-05** — *Étant donné* une annonce pour un poste de comptable, *alors* la Piste est écartée avec le motif « hors services ».
- **RG-08** — *Étant donné* une Piste avec numéro de téléphone public, *alors* le Back-Office ne propose aucun envoi WhatsApp direct, seulement le canal d'origine.
- **RG-09** — *Étant donné* un prospect qui écrit « Bonjour [P-0042] », *alors* la Piste P-0042 passe à `convertie` et le Dossier créé porte `source = prospection`.
