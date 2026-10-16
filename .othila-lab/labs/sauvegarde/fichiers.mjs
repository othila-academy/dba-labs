// Les fichiers du lab sauvegarde, vus des checks : scripts de l'étudiant et dumps de backups/.
import { accessSync, constants, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../shared/db.mjs';

export const BACKUP_SCRIPT = path.join(ROOT, 'project/ops/backup.sh');
export const RUNBOOK = path.join(ROOT, 'project/runbooks/sauvegarde.sh');
export const BACKUPS = path.join(ROOT, 'backups');

// Le fichier existe et s'exécute ; sinon, l'échec qui le dit.
export function requireExecutable(file) {
  const name = path.relative(ROOT, file);
  if (!existsSync(file)) throw new Error(`Attendu : ${name}. Constaté : absent.`);
  try {
    accessSync(file, constants.X_OK);
  } catch {
    throw new Error(`Attendu : ${name} exécutable. Constaté : il ne l'est pas (ls -l ${name}).`);
  }
}

// Le dump de valmorin le plus récent de backups/, ou null.
export function latestDump() {
  if (!existsSync(BACKUPS)) return null;
  return (
    readdirSync(BACKUPS)
      .filter((f) => /^valmorin-\d{8}-\d{6}\.dump$/.test(f))
      .map((f) => path.join(BACKUPS, f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ?? null
  );
}
