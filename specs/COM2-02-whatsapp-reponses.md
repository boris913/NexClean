# COM2-02 – WhatsApp Cloud API : réponses, modèles, accusés automatiques

ADR de référence : 0005, 0025. Dépend de COM2-01.

## 1. User stories

- En tant que **référent**, je veux répondre au client directement depuis le Dossier, sans téléphone.
- En tant que **client**, je veux un accusé de réception immédiat, même la nuit.
- En tant que **Stéphanie**, je veux pouvoir reprendre la main à tout moment sur une réponse automatique.

## 2. Envoi

**RG-01** Zone de réponse dans le fil : texte libre, pièce jointe (document du Dossier via **lien d'accès temporaire**, ADR 0003 — jamais le fichier brut pour un devis ou une facture), modèle de message (MVP1-05 RG-14).

**RG-02** **Fenêtre de service** : si le dernier message entrant date de moins de 24 h, texte libre autorisé. Au-delà, seul l'envoi d'un **modèle approuvé par Meta** est possible ; l'interface l'indique et propose les modèles éligibles.

**RG-03** Les modèles de messages gagnent un attribut « modèle Meta » (nom, catégorie utilitaire / marketing, langue, statut d'approbation synchronisé depuis l'API). Un modèle non approuvé ne peut pas être envoyé hors fenêtre.

**RG-04** L'envoi passe par l'interface de canal (ADR 0005) : succès → message enregistré avec son identifiant Meta et son statut ; échec → erreur affichée, proposition de repli `wa.me`.

**RG-05** « Valider et envoyer » (MVP2-04) envoie désormais réellement le message via l'API quand le canal est disponible ; l'historique enregistre la **remise effective** (statut Meta) et non plus seulement l'intention.

## 3. Réponses automatiques

**RG-06** Accusé de réception automatique au **premier message** d'une nouvelle conversation (ou après 7 jours de silence) : texte paramétrable, avec numéro de dossier et horaires. En dehors des heures ouvrées, variante « nous vous répondons dès [prochaine ouverture] ».

**RG-07** Réponses rapides par mots-clés (paramétrables) : horaires, zones couvertes, liste des services, lien de suivi de son dossier. Une réponse automatique n'envoie **jamais** de prix autre que l'Estimation de la grille.

**RG-08** **Reprise manuelle** : dès qu'un humain répond (Back-Office ou téléphone), les réponses automatiques de la conversation sont suspendues 12 h (paramètre). Bouton « Reprendre la main » / « Rendre la main à l'automate » par conversation.

## 4. Consentement

**RG-09** Un client qui écrit le premier vaut accord pour la conversation en cours. Tout envoi de modèle **marketing** exige un accord explicite enregistré (date, formulation, canal). Mots-clés `STOP` / `ARRET` → désinscription immédiate des messages marketing, confirmée au client, journalisée.

**RG-10** Plafond d'envoi marketing paramétrable (défaut : 1 par client par semaine). Suivi de la **note de qualité** du numéro (API Meta) sur le tableau de bord ; passage en note basse → alerte Direction et suspension automatique des envois marketing.

## 5. Critères d'acceptation

- **RG-02** — *Étant donné* un dernier message client vieux de 30 h, *quand* le référent tente un texte libre, *alors* l'envoi est bloqué et seuls les modèles approuvés sont proposés.
- **RG-08** — *Étant donné* une réponse de Stéphanie depuis son téléphone à 10 h, *quand* le client réécrit à 10 h 05, *alors* aucune réponse automatique ne part.
- **RG-09** — *Étant donné* un client qui envoie « STOP », *alors* il ne reçoit plus aucun modèle marketing et l'action est journalisée.
