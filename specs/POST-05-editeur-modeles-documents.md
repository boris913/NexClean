# POST-05 – Éditeur de modèles de documents (ADR 0023, « Après les MVP » n° 4)

ADR de référence : 0018 (droit `modeles.gerer`), 0020 §3 (une facture émise ne change plus), 0023. Prolonge [MVP2-04](MVP2-04-tarification-documents.md) RG-16 : « modèles fixes dans le code, avec textes et paramètres administrables ».

## 1. Point de départ : ce qui est modifiable aujourd'hui

Relevé du code avant ce lot (`lib/documents/modeles.ts`, `lib/propositions/pdf.ts`, `lib/parametres.ts`) :

| Élément | Où | Modifiable avant POST-05 |
|---|---|---|
| Mentions légales (pied de page de tous les PDF) | paramètre `mentions_legales` | oui (Paramètres), figé sur le devis et la facture à leur création |
| Conditions générales du devis | paramètre `conditions_devis` | oui (Paramètres), figé sur le devis |
| Conditions particulières | saisie sur chaque devis | oui (référent) |
| Valeurs : validité, acompte, délai, garantie, TVA, commission | paramètres tarifaires | oui, figées sur le devis |
| Sous-titre de l'en-tête (« Nettoyage, recrutement et services ») | code | **non** |
| Phrases d'introduction, titres de section, « Prochaines étapes », phrase du reçu, « Merci d'indiquer la référence… », texte de l'avoir, textes de l'attestation, « Bon pour accord »… | code | **non** |
| Ordre des sections | code | **non** |
| Tableaux de montants, totaux, mention TVA, numérotation, références | code | non, et ne le devient pas (RG-04) |

Ce lot rend modifiables les textes figés dans le code, ajoute un texte complémentaire libre et un complément de pied de page, et permet de réordonner certaines sections. Les mentions légales et les conditions générales restent dans les Paramètres : elles sont déjà figées sur les devis et factures (MVP2-04 RG-02) et ce circuit ne change pas.

## 2. User stories

- En tant que **Direction**, je veux adapter les textes des documents PDF (introduction, conditions, mentions de pied de page…) sans intervention technique, afin qu'ils suivent l'évolution de l'offre et de la communication.
- En tant que **Direction**, je veux voir un aperçu PDF avant d'enregistrer, afin de ne jamais envoyer un document mal présenté.
- En tant que **Direction**, je veux retrouver chaque version d'un modèle et revenir à une version antérieure, afin de corriger une erreur sans tout ressaisir.
- En tant que **client**, je veux qu'une facture ou un reçu déjà reçu reste identique, afin de pouvoir m'y fier.

## 3. Règles

### Types de documents et contenu d'un modèle

**RG-01** Six modèles, un par type : accusé de réception, devis (aussi utilisé pour l'avenant), facture (acompte et solde), avoir, reçu d'encaissement, attestation de prise de poste. Un modèle est composé de **blocs de texte** et d'un **ordre des sections**. Le catalogue (blocs, sections, variables, textes d'origine, longueurs maximales) est défini dans le code (`lib/documents/personnalisation.ts`).

**RG-02** Blocs communs à tous les types : **sous-titre de l'en-tête** (sous « NEXCLEAN », vide = pas de sous-titre) et **complément du pied de page** (ajouté sous les mentions légales, vide par défaut). Chaque type a ses blocs propres :

| Type | Blocs modifiables |
|---|---|
| Accusé de réception | titre du document, introduction, titre « Postes demandés », titre et liste des prochaines étapes (une étape par ligne, numérotées automatiquement), conclusion, texte complémentaire |
| Devis / avenant | introduction, phrase de l'avenant, titre « Modalités », titres « Conditions générales » et « Conditions particulières », titre « Bon pour accord », légende du cadre de signature, texte complémentaire |
| Facture | consignes de paiement, texte complémentaire |
| Avoir | explication de l'avoir, texte complémentaire |
| Reçu | déclaration de réception, avertissement « ne constitue pas une facture », texte complémentaire |
| Attestation | titre, déclaration, constat de prise de poste, garantie de remplacement, titre de la zone client, texte complémentaire |

**RG-03** Un bloc **obligatoire** ne peut pas être vide (titres de section, déclaration et avertissement du reçu, textes de l'attestation). Un bloc facultatif vide supprime sa section ou sa ligne du PDF. Chaque bloc a une longueur maximale (de 80 à 2 000 caractères ; 600 au plus sur l'attestation, qui tient sur une page).

### Sections verrouillées

**RG-04** Restent hors de l'éditeur et toujours présents : numéro et date du document, références (dossier, devis, facture d'origine), intitulé du document dans l'en-tête (« FACTURE D'ACOMPTE », « AVOIR »…), bloc client, tableaux de lignes et de montants, totaux, mention TVA (MVP2-04 RG-19), net à payer, acompte, déduction du crédit client, modalités chiffrées du devis, situation du reçu, champs de l'attestation, mentions légales. Ce sont des données figées ou des éléments réglementaires : les rendre modifiables permettrait de produire une facture non conforme ou un document qui contredit les montants.

