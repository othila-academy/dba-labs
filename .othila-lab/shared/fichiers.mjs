// Les fichiers de l'étudiant vus des checks : scripts exécutables, sauvegardes horodatées, sections d'un document, et ce
// que git en fait.
import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ROOT, TIMEOUT_MS } from './db.mjs';

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

// Le fichier le plus récent d'un dossier dont le nom suit le motif, ou null.
export function latestFile(dir, pattern) {
  if (!existsSync(dir)) return null;
  return (
    readdirSync(dir)
      .filter((f) => pattern.test(f))
      .map((f) => path.join(dir, f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ?? null
  );
}

// Les sections attendues absentes d'un document Markdown (titres #, ##…), apostrophes droites ou typographiques, casse ignorée.
export function missingSections(file, titles) {
  const norm = (s) => s.replace(/[’']/g, "'").trim().toLowerCase();
  const found = new Set(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => /^#{1,6}\s/.test(line))
      .map((line) => norm(line.replace(/^#{1,6}\s+/, '')))
  );
  return titles.filter((title) => !found.has(norm(title)));
}

// Ce que git fait d'un fichier du cours : 'suivi' (dans l'index), 'ignore' (écarté par un .gitignore) ou 'visible'.
export function gitStatusOf(root, rel) {
  const git = (...args) => spawnSync('git', ['-C', root, ...args], { stdio: 'ignore', timeout: TIMEOUT_MS }).status;
  if (git('ls-files', '--error-unmatch', '--', rel) === 0) return 'suivi';
  return git('check-ignore', '-q', '--', rel) === 0 ? 'ignore' : 'visible';
}
