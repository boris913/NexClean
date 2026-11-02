# ADR 0013 – Offres publiées : entité distincte, publication manuelle, anonyme par défaut

- **Statut :** accepté
- **Date :** 2026-11-02
- **Décideur :** Ange

## Contexte

Le brief envisage des offres consultables par les candidats, liées au placement chez des Clients. Le site actuel (`content/jobs-data.ts`) publie déjà des offres qui mélangent recrutements internes de NEXCLEAN (Community Manager, Commercial…) et postes chez des Clients (« 2 agents de caisse pour une cave à Akwa »).

## Décision

1. L'**Offre** est une entité distincte de la Ligne de poste : annonce publique rédigée pour les candidats, statut `brouillon → publiée → fermée`, date de publication.
2. **Origine** : soit une **Ligne de poste** d'un Dossier de recrutement (placement), soit un **recrutement interne** NEXCLEAN (sans Dossier client).
3. **Création par un référent**, brouillon **pré-rempli** depuis la Ligne de poste ; **jamais de publication automatique**.
4. **Anonymisation par défaut** : pas de raison sociale du Client (description générique : secteur, quartier). **Salaire publié uniquement avec l'accord du Client** (indicateur dans le Dossier).
5. **Fermeture automatique** quand la Ligne de poste liée est pourvue ou le Dossier clos ; fermeture manuelle possible.
6. Les offres de `content/jobs-data.ts` sont **migrées en base** et deviennent administrables ; le fichier est retiré.

## Conséquences

- Les pages `/recrutement` et `/recrutement/[slug]` lisent la base (rendu statique régénéré à la publication / fermeture).
- Le formulaire de candidature existant (`/api/candidature`) devra créer une Candidature en base rattachée à l'Offre, et non plus seulement envoyer un e-mail.
- Les recrutements internes suivent le même parcours candidat, sans Client ni commission.
