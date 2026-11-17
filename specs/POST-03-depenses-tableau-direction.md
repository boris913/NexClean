# POST-03 – Dépenses et tableau de bord direction (ADR 0020)

Lot « Après les MVP » n° 3 de l'ADR 0023. ADR de référence : 0020 (la décision fait foi), 0003 (stockage des fichiers), 0018 (droits). Il réutilise les factures et avoirs de [MVP2-04](MVP2-04-tarification-documents.md) et les Encaissements de [MVP2-05](MVP2-05-encaissements.md), sans les modifier.

Les valeurs marquées **(défaut)** sont des valeurs par défaut, **à confirmer par la Direction**.

## 1. User stories

- En tant que **Responsable finances** ou **Direction**, je veux saisir une dépense en quelques secondes, avec la photo du reçu, afin que les indicateurs reflètent les sorties d'argent réelles.
- En tant que **Direction**, je veux voir sur une période le facturé, l'encaissé, les impayés par ancienneté, les dépenses, le résultat estimé, la trésorerie et la marge par dossier ou par service, afin de piloter l'agence sans confondre facturation, encaissement, dépense et résultat.
- En tant que **Responsable finances**, je veux exporter les factures, avoirs et dépenses de la période dans un fichier que le comptable ouvre directement dans Excel, afin de lui transmettre les pièces sans ressaisie.
- En tant que **Direction**, je veux adapter la liste des catégories de dépenses sans perdre l'historique.

## 2. Dépenses

**RG-01 Saisie.** Par le Responsable finances et la Direction (permission `depense.saisir`). Champs :

| Champ | Obligatoire | Règle |
|---|---|---|
| Date de la dépense | oui | ≤ aujourd'hui (fuseau Africa/Douala) ; c'est elle qui range la dépense dans une période |
| Catégorie | oui | catégorie active (RG-02) |
| Libellé | oui | 2 à 200 caractères |
| Montant payé | oui | FCFA, entier > 0 (« 15 000 » accepté) |
| Moyen de paiement | oui | ceux des Encaissements (Orange Money, MTN MoMo, espèces, virement, chèque, autre), sans « Crédit client » |
| Référence | non | n° de transaction, de facture fournisseur… |
| Dossier | non | saisi par son numéro (ex. `REC-2026-00012`) ; refusé s'il n'existe pas |
| Service | non | ignoré si un Dossier est indiqué (RG-04) |
| Ville | non | référentiel géographique |
| Justificatif | non **(défaut)** | photo (JPEG, PNG, WebP) ou PDF, 5 Mo au plus, type réel vérifié (M1-DOC-02) ; stockage interne hors racine web (ADR 0003) |
| Commentaire | non | 1 000 caractères au plus |

Le montant est celui **effectivement payé**, TVA comprise le cas échéant : pas de récupération de TVA, pas de partie double ni de plan comptable (ADR 0020 §1).

**RG-02 Catégories.** Paramétrables par la Direction et l'Administrateur (permission `depense.categories`, comme `referentiel.gerer`), page *Catégories de dépenses*. Liste initiale semée par la migration **(défaut)** : Salaires et primes, Transport, Produits et consommables, Matériel, Loyer et charges, Communication et publicité, Téléphone et internet, Impôts et taxes, Frais bancaires et mobile money, Autre. Libellé unique (sans tenir compte de la casse), ordre d'affichage. Une catégorie **utilisée** ne se supprime pas : elle se **désactive** (plus proposée à la saisie ; les dépenses existantes la gardent et restent modifiables). Seule une catégorie jamais utilisée peut être supprimée. Au moins une catégorie reste active. Toute écriture est journalisée.

**RG-03 Modification.** Une dépense non annulée reste modifiable (tous les champs, justificatif remplacé ou retiré). Chaque modification est journalisée avec les seules valeurs changées, avant et après (`depense.modifiee`). Un justificatif remplacé ou retiré est supprimé du stockage après l'enregistrement.

**RG-04 Rattachement.** Une dépense rattachée à un Dossier prend le **service** du Dossier (son type : REC, NET, EV…). Sans Dossier, elle peut être rattachée directement à un service. Sans l'un ni l'autre, c'est une **charge générale** : elle compte dans les Dépenses, le résultat et la trésorerie, jamais dans une marge (ADR 0020, conséquences).

**RG-05 Liste.** Page *Dépenses* : filtres période (mois en cours par défaut) et catégorie dans l'URL, total des dépenses non annulées de la sélection, option « Voir les annulées » (barrées). Les 200 plus récentes sont affichées.

