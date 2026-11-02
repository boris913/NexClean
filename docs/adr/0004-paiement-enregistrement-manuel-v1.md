# ADR 0004 – Paiements : enregistrement manuel en V1, agrégateur Mobile Money reporté

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le brief demande un « paiement sécurisé de l'acompte (Mobile Money ou autre) » et la génération de reçus, factures et justificatifs. Le site annonce aujourd'hui trois moyens de paiement, tous traités hors ligne : espèces, Mobile Money, virement bancaire (`lib/constants.ts`, `PAYMENT_TERMS`). Le paiement en ligne Mobile Money au Cameroun passe en pratique par un agrégateur (CinetPay, Campay, NotchPay, Monetbil…) couvrant Orange Money et MTN MoMo, avec KYC entreprise et commission par transaction.

## Décision

1. Le domaine distingue l'**Encaissement** (fait qu'une somme a été reçue, quel que soit le moyen) du **paiement en ligne** (un canal possible de collecte).
2. **V1 : enregistrement manuel uniquement.** Un collaborateur autorisé enregistre l'encaissement dans le dossier : montant, moyen (espèces, Orange Money, MTN MoMo, virement…), référence de transaction, date, auteur. L'enregistrement est journalisé et déclenche la génération du reçu.
3. Le code expose dès la V1 une **interface de prestataire de paiement** (création d'une demande de paiement, réception d'une notification de paiement), sans implémentation en ligne.
4. **Lot L5** : intégration d'un agrégateur couvrant **Orange Money et MTN MoMo**, choisi sur comparaison (commissions, délais de reversement, KYC, qualité des webhooks). Pas d'intégration directe opérateur. **Carte bancaire hors périmètre** sauf demande ultérieure.

## Conséquences

- La V1 n'attend pas la validation KYC d'un agrégateur.
- Le risque d'erreur de saisie ou de fraude interne sur les encaissements manuels est réel : droit d'enregistrer un encaissement réservé à certains rôles, journalisation, et rapprochement possible avec les relevés Mobile Money (à préciser dans la matrice des droits).
- Le « paiement sécurisé » au sens du brief (lien de paiement en ligne) n'est livré qu'en L5 ; à communiquer à la direction.
- Prérequis direction : compte marchand Orange Money / MTN MoMo (voir questions ouvertes).
