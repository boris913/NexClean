# ADR 0022 – Formulaires du site : « enregistrer d'abord, puis WhatsApp »

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Les formulaires de devis actuels (`WhatsAppForm`, configurés dans `components/forms/quote-forms.ts`) ne persistent rien : ils ouvrent WhatsApp avec un message prérempli. La candidature passe par `/api/candidature` (e-mail Resend + webhook Google Sheet optionnel). Les commandes boutique et les boutons WhatsApp libres ne laissent aucune trace.

## Décision

1. **Devis général, pro, espaces verts (MVP)** : la soumission crée Demande + Dossier, affiche le numéro de dossier, **puis** ouvre WhatsApp avec ce numéro (pour l'envoi des photos). En cas d'échec d'enregistrement : **repli** sur le comportement WhatsApp actuel.
2. **Formulaire abonnement** : même principe, juste après le MVP.
3. **Boutons WhatsApp libres** : inchangés ; les demandes réelles sont saisies manuellement (canal « WhatsApp », ADR 0006).
4. **Candidature** : crée un compte candidat léger + une Candidature en base, puis invite à compléter le profil ; l'e-mail Resend devient une notification interne. **Le webhook Google Sheet est supprimé** (copie non maîtrisée de données personnelles, contraire aux ADR 0003 et 0017).
5. **Boutique** : hors Back-Office en V1.

## Conséquences

- Le Back-Office reçoit des demandes réelles dès le MVP, au-delà du recrutement.
- Le repli WhatsApp peut créer des demandes non enregistrées : à surveiller (événement analytique) et à saisir manuellement.
- La variable `CANDIDATURE_WEBHOOK_URL` et son code sont retirés.
