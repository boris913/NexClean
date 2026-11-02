# MVP1-02 – Client, Demande, Dossier

ADR de référence : 0005, 0006, 0007, 0014, 0019.

## 1. User stories

- En tant que **référent**, je veux retrouver dans un seul écran tout ce qui concerne un Dossier (demandes reçues, client, lignes de poste, documents, historique) afin de le traiter sans ressaisie.
- En tant que **référent**, je veux saisir moi-même une demande reçue par téléphone ou WhatsApp afin qu'elle suive le même circuit que celles du site.
- En tant que **référent**, je veux rattacher une demande en double à un Dossier existant afin d'éviter deux dossiers pour un même besoin.
- En tant que **client**, je veux suivre l'avancement de mon Dossier depuis un lien reçu sur WhatsApp, sans créer de compte.
- En tant que **direction**, je veux voir tous les Dossiers et filtrer par statut, type, ville et référent.

## 2. Types de dossier et numérotation

| Type | Préfixe | Origine en MVP-1 |
|---|---|---|
| Recrutement / placement | `REC` | Formulaire « Demander du personnel », saisie manuelle |
| Nettoyage | `NET` | Devis général (hors espaces verts), devis pro, saisie manuelle |
| Espaces verts | `EV` | Devis espaces verts, devis général avec service espaces verts, saisie manuelle |
| Abonnement | `ABO` | Saisie manuelle (formulaire après MVP) |
| Mise à disposition | `MAD` | Saisie manuelle |
| Partenariat | `PAR` | Saisie manuelle |
| Réclamation | `RCL` | Saisie manuelle |

**RG-01** Numéro = `PRÉFIXE-AAAA-NNNNN`, séquence par type et par année civile (fuseau Africa/Douala), remise à 1 au 1er janvier. Attribution transactionnelle : deux soumissions simultanées n'obtiennent jamais le même numéro. Des trous sont tolérés (transaction annulée) ; ce n'est pas une numérotation de facture.

