# POST-02 – Formulaire abonnement (ADR 0022 §2)

Lot « Après les MVP » n° 2 de l'ADR 0023. Il reprend le circuit des formulaires de devis de [MVP1-04](MVP1-04-formulaires-devis.md), sans nouvelle règle de fond.

## User story

En tant que particulier ou entreprise intéressé par un entretien régulier, je veux décrire mon besoin d'abonnement sur `/abonnements`. Je reçois un numéro de suivi, puis je poursuis sur WhatsApp, afin qu'un conseiller construise la formule avec moi sans que ma demande se perde.

## Règles

- **RG-01** Le formulaire `demande-abonnement` suit le circuit MVP1-04 : il crée la Demande et le Dossier, affiche le numéro, puis ouvre WhatsApp avec ce numéro et le lien de suivi. Si l'enregistrement échoue, il retombe sur le comportement WhatsApp (MVP1-04 RG-06). L'anti-abus est celui de MVP1-04 RG-08 (champ piège, limite par IP, anti-doublon).
- **RG-02** Champs :

  | Champ | Obligatoire |
  |---|---|
  | Nom / Entreprise | oui |
  | Vous êtes (Particulier / Entreprise ou organisation) | oui |
  | Téléphone / WhatsApp | oui |
  | Formule (Particuliers / Professionnels / Espaces verts / Je ne sais pas encore) | oui |
  | Site à entretenir | oui |
  | Ville / quartier (référentiel, avec « Autre ») | oui |
  | Fréquence souhaitée | oui |
  | Surface | non |
  | Début souhaité | non |
  | Précisions | non |

  Le consentement est requis, comme dans MVP1-04.
- **RG-03** Le Dossier créé est toujours de type **ABO**, y compris pour la formule « Espaces verts » : c'est un contrat récurrent. Secteur = site à entretenir ; description = précisions. La formule et la fréquence sont conservées dans les données de la Demande.
- **RG-04** Le Client est un particulier si « Vous êtes » vaut Particulier (le contact est alors le nom saisi), sinon une entreprise.
- **RG-05** Sur `/abonnements`, le bouton principal « Demander une formule » renvoie vers le formulaire. Le lien WhatsApp direct reste disponible (ADR 0022 §3 : boutons WhatsApp libres inchangés), tout comme les liens WhatsApp des cartes de formules.

## Critères d'acceptation

- Étant donné un formulaire abonnement complet, quand il est envoyé, alors un Dossier `ABO-AAAA-NNNNN` est créé au statut « Nouvelle demande », avec la formule et la fréquence dans la Demande.
- Étant donné « Vous êtes : Particulier », alors le Client est un particulier ; sinon une entreprise.
- Étant donné un champ obligatoire vide, alors l'envoi est refusé avec une erreur sur ce champ, et aucun Dossier n'est créé.