**RG-05** Une section est **verrouillée** quand sa place est imposée ; elle reste à sa position d'origine. Les autres sections s'échangent entre les places libres.

| Type | Sections (ordre d'origine ; 🔒 = verrouillée) | Pourquoi verrouillée |
|---|---|---|
| Accusé de réception | 🔒 Destinataire · Introduction · Postes demandés · Prochaines étapes · Conclusion · Texte complémentaire | le document s'ouvre sur son identification |
| Devis / avenant | 🔒 Destinataire · 🔒 Montants · Modalités · Conditions · Texte complémentaire · 🔒 Signature | identification en tête, montants juste après (ils fondent l'engagement), rien après le « Bon pour accord » |
| Facture | 🔒 Destinataire · 🔒 Montants · Consignes de paiement · Texte complémentaire | ADR 0020 §3 et RG-19 : la partie réglementaire est fixe |
| Avoir | 🔒 Destinataire · 🔒 Montants · Explication · Texte complémentaire | idem |
| Reçu | 🔒 Destinataire · Déclaration · 🔒 Détail du paiement · Avertissement · Texte complémentaire | le détail chiffré a une place fixe |
| Attestation | 🔒 Corps de l'attestation · Garantie · Texte complémentaire · 🔒 Signature du client | la déclaration, les champs et le constat forment une phrase ; la signature clôt le document |

La section « Postes demandés » de l'accusé de réception et la section « Conditions » du devis sont toujours présentes (données du dossier, conditions figées sur le devis) mais déplaçables.

### Variables

**RG-06** Les blocs acceptent des variables avec la syntaxe des modèles de messages : `{{dossier.numero}}` (espaces tolérés : `{{ dossier.numero }}`). Chaque type a sa liste de variables, affichée dans l'éditeur :

| Type | Variables |
|---|---|
| Accusé de réception | `dossier.numero`, `dossier.recu_le`, `client.nom`, `client.contact`, `postes.total` |
| Devis / avenant | `dossier.numero`, `client.nom`, `devis.numero`, `devis.version`, `devis.initial`, `devis.date`, `devis.validite`, `devis.total`, `devis.acompte` |
| Facture | `dossier.numero`, `client.nom`, `facture.numero`, `facture.emise_le`, `facture.net_a_payer`, `devis.numero` |
| Avoir | `dossier.numero`, `client.nom`, `avoir.numero`, `avoir.emis_le`, `avoir.montant`, `facture_origine.numero` |
| Reçu | `dossier.numero`, `client.nom`, `recu.numero`, `recu.montant`, `recu.montant_lettres`, `recu.recu_le`, `recu.nature`, `recu.moyen` |
| Attestation | `dossier.numero`, `client.nom`, `client.designation`, `candidat.nom_complet`, `poste.intitule`, `poste.date_prevue`, `garantie.jours` |

**RG-07** Une variable inconnue pour le type bloque l'enregistrement et l'aperçu ; le message nomme le bloc et la variable. Une variable sans valeur (ex. `devis.initial` sur un devis qui n'est pas un avenant) est remplacée par une chaîne vide.

### Versions

**RG-08** Sans version enregistrée, un type utilise le **modèle d'origine** (version 0), défini dans le code : le rendu est alors identique à celui d'avant ce lot.

**RG-09** Chaque enregistrement crée une **nouvelle version** numérotée (1, 2…), avec auteur, date et commentaire facultatif ; une version n'est jamais modifiée ni supprimée. L'enregistrement est journalisé (`modele_document.version_creee`, contenu avant / après). Un enregistrement sans changement est refusé. Si une autre personne a enregistré entre-temps, l'enregistrement est refusé (« rechargez la page »).

**RG-10** **Revenir à une version** (y compris la version 0) crée une nouvelle version qui recopie son contenu et indique la version d'origine ; journalisé (`modele_document.version_restauree`). L'historique reste linéaire.

**RG-11** **Version applicable à un document** : la version en vigueur à la **date de référence** du document, c'est-à-dire la dernière version créée au plus tard à cette date. Les versions étant immuables et datées, un document régénéré plus tard retrouve exactement le même modèle, sans rien stocker sur le document :

| Document | Date de référence | Conséquence |
|---|---|---|
| Facture, avoir | date d'émission | ADR 0020 §3 : une facture régénérée (archivage différé) garde le modèle de son émission |
| Reçu | date d'enregistrement de l'Encaissement | idem |
| Devis / avenant | date d'envoi (ou maintenant, au moment de « Valider et envoyer ») | le PDF envoyé est archivé et n'est plus régénéré |
| Accusé de réception | date de création du Dossier | archivé au premier téléchargement avec le modèle de la date de réception |
| Attestation | date d'établissement (maintenant) | document vivant, régénéré à chaque téléchargement (il intègre la confirmation en ligne) : il suit le modèle en vigueur ; l'exemplaire archivé à l'annonce du placement ne change pas |

**RG-12** Un PDF déjà archivé (devis envoyé, facture, avoir, reçu, accusé, attestation archivée) n'est jamais régénéré à cause d'un changement de modèle.

### Aperçu et accès

**RG-13** **Aperçu PDF** : depuis l'éditeur, avant enregistrement, le modèle en cours de saisie est rendu avec des données d'exemple (client « Hôtel du Lac (exemple) », montants fictifs) et les mentions légales courantes. Rien n'est enregistré ni journalisé. Les mêmes contrôles qu'à l'enregistrement s'appliquent (RG-03, RG-05, RG-07).

**RG-14** Accès : droit `modeles.gerer` (Direction, Administrateur ; ADR 0018), sur l'écran **Modèles**, onglet **Documents PDF** (`/admin/modeles/documents`). L'onglet **Messages WhatsApp** reste inchangé. Les actions serveur revérifient le droit.

## 4. Critères d'acceptation

- **RG-08** — *Étant donné* aucun modèle enregistré, *quand* un devis, une facture, un avoir, un reçu, un accusé de réception ou une attestation est généré, *alors* le contenu du PDF est identique à celui produit avant ce lot.
- **RG-02** — *Étant donné* un modèle de devis dont l'introduction est « Offre préparée pour {{client.nom}} », *quand* le devis est généré pour « Hôtel du Lac », *alors* le PDF contient « Offre préparée pour Hôtel du Lac ».
- **RG-03** — *Étant donné* la conclusion de l'accusé de réception vidée, *quand* le PDF est généré, *alors* la phrase de conclusion n'y figure plus ; *étant donné* le titre « Modalités » vidé, *quand* la Direction enregistre, *alors* l'enregistrement est refusé.
- **RG-05** — *Étant donné* l'ordre « Conditions » avant « Modalités » sur le devis, *quand* le PDF est généré, *alors* « Conditions générales » précède « Modalités » ; *étant donné* un ordre qui déplace « Montants » ou « Signature », *quand* la Direction enregistre, *alors* l'enregistrement est refusé.
- **RG-07** — *Étant donné* un bloc contenant `{{client.telephone}}`, *quand* la Direction enregistre ou demande l'aperçu, *alors* l'action est refusée avec « Variable inconnue dans « … » : client.telephone ».
- **RG-09** — *Étant donné* le modèle de facture en version 1, *quand* la Direction enregistre une modification, *alors* la version 2 est créée avec son nom et la date, et le journal contient `modele_document.version_creee`.
- **RG-10** — *Étant donné* les versions 1 et 2, *quand* la Direction revient à la version 1, *alors* la version 3 est créée avec le contenu de la version 1 et la mention « reprise de la version 1 ».
- **RG-11** — *Étant donné* une facture émise sous la version 1, *quand* la version 2 est enregistrée puis la facture régénérée, *alors* le PDF utilise la version 1 ; une facture émise après utilise la version 2.
- **RG-13** — *Étant donné* un modèle modifié non enregistré, *quand* la Direction clique « Aperçu PDF », *alors* un PDF d'exemple avec ses textes s'ouvre et aucune version n'est créée.
- **RG-14** — *Étant donné* un référent, *quand* il ouvre `/admin/modeles/documents` ou appelle l'action d'enregistrement, *alors* l'accès est refusé.

## 5. Cas limites

- **Ajout ou retrait d'un bloc ou d'une section dans le code** : une version enregistrée sans le nouveau bloc prend le texte d'origine de ce bloc ; un bloc retiré est ignoré ; si l'ordre enregistré ne correspond plus aux sections du code, l'ordre d'origine s'applique.
- **Texte long sur l'attestation** : l'attestation tient sur une page (pas de pagination) ; les longueurs maximales de ses blocs (RG-03) évitent le débordement dans les cas courants.
- **Caractères hors police standard** (émojis…) : remplacés par « ? », comme les autres textes des PDF.
- **Enregistrements simultanés** : la version est attribuée sous verrou ; le second enregistrement, fondé sur une version périmée, est refusé.
- **Horloge** : une version enregistrée dans la même seconde que l'émission d'une facture s'applique selon l'ordre des horodatages ; l'archivage immédiat de la facture (cas normal) rend ce cas sans effet.
- **Langue** : `fr` uniquement (traduction : lot POST-08).
- Hors périmètre : mise en page libre (polices, couleurs, logo, colonnes des tableaux), modèles par client ou par type de dossier, éditeur des e-mails.
