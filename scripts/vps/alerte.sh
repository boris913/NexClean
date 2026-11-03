#!/usr/bin/env bash
# Envoi d'une alerte d'exploitation par e-mail (M1-SOC-06), via l'API Resend déjà utilisée par
# l'application. Utilisé par sauvegarde.sh (échec) et surveillance.sh (espace disque).
#
# Usage : /opt/nexclean/alerte.sh "Sujet" "Texte de l'alerte"
#
# Variables attendues (fichier /etc/nexclean/alertes.env, lisible par root seul) :
#   RESEND_API_KEY        clé Resend (droit d'envoi seul), la même que l'application
#   ALERTE_EXPEDITEUR     ex. NexClean Serveur <no-reply@nexclean.xyz>
#   ALERTE_DESTINATAIRES  adresses séparées par des virgules
set -euo pipefail

set -a; source /etc/nexclean/alertes.env; set +a

sujet="[NEXCLEAN serveur] $1"
texte="$2

Serveur : $(hostname) — $(date -u '+%Y-%m-%d %H:%M UTC') ($(TZ=Africa/Douala date '+%H:%M') à Douala)
Journaux : /var/log/nexclean-*.log
Procédures : docs/exploitation.md"

# JSON construit par python3 (présent sur Ubuntu) : échappement fiable du texte libre.
corps=$(SUJET="$sujet" TEXTE="$texte" python3 -c '
import json, os
print(json.dumps({
  "from": os.environ["ALERTE_EXPEDITEUR"],
  "to": [a.strip() for a in os.environ["ALERTE_DESTINATAIRES"].split(",") if a.strip()],
  "subject": os.environ["SUJET"],
  "text": os.environ["TEXTE"],
}))')

if curl -fsS -m 20 --retry 3 https://api.resend.com/emails \
  -H "Authorization: Bearer ${RESEND_API_KEY}" -H 'Content-Type: application/json' \
  -d "$corps" >/dev/null; then
  echo "$(date -u +%FT%TZ) alerte envoyée : $1"
else
  echo "$(date -u +%FT%TZ) ÉCHEC d'envoi de l'alerte : $1" >&2
  exit 1
fi
