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

## Mise en œuvre (2026-11-13)

- Table `offre` (migration `0024_offres`), écran Back-Office **Offres d'emploi** (`/admin/offres`), droit `offre.gerer` : Direction et Référents du service Recrutement. Les 8 offres du fichier sont reprises par la migration (publiées → `publiee`, pourvues → `fermee`).
- **Écart au point 4 :** l'accord du Client sur le salaire est porté par l'**Offre** (case « le client a donné son accord »), pas par le Dossier. Le salaire n'est jamais repris dans le brouillon pré-rempli ; une offre de placement avec salaire ne s'enregistre pas sans cette case. Un indicateur dans le Dossier n'apportait rien de plus, puisque seule l'Offre est publiée.
- **Adresse (slug) figée** dès la première publication : Candidatures et responsables d'offre y restent rattachés (pas de clé étrangère, pour ne pas toucher aux candidatures existantes).
- **Fermeture automatique** : placement confirmé qui pourvoit la ligne, Dossier passé à un statut final, clôture de la recherche, date limite de candidature dépassée (tâche planifiée). Le site public se met à jour sous 10 minutes dans ces cas (cache), immédiatement après une action manuelle ; la candidature, elle, est refusée tout de suite car elle relit la base.
- Un brouillon jamais publié et sans candidature peut être supprimé ; une offre publiée ne revient jamais en brouillon (elle se ferme, puis peut être rouverte).