**RG-02** Le numéro est attribué à la création du Dossier et ne change jamais, même si le type est corrigé (le type corrigé est journalisé ; le préfixe reste celui d'origine).

## 3. Client

**RG-03** Un Client est identifié par son numéro WhatsApp normalisé E.164. À la création d'une Demande, si un Client existe avec ce numéro, la Demande lui est associée ; sinon un Client est créé.

**RG-04** Champs Client : type (entreprise / particulier), nom ou raison sociale, nom du contact, numéro WhatsApp, autre téléphone, e-mail, ville, quartier. Les informations d'une nouvelle Demande **ne remplacent pas** celles du Client existant ; les différences sont signalées au référent (« Nouvelles coordonnées reçues : … — mettre à jour ? »).

**RG-05** Fusion de deux Clients (Direction uniquement) : les Dossiers sont réaffectés au Client conservé ; l'opération est journalisée. Séparation : un Dossier peut être déplacé vers un nouveau Client.

## 4. Demande

**RG-06** Une Demande est **immuable** : les données soumises sont conservées telles quelles (copie JSON + champs structurés), avec horodatage, canal (`site`, `whatsapp`, `téléphone`, `e-mail`, `visite`, `autre`), formulaire d'origine, et auteur si saisie par un collaborateur.

**RG-07** Toute nouvelle Demande crée un Dossier (statut « Nouvelle demande »), sauf saisie manuelle où le collaborateur choisit explicitement « rattacher à un Dossier existant ».

**RG-08** Rattachement a posteriori : un référent ayant accès aux deux Dossiers peut rattacher une Demande d'un Dossier A à un Dossier B. Si A n'a plus de Demande, A passe en « Sans suite » avec le motif « Fusionné dans B ». Le rattachement est journalisé dans A et B.

## 5. Dossier

**RG-09** Contenu : numéro, type, Client, Demandes (≥ 1), référent (ou aucun), statut, phase dérivée, ville / quartier / lieu d'affectation, lignes de poste (type REC), documents, notes internes, historique, lien de suivi.

**RG-10** Les données de travail du Dossier (ville, lignes de poste, précisions) sont initialisées depuis la première Demande puis **modifiables** par le référent ; chaque modification est historisée (avant / après).

**RG-11** Notes internes : texte libre, horodaté, auteur ; jamais visibles du client.

### Statuts et transitions (ADR 0007)

**RG-12** Cycle recrutement : `Nouvelle demande → Attribuée → En qualification ⇄ À compléter → Devis prêt → Devis envoyé → Accepté → Acompte reçu → Recherche en cours → Candidats proposés → Placements confirmés → Solde reçu → Clôturé`, issues `Refusé` et `Sans suite` possibles depuis tout statut non final.

**RG-13** Cycle générique (autres types) : `Nouvelle demande → Attribuée → En qualification ⇄ À compléter → Devis prêt → Devis envoyé → Accepté → Acompte reçu → En cours → Terminé → Solde reçu → Clôturé`, mêmes issues.

**RG-14** `Nouvelle demande → Attribuée` est automatique à l'attribution (MVP1-05). Toute autre transition est manuelle, réservée au référent du Dossier et à la Direction, avec commentaire facultatif sauf mention contraire.

**RG-15** Commentaire **obligatoire** pour : `À compléter` (liste des informations manquantes), `Refusé`, `Sans suite`, et tout retour en arrière.

**RG-16 — Mode transitoire MVP-1.** Les modules devis et encaissements n'existant qu'en MVP-2, les conditions de passage de l'ADR 0007 sont temporairement remplacées par :
- `Devis prêt`, `Devis envoyé` : au moins un document de catégorie « devis externe » joint au Dossier ;
- `Acompte reçu`, `Solde reçu` : commentaire obligatoire indiquant montant, moyen et référence, et un justificatif joint ;
- `Placements confirmés` : commentaire obligatoire indiquant le nombre de placements.
Ces gardes transitoires sont remplacées en MVP-2 par les vraies gardes (devis validé, Encaissement enregistré, Placements confirmés).

**RG-17** Chaque transition crée une entrée d'historique : ancien statut, nouveau statut, auteur, horodatage, commentaire.

**RG-18** Les statuts finaux (`Clôturé`, `Refusé`, `Sans suite`) sont réouvrables par la Direction uniquement, avec commentaire.

## 6. Saisie manuelle d'une Demande

**RG-19** Tout collaborateur ayant le rôle Référent ou Direction peut saisir une Demande : type de dossier, canal, Client (recherche par numéro ou création), ville / quartier, description ; pour le type REC, mêmes champs que le formulaire public (MVP1-03).

**RG-20** Option « Me l'attribuer » (cochée par défaut pour un Référent qui traite ce service et cette ville) ; sinon l'attribution automatique s'applique.

## 7. Liste et fiche Dossier (Back-Office)

**RG-21** Liste des Dossiers : recherche par numéro, nom de client ou téléphone ; filtres type, statut, phase, ville, référent (Direction), période ; tri par date de création ou de dernière action. Utilisable sur un écran de 375 px (cartes empilées, pas de tableau horizontal).

**RG-22** Fiche Dossier, onglets : Résumé, Demandes, Postes (REC), Documents, Historique, Notes. Actions principales accessibles au pouce : changer de statut, « Envoyer sur WhatsApp », ajouter un document, ajouter une note.

**RG-23** Indicateur « sans action depuis N jours » (paramètre, défaut 3) sur la liste.

## 8. Page de suivi client (ADR 0014, périmètre MVP-1)

**RG-24** Chaque Dossier a un jeton de suivi aléatoire (≥ 128 bits), URL `https://nexclean.xyz/suivi/<jeton>`.

**RG-25** En MVP-1, la page affiche uniquement : numéro de dossier, type, date de la demande, **phase** (libellé client simplifié), date de dernière mise à jour, et un bouton WhatsApp vers NEXCLEAN prérempli avec le numéro. Aucun montant, aucun document, aucune donnée personnelle hormis le prénom / nom du contact.

**RG-26** Libellés client des phases : Nouveau → « Demande reçue » ; En qualification → « En cours d'étude » ; Devis → « Devis en préparation / envoyé » ; Accepté → « Devis accepté » ; En exécution → « En cours de réalisation » ; Terminé → « Réalisé » ; Clôturé → « Dossier clôturé » ; Refusé / Sans suite → « Dossier fermé ».

**RG-27** Le référent peut régénérer le jeton (l'ancien lien cesse immédiatement de fonctionner) ; journalisé. Chaque consultation est journalisée (horodatage, IP).

**RG-28** La page n'est pas indexable (`noindex`, exclue du sitemap) ; un jeton invalide renvoie une page « Lien invalide ou expiré » sans distinguer inexistant / révoqué.

**RG-29** Le lien expire 90 jours après le passage du Dossier à un statut final.

## 9. Critères d'acceptation

- **RG-01** — *Étant donné* 20 soumissions simultanées du formulaire « Demander du personnel », *quand* elles sont traitées, *alors* 20 Dossiers `REC-2026-…` sont créés avec 20 numéros distincts.
- **RG-03** — *Étant donné* un Client existant avec le numéro `+237690000000`, *quand* une Demande arrive avec `690 00 00 00`, *alors* elle est associée au même Client.
- **RG-06** — *Étant donné* une Demande reçue, *quand* le référent modifie le nombre de personnes d'une ligne de poste dans le Dossier, *alors* la Demande conserve la valeur d'origine et l'historique du Dossier montre l'ancienne et la nouvelle valeur.
- **RG-08** — *Étant donné* deux Dossiers A et B d'un même Client, A n'ayant qu'une Demande, *quand* le référent rattache cette Demande à B, *alors* A passe en « Sans suite » avec le motif « Fusionné dans B » et B affiche deux Demandes.
- **RG-15** — *Étant donné* un Dossier « En qualification », *quand* le référent le passe en « À compléter » sans commentaire, *alors* la transition est refusée avec le message « Indiquez les informations manquantes ».
- **RG-16** — *Étant donné* un Dossier REC « Accepté » sans justificatif joint, *quand* le référent tente « Acompte reçu », *alors* la transition est refusée.
- **RG-18** — *Étant donné* un Dossier « Clôturé », *quand* un Référent tente de le rouvrir, *alors* l'action ne lui est pas proposée et l'appel direct renvoie 403.
- **RG-25** — *Étant donné* le lien de suivi d'un Dossier « Recherche en cours », *quand* le client l'ouvre, *alors* il voit « En cours de réalisation » et aucun montant ni document.
- **RG-27** — *Étant donné* un lien de suivi régénéré, *quand* l'ancien lien est ouvert, *alors* la page « Lien invalide ou expiré » s'affiche.

## 10. Cas limites

- Numéro WhatsApp étranger (diaspora qui commande pour un proche) : accepté en E.164 ; pays par défaut Cameroun uniquement si aucun indicatif n'est saisi.
- Même numéro utilisé par deux entreprises (standard partagé) : rattachées au même Client par défaut ; séparation manuelle (RG-05).
- Client qui soumet trois fois le même formulaire en une minute (double clic, réseau lent) : protection anti-doublon — même numéro + même formulaire + mêmes données en moins de 10 min → une seule Demande, et le numéro existant est réaffiché.
- Changement de type d'un Dossier (ex. NET → ABO) : autorisé au référent avant `Devis envoyé`, journalisé, numéro inchangé (RG-02) ; le Dossier est réévalué par l'attribution si le référent ne traite pas le nouveau type.
- Dossier sans référent dont le client consulte le suivi : phase « Demande reçue ».
