# MVP2-04 – Grille tarifaire, devis, documents PDF, « Valider et envoyer »

ADR de référence : 0003, 0005, 0007, 0008, 0009, 0010, 0014, 0020.

## 1. User stories

- En tant que **direction**, je veux administrer les paramètres de prix afin que les devis soient justes sans intervention technique.
- En tant que **référent**, je veux un devis pré-rempli à partir du Dossier, que je contrôle puis envoie en un clic, afin de ne rien ressaisir.
- En tant que **client**, je veux consulter et accepter le devis depuis mon téléphone afin de lancer la recherche rapidement.

## 2. Grille tarifaire (périmètre MVP-2)

**RG-01** Paramètres administrables par Direction et Administrateur, chacun historisé (valeur, date d'effet, auteur) :

| Paramètre | Valeur initiale |
|---|---|
| Commission de placement par personne (HT) | 5 000 FCFA |
| Commission par catégorie de poste (optionnelle) | aucune |
| Taux de TVA | 0 % (« TVA non applicable ») en attendant QO-2 |
| Taux d'acompte par défaut | 50 % |
| Bornes du taux d'acompte | 30 % – 100 % |
| Délai de recherche par défaut | 30 jours |
| Garantie de remplacement | 15 jours |
| Validité d'un devis | 15 jours |
| Mentions légales des documents | raison sociale, adresse, RCCM, NIU, téléphone, e-mail (texte libre) |
| Conditions générales du devis | texte administrable |

**RG-02** Une modification prend effet pour les **nouveaux** devis uniquement ; les devis existants conservent leurs valeurs figées (ADR 0008).

**RG-03** Hors type REC, la grille des prestations (nettoyage, espaces verts, abonnements) n'est **pas** dans le MVP-2 : pour ces types, le mode transitoire de MVP1-02 RG-16 (devis externe joint) reste en vigueur.

## 3. Devis (Dossiers REC)

**RG-04** Le référent crée le devis depuis le Dossier ; il est pré-rempli : client, lignes de poste (intitulé, nombre de personnes, commission unitaire), total HT, TVA, TTC, taux d'acompte, montant d'acompte (arrondi à la centaine supérieure), délai de recherche, garantie, conditions.

**RG-05** **Contrôle « À compléter »** : impossible de générer un devis si le Dossier est « À compléter » ou s'il manque une donnée requise (raison sociale ou nom, numéro WhatsApp, au moins une ligne de poste avec nombre de personnes, ville). Le message liste les données manquantes et propose de passer le Dossier en « À compléter ».

**RG-06** Le référent peut modifier : quantités, taux d'acompte dans les bornes (justification obligatoire si différent du défaut), délai de recherche, texte libre de conditions particulières. Un taux hors bornes exige une **validation Direction** (le devis reste « en attente de validation direction »).

**RG-07** États du devis : `brouillon → validé → envoyé → accepté / refusé / expiré`. Un devis validé n'est plus modifiable ; toute modification crée une **nouvelle version** (v2…), l'ancienne passe à `remplacé`.

**RG-08** Transitions du Dossier liées (remplacent le mode transitoire pour REC) : devis validé → « Devis prêt » ; « Valider et envoyer » → « Devis envoyé » ; acceptation → « Accepté » ; refus → « Refusé » (le référent peut rouvrir en « En qualification » pour une nouvelle version).

**RG-09** **Avenant** : sur un devis accepté, le référent peut créer un avenant (nombre de personnes, prolongation du délai de recherche) ; même circuit valider → envoyer → accepter ; le montant final utilise le devis et ses avenants acceptés.

## 4. « Valider et envoyer »

**RG-10** Le bouton génère le PDF définitif, l'archive dans les Documents du Dossier (catégorie « devis »), passe le devis à `envoyé`, puis ouvre WhatsApp avec le modèle « Envoi du devis » contenant le lien de la page de suivi. Si le client a un e-mail, un e-mail (Resend) avec le PDF en pièce jointe est également envoyé.

**RG-11** L'auto-validation des devis est hors périmètre : tout devis passe par l'action humaine « Valider et envoyer ».

## 5. Acceptation sur la page de suivi (ADR 0014)

**RG-12** La page de suivi affiche le devis en cours (montants, conditions, PDF) après vérification des 4 derniers chiffres.

**RG-13** Bouton « J'accepte le devis » : saisie du nom et de la fonction du signataire, case « J'ai lu et j'accepte les conditions » ; enregistrement : horodatage, IP, navigateur, version exacte du devis (empreinte du PDF). Le Dossier passe à « Accepté », le référent est notifié, une **facture d'acompte** est émise (RG-17).

**RG-14** Bouton « Refuser » (motif facultatif). Un devis non accepté à la date de validité passe à `expiré` (tâche quotidienne) et le référent est notifié.

**RG-15** Acceptation hors page de suivi (client qui répond « OK » sur WhatsApp) : le référent enregistre l'acceptation avec capture jointe ; marquée `whatsapp`.

## 6. Documents PDF

**RG-16** Modèles fixes dans le code, avec textes et paramètres administrables (en-tête, mentions légales, conditions), langue `fr` :

| Document | Déclencheur | Numérotation |
|---|---|---|
| Accusé de réception | création d'un Dossier REC (téléchargeable depuis la page de suivi) | numéro de dossier |
| Devis / avenant | « Valider et envoyer » | `DEV-AAAA-NNNNN` + version |
| Attestation de prise de poste | Placement annoncé (MVP2-03) | numéro de dossier + n° de placement |
| Facture d'acompte | acceptation du devis | séquence facture |
| Facture de solde | clôture de la recherche, si montant final > acompte facturé | séquence facture |
| Avoir | montant final < acompte facturé, ou correction d'une facture | séquence facture |
| Reçu | chaque Encaissement (MVP2-05) | `REÇ-AAAA-NNNNN` |

**RG-17** **Factures et avoirs** : séquence unique `FAC-AAAA-NNNNN`, **continue et sans trou** (attribuée dans la transaction d'émission, verrou sur la séquence) ; aucune facture ni avoir ne peut être modifié ou supprimé après émission ; une erreur se corrige par un avoir (ADR 0020).

**RG-18** Facture de solde = montant final TTC − acompte facturé TTC ; si négatif, un **avoir** du montant de la différence est émis sur la facture d'acompte (et le trop-perçu est traité selon MVP2-05).

**RG-19** Tous les PDF sont générés côté serveur, archivés dans les Documents du Dossier, et accessibles au client uniquement via la page de suivi ou un lien d'accès temporaire. Mention légale TVA : HT / TVA / TTC si taux > 0, sinon « TVA non applicable ».

**RG-20** Rendu lisible sur smartphone (A4 portrait, police ≥ 10 pt) et poids < 300 Ko par document.

## 7. Critères d'acceptation

- **RG-02** — *Étant donné* un devis validé avec une commission de 5 000, *quand* la Direction passe la commission à 6 000, *alors* le devis et son PDF restent à 5 000 et un nouveau devis utilise 6 000.
- **RG-04** — *Étant donné* un Dossier de 10 personnes, TVA 0 %, acompte 50 %, *quand* le référent crée le devis, *alors* il affiche 50 000 FCFA, « TVA non applicable », acompte 25 000 FCFA.
- **RG-04 (arrondi)** — *Étant donné* un total TTC de 59 625 et un acompte de 50 %, *quand* le devis est calculé, *alors* l'acompte vaut 29 900.
- **RG-05** — *Étant donné* un Dossier « À compléter », *quand* le référent clique « Créer le devis », *alors* l'action est refusée avec la liste des données manquantes.
- **RG-06** — *Étant donné* un taux d'acompte de 20 % (borne min 30 %), *quand* le référent valide, *alors* le devis passe « en attente de validation direction » et la Direction est notifiée.
- **RG-13** — *Étant donné* un client qui accepte le devis v2 sur la page de suivi, *quand* l'acceptation est enregistrée, *alors* le Dossier passe à « Accepté », une facture d'acompte `FAC-…` est émise et l'historique contient nom, fonction, horodatage, IP et version v2.
- **RG-17** — *Étant donné* deux factures émises simultanément, *quand* elles sont enregistrées, *alors* elles reçoivent deux numéros consécutifs distincts sans trou.
- **RG-17** — *Étant donné* une facture émise, *quand* un utilisateur quelconque tente de la modifier, *alors* l'action est impossible (interface et serveur).

## 8. Cas limites

- Client qui accepte une ancienne version (lien ancien) : seule la dernière version `envoyé` est acceptable ; les anciennes affichent « Ce devis a été remplacé ».
- Régime fiscal confirmé avec TVA après des factures émises à 0 % : les factures émises restent inchangées ; le nouveau taux s'applique aux nouveaux devis (RG-02).
- Minimum de facturation (QO-3) : non implémenté ; prévoir le paramètre sans l'activer.
