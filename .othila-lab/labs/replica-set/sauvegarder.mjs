import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';
import { assert } from '@othila-academy/lab';
import { DOWN, ROOT, TIMEOUT_MS } from '../../shared/db.mjs';
import { BACKUPS, latestFile, requireExecutable } from '../../shared/fichiers.mjs';
import { RS_URI } from './rs.mjs';

export const title = 'Sauvegarder MongoDB';
export const instructions = `Une réplique n'est pas une sauvegarde : un drop sur le primaire part aussitôt sur les secondaires. Écris
project/ops/backup-mongo.sh, exécutable, qui :
  - sauvegarde la base valmorin avec mongodump, en une archive compressée : backups/valmorin-mongo-AAAAMMJJ-HHMMSS.archive
    (--archive=<fichier> --gzip) ;
  - lit sur un secondaire (readPreference=secondary dans la chaîne de connexion) : la sauvegarde ne charge pas le primaire ;
  - vérifie l'archive avec mongorestore --dryRun, affiche son chemin, et sort en code non nul si quoi que ce soit échoue.
Lance-le, puis : mongorestore --dryRun -v --uri "mongodb://mongo1:27017/?replicaSet=rs0" --archive=<ton archive> --gzip.

À expliquer (npx lab submit replica-set sauvegarder) : pourquoi lire la sauvegarde sur un secondaire, et que risque-t-on si ce secondaire est en retard ?`;

export const BACKUP_MONGO = path.join(ROOT, 'project/ops/backup-mongo.sh');
const ARCHIVE = /^valmorin-mongo-\d{8}-\d{6}\.archive$/;

// La table des matières d'une archive : mongorestore --dryRun -v ne lit que son en-tête, avec ou sans --gzip.
function sommaire(file) {
  let out = '';
  for (const gzip of [['--gzip'], []]) {
    const res = spawnSync('mongorestore', ['--dryRun', '-v', `--uri=${RS_URI}`, `--archive=${file}`, ...gzip], {
      encoding: 'utf8', timeout: TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe']
    });
    out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    if (res.status === 0) return { ok: true, out };
    if (/error connecting to host/.test(out)) throw new Error(DOWN);
  }
  return { ok: false, out };
}

export const checks = [
  {
    id: 'backup-mongo-executable',
    label: 'project/ops/backup-mongo.sh existe et est exécutable',
    run: async () => requireExecutable(BACKUP_MONGO)
  },
  {
    id: 'archive-valide',
    label: 'la dernière archive backups/valmorin-mongo-*.archive se lit avec mongorestore --dryRun et contient valmorin.catalogue',
    run: async () => {
      const file = latestFile(BACKUPS, ARCHIVE);
      assert(file, 'Attendu : une archive backups/valmorin-mongo-AAAAMMJJ-HHMMSS.archive. Constaté : aucune. As-tu lancé project/ops/backup-mongo.sh ?');
      const name = path.relative(ROOT, file);
      const { ok, out } = sommaire(file);
      const derniere = (out.trim().split('\n').pop() ?? '').replace(/^\S+\s+/, '');
      assert(ok, `Attendu : ${name} lisible par mongorestore --dryRun. Constaté : « ${derniere} ». Est-ce bien une archive de mongodump (--archive) ?`);
      assert(/found collection `?valmorin\.catalogue`?/.test(out), `Attendu : la collection valmorin.catalogue dans ${name}. Constaté : absente (mongorestore --dryRun -v --archive=${name}). As-tu sauvegardé la base valmorin ?`);
      const size = statSync(file).size;
      assert(size >= 1_000_000, `Attendu : une archive qui contient le catalogue et les données brutes. Constaté : ${size} octets. --dryRun ne lit que l'en-tête : une archive tronquée y passe, pas sa taille.`);
    }
  }
];

export const hints = [
  'mongodump sait écrire une seule archive, compressée, et lire sur le membre de ton choix : par où passe ce choix ?',
  "mongodump --uri 'mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0&readPreference=secondary' --db valmorin --archive=<fichier> --gzip ; puis mongorestore --dryRun --uri '…' --archive=<fichier> --gzip.",
  'set -euo pipefail ; cd "$(dirname "$0")/../.." ; mkdir -p backups ; a=backups/valmorin-mongo-$(date +%Y%m%d-%H%M%S).archive ; trap \'rm -f "$a"\' ERR ; mongodump --quiet --uri "…&readPreference=secondary" --db valmorin --archive="$a" --gzip ; mongorestore --quiet --dryRun --uri "…" --archive="$a" --gzip ; echo "$a"'
];

export const points = 100;
