# ADR 0023 – Phasage : MVP-1 (réception et attribution), MVP-2 (cycle recrutement complet)

- **Statut :** accepté — complété par les lots COM (ADR 0025–0027, `specs/README.md`) qui avancent le point 7
- **Date :** 2026-11-02
- **Décideur :** Ange
- **Remplace :** le découpage L0–L9 du §9 du brief

## Contexte

Les décisions 0001–0022 modifient les dépendances du découpage initial (attribution simple, paiements manuels, migration précoce des formulaires de devis). Volumétrie de référence : 5 collaborateurs au démarrage, 50–300 dossiers/mois, 1 000–5 000 candidats la première année.

## Décision

### MVP-1 – « Tout arrive dans le Back-Office »
- Socle VPS / Coolify / PostgreSQL, sauvegardes externes, supervision (0001, 0002).
- Comptes collaborateurs, 2FA, 4 rôles, journal d'audit (0016, 0018).
- Client / Demande / Dossier, numérotation, statuts et phases, historique (0006, 0007).
- Référentiel géographique Douala + Yaoundé (0021).
- Formulaire « Demander du personnel » (plusieurs lignes de poste, estimation, numéro) (0008).
- Formulaires de devis général / pro / espaces verts en « enregistrer puis WhatsApp » (0022).
- Saisie manuelle de demande (0006).
- Attribution automatique, file « Non attribués », réaffectation (0019).
- Notifications internes + e-mail, modèles de messages WhatsApp (0005).
- Page de suivi client (statut seul) (0014).
- Stockage des documents / pièces jointes (0003).
- Compteurs simples : dossiers par statut, ville, référent.

### MVP-2 – « Cycle recrutement complet »
- Espace candidat : inscription, consentements, profil, CV, demande de suppression (0016, 0017).
- Candidature en base (offres encore lues depuis `jobs-data.ts`), suppression du webhook Google Sheet (0015, 0022).
- File « Nouveaux candidats », recherche / filtres, statuts candidat (0015, 0021).
- Propositions avec accord du candidat, placements confirmés sur attestation (0011, 0015, 0017).
- Grille tarifaire : commission, TVA, acompte et bornes, délai de recherche (0008, 0009).
- PDF à partir de modèles fixes à textes/paramètres modifiables : accusé de réception, devis, attestation de prise de poste, reçu, facture, avoir.
- « Valider et envoyer » ; acceptation du devis sur la page de suivi (0014).
- Encaissements manuels, calcul du solde, trop-perçu, remboursement, avoir (0004, 0010).
- Compteur de candidats inscrits.

### Après les MVP (ordre indicatif)
1. Offres administrables, migration de `jobs-data.ts` (0013).
2. Formulaire abonnement (0022).
3. Tableau de bord direction complet, dépenses, exports (0020).
4. Éditeur complet de modèles de documents.
5. Paiement en ligne via agrégateur Orange Money / MTN MoMo (0004).
6. Anonymisation automatique des profils inactifs, export des données candidat (0017).
7. API WhatsApp Business, SMS (0005).
8. Mise à disposition (0012).
9. Traduction anglaise.

## Conséquences

- Chaque MVP est utilisable en production indépendamment.
- Les specs par lot (`specs/`) suivront ce découpage : `MVP1-*`, `MVP2-*`, puis un fichier par lot ultérieur.
- La demande de suppression des données candidat est livrée dès MVP-2 ; l'anonymisation automatique peut attendre (aucun profil n'atteint 24 mois d'inactivité avant longtemps).
