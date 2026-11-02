# MVP2-05 – Encaissements manuels, solde, trop-perçu, remboursement, avoir

ADR de référence : 0004, 0009, 0010, 0018, 0020.

## 1. User stories

- En tant que **référent ou responsable finances**, je veux enregistrer un paiement reçu (Mobile Money, espèces, virement) afin que le reçu soit généré et le Dossier avance.
- En tant que **direction**, je veux valider tout remboursement afin de maîtriser les sorties d'argent.
- En tant que **client**, je veux un reçu pour chaque paiement et savoir précisément ce qu'il me reste à payer.

## 2. Encaissement

**RG-01** Enregistrement par : référent du Dossier, Responsable finances, Direction (ADR 0018). Champs : nature (`acompte`, `solde`, `autre`), montant (FCFA, entier > 0), moyen (`Orange Money`, `MTN MoMo`, `espèces`, `virement`, `chèque`, `autre`), référence de transaction (obligatoire sauf espèces), date de réception (≤ aujourd'hui), justificatif (obligatoire sauf espèces ; photo du reçu opérateur ou de l'avis de virement), commentaire.

**RG-02** Un Encaissement est **immuable** après enregistrement. Une erreur se corrige par une **annulation** (Direction ou Responsable finances, motif obligatoire) qui crée une écriture inverse liée ; le reçu d'origine est marqué « annulé » et un nouveau reçu est émis si besoin.

**RG-03** Doublon : une même référence de transaction et un même moyen ne peuvent être enregistrés deux fois (blocage avec lien vers l'Encaissement existant).

**RG-04** Chaque Encaissement génère un **reçu** PDF (MVP2-04), archivé et visible sur la page de suivi.

**RG-05** Gardes de statut (remplacent le mode transitoire pour REC) :
- « Acompte reçu » est atteint automatiquement quand la somme des Encaissements `acompte` ≥ montant d'acompte du devis accepté ;
- un acompte partiel laisse le Dossier en « Accepté » avec l'indication « acompte partiel : X / Y » ;
- « Recherche en cours » est accessible au référent seulement après « Acompte reçu » ; la date d'échéance du délai de recherche est calculée à partir de la date de l'Encaissement qui complète l'acompte (MVP2-03 RG-20).

**RG-06** L'encaissement d'acompte peut être enregistré avant l'acceptation formelle du devis (client qui paie directement) ; il est alors rattaché au devis `envoyé` et l'acceptation doit être enregistrée (MVP2-04 RG-15) pour que le Dossier avance.

## 3. Montant final et solde

**RG-07** À la clôture de la recherche (MVP2-03 RG-22) : montant final TTC = Σ (placements confirmés de la ligne hors remplacements × commission figée de la ligne) × (1 + TVA figée), arrondi au FCFA.

**RG-08** Solde = montant final − Σ Encaissements nets (acompte compris).
- Solde > 0 : facture de solde émise (MVP2-04 RG-18) ; le Dossier passe à « Placements confirmés » ; « Solde reçu » est atteint automatiquement quand le solde est entièrement encaissé.
- Solde = 0 : le Dossier passe directement à « Solde reçu ».
- Solde < 0 : **trop-perçu** (§4).

**RG-09** Impayé : une facture de solde non réglée 15 jours après émission (paramètre) déclenche une alerte au référent et au Responsable finances, puis tous les 7 jours ; le modèle WhatsApp « Relance solde » est proposé.

## 4. Trop-perçu, remboursement, avoir

**RG-10** En cas de trop-perçu, un avoir est émis sur la facture d'acompte (MVP2-04 RG-18) et le référent prépare un **ajustement** en indiquant le choix du client : `remboursement` ou `crédit sur un prochain dossier`.

**RG-11** **Remboursement** : statut `à valider` → validé par la Direction (ou refusé avec motif) → `effectué` quand le Responsable finances ou la Direction enregistre la sortie (moyen, référence, date, justificatif). Le remboursement apparaît comme un Encaissement négatif. Le Dossier passe à « Solde reçu » une fois le remboursement effectué.

**RG-12** **Crédit client** : le montant devient un solde créditeur du Client, visible sur sa fiche et proposé automatiquement comme déduction lors du prochain devis de ce Client (la déduction apparaît sur la facture concernée). Pas d'expiration en MVP-2.

**RG-13** Clôture : le Dossier peut passer à « Clôturé » (référent ou Direction) quand le solde est nul, sans remboursement en attente, et que tous les documents attendus sont émis.

## 5. Vue financière du Dossier

**RG-14** Onglet « Finances » du Dossier (référent du Dossier, Responsable finances, Direction) : devis et avenants, factures et avoirs, Encaissements (et annulations), remboursements, montant final, reste à payer ou trop-perçu, échéance du délai de recherche.

**RG-15** La page de suivi du client affiche (après vérification) : montant du devis, acompte demandé, montants payés, reste à payer, et les reçus / factures téléchargeables. Aucune donnée interne (commentaires, justificatifs).

## 6. Critères d'acceptation

- **RG-03** — *Étant donné* un Encaissement MTN MoMo de référence `MP2611.1234.A`, *quand* un second est saisi avec la même référence, *alors* il est refusé avec un lien vers le premier.
- **RG-05** — *Étant donné* un acompte de 25 000 et un Encaissement de 15 000, *quand* il est enregistré, *alors* le Dossier reste « Accepté » avec « acompte partiel : 15 000 / 25 000 » ; *quand* 10 000 de plus sont encaissés, *alors* il passe à « Acompte reçu ».
- **RG-08 (7/10)** — *Étant donné* 10 personnes à 5 000, acompte 25 000 encaissé, 7 placements confirmés, *quand* la recherche est clôturée, *alors* le montant final est 35 000, une facture de solde de 10 000 est émise.
- **RG-08 (4/10)** — *Étant donné* le même Dossier avec 4 placements, *quand* la recherche est clôturée, *alors* le montant final est 20 000, un avoir de 5 000 est émis et un ajustement « trop-perçu 5 000 » est à préparer.
- **RG-11** — *Étant donné* un remboursement `à valider`, *quand* un Référent tente de le valider, *alors* l'action est refusée (403) ; *quand* la Direction le valide, *alors* il passe à `validé` et le Responsable finances est notifié.
- **RG-12** — *Étant donné* un Client avec un crédit de 5 000, *quand* le référent crée un nouveau devis pour ce Client, *alors* la déduction de 5 000 est proposée et, si conservée, figure sur la facture.
- **RG-02** — *Étant donné* un Encaissement enregistré, *quand* le référent tente de modifier le montant, *alors* seule l'action « Demander l'annulation » est disponible.

## 7. Cas limites

- Client qui paie l'acompte et le solde en une fois au départ : Encaissement nature `acompte` plafonné au montant d'acompte ; l'excédent est enregistré `autre` et imputé au solde à la clôture.
- Paiement reçu sur le numéro personnel d'un collaborateur : enregistré normalement, commentaire obligatoire ; signalé dans la vue Responsable finances (moyen « autre »).
- Frais opérateur Mobile Money déduits : le montant enregistré est le montant **reçu** ; l'écart avec le montant dû reste dans le reste à payer (décision du référent : relance ou annulation de l'écart par la Direction via avoir).
- Dossier « Sans suite » après acompte (client qui abandonne) : traité comme une clôture de recherche anticipée avec motif ; les placements confirmés éventuels sont dus, le reste suit RG-10.
