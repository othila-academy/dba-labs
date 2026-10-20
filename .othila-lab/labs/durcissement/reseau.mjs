import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { assert } from '@othila-academy/lab';
import { ROOT, TIMEOUT_MS, readEnv } from '../../shared/db.mjs';

export const title = 'Le réseau';
export const instructions = `project/legacy/compose.yaml publie les ports du serveur hérité sur toutes les interfaces (0.0.0.0) : n'importe quel
poste du réseau pourrait s'y connecter. scripts/db ramène déjà la publication à 127.0.0.1, par sécurité, et le dit à chaque up :
corrige la déclaration elle-même. Le mieux est de ne rien publier (le serveur reste joignable depuis dba-net) ; sinon,
127.0.0.1 seulement. Vérifie : scripts/db up n'affiche plus d'avertissement ; docker port dba-pg-legacy-1.
Pourquoi ne pas restreindre plutôt listen_addresses (PostgreSQL) ou bindIp (MongoDB) ? Dans un conteneur, '*' et 0.0.0.0
désignent les interfaces du conteneur, sur le réseau dba-net : c'est par là que passent scripts/db et les checks. La frontière
qui protège la salle est la publication des ports sur la machine. Sur un serveur sans conteneur, on restreindrait aussi
listen_addresses et bindIp aux interfaces utiles.

À expliquer (npx lab submit durcissement reseau) : pourquoi corriger la déclaration, si scripts/db protège déjà ce poste ?`;

const OVERRIDE = path.join(ROOT, 'project/legacy/compose.yaml');

export const checks = [
  {
    id: 'ports-locaux',
    label: 'project/legacy/compose.yaml ne publie aucun port de pg-legacy ni de mongo-legacy au-delà de 127.0.0.1',
    run: async () => {
      if (!existsSync(OVERRIDE)) return; // aucune déclaration : rien de publié
      let config;
      try {
        // La configuration déclarée, celle que lirait un autre outil que scripts/db : comme pg_hba_file_rules lit pg_hba.conf.
        config = JSON.parse(execFileSync('docker', ['compose', '--project-directory', path.join(ROOT, 'infra'), '-f', path.join(ROOT, 'infra/compose.yaml'), '-f', OVERRIDE, 'config', '--format', 'json'], {
          env: { ...process.env, ...readEnv('infra/images.env'), COMPOSE_PROFILES: 'legacy' },
          encoding: 'utf8', timeout: TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe']
        }));
      } catch (error) {
        throw new Error(`Attendu : project/legacy/compose.yaml lisible par Docker Compose. Constaté : « ${String(error.stderr || error.message).trim().split('\n')[0]} ».`);
      }
      const ouverts = ['pg-legacy', 'mongo-legacy'].flatMap((s) =>
        (config.services[s]?.ports ?? [])
          .filter((p) => (p.host_ip || '0.0.0.0') !== '127.0.0.1')
          .map((p) => `${s} sur ${p.host_ip || '0.0.0.0'}:${p.published ?? '?'}`)
      );
      assert(ouverts.length === 0, `Attendu : aucun port publié au-delà de 127.0.0.1. Constaté : ${ouverts.join(', ')}.`);
    }
  }
];

export const hints = [
  'Un port publié sans adresse, ou sur 0.0.0.0, écoute sur toutes les interfaces de la machine, Wi-Fi compris.',
  'Dans compose.yaml : ports: ["127.0.0.1:25432:5432"], ou pas de ports du tout.',
  'services: { pg-legacy: {}, mongo-legacy: {} } : plus rien de publié ; les checks et scripts/db joignent les serveurs par dba-net.'
];

export const points = 75;
