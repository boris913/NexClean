# MVP2-03 – Propositions, transmission au client, placements

ADR de référence : 0005, 0010, 0011, 0014, 0015, 0017.

## 1. User stories

- En tant que **référent**, je veux proposer des candidats pour une ligne de poste, avec leur accord, afin de constituer une présélection pour le client.
- En tant que **client**, je veux consulter les profils proposés sans recevoir de données inutiles afin de choisir qui rencontrer.
- En tant que **référent**, je veux enregistrer la prise de poste avec une preuve afin que le solde soit calculé sur des placements réels.

## 2. Proposition

**RG-01** États : `en attente d'accord → proposée → entretien → retenue / refusée → placée`, plus `refusée par le candidat` et `retirée` (par le référent ou suite à suppression des données).

**RG-02** Création depuis une ligne de poste (ou depuis la recherche avec choix du Dossier et de la ligne) par le référent du Dossier ou la Direction. Le Dossier doit être au statut « Recherche en cours » ou « Candidats proposés » (gardes MVP-2) ; sinon la création est refusée avec le message du statut attendu.

**RG-03** **Accord du candidat obligatoire** avant toute transmission (ADR 0017) :
- par défaut, la Proposition est `en attente d'accord` et apparaît dans l'espace du candidat (MVP2-01 RG-13) ; le référent peut lui envoyer le modèle WhatsApp « Proposition de poste » avec le lien vers son espace ;
- alternative : le référent enregistre un **accord recueilli par WhatsApp** en joignant une capture et en saisissant la date ; l'accord est marqué `whatsapp` ;
- l'accord porte sur **ce Client et ce poste** ; il n'est pas réutilisable pour un autre Client.

**RG-04** `refusée par le candidat` ne peut pas être forcée par le référent ; une nouvelle Proposition au même Client exige un nouvel accord.

**RG-05** Un même candidat ne peut avoir qu'une Proposition active par ligne de poste ; il peut avoir des Propositions actives pour plusieurs Clients (avertissement affiché au référent).

**RG-06** Le premier passage d'une Proposition à `proposée` dans un Dossier fait passer le Dossier de « Recherche en cours » à « Candidats proposés » (transition automatique, journalisée).

## 3. Transmission au client

**RG-07** Les Propositions `proposée` sont visibles du client sur la **page de suivi**, après vérification des 4 derniers chiffres de son numéro WhatsApp (ADR 0014 ; 5 essais puis blocage 30 min). Pour chaque profil : prénom + initiale du nom, métier, expérience résumée, compétences, disponibilité, quartier (sans adresse ni point de repère), CV consultable.

**RG-08** Le téléphone du candidat **n'est pas affiché** au client. L'organisation de l'entretien passe par le référent ; le référent peut, avec accord du candidat (case dans la Proposition), communiquer le numéro au client.

**RG-09** Le CV est servi via la page de suivi (contrôle du jeton + vérification), en affichage dans le navigateur avec filigrane « Transmis par NEXCLEAN à <client> le <date> » sur les CV PDF ; téléchargement journalisé (horodatage, IP).

**RG-10** Le référent peut aussi envoyer au client un **lien d'accès temporaire** à un profil précis (validité 7 jours, révocable) via « Envoyer sur WhatsApp ». Même contenu et mêmes protections que RG-07 à RG-09.

**RG-11** Le client peut indiquer sur la page de suivi, pour chaque profil : « Je souhaite le / la rencontrer » ou « Ne correspond pas » (motif facultatif) ; le référent est notifié. Ces retours n'engagent pas de statut automatique au-delà d'une notification.

## 4. Entretien et décision

**RG-12** Le référent passe la Proposition à `entretien` avec date / heure / lieu (facultatifs) ; le modèle WhatsApp « Convocation entretien » est proposé pour le candidat.

**RG-13** Résultat : `retenue` ou `refusée` (motif facultatif côté client, obligatoire si saisi par le référent pour suivi).

## 5. Placement

**RG-14** Une Proposition `retenue` peut donner lieu à un Placement **annoncé** : date de prise de poste prévue, poste, salaire convenu (facultatif, confidentiel).

