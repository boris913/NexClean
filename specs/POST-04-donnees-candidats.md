# POST-04 – Données personnelles des candidats : conservation et export (ADR 0017 §4, §6)

Lot « Après les MVP » n° 4 du plan (`docs/etat-adr.md` § 4). Il complète [MVP2-01](MVP2-01-espace-candidat.md) : consentements, accord par Proposition et suppression à la demande y sont déjà livrés. Ce lot ajoute la **durée de conservation** (relance puis anonymisation d'un profil inactif) et l'**export « Mes données »** depuis l'espace candidat.

Les textes destinés aux candidats (notification, e-mails, modèle WhatsApp) sont des **textes par défaut, à valider par la Direction** (QO-5 de l'ADR 0017 : validation juridique). Ils sont regroupés dans `lib/candidats/donnees.ts` et dans la migration du modèle WhatsApp.

## User stories

- En tant que candidat inscrit, je veux être prévenu avant que mon profil inactif soit effacé, afin de pouvoir le garder si je cherche encore un emploi.
- En tant que candidat, je veux télécharger toutes les données que NEXCLEAN conserve à mon sujet, en PDF lisible et en JSON réutilisable, afin d'exercer mon droit d'accès sans passer par un conseiller.
- En tant que référent recrutement, je veux être alerté quand un de mes candidats est relancé, avec un message WhatsApp prêt, et pouvoir noter sa réponse, afin qu'un candidat joignable seulement par WhatsApp ne soit pas anonymisé à tort.
- En tant que Direction, je veux que la conservation soit appliquée automatiquement et tracée, afin de respecter la durée annoncée dans la politique de confidentialité.

## Règles

### Conservation (ADR 0017 §4)

- **RG-01 Activité.** La dernière activité d'un candidat est la plus récente de ces dates : inscription, mise à jour du profil (profil, documents, « Je suis / ne suis plus en recherche »), connexion, **visite de l'espace avec une session déjà ouverte** (enregistrée au plus une fois par heure), Candidature envoyée, réponse à une Proposition (espace ou accord WhatsApp enregistré), Placement confirmé, réponse à la relance notée par le référent (RG-04). Les actions des collaborateurs sur le candidat ne comptent pas.
- **RG-02 Inactivité.** Un profil dont la dernière activité date de **24 mois** ou plus (mois calendaires) est relancé, une seule fois.
- **RG-03 Relance.** La relance comprend, dans la même transaction : la date de relance sur le candidat, une **notification dans l'espace candidat**, une **alerte au référent** (in-app et e-mail ; à la Direction si le candidat n'a pas de référent actif) qui l'invite à envoyer le modèle WhatsApp « Relance inactivité » depuis la fiche, et une entrée au journal (`candidat.relance_inactivite`). Après la transaction, un **e-mail** est envoyé au candidat si une adresse est connue (un échec d'envoi ne bloque rien : notification et alerte restent).
- **RG-04 Réponse.** Toute activité (RG-01) postérieure à la relance l'annule. Si le candidat répond sur WhatsApp, le référent ou la Direction clique « Le candidat a répondu » sur la fiche (`candidat.conservation_confirmee`) : cela vaut activité. L'annulation est journalisée (`candidat.relance_inactivite_annulee`, raison `activite` ou `processus_actif`).
- **RG-05 Anonymisation.** Sans activité **30 jours** après la relance, les données sont effacées comme pour une suppression à la demande (MVP2-01 RG-17) : profil remplacé par le pseudonyme, expériences, consentements, jetons, notifications du candidat supprimés, **fichiers supprimés du stockage**, **sessions supprimées**. Sont conservés sous pseudonyme : Propositions, Placements, pièces de preuve et pièces financières, et les **Candidatures** (sans la motivation, texte libre), le candidat n'étant plus identifiable. Journal : `candidat.anonymise` (motif `inactivite`). E-mail d'information si une adresse existait. La décision est revérifiée sous verrou juste avant l'effacement (une connexion de dernière minute l'empêche).
- **RG-06 Processus actif.** Un candidat avec une Proposition en cours (`en_attente_accord`, `proposee`, `entretien`, `retenue`) ou un Placement annoncé non confirmé n'est **ni relancé ni anonymisé** : on n'efface pas une personne au milieu d'un recrutement. Une relance en cours est annulée si un tel processus s'ouvre ; une nouvelle relance aura lieu, avec un nouveau délai de 30 jours, si le profil est toujours inactif à la fin du processus. Un Placement confirmé compte comme activité (RG-01) : un candidat placé récemment n'est pas relancé avant 24 mois.
- **RG-07 Suppression demandée.** Un candidat dont la suppression est demandée, ou dont les données sont déjà supprimées, n'entre pas dans ce circuit (MVP2-01 RG-15..18).
- **RG-08 Tâche planifiée.** `appliquerConservation` (dans `lib/taches.ts`, toutes les 15 minutes) examine au plus 200 candidats par passage. Elle est idempotente : relance posée seulement si aucune n'est en cours, annulation seulement si la relance lue est toujours celle en base, effacement seulement si les données ne sont pas déjà supprimées. Un candidat en erreur ne bloque pas les autres.

