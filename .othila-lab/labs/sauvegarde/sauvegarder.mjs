import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { assert } from '@othila-academy/lab';
import { ROOT, TIMEOUT_MS } from '../../shared/db.mjs';
import { BACKUPS, BACKUP_SCRIPT, latestDump, requireExecutable } from './fichiers.mjs';

export const title = 'Sauvegarder';
export const explain = 'Avec une sauvegarde par nuit, quel est ton RPO, et que faudrait-il pour le réduire ?';
export const instructions = `Écris project/ops/backup.sh, un script Bash exécutable (chmod +x), qui :
  - sauvegarde la base donnée en argument (valmorin par défaut) avec pg_dump au format custom (-Fc), en postgres, avec le
    mot de passe de infra/.env.lab ;
  - range le dump dans backups/<base>-AAAAMMJJ-HHMMSS.dump (backups/ n'est pas suivi par git) ;
  - vérifie le dump avec pg_restore --list, puis affiche son chemin ;
  - sort avec un code non nul si quoi que ce soit échoue, sans laisser de dump incomplet.
Lance-le (project/ops/backup.sh), puis lis la table des matières du dump : pg_restore --list backups/<ton dump>.

À expliquer (npx lab submit sauvegarde sauvegarder) : avec une sauvegarde par nuit, quel est ton RPO, et que faudrait-il pour le réduire ?`;

export const prediction = {
  promptId: 'sauvegarde-roles-dans-dump',
  question: 'Un pg_dump de valmorin contient-il les rôles app_valmorin et analyste ?',
  choices: ['oui', 'non'],
  expected: 'non'
};

export const checks = [
  {
    id: 'backup-executable',
    label: 'project/ops/backup.sh existe et est exécutable',
    run: async () => requireExecutable(BACKUP_SCRIPT)
  },
  {
    id: 'dump-valide',
    label: 'le dernier backups/valmorin-*.dump se lit avec pg_restore --list et contient les données de emprunt',
    run: async () => {
      const dump = latestDump();
      assert(dump, 'Attendu : un dump backups/valmorin-AAAAMMJJ-HHMMSS.dump. Constaté : aucun. As-tu lancé project/ops/backup.sh ?');
      const name = path.relative(ROOT, dump);
      let toc;
      try {
        toc = execFileSync('pg_restore', ['--list', dump], { encoding: 'utf8', timeout: TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
      } catch (error) {
        const why = String(error.stderr || error.message).trim().split('\n')[0];
        throw new Error(`Attendu : ${name} lisible par pg_restore --list. Constaté : « ${why} ». Avec quel format pg_dump l'a-t-il écrit ?`);
      }
      assert(/TABLE DATA public emprunt /.test(toc), `Attendu : les données de emprunt dans ${name}. Constaté : aucune entrée TABLE DATA public emprunt (pg_restore --list ${name}).`);
      const size = statSync(dump).size;
      assert(size >= 1_000_000, `Attendu : un dump qui contient 2 millions d'emprunts. Constaté : ${size} octets. Était-ce bien la base valmorin, après scripts/db rebuild ?`);
    }
  },
  {
    id: 'echec-signale',
    label: 'project/ops/backup.sh sur une base qui n’existe pas sort avec un code non nul',
    run: async () => {
      requireExecutable(BACKUP_SCRIPT);
      const res = spawnSync(BACKUP_SCRIPT, ['check_absente'], { cwd: ROOT, encoding: 'utf8', timeout: TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'] });
      for (const f of existsSync(BACKUPS) ? readdirSync(BACKUPS) : []) {
        if (f.startsWith('check_absente-')) rmSync(path.join(BACKUPS, f), { force: true });
      }
      assert(res.error?.code !== 'ETIMEDOUT' && !res.signal, 'Attendu : project/ops/backup.sh check_absente s’arrête en erreur. Constaté : toujours en cours après 5 s. Attend-il un mot de passe ?');
      assert(!res.error, `Attendu : project/ops/backup.sh se lance. Constaté : « ${res.error?.message} ». Que dit sa première ligne ?`);
      assert(res.status !== 0, 'Attendu : un code non nul sur une base qui n’existe pas. Constaté : 0. Une tâche planifiée croirait la sauvegarde faite.');
    }
  }
];

export const hints = [
  'Que doit savoir pg_dump pour se connecter (hôte, rôle, mot de passe, base) ? Et comment un script Bash s’arrête-t-il à la première erreur ?',
  'source infra/.env.lab pour le mot de passe (PGPASSWORD), pg_dump -h pg -U postgres -Fc -f <fichier> <base>, puis pg_restore --list <fichier> ; date +%Y%m%d-%H%M%S pour l’horodatage ; set -euo pipefail en tête.',
  'set -euo pipefail ; cd "$(dirname "$0")/../.." ; base=${1:-valmorin} ; source infra/.env.lab ; export PGPASSWORD=$POSTGRES_PASSWORD ; mkdir -p backups ; f=backups/$base-$(date +%Y%m%d-%H%M%S).dump ; pg_dump -h pg -U postgres -Fc -f "$f" "$base" || { rm -f "$f"; exit 1; } ; pg_restore --list "$f" >/dev/null ; echo "$f"'
];

export const points = 150;
