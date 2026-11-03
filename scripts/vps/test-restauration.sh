#!/usr/bin/env bash
# Test de restauration (M1-SOC-05, à faire avant la mise en production puis chaque trimestre).
# Restaure la dernière sauvegarde dans un PostgreSQL TEMPORAIRE et isolé (aucun réseau, aucun
# port publié), puis compare le nombre de lignes des tables principales avec la production et
# vérifie les documents. La base de production n'est jamais modifiée.
#
# Usage (root, sur le VPS) : /opt/nexclean/test-restauration.sh
set -euo pipefail

# Variables exportées : restic les lit dans son environnement.
set -a; source /etc/nexclean/sauvegarde.env; set +a

temp=nexclean-test-restauration
dossier=$(mktemp -d /tmp/nexclean-restauration.XXXXXX)
nettoyer() {
  docker rm -f "$temp" >/dev/null 2>&1 || true
  rm -rf "$dossier"
}
trap nettoyer EXIT

prod=$(docker ps --filter "name=^${CONTENEUR_DB}" --filter status=running --format '{{.Names}}' | head -1)
[ -n "$prod" ] || { echo "Conteneur PostgreSQL de production introuvable (${CONTENEUR_DB}*)" >&2; exit 1; }

echo "== Instantanés disponibles"
restic snapshots --compact | tail -n 8

echo "== Base : restauration du dernier dump dans un PostgreSQL temporaire"
fichier=$(restic ls latest --tag db --json | sed -n 's/.*"path":"\(\/nexclean-db-[^"]*\.dump\)".*/\1/p' | head -1)
[ -n "$fichier" ] || { echo "Aucun dump de base dans la dernière sauvegarde « db »" >&2; exit 1; }
echo "dump : $fichier"
docker run -d --name "$temp" --network none -e POSTGRES_PASSWORD=restauration -e POSTGRES_USER=nexclean -e POSTGRES_DB=nexclean postgres:16-alpine >/dev/null
until docker exec "$temp" pg_isready -U nexclean -d nexclean -q; do sleep 1; done
sleep 2
restic dump --tag db latest "$fichier" | docker exec -i "$temp" pg_restore -U nexclean -d nexclean --no-owner --no-acl --exit-on-error

compter() { # $1 conteneur
  docker exec "$1" psql -U nexclean -d nexclean -At -F ' ' -c "
    select 'dossier', count(*) from dossier union all
    select 'demande', count(*) from demande union all
    select 'client', count(*) from client union all
    select 'user', count(*) from \"user\" union all
    select 'document', count(*) from document union all
    select 'journal_audit', count(*) from journal_audit union all
    select 'quartier', count(*) from quartier
    order by 1"
}
echo "== Comparaison (table : sauvegarde / production)"
ecart=0
while read -r table n_sauv; do
  n_prod=$(compter "$prod" | awk -v t="$table" '$1 == t { print $2 }')
  marque="ok"
  # La production peut avoir avancé depuis la sauvegarde (jamais reculé).
  if [ "$n_sauv" -gt "$n_prod" ] || { [ "$n_prod" -gt 0 ] && [ "$n_sauv" -eq 0 ]; }; then marque="ÉCART"; ecart=1; fi
  printf '  %-14s %6s / %-6s %s\n' "$table" "$n_sauv" "$n_prod" "$marque"
done < <(compter "$temp")

echo "== Documents"
restic restore latest --tag documents --target "$dossier" >/dev/null
n_sauv=$(find "$dossier" -type f | wc -l)
n_prod=$(find "$VOLUME_DOCUMENTS" -type f | wc -l)
echo "  fichiers : $n_sauv restaurés / $n_prod en production"

if [ "$ecart" -ne 0 ]; then echo "ÉCHEC : la restauration ne correspond pas à la production" >&2; exit 1; fi
echo "Restauration vérifiée."