### Export « Mes données » (ADR 0017 §6)

- **RG-09 Accès.** Bloc « Mes données » dans l'espace candidat : deux téléchargements, **PDF** et **JSON**. Uniquement pour le candidat connecté (session de l'espace candidat, ADR 0024) et pour ses propres données ; jamais depuis une session du Back-Office.
- **RG-10 Contenu.** Profil (identité, contacts, localisation avec les noms de lieux, recherche, parcours, disponibilité, dates du compte), **consentements** (type, version, canal, IP, horodatage, et texte accepté quand la version est la version courante), expériences, **liste** des documents (nom, type, taille, date : les fichiers eux-mêmes se téléchargent déjà un par un), Candidatures (offre, motivation, statut tel que montré au candidat), **Propositions et accords** (mêmes informations que l'espace : poste, Client, lieu, contrat, salaire seulement s'il est communicable, mode et date de l'accord, numéro communiqué ou non, entretien), Placements (poste, employeur, statut, dates), notifications de l'espace. Le JSON porte un format, une version, la date de génération et le responsable du traitement. Le PDF présente le même contenu, lisible sur téléphone (gabarit commun des documents, police ≥ 10 pt).
- **RG-11 Exclusions.** Jamais : mot de passe haché, jetons, sessions, clés de stockage, statut interne et référent, notes, motifs saisis par les collaborateurs, retours des Clients, salaire convenu d'un Placement, données d'autres personnes. Le nom du Client d'une Proposition figure, comme dans l'espace (ADR 0017 §2).
- **RG-12 Fréquence.** Au plus **5 exports par 24 heures glissantes** et par candidat (tous formats confondus) ; au-delà, message « Vous avez déjà téléchargé vos données 5 fois en 24 heures. Réessayez plus tard. » (HTTP 429).
- **RG-13 Journal.** Chaque export est journalisé (`candidat.export_donnees`, acteur candidat, IP, format, taille) et apparaît dans l'historique de la fiche.
- **RG-14 Fichiers.** Nom `nexclean-mes-donnees-AAAA-MM-JJ.json` ou `.pdf` (jour à Douala), téléchargement en pièce jointe, `Cache-Control: private, no-store`.

## Critères d'acceptation

- **RG-02, RG-03** — *Étant donné* un candidat sans activité depuis 25 mois, *quand* la tâche s'exécute, *alors* il reçoit une notification dans son espace (et un e-mail s'il a une adresse), son référent reçoit une alerte citant le modèle « Relance inactivité », et le journal contient `candidat.relance_inactivite` ; *quand* la tâche s'exécute de nouveau, *alors* rien n'est envoyé une seconde fois.
- **RG-03** — *Étant donné* un candidat inactif sans référent actif, *quand* il est relancé, *alors* l'alerte va à la Direction.
- **RG-04** — *Étant donné* un candidat relancé qui se connecte, *quand* la tâche s'exécute, *alors* la relance est annulée et journalisée, et il n'est pas anonymisé.
- **RG-04** — *Étant donné* un candidat relancé depuis 40 jours dont le référent a noté la réponse WhatsApp, *quand* la tâche s'exécute, *alors* la relance est annulée et les données sont conservées.
- **RG-05** — *Étant donné* un candidat relancé depuis 31 jours, sans activité, avec un CV, une session, une Candidature et un Placement, *quand* la tâche s'exécute, *alors* le profil porte le pseudonyme, le CV n'existe plus sur le disque, la session est supprimée, la Candidature est conservée sans motivation, la Proposition et le Placement sont conservés, et le journal contient `candidat.anonymise`.
- **RG-06** — *Étant donné* un candidat relancé depuis 40 jours avec une Proposition au statut « proposée », *quand* la tâche s'exécute, *alors* il n'est pas anonymisé, la relance est annulée (raison `processus_actif`) et il n'est pas relancé tant que la Proposition est en cours.
- **RG-07** — *Étant donné* un candidat inactif dont la suppression est demandée, *quand* la tâche s'exécute, *alors* il n'est ni relancé ni anonymisé par ce circuit.
- **RG-10, RG-11** — *Étant donné* un candidat connecté avec une Proposition refusée (motif interne, retour client), un jeton de réinitialisation et un autre candidat proposé au même Client, *quand* il télécharge le JSON, *alors* il y trouve son profil, ses consentements et sa Proposition avec le nom du Client et le mode d'accord, et n'y trouve ni mot de passe haché, ni jeton, ni motif interne, ni retour client, ni l'autre candidat.
- **RG-10** — *Quand* il télécharge le PDF, *alors* il obtient un PDF valide, paginé si nécessaire.
- **RG-12, RG-13** — *Étant donné* 5 exports en 24 heures, *quand* le candidat en demande un sixième, *alors* il est refusé avec le message de RG-12, et le journal contient exactement 5 `candidat.export_donnees`.

