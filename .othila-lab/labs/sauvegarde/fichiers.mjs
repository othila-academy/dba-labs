// Les fichiers du lab sauvegarde, vus des checks : scripts de l'étudiant et dumps de backups/.
import path from 'node:path';
import { ROOT } from '../../shared/db.mjs';
import { BACKUPS, latestFile } from '../../shared/fichiers.mjs';

export { BACKUPS, requireExecutable } from '../../shared/fichiers.mjs';
export const BACKUP_SCRIPT = path.join(ROOT, 'project/ops/backup.sh');
export const RUNBOOK = path.join(ROOT, 'project/runbooks/sauvegarde.sh');

// Le dump de valmorin le plus récent de backups/, ou null.
export const latestDump = () => latestFile(BACKUPS, /^valmorin-\d{8}-\d{6}\.dump$/);
