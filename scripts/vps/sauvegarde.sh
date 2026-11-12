#!/usr/bin/env bash
# Sauvegarde quotidienne chiffrée (M1-SOC-05) : base PostgreSQL + documents + messagerie → stockage
# objet externe via restic. Rétention 30 jours. À lancer par cron sur le VPS (voir
# docs/exploitation.md). Signale le succès / l'échec à un service de surveillance
# (M1-SOC-06) via l'URL de ping SURVEILLANCE_PING_URL (ex. Healthchecks.io), et envoie une
# alerte e-mail en cas d'échec (alerte.sh).
#
# Variables attendues (fichier /etc/nexclean/sauvegarde.env, lisible par root seul) :
#   RESTIC_REPOSITORY      ex. s3:https://eu2.contabostorage.com/nexclean-sauvegardes
#   RESTIC_PASSWORD        clé de chiffrement du dépôt (à conserver HORS du VPS)
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   identifiants du stockage objet
#   CONTENEUR_DB           début du nom du conteneur PostgreSQL, ex. db-cwdhvioxedgfuqco8rrzjjpe
#                          (Coolify y ajoute un horodatage qui change à chaque déploiement)
#   VOLUME_DOCUMENTS       chemin hôte du volume des documents (docker volume inspect)
#   SURVEILLANCE_PING_URL  URL de ping ; « /fail » est ajouté en cas d'échec
set -euo pipefail

# Variables exportées : restic les lit dans son environnement.
set -a; source /etc/nexclean/sauvegarde.env; set +a
DOSSIER_MAIL=${DOSSIER_MAIL:-/var/lib/nexclean-mail}
CONTENEUR_MAIL=${CONTENEUR_MAIL:-nexclean-mail}

ping() { [ -n "${SURVEILLANCE_PING_URL:-}" ] && curl -fsS -m 10 --retry 3 "${SURVEILLANCE_PING_URL}$1" >/dev/null || true; }
echec() {
  ping /fail
  # Alerte e-mail directe (M1-SOC-06), indépendante du service de ping.
  [ -x /opt/nexclean/alerte.sh ] && /opt/nexclean/alerte.sh "Échec de la sauvegarde nocturne"     "La sauvegarde ${horodatage:-} a échoué (ligne $1 de sauvegarde.sh). Les sauvegardes précédentes restent intactes.

Voir : tail -50 /var/log/nexclean-sauvegarde.log, puis relancer /opt/nexclean/sauvegarde.sh à la main." || true
}
trap 'echec $LINENO' ERR

ping /start
horodatage=$(date -u +%Y%m%dT%H%M%SZ)

# Conteneur PostgreSQL en service (nom horodaté par Coolify).
conteneur=$(docker ps --filter "name=^${CONTENEUR_DB}" --filter status=running --format '{{.Names}}' | head -1)
[ -n "$conteneur" ] || { echo "Conteneur PostgreSQL introuvable (${CONTENEUR_DB}*)" >&2; false; }
echo "$(date -u +%FT%TZ) sauvegarde ${horodatage} depuis ${conteneur}"

# 1. Base : dump au format custom, envoyé directement à restic (pas de copie en clair sur disque).
docker exec "$conteneur" pg_dump -U nexclean -d nexclean --format=custom \
  | restic backup --stdin --stdin-filename "nexclean-db-${horodatage}.dump" --tag db

# 2. Documents.
restic backup "$VOLUME_DOCUMENTS" --tag documents

# 3. Messagerie : RocksDB n'a pas de sauvegarde à chaud, Stalwart est donc arrêté le temps de la
# copie. Les serveurs expéditeurs réessaient d'eux-mêmes ; il redémarre même si restic échoue.
if [ -d "$DOSSIER_MAIL" ]; then
  docker stop -t 30 "$CONTENEUR_MAIL" >/dev/null
  code=0
  restic backup "$DOSSIER_MAIL" --tag mail || code=$?
  docker start "$CONTENEUR_MAIL" >/dev/null
  [ "$code" -eq 0 ]
fi

# 4. Rétention : 30 sauvegardes quotidiennes (cf. ADR 0003 / 0017 : purge à rotation).
# Regroupement par étiquette (db, documents, mail) : le nom du dump change chaque jour.
restic forget --group-by host,tags --keep-daily 30 --prune

# 5. Vérification d'intégrité légère (5 % des données).
restic check --read-data-subset=5%

echo "$(date -u +%FT%TZ) sauvegarde ${horodatage} terminée"
# Marque de la dernière réussite, lue par surveillance.sh (fraîcheur des sauvegardes).
touch /var/lib/nexclean-sauvegarde-ok
ping ""
