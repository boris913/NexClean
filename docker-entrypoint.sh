#!/bin/sh
# Applique les migrations puis démarre le serveur Next.js (standalone).
set -e
node dist-scripts/migrer.cjs
exec node server.js