## Cas limites

- **Compte léger** (créé par une candidature, MVP2-02 RG-07) : même règle. Son activité inclut la Candidature qui l'a créé ; il n'a souvent pas d'e-mail, la relance passe alors par la notification de l'espace et le WhatsApp du référent.
- **Compte assisté jamais activé** (sans mot de passe) : même règle ; le message WhatsApp invite à répondre directement au référent, qui note la réponse (RG-04).
- **Session « rester connecté » (30 jours)** : une simple visite de l'espace compte comme activité (RG-01), sans nouvelle connexion.
- **Relance puis Proposition** : la relance est annulée (RG-06) ; le délai de 30 jours repart de zéro à la prochaine relance.
- **Suppression demandée pendant une relance** : la suppression à la demande s'applique (RG-07) ; la relance reste notée mais n'a plus d'effet.
- **Connexion pendant l'exécution de la tâche** : l'effacement revérifie la décision sous verrou de la ligne candidat (RG-05).
- **E-mail en échec** : la relance reste valable (notification et alerte au référent) ; l'e-mail n'est pas renvoyé.
- **Export d'un compte en cours de suppression** : impossible, la session est fermée dès la demande (MVP2-01 RG-16).
- **Texte de consentement d'une ancienne version** : la version et l'horodatage sont exportés ; le texte n'est joint que pour la version courante (les anciens textes ne sont pas conservés dans le code).

## Hors périmètre

- Purge des sauvegardes (rotation de 30 jours, déjà en place, MVP2-01 RG-17).
- Export des données par un collaborateur pour le compte d'un candidat (le candidat sans accès à son espace passe par la réinitialisation assistée).
- Rédaction juridique de la politique de confidentialité (ADR 0017 §7) : seul le passage sur la durée de conservation des candidatures est aligné sur ces règles, à valider par la Direction.
