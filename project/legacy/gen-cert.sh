#!/usr/bin/env bash
# Certificats auto-signés du serveur hérité, générés s'ils manquent : jamais dans git (project/legacy/.gitignore).
# scripts/db le lance avant chaque démarrage de pg-legacy et de mongo-legacy. Usage : project/legacy/gen-cert.sh
set -euo pipefail
cd "$(dirname "$0")"
# Un certificat d'un an pour un nom d'hôte, et sa clé ; rien si la clé existe déjà.
cert() {
  local dir=$1 host=$2
  [[ -f $dir/server.key ]] && return 0
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=$host" -addext "subjectAltName=DNS:$host" \
    -keyout "$dir/server.key" -out "$dir/server.crt" 2>/dev/null
  echo "certificat auto-signé de $host : $dir/server.crt"
}
cert postgres pg-legacy
cert mongo mongo-legacy
# mongod veut la clé et le certificat dans un seul fichier.
cat mongo/server.key mongo/server.crt >mongo/server.pem
