#!/usr/bin/env bash
# Contrôles internes du serveur (M1-SOC-06), lancés chaque heure par cron :
#   - espace disque libre < 20 % sur / ;
#   - application ou base arrêtée / en mauvaise santé ;
#   - aucune sauvegarde réussie depuis plus de 26 h (sauvegarde qui n'a pas tourné du tout).
# Une alerte e-mail (alerte.sh) part au premier constat, puis au plus une fois par 24 h tant que
# le problème dure, et un message de retour à la normale est envoyé quand il disparaît.
#
# La disponibilité du site vue d'Internet relève d'un service externe (UptimeRobot) : si le
# serveur tombe, il ne peut plus rien signaler lui-même.
set -uo pipefail

ETAT=/var/lib/nexclean-surveillance
JOURNAL_SAUVEGARDE=/var/log/nexclean-sauvegarde.log
MARQUE_SAUVEGARDE=/var/lib/nexclean-sauvegarde-ok   # touchée par sauvegarde.sh après chaque réussite
APPLI=app-cwdhvioxedgfuqco8rrzjjpe
BASE=db-cwdhvioxedgfuqco8rrzjjpe
mkdir -p "$ETAT"

# signaler <clé> <sujet> <texte> : alerte au plus une fois par 24 h pour une même clé.
signaler() {
  local f="$ETAT/$1"
  if [ ! -f "$f" ] || [ -n "$(find "$f" -mmin +1440)" ]; then
    /opt/nexclean/alerte.sh "$2" "$3" && touch "$f"
  fi
}
# retablir <clé> <sujet> : message de retour à la normale si une alerte était en cours.
retablir() {
  local f="$ETAT/$1"
  if [ -f "$f" ]; then
    /opt/nexclean/alerte.sh "$2" "Le problème signalé précédemment a disparu. Aucune action n'est nécessaire." && rm -f "$f"
  fi
}

# 1. Espace disque.
libre=$(df --output=pcent / | tail -1 | tr -dc '0-9'); libre=$((100 - libre))
if [ "$libre" -lt 20 ]; then
  signaler disque "Espace disque faible : ${libre} % libre" "Il reste ${libre} % d'espace libre sur le disque du serveur (seuil : 20 %).

Pistes : images Docker inutilisées (docker system prune), journaux, documents.
$(df -h / | tail -1)"
else
  retablir disque "Espace disque revenu à la normale (${libre} % libre)"
fi

# 2. Conteneurs de l'application et de la base.
sante() { docker ps --filter "name=^$1" --format '{{.Status}}' | head -1; }
for c in "$APPLI" "$BASE"; do
  s=$(sante "$c")
  if [ -z "$s" ] || [[ "$s" == *unhealthy* ]]; then
    signaler "conteneur-$c" "Conteneur arrêté ou en mauvaise santé : ${c%%-*}" "Le conteneur ${c}* est ${s:-absent}.

Vérifier dans Coolify (tunnel SSH) ou : docker ps -a | grep ${c}"
  else
    retablir "conteneur-$c" "Conteneur ${c%%-*} de nouveau en service"
  fi
done

# 3. Fraîcheur de la dernière sauvegarde réussie (le cron a-t-il seulement tourné ?).
derniere=$( [ -f "$MARQUE_SAUVEGARDE" ] && date -u -r "$MARQUE_SAUVEGARDE" '+%Y-%m-%d %H:%M UTC' )
if [ -z "$derniere" ] || [ -n "$(find "$MARQUE_SAUVEGARDE" -mmin +$((26 * 60)))" ]; then
  signaler sauvegarde-ancienne "Aucune sauvegarde réussie depuis plus de 26 h" "Dernière sauvegarde réussie : ${derniere:-aucune}.

Vérifier : tail -50 $JOURNAL_SAUVEGARDE, puis /opt/nexclean/sauvegarde.sh à la main."
else
  retablir sauvegarde-ancienne "Sauvegardes de nouveau à jour"
fi