**RG-06 Annulation plutôt que suppression.** Une dépense n'est **jamais supprimée** : une erreur se corrige par une modification (RG-03) ou, pour une dépense saisie à tort ou en double, par une **annulation** avec motif obligatoire (`depense.annulee`). Une dépense annulée reste visible avec son motif, ne peut plus être modifiée et sort des indicateurs et de l'export. Raisons : garder la trace d'une pièce déjà transmise au comptable, et suivre la règle déjà retenue pour les Encaissements (MVP2-05 RG-02) et les factures (ADR 0020 §3).

**RG-07 Justificatif.** Servi par `/admin/depenses/{id}/justificatif` uniquement à un collaborateur ayant `depense.saisir` (2FA activée), sans cache. Chaque lecture (`depense.justificatif_telecharge`) et chaque refus (`acces.refuse`) sont journalisés. Jamais visible du client.

## 3. Tableau de bord direction

**RG-08 Accès et période.** Page *Pilotage*, permission `finances.tableau_de_bord` (Responsable finances, Direction). Période choisie : mois en cours par défaut, mois précédent, depuis le 1er janvier, ou dates libres (bornes incluses, inversées si besoin). Toutes les dates sont des jours de Douala. Les sommes sont calculées en SQL (`lib/depenses/indicateurs.ts`), les combinaisons dans un module pur (`lib/depenses/domaine.ts`).

Définitions uniques (ADR 0020 §2), appliquées telles quelles :

