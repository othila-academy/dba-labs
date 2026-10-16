# Administration des bases de données — Othila Academy

Le module « Administration des Bases de Données » (RNCP39611, BC01, 14 h) en labs : tu administres les bases du réseau de médiathèques de Valmorin (PostgreSQL et MongoDB) dans un environnement jetable, reconstruit à l'identique depuis tes fichiers.

## Démarrer

1. Installe Docker (Desktop sous macOS ou Windows + WSL2, Engine sous Linux), VS Code et l'extension Dev Containers.
2. Clone ce dépôt et ouvre-le dans VS Code, puis « Reopen in Container ».
3. Dans le terminal du devcontainer : `scripts/db doctor` (tout doit être vert).
4. `npx lab init`, puis `scripts/db rebuild`.
5. `npx lab start prise-en-main`, puis le premier lab : `npx lab catalog`.

## Les bases

`scripts/db help` liste les commandes : `up`, `down`, `rebuild`, `restart`, `reload`, `status`, `psql`, `mongosh`, `incident`, `doctor`. Tout l'état des bases vient de `project/` : `scripts/db rebuild` le reconstruit.
