# Outillage du cours : client PostgreSQL 18 (PGDG), de la même version majeure que le serveur, et outils MongoDB
# (mongosh 2, database-tools 100) tirés du dépôt 8.0, compatibles avec le serveur 7.0 comme avec un futur 8.x.
FROM mcr.microsoft.com/devcontainers/base:noble@sha256:21e9e3275736cb3bc33a2904b279a2ab292c51fedd53c2963463627d4586c3e6

ARG PG_MAJOR=18
ARG MONGO_SERIES=8.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg jq openssl shellcheck \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
 && curl -fsSL "https://www.mongodb.org/static/pgp/server-${MONGO_SERIES}.asc" | gpg --dearmor -o "/usr/share/keyrings/mongodb-server-${MONGO_SERIES}.gpg" \
 && echo "deb [signed-by=/usr/share/keyrings/mongodb-server-${MONGO_SERIES}.gpg] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/${MONGO_SERIES} multiverse" \
      > "/etc/apt/sources.list.d/mongodb-org-${MONGO_SERIES}.list" \
 && apt-get update \
 && apt-get install -y --no-install-recommends "postgresql-client-${PG_MAJOR}" mongodb-mongosh mongodb-database-tools \
 && rm -rf /var/lib/apt/lists/*

# Sur Docker Desktop, le dossier monté paraît parfois appartenir à un autre utilisateur juste après une écriture :
# git refuserait alors le dépôt (« dubious ownership »). Le dépôt du cours est le seul que l'on monte ici.
RUN git config --system --add safe.directory '*'
