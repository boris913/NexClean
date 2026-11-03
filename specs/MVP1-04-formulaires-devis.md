# MVP1-04 – Formulaires de devis : « enregistrer d'abord, puis WhatsApp »

ADR de référence : 0005, 0006, 0021, 0022.

## 1. Périmètre

Les trois formulaires existants, configurés dans `components/forms/quote-forms.ts` et rendus par `components/forms/WhatsAppForm.tsx` :

| Formulaire (`formId`) | Page | Type de dossier créé |
|---|---|---|
| `devis` (général) | `/contact` via `ContactForm` | selon le service choisi (RG-04) |
| `devis-pro` | `/professionnels` | `NET` |
| `devis-espaces-verts` | `/espaces-verts` | `EV` |

Hors périmètre : boutons WhatsApp libres (inchangés), commande boutique (inchangée), formulaire abonnement (après MVP).

## 2. User stories

- En tant que **client**, je veux continuer à envoyer ma demande et mes photos sur WhatsApp comme aujourd'hui, avec en plus un numéro de dossier, afin d'être suivi sans effort supplémentaire.
- En tant que **référent**, je veux que chaque demande de devis du site existe dans le Back-Office avant même que le client m'écrive sur WhatsApp, afin de ne rien perdre.

## 3. Règles métier

**RG-01** À la soumission, le formulaire appelle une route serveur qui crée Client + Demande + Dossier (MVP1-02) et renvoie numéro de dossier et lien de suivi, **puis** ouvre WhatsApp avec le message structuré actuel, enrichi en tête de « Demande n° NET-2026-00042 » et en pied du lien de suivi.

**RG-02** Les champs de localisation texte libre (« Ville / quartier », « Quartier ») sont remplacés par Ville + Quartier issus du référentiel (avec « Autre »), comme MVP1-03 ; le reste des champs est conservé à l'identique (mêmes libellés, mêmes options).

**RG-03** Le champ « Téléphone / WhatsApp » devient l'identifiant du Client (normalisation E.164).

**RG-04** Formulaire général : service « Entretien Espaces Verts » → `EV` ; « Entretien Régulier (Abonnement) » → `ABO` ; tout autre service ou « Autre » → `NET`.

**RG-05** Case de consentement obligatoire identique à MVP1-03 (traitement + contact WhatsApp).

**RG-06 – Repli.** Si la route serveur échoue (erreur, délai > 8 s, hors ligne), le formulaire ouvre WhatsApp avec le message actuel sans numéro, et enregistre un événement analytique `quote_form_fallback`. Le client n'est jamais bloqué.

**RG-07** L'écran après envoi affiche le numéro de dossier et le rappel actuel : « Joignez vos photos ou vidéos dans la conversation WhatsApp ». Si l'ouverture automatique de WhatsApp est bloquée par le navigateur, un bouton « Ouvrir WhatsApp » est affiché.

**RG-08** Anti-robot et limitation de débit identiques à MVP1-03 ; anti-doublon de MVP1-02 §10.

**RG-09** L'événement analytique existant `quote_form_submit` est conservé et complété du type de dossier.

## 4. Critères d'acceptation

- **RG-01** — *Étant donné* le formulaire devis pro valide, *quand* le client l'envoie, *alors* un Dossier `NET` est créé et WhatsApp s'ouvre avec un message commençant par « Demande n° NET-2026-… ».
- **RG-04** — *Étant donné* le formulaire général avec le service « Entretien Espaces Verts », *quand* il est envoyé, *alors* le Dossier créé est de type `EV`.
- **RG-06** — *Étant donné* le serveur indisponible, *quand* le client envoie le formulaire, *alors* WhatsApp s'ouvre avec le message structuré (sans numéro) et un événement `quote_form_fallback` est émis.
- **Non-régression** — *Étant donné* chacun des trois formulaires, *quand* on compare le message WhatsApp généré avant et après migration, *alors* tous les champs d'origine y figurent avec les mêmes libellés.

## 5. Cas limites

- Le client envoie le formulaire puis n'écrit jamais sur WhatsApp : le Dossier existe et est attribué ; le référent peut relancer via le modèle de message « relance demande de devis » (MVP1-05).
- Le client écrit sur WhatsApp sans le numéro : le référent retrouve le Dossier par recherche sur le téléphone (MVP1-02 RG-21).
- Envoi en mode repli puis renvoi réussi quelques minutes plus tard : anti-doublon applicable uniquement aux Demandes enregistrées ; le référent rattache si besoin.
