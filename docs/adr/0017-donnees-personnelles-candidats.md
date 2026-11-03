# ADR 0017 – Données personnelles des candidats : consentement, transmission, conservation, suppression

- **Statut :** accepté (sous réserve de validation juridique, QO-5)
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le brief impose le consentement explicite, la confidentialité des candidatures, les droits d'accès / rectification / suppression, et interdit toute transmission de profil à un employeur sans information du candidat et sans base légale. Le Cameroun aurait adopté fin 2024 une loi sur la protection des données à caractère personnel (loi n° 2024/017, à confirmer) ; son contenu exact et ses délais d'application doivent être vérifiés par un juriste. Les règles ci-dessous suivent les standards usuels et seront ajustées si nécessaire.

## Décision

1. **Consentement à l'inscription** : deux cases distinctes, non précochées — (a) traitement du profil pour la recherche d'emploi, (b) prise de contact par NEXCLEAN. Horodatage et version du texte accepté enregistrés.
2. **Accord à chaque Proposition** : le candidat voit une proposition en attente (poste, secteur, ville, **nom du Client**) et accepte ou refuse dans son espace ; à défaut, le référent enregistre un accord WhatsApp avec capture jointe. **Sans accord, la Proposition est bloquée.**
3. **Minimisation** : le Client reçoit un profil résumé et le CV via lien d'accès temporaire ; pas de numéro ni d'adresse précise du candidat avant l'entretien sauf accord.
4. **Conservation** : profil inactif 24 mois (ni connexion ni mise à jour) → relance ; sans réponse sous 30 jours → **anonymisation** et suppression des fichiers.
5. **Suppression à la demande** depuis l'espace candidat, traitée sous **30 jours** : profil, CV, justificatifs supprimés ; Placements confirmés et pièces financières conservés **pseudonymisés** (obligations comptables) ; purge des sauvegardes à rotation.
6. **Accès / rectification** : modification en libre-service ; export des données (PDF/JSON) en lot ultérieur.
7. Réécriture de la **politique de confidentialité** (`app/confidentialite/page.tsx`).
8. **Accès internes** aux CV et données candidats journalisés (consultations, téléchargements, transmissions).

## Conséquences

- Chaque Proposition porte une trace d'accord (mode : espace candidat / WhatsApp, horodatage, preuve).
- Tâches planifiées nécessaires : détection d'inactivité, relances, anonymisation.
- La pseudonymisation doit préserver les statistiques (placements, délais) sans identifier la personne.