**RG-15** Le système génère l'**attestation de prise de poste** (PDF, MVP2-04) pré-remplie ; le référent l'envoie au client (« Envoyer sur WhatsApp » + lien d'accès temporaire, ou via la page de suivi).

**RG-16** Confirmation : le client confirme sur la page de suivi (bouton « Je confirme la prise de poste de <prénom> le <date> », après vérification des 4 chiffres, avec nom et fonction du signataire), **ou** le référent joint la preuve (attestation signée en photo/PDF, ou capture de confirmation WhatsApp). Sans l'une ou l'autre, le Placement reste **annoncé**.

**RG-17** À la confirmation : Placement `confirmé`, Proposition `placée`, statut candidat `placé`, notification au candidat (in-app), décompte « X placés / Y demandés » mis à jour sur la ligne de poste.

**RG-18** **Garantie de remplacement** (durée paramétrable, défaut 15 jours) : si le candidat quitte le poste pendant la garantie, le référent marque le Placement `rompu pendant garantie` (motif, date). Une nouvelle Proposition de remplacement est créée sur la même ligne ; le Placement de remplacement est marqué « remplacement » et **n'ajoute pas de commission**. Le Placement rompu reste compté dans le montant final.

**RG-19** Rupture après la garantie : Placement marqué `terminé` pour information, sans effet financier.

## 6. Clôture de la recherche

**RG-20** Échéance du délai de recherche = date d'encaissement de l'acompte + délai figé au devis (défaut 30 jours), prolongeable par avenant (MVP2-04). Alerte au référent 5 jours avant l'échéance.

**RG-21** **Clôture de la recherche** par le référent : possible quand tous les postes sont pourvus, ou à l'échéance, ou avant l'échéance avec motif. Les Placements encore `annoncés` doivent être confirmés ou abandonnés avant la clôture (blocage avec la liste des placements concernés).

**RG-22** La clôture fige le nombre de placements confirmés (hors remplacements), déclenche le calcul du montant final (MVP2-05) et fait passer le Dossier à « Placements confirmés ». Les Propositions encore actives passent à `retirée` et les candidats sont notifiés.

**RG-23** À la clôture ou à la fermeture du Dossier, l'accès client aux profils (page de suivi et liens temporaires) est révoqué pour les candidats non placés.

## 7. Critères d'acceptation

- **RG-03** — *Étant donné* une Proposition `en attente d'accord`, *quand* le client ouvre sa page de suivi, *alors* ce profil n'y figure pas.
- **RG-03 (WhatsApp)** — *Étant donné* un référent qui enregistre un accord WhatsApp sans capture jointe, *quand* il valide, *alors* l'enregistrement est refusé.
- **RG-04** — *Étant donné* une Proposition `refusée par le candidat`, *quand* le référent tente de la passer à `proposée`, *alors* l'action n'est pas disponible.
- **RG-06** — *Étant donné* un Dossier « Recherche en cours », *quand* le premier candidat accepte d'être présenté, *alors* le Dossier passe à « Candidats proposés » avec une entrée d'historique « automatique ».
- **RG-07** — *Étant donné* un client sur sa page de suivi, *quand* il saisit 5 fois de mauvais chiffres, *alors* l'accès aux profils est bloqué 30 min et les tentatives sont journalisées.
- **RG-08** — *Étant donné* un profil proposé, *quand* le client le consulte, *alors* le téléphone du candidat n'apparaît nulle part (page, CV filigrané excepté si le CV le contient lui-même).
- **RG-16** — *Étant donné* un Placement annoncé sans preuve, *quand* le référent clôture la recherche, *alors* la clôture est bloquée et le placement est listé.
- **RG-18** — *Étant donné* 7 placements confirmés dont 1 rompu au 10e jour et remplacé, *quand* la recherche est clôturée, *alors* le nombre retenu pour le montant final est 7.

## 8. Cas limites

- Le CV du candidat contient son téléphone et son adresse : NEXCLEAN n'altère pas le CV ; l'accord du candidat (RG-03) porte sur la transmission du CV tel quel — mention explicite dans le texte d'accord.
- Le client recrute directement un candidat proposé sans le déclarer : le référent peut créer un Placement confirmé sur preuve (déclaration du candidat, capture) ; la clause de non-contournement (ADR 0011) s'applique au contrat.
- Candidat placé chez un Client qui demande la suppression de ses données : traitement MVP2-01 RG-17 ; le Placement reste avec un pseudonyme.
- Plus de placements que demandés sur une ligne : autorisé avec avertissement ; un avenant au devis est exigé avant la clôture (MVP2-04).