**RG-09 Facturé.** Somme TTC des factures (acompte, solde) **émises** sur la période, **moins** les avoirs émis sur la période. En base, factures et avoirs portent tous deux des montants positifs (HT, TVA et TTC figés à l'émission) : l'avoir est déduit, il n'est pas stocké en négatif. Le Facturé HT, utilisé par RG-12 et RG-14, suit la même règle sur les montants HT.

**RG-10 Encaissé.** Somme des écritures d'encaissement reçues sur la période (date de réception) : encaissements, annulations (négatives) et remboursements effectués (négatifs) — les remboursements sont donc déduits. Les écritures de **crédit client** (MVP2-05 RG-12) ne sont pas des mouvements d'argent : elles sont exclues **(défaut)**. *Écart connu* : le tableau de bord commercial (COM1-02) les inclut dans son « encaissé ».

**RG-11 Impayés par ancienneté.** Facturé non encaissé, arrêté à la fin de la période, ou à aujourd'hui si la période n'est pas terminée. Par Dossier, ce qui est réglé (encaissements nets, crédit client compris, plus les avoirs) couvre d'abord les factures les plus anciennes ; le reste dû est porté par les plus récentes. L'ancienneté d'une facture impayée compte les jours depuis son émission. Tranches **(défaut)** : 0–30, 31–60, 61–90, plus de 90 jours. Contrairement aux autres indicateurs, c'est un stock : il couvre les factures émises avant la période.

**RG-12 Dépenses.** Somme des dépenses non annulées, par date de dépense. Ventilation par catégorie.

**RG-13 Résultat et trésorerie.** Résultat mensuel estimé = Facturé HT − Dépenses (indicatif, non comptable). Trésorerie du mois = Encaissé − Dépenses payées ; toute dépense saisie est une sortie d'argent effectuée **(défaut)** : il n'existe pas de dépense « à payer ». Les deux peuvent être négatifs (affichés en rouge).

**RG-14 Marge.** Marge = Facturé HT − Dépenses rattachées, sur la période. *Par Dossier* : Dossiers facturés ou ayant une dépense rattachée sur la période (100 au plus, meilleure marge en tête). *Par service* : Facturé HT des Dossiers du service − dépenses rattachées au service (RG-04) ; les charges générales sont affichées à part. Taux de marge = marge / Facturé HT (« — » sans facturé).

## 4. Export comptable

**RG-15** Bouton *Export comptable (CSV)* sur *Pilotage* et *Dépenses*, permission `export.donnees` (Responsable finances, Direction), 2FA requise ; chaque export est journalisé (`finances.export_comptable` : période, nombre de lignes), chaque refus aussi. Contenu : factures, avoirs et dépenses **non annulées** de la période, triés par date (à date égale, factures avant dépenses). Format : séparateur `;`, UTF-8 avec BOM, fins de ligne CRLF, montants entiers en FCFA sans séparateur de milliers, formules neutralisées. Colonnes : Nature (Facture, Avoir, Dépense), Date, Pièce (numéro FAC, ou `DEP-00042` pour une dépense), Libellé, Catégorie, Client, Dossier, Service, Ville, Moyen de paiement, Référence, Montant HT, TVA, Montant TTC, Justificatif (oui/non). Les avoirs sont **négatifs** (la somme TTC des factures et avoirs donne le Facturé), les dépenses positives ; HT et TVA sont vides pour une dépense.

## 5. Critères d'acceptation

- **RG-01** — *Étant donné* le Responsable finances, *quand* il saisit « Taxi entretiens candidats », 3 500 FCFA, espèces, Dossier `rec-2026-00001`, avec la photo du reçu, *alors* la dépense est créée, rattachée au Dossier et au service REC, le justificatif est stocké sous `depenses/AAAA-MM/…` et l'action est journalisée.
- **RG-01** — *Étant donné* un Référent ou un Administrateur, *quand* il tente de saisir une dépense, *alors* l'action est refusée.
- **RG-01** — *Étant donné* une date de demain, un Dossier inexistant ou un fichier qui n'est ni une image ni un PDF, *quand* la dépense est envoyée, *alors* elle est refusée avec un message clair et aucun fichier ne reste sur le disque.
- **RG-02** — *Étant donné* la catégorie Transport utilisée, *quand* la Direction tente de la supprimer, *alors* c'est refusé avec l'invitation à la désactiver ; *quand* elle la désactive, *alors* elle n'est plus proposée à la saisie mais une dépense existante la garde.
- **RG-03** — *Étant donné* une dépense « Loyer bureau », *quand* la Direction la renomme et remplace la quittance, *alors* le journal contient `avant: { libelle: "Loyer bureau" }`, `après: { libelle: "Loyer bureau Akwa" }` et l'ancien fichier est supprimé.
- **RG-06** — *Étant donné* une dépense en double, *quand* elle est annulée sans motif, *alors* c'est refusé ; *avec* le motif « Saisie en double », *alors* elle est barrée, ne peut plus être modifiée et sort des totaux.
- **RG-07** — *Étant donné* un Référent, *quand* il ouvre le justificatif d'une dépense, *alors* il reçoit 403 et le refus est journalisé.
- **RG-09/10/12/13** — *Étant donné*, en novembre, un solde de 10 000 HT (11 925 TTC), un acompte de 20 000 émis le 31 octobre à 23 h 30 UTC (1er novembre à Douala), un avoir de 2 000, 15 000 encaissés plus 5 000 encaissés puis annulés, un crédit client de 4 000, et 63 500 de dépenses non annulées, *quand* la Direction ouvre *Pilotage* sur novembre, *alors* Facturé TTC = 29 925, Facturé HT = 28 000, Encaissé = 15 000, Dépenses = 63 500, Résultat estimé = −35 500, Trésorerie = −48 500.
- **RG-11** — *Étant donné* ces mêmes données au 20 novembre et une facture d'août de 8 000 réglée à moitié par crédit client, *alors* les impayés valent 18 925 : 14 925 entre 0 et 30 jours (2 factures) et 4 000 au-delà de 90 jours (111 jours).
- **RG-14** — *Étant donné* 3 500 de dépenses rattachées au Dossier du solde et 10 000 rattachées directement au service Nettoyage, *alors* la marge du Dossier vaut 6 500, celle du service Recrutement 24 500 (88 %), celle du Nettoyage −10 000.
- **RG-15** — *Étant donné* novembre, *quand* le Responsable finances exporte, *alors* le fichier commence par le BOM, compte 6 lignes (3 factures ou avoirs, 3 dépenses), l'avoir est à −2 000, les dépenses annulées ou d'octobre sont absentes, et l'export est journalisé.

## 6. Cas limites

- **Facture émise tard le soir** : son jour est celui de Douala (UTC+1), pas celui d'UTC.
- **Dépense modifiée après un export** : l'export suivant reflète la nouvelle valeur ; le journal garde l'ancienne. Une dépense annulée après export disparaît de l'export suivant : le comptable s'appuie sur le journal (motif, date) pour contre-passer.
- **Dossier soldé par crédit client** : n'apparaît pas en impayé, mais le crédit n'augmente ni l'Encaissé ni la Trésorerie (RG-10).
- **Trop-perçu** (réglé > facturé sur un Dossier) : aucun impayé ; pas de montant négatif dans les impayés.
- **Période à cheval sur le futur** : impayés arrêtés à aujourd'hui ; les autres indicateurs ne comptent que ce qui existe.
- **Dépense rattachée à un Dossier d'un autre service que celui choisi** : le type du Dossier fait foi (RG-04).
- **Catégorie renommée** : les dépenses déjà saisies suivent le nouveau libellé (y compris dans les exports suivants).
- **Salaires versés à plusieurs collaborateurs en une fois** : une dépense par virement ou par versement ; pas de ventilation automatique.
- **Frais Mobile Money d'une dépense** : à saisir dans le montant payé, ou en dépense séparée « Frais bancaires et mobile money » ; ceux prélevés sur un Encaissement restent régis par MVP2-05 (montant reçu).

## 7. Hors périmètre

Import CSV des dépenses (« plus tard », ADR 0020 §1), dépenses récurrentes, budget, TVA déductible, dépenses à payer (échéancier fournisseurs), multi-devises.
