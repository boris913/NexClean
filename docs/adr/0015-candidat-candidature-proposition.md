# ADR 0015 – Candidat hors modèle Dossier ; Candidature et Proposition distinctes

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le brief range l'inscription candidat parmi les « dossiers » du Back-Office soumis à attribution (§5 M4.1). Or le candidat n'a ni devis, ni encaissement, ni cycle commercial. Le brief distingue aussi la candidature (le candidat postule à une offre) de la proposition (un référent présente un candidat à un client).

## Décision

1. Le **Candidat** est une entité propre, **hors modèle Dossier**, avec un **statut candidat** : nouveau, à contacter, présélectionné, entretien, proposé au client, placé, indisponible. L'ensemble des candidats forme le **Vivier**.
2. Chaque nouvelle inscription entre dans une **file « Nouveaux candidats »**, **attribuée** à un référent recrutement selon les règles d'attribution (ville notamment), pour vérification et qualification.
3. **Candidature** = lien Candidat ↔ Offre, à l'initiative du candidat ; statut : reçue → retenue / refusée. Visible dans le Dossier lié à l'Offre s'il existe.
4. **Proposition** = lien Candidat ↔ Ligne de poste d'un Dossier, à l'initiative du référent (que le candidat ait postulé ou non) ; statut : proposée → entretien → retenue / refusée → placée. **Une Proposition exige que le candidat ait été informé et ait accepté d'être présenté à ce Client.**
5. Une Proposition « placée » donne lieu à un **Placement** (ADR 0011).
6. Le statut candidat est **en partie dérivé** des Propositions (« proposé au client », « placé »), avec correction manuelle possible.
7. Les statistiques candidats reposent sur Candidat, Candidature, Proposition et Placement.

## Conséquences

- Le Back-Office a deux grandes files de travail : Dossiers et Nouveaux candidats ; le moteur d'attribution doit servir les deux.
- Le consentement du candidat est vérifié au niveau de chaque Proposition (modalités à fixer avec la question des données personnelles).
