# MVP1-05 – Attribution, notifications, modèles de messages, compteurs

ADR de référence : 0005, 0007, 0018, 0019.

## 1. User stories

- En tant que **direction**, je veux que chaque nouveau Dossier soit attribué automatiquement au bon référent afin que personne n'ait à trier les demandes.
- En tant que **référent**, je veux être prévenu immédiatement quand un Dossier m'est attribué afin de rappeler le client rapidement.
- En tant que **direction**, je veux voir les Dossiers que personne ne peut prendre et pouvoir les réaffecter afin qu'aucune demande ne reste sans réponse.
- En tant que **référent**, je veux envoyer au client un message WhatsApp prérempli en un clic afin de gagner du temps et rester homogène.

## 2. Attribution automatique

**RG-01** L'attribution s'exécute à la création de tout Dossier sans référent choisi, et lors d'un changement de type ou de ville qui rend le référent actuel inéligible (proposition à la Direction, pas de réattribution silencieuse).

**RG-02** Éligibilité d'un collaborateur : rôle Référent, compte actif, type de dossier dans ses services, ville du Dossier dans ses villes, non absent à la date du jour, capacité non atteinte (si définie).

**RG-03** Ordre :
1. **Continuité** — le référent du Dossier le plus récent du même Client (ouvert, ou passé à un statut final depuis moins de 12 mois), s'il est éligible ;
2. sinon, parmi les éligibles, celui qui a **le moins de Dossiers ouverts** (statuts dont la phase précède « Terminé ») ;
3. égalité → celui dont la **dernière attribution est la plus ancienne** (jamais attribué = plus ancien).

**RG-04** Chaque attribution enregistre la règle appliquée (`continuité`, `charge minimale`, `tour de rôle`, `manuelle`, `saisie — moi-même`) et apparaît dans l'historique du Dossier.

**RG-05** Aucun éligible, ou ville hors référentiel / non couverte → Dossier en file **Non attribués** (statut « Nouvelle demande », sans référent), notification immédiate à tous les collaborateurs Direction.

**RG-06** Escalade : un Dossier resté en Non attribués plus de **4 heures ouvrées** (paramètre) déclenche une relance à la Direction, répétée chaque jour ouvré à 8 h tant qu'il n'est pas attribué.

**RG-07** Heures ouvrées (paramètre, fuseau Africa/Douala), valeurs initiales reprises de `BUSINESS_HOURS` : lundi–vendredi 7 h–19 h, samedi 8 h–17 h, dimanche non ouvré.

**RG-08** Réaffectation (Direction) : choix du nouveau référent (même non éligible, avec avertissement), motif obligatoire ; notifications à l'ancien et au nouveau référent ; journalisée.

**RG-09** Un collaborateur passé « absent » conserve ses Dossiers ; la Direction voit la liste des Dossiers ouverts des absents et peut les réaffecter en masse (motif commun).

## 3. Notifications

**RG-10** Canaux MVP-1 : **dans l'application** (cloche, compteur de non-lus, liste) et **e-mail** (Resend). Pas d'envoi automatique vers clients ou candidats.

**RG-11** Événements notifiés :

| Événement | Destinataires | Canaux |
|---|---|---|
| Dossier attribué (auto ou réaffectation) | nouveau référent | in-app + e-mail |
| Dossier retiré (réaffectation) | ancien référent | in-app |
| Dossier en Non attribués | Direction | in-app + e-mail |
| Escalade Non attribués (RG-06) | Direction | e-mail |
| Dossier sans action depuis N jours (défaut 3, hors statuts finaux) | référent | in-app + e-mail récapitulatif quotidien à 8 h |
| Nouvelle Demande rattachée à un Dossier existant | référent du Dossier | in-app |

**RG-12** L'e-mail ne contient ni budget, ni salaire, ni pièce jointe : numéro, type, ville, nom du client et lien vers le Dossier (connexion requise).

**RG-13** Un échec d'envoi e-mail est retenté (3 essais) puis journalisé ; la notification in-app reste la référence.

## 4. Modèles de messages WhatsApp

**RG-14** Bibliothèque de modèles administrable (Direction, Administrateur) : nom, type(s) de dossier concernés, langue (fr par défaut), texte avec variables.

