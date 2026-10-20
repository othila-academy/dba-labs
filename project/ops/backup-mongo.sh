#!/usr/bin/env bash
# Sauvegarde logique de MongoDB : mongodump de valmorin, lu sur un secondaire, en une archive compressée, vérifiée par
# mongorestore --dryRun. Usage : project/ops/backup-mongo.sh. Affiche le chemin de l'archive ; code 1 en cas d'échec.
set -euo pipefail
cd "$(dirname "$0")/../.."
RS='mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0'
mkdir -p backups
archive="backups/valmorin-mongo-$(date +%Y%m%d-%H%M%S).archive"
# Une archive incomplète ne doit pas passer pour une sauvegarde.
trap 'rm -f "$archive"' ERR
mongodump --quiet --uri "$RS&readPreference=secondary" --db valmorin --archive="$archive" --gzip
mongorestore --quiet --dryRun --uri "$RS" --archive="$archive" --gzip
echo "$archive"
