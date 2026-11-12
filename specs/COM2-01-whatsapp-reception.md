# COM2-01 – WhatsApp Cloud API : réception centralisée

ADR de référence : 0005, 0006, 0025. Étape A : **réception seule**. Stéphanie continue de répondre depuis son téléphone (coexistence) ; le Back-Office voit tout.

## 0. Prérequis (bloquants, côté NEXCLEAN)

- Meta Business Manager au nom de NEXCLEAN, entreprise vérifiée, développeur ajouté avec un rôle limité.
- Application Meta créée, webhook configuré vers `https://nexclean.xyz/api/whatsapp/webhook`.
- Développement et recette **sur le numéro de test Meta**. Le numéro commercial n'est branché qu'après les vérifications de l'ADR 0025 §3 et l'accord écrit de NEXCLEAN.

## 1. User stories

- En tant que **Stéphanie**, je veux que chaque message reçu sur le WhatsApp commercial apparaisse dans le Back-Office, rattaché au bon client, afin qu'aucune demande ne se perde.
- En tant que **direction**, je veux voir les conversations non traitées et leur ancienneté.

## 2. Webhook

**RG-01** Point d'entrée `POST /api/whatsapp/webhook` : vérification de la signature `X-Hub-Signature-256` (secret de l'application) **avant** toute lecture ; requête non signée → 401, journalisée. `GET` gère le défi de vérification Meta.

**RG-02** Réponse 200 immédiate, traitement asynchrone ; idempotence sur l'identifiant de message WhatsApp (Meta peut renvoyer un même événement).

**RG-03** Types traités : texte, image, document, audio (note vocale), localisation, contact, réponses à boutons. Les médias sont téléchargés immédiatement (les URL Meta expirent) et stockés en interne (ADR 0003), 5 Mo max par fichier comme le reste du système (au-delà : lien conservé, marqué « trop volumineux »).

**RG-04** Les événements de statut (envoyé, remis, lu, échec) sont enregistrés sur le message concerné. Les messages envoyés depuis le téléphone (coexistence) arrivent aussi par webhook et sont enregistrés comme messages sortants « depuis l'application ».

## 3. Conversation et rattachement

**RG-05** Entité **Conversation** : un numéro WhatsApp (E.164) ↔ un Client (identifié par son numéro, CONTEXT.md). Premier message d'un numéro inconnu → création du Client (nom = nom de profil WhatsApp, à corriger).

**RG-06** Premier message d'une conversation sans Dossier ouvert → création d'une **Demande** `canal = whatsapp`, `source` déduite de la référence du texte prérempli (COM1-01 RG-05) sinon `whatsapp_direct`, puis d'un Dossier et attribution (MVP1-05). Le Dossier reste en phase *Nouveau* (« à qualifier ») ; son **type** est déduit des mots du message (« ménagère » → Recrutement, « gazon » → Espaces verts, Nettoyage par défaut) et la **ville / le quartier** cités sont reconnus dans le référentiel, pour que l'attribution automatique fonctionne. Le référent corrige le type si besoin (RG-07). *Pas de type « à qualifier » : aucun référent ne le traiterait (attribution impossible) et le préfixe du numéro ne change jamais.* Messages suivants du même client → ajoutés à la conversation ; s'il a un Dossier ouvert, ils apparaissent dans son historique, sans nouvelle Demande.

**RG-07** Le référent peut **rattacher** une conversation à un autre Dossier ou **requalifier** le type du Dossier ; journalisé.

## 4. Interface

**RG-08** Page **Messagerie** : liste des conversations (non lues d'abord, ancienneté du dernier message entrant), fil complet avec médias, lien vers le Client et le Dossier. Rafraîchissement automatique (≤ 15 s) sans recharger la page.

**RG-09** Une conversation est **non traitée** tant qu'aucune réponse (téléphone ou Back-Office) n'a suivi le dernier message entrant. Compteur dans la navigation ; non traitée depuis plus de 2 h ouvrées → notification au référent, 4 h → Direction (mêmes heures ouvrées que MVP1-05 RG-07).

**RG-10** Accès : le référent voit les conversations de ses Dossiers ; Stéphanie et la Direction voient tout (permission `messagerie.voir_tout`). Le Responsable finances n'a pas accès aux conversations.

## 5. Cas limites

- Message reçu pendant une panne du serveur : Meta renvoie les webhooks pendant plusieurs heures ; l'idempotence (RG-02) évite les doublons.
- Client qui écrit depuis un autre numéro : nouveau Client ; fusion manuelle possible (lot ultérieur), en attendant rattachement au Dossier existant (RG-07).
- Numéro d'un **Candidat** connu : la conversation est signalée « candidat » et n'ouvre pas de Dossier client ; renvoi vers la fiche candidat.

## 6. Critères d'acceptation

- **RG-01** — *Étant donné* une requête au webhook avec une signature invalide, *alors* elle est rejetée et aucun message n'est créé.
- **RG-06** — *Étant donné* un numéro inconnu qui écrit « Bonjour [FB] je cherche une ménagère à Bonamoussadi », *alors* un Client, une Demande `source = facebook` et un Dossier attribué sont créés.
- **RG-04** — *Étant donné* une réponse envoyée par Stéphanie depuis son téléphone, *alors* elle apparaît dans le fil du Back-Office et la conversation passe à « traitée ».
