# MVP2-02 – Vivier, file Nouveaux candidats, candidatures, recherche

ADR de référence : 0013, 0015, 0017, 0018, 0019, 0021, 0022.

## 1. User stories

- En tant que **référent recrutement**, je veux traiter les nouveaux inscrits de mes villes afin de qualifier rapidement le vivier.
- En tant que **référent recrutement**, je veux rechercher des candidats par critères depuis un Dossier REC afin de trouver vite des profils pertinents.
- En tant que **candidat**, je veux postuler à une offre publiée en quelques clics afin d'être considéré pour ce poste.

## 2. File Nouveaux candidats

**RG-01** Toute inscription (en ligne ou assistée) et toute candidature créant un compte léger (RG-07) crée une entrée dans la file **Nouveaux candidats**, attribuée par l'algorithme de MVP1-05 avec le service « Recrutement » et la ville du candidat (continuité non applicable).

**RG-02** Traitement : le référent consulte le profil, contacte si besoin (modèles WhatsApp « Bienvenue candidat », « Compléter votre profil »), puis fixe le statut candidat : `à contacter`, `présélectionné`, `indisponible`, ou le laisse `nouveau`. Une entrée sort de la file dès que le statut quitte `nouveau`.

**RG-03** Escalade identique aux Dossiers (Non attribués, 4 h ouvrées) ; alerte « nouveaux candidats non traités depuis 5 jours ouvrés » au référent.

## 3. Statuts candidat

**RG-04** Statuts : `nouveau`, `à contacter`, `présélectionné`, `entretien`, `proposé au client`, `placé`, `indisponible`.

**RG-05** Dérivations automatiques :
- une Proposition passe à `proposée` (accord obtenu) → statut `proposé au client` (si le statut était inférieur) ;
- une Proposition passe à `entretien` → `entretien` ;
- un Placement confirmé → `placé` ;
- « Je ne cherche plus » côté candidat → `indisponible` ;
- « Je suis toujours en recherche » côté candidat → `à contacter`.
Le référent peut corriger manuellement (journalisé).

**RG-06** Un candidat `placé` ou `indisponible` est exclu par défaut des recherches (filtre désactivable).

## 4. Candidatures (offres existantes)

**RG-07** En MVP-2, les offres restent lues depuis `content/jobs-data.ts` (ADR 0023). Le formulaire de `/recrutement/[slug]` est remplacé :
- candidat connecté → bouton « Postuler » (motivation facultative), une Candidature est créée ;
- non connecté → formulaire court : nom, prénom, téléphone, ville, quartier, métier, expérience, disponibilité, CV facultatif, mot de passe, deux consentements → crée un **compte candidat léger** (profil incomplet) + la Candidature, puis invite à compléter le profil.

**RG-08** Une Candidature référence l'offre par son `slug` (et le titre au moment de la candidature) ; elle sera reliée à l'entité Offre lors de la migration (ADR 0013).

**RG-09** Statuts : `reçue → retenue / refusée`. « Retenue » permet de créer une Proposition si l'offre est liée à un Dossier.

**RG-10** Les Candidatures sont visibles dans une liste « Candidatures » du Back-Office, filtrable par offre ; elles sont attribuées au référent qui suit l'offre (paramètre par offre : référent responsable ; à défaut, attribution par ville). Les offres de recrutement interne sont attribuées au(x) collaborateur(s) désigné(s) par la Direction.

**RG-11** L'API `/api/candidature` est réécrite : enregistrement en base, notification interne (in-app + e-mail Resend sans pièce jointe ni CV), **suppression du webhook Google Sheet** et de `CANDIDATURE_WEBHOOK_URL`. Le repli WhatsApp n'est conservé qu'en cas d'erreur serveur.

**RG-12** Un candidat ne peut pas postuler deux fois à la même offre (message « Vous avez déjà postulé »).

## 5. Recherche et filtres (Back-Office)

**RG-13** Accès : Référents ayant le service Recrutement et Direction (ADR 0018). Chaque consultation de fiche candidat et chaque téléchargement de CV sont journalisés.

**RG-14** Filtres : ville, arrondissement, quartier, **rayon** autour d'un quartier (si centroïde renseigné), zones de travail acceptées couvrant un lieu donné, métier, secteur, expérience (années), compétences (étiquettes), type de contrat, disponibilité (immédiate / d'ici une date), prétentions salariales ≤ montant, statut, date d'inscription, profil complet / CV présent.

**RG-15** Recherche plein texte sur métiers, compétences, expériences et qualifications (insensible aux accents et à la casse).

**RG-16** Depuis une ligne de poste d'un Dossier REC, le bouton « Trouver des candidats » ouvre la recherche pré-filtrée : ville et quartier du lieu d'affectation (rayon 5 km par défaut si disponible), métier = intitulé du poste, type de contrat, expérience minimale. Les résultats sont triés par pertinence simple (nombre de critères satisfaits, puis disponibilité immédiate, puis date de mise à jour du profil).

**RG-17** Depuis les résultats : ouvrir la fiche, « Envoyer sur WhatsApp » (modèles candidat), créer une Proposition (MVP2-03), changer le statut.

**RG-18** Pagination 20 résultats ; affichage en cartes sur mobile. Export **non** disponible en MVP-2.

## 6. Critères d'acceptation

- **RG-01** — *Étant donné* une inscription à Yaoundé et un référent recrutement couvrant Yaoundé, *quand* l'inscription est terminée, *alors* le candidat apparaît dans la file Nouveaux candidats de ce référent.
- **RG-05** — *Étant donné* un candidat `présélectionné`, *quand* un Placement le concernant est confirmé, *alors* son statut devient `placé`.
- **RG-07** — *Étant donné* un visiteur non inscrit, *quand* il postule à « Agent de caisse » avec le formulaire court, *alors* un compte candidat et une Candidature `reçue` sont créés, et aucun appel au webhook Google Sheet n'a lieu.
- **RG-13** — *Étant donné* un Référent sans service Recrutement, *quand* il ouvre l'URL d'une fiche candidat, *alors* il reçoit 403 et la tentative est journalisée.
- **RG-14 (rayon)** — *Étant donné* des candidats à Akwa (0 km), Bonapriso (≈ 2 km) et Bonabéri (≈ 8 km), centroïdes renseignés, *quand* le référent filtre « à 5 km d'Akwa », *alors* seuls les deux premiers apparaissent.
- **RG-16** — *Étant donné* une ligne « Serveur, CDD, Bonamoussadi », *quand* le référent clique « Trouver des candidats », *alors* la recherche s'ouvre avec ces filtres pré-remplis et modifiables.

## 7. Cas limites

- Quartier sans centroïde : le filtre rayon l'exclut, avec la mention « N candidats de quartiers non géolocalisés — afficher quand même ».
- Candidat dont les zones de travail acceptées sont « toute la ville » : correspond à tout lieu de cette ville.
- Offre fermée (`status: 'closed'`) : bouton « Postuler » remplacé par « Offre pourvue — inscrivez-vous pour être contacté ».
- Candidat qui postule à une offre de recrutement interne : même parcours ; aucune Proposition ni Placement (pas de Dossier client).
