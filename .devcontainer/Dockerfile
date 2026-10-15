# Outillage du cours : clients PostgreSQL 18 (PGDG) et MongoDB 8.0, de la même version majeure que les serveurs.
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