**RG-15** Variables disponibles en MVP-1 : `{{client.contact}}`, `{{client.nom}}`, `{{dossier.numero}}`, `{{dossier.type}}`, `{{dossier.ville}}`, `{{dossier.lien_suivi}}`, `{{referent.prenom}}`, `{{referent.telephone}}`, `{{postes.resume}}` (REC). Une variable inconnue bloque l'enregistrement du modèle.

**RG-16** Modèles initiaux : premier contact après demande, demande d'informations complémentaires (« À compléter »), relance sans réponse, envoi du lien de suivi, relance demande de devis.

**RG-17** Dans un Dossier, « Envoyer sur WhatsApp » : choix du modèle → aperçu modifiable → ouverture de `wa.me/<numéro client>?text=…`. Le système enregistre dans l'historique « Message WhatsApp préparé : <modèle> » avec le texte final (il ne peut pas savoir si le message a été réellement envoyé).

## 5. Compteurs (tableau de bord minimal)

**RG-18** Page d'accueil du Back-Office :
- **Référent** : mes Dossiers ouverts par statut, mes Dossiers sans action depuis N jours, mes notifications.
- **Direction** : Dossiers par phase, par type, par ville et par référent (ouverts / créés sur la période), file Non attribués, Dossiers sans action depuis N jours.
- Période sélectionnable : aujourd'hui, 7 jours, mois en cours, mois précédent.

**RG-19** Les compteurs se basent sur les phases (ADR 0007) pour être comparables entre types.

## 6. Critères d'acceptation

- **RG-03 (continuité)** — *Étant donné* un Client dont le dernier Dossier NET, clos il y a 2 mois, était traité par la référente Awa, éligible, *quand* ce Client soumet une nouvelle demande NET, *alors* le Dossier est attribué à Awa avec la règle « continuité ».
- **RG-03 (charge)** — *Étant donné* deux référents éligibles ayant 4 et 7 Dossiers ouverts, *quand* un Dossier arrive, *alors* il est attribué à celui qui en a 4.
- **RG-03 (tour de rôle)** — *Étant donné* deux référents éligibles à égalité de charge, *quand* un Dossier arrive, *alors* il est attribué à celui dont la dernière attribution est la plus ancienne.
- **RG-02** — *Étant donné* le seul référent recrutement de Yaoundé marqué absent aujourd'hui, *quand* une demande REC de Yaoundé arrive, *alors* le Dossier va en Non attribués et la Direction est notifiée.
- **RG-06** — *Étant donné* un Dossier entré en Non attribués un vendredi à 17 h, *quand* aucune action n'a lieu, *alors* l'escalade part le samedi à 10 h (2 h vendredi + 2 h samedi ouvrées), pas pendant la nuit.
- **RG-08** — *Étant donné* une réaffectation sans motif, *quand* la Direction valide, *alors* l'action est refusée.
- **RG-12** — *Étant donné* un Dossier REC avec budget, *quand* l'e-mail d'attribution est envoyé, *alors* il ne contient pas le budget.
- **RG-15** — *Étant donné* un modèle contenant `{{dossier.montant}}`, *quand* l'administrateur l'enregistre, *alors* l'enregistrement est refusé avec « Variable inconnue : dossier.montant ».
- **RG-17** — *Étant donné* un Dossier dont le client a le numéro `+237690000000`, *quand* le référent choisit « Premier contact », *alors* le lien ouvert est `https://wa.me/237690000000?text=…` avec le texte encodé et une entrée d'historique est créée.

## 7. Cas limites

- Aucun référent configuré du tout (démarrage) : tout part en Non attribués ; l'écran de la Direction affiche un avertissement « Aucun référent n'est configuré pour <service> / <ville> ».
- Référent désactivé avec des Dossiers ouverts : ses Dossiers basculent en Non attribués et la Direction est notifiée.
- Collaborateur à la fois Direction et Référent : reçoit les notifications des deux rôles, sans doublon pour un même événement.
- Client avec plusieurs Dossiers ouverts chez des référents différents : la continuité retient le Dossier le plus récent.
