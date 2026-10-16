import { assert } from '@othila-academy/lab';
import { expectAccepted, inRollback, withPg } from '../../shared/db.mjs';
import { EMPRUNT_RENDU, as } from '../../shared/valmorin.mjs';
import { RUNBOOK, requireExecutable } from './fichiers.mjs';

export const title = 'Restaurer, et écrire le runbook';
export const instructions = `Lance scripts/db incident sauvegarde, et lis ce qui vient de se passer. Puis remets la base en service :
  - restaure la table emprunt depuis ton dump, avec ses données, ses clés, ses index et ses droits ;
  - sans toucher au reste : les adhérents inscrits depuis la sauvegarde doivent rester là.
pg_restore -l liste le contenu d'un dump ; pg_restore -L <liste> ne restaure que les entrées de la liste.
Consigne ta procédure dans project/runbooks/sauvegarde.sh, exécutable : quelqu'un d'autre doit pouvoir la rejouer à 3 h du
matin, sans réfléchir. Vérifie-la : scripts/db incident sauvegarde, puis project/runbooks/sauvegarde.sh.

À expliquer (npx lab submit sauvegarde restaurer) : pourquoi ne pas restaurer tout le dump, et qu'aurait-on perdu ?`;

export const prediction = {
  promptId: 'sauvegarde-restore-t',
  question: 'pg_restore -t emprunt restaure-t-il aussi les clés étrangères de emprunt ?',
  choices: ['oui', 'non'],
  expected: 'non'
};

// Les emprunts des données de démonstration ; un dump fait après quelques essais à la main en a un peu plus ou un peu moins.
const EMPRUNTS_MIN = 1900000;
// Les cartes des adhérents inscrits par l'incident (.othila-lab/incidents/sauvegarde.sh).
const NOUVEAUX = ['VAL050001', 'VAL050012'];

export const checks = [
  {
    id: 'emprunt-restauree',
    label: 'emprunt est restaurée (2 000 000 lignes, clé primaire, clés étrangères) et les 12 adhérents inscrits depuis la sauvegarde sont toujours là',
    run: () =>
      withPg(async (client) => {
        const { rows: [table] } = await client.query("select to_regclass('public.emprunt') is not null as present");
        assert(table.present, 'Attendu : la table emprunt. Constaté : absente. pg_restore -l liste ce que contient ton dump.');
        const { rows: [count] } = await client.query('select count(*)::int as n from emprunt');
        assert(count.n >= EMPRUNTS_MIN, `Attendu : les emprunts du dump (2 millions environ). Constaté : ${count.n}. Les données ont-elles été restaurées ?`);
        const { rows: keys } = await client.query(
          "select contype, confrelid::regclass::text as ref from pg_constraint where conrelid = 'public.emprunt'::regclass and contype in ('p', 'f')"
        );
        assert(keys.some((k) => k.contype === 'p'), 'Attendu : la clé primaire de emprunt. Constaté : absente. Dans un dump, une contrainte est une entrée à part.');
        const refs = keys.filter((k) => k.contype === 'f').map((k) => k.ref).sort();
        assert(
          refs.includes('adherent') && refs.includes('exemplaire'),
          `Attendu : les clés étrangères de emprunt vers adherent et exemplaire. Constaté : ${refs.length ? refs.join(', ') : 'aucune'}. Dans un dump, une clé étrangère est une entrée à part (FK CONSTRAINT).`
        );
        const { rows: [nouveaux] } = await client.query('select count(*)::int as n from adherent where numero_carte between $1 and $2', NOUVEAUX);
        assert(
          nouveaux.n === 12,
          `Attendu : les 12 adhérents inscrits depuis la sauvegarde (cartes ${NOUVEAUX.join(' à ')}). Constaté : ${nouveaux.n}. Une restauration complète remet toute la base dans l'état du dump ; un scripts/db rebuild aussi : relance alors scripts/db incident sauvegarde, puis ta restauration.`
        );
      })
  },
  {
    id: 'application-retablie',
    label: 'app_valmorin enregistre de nouveau un emprunt (transaction annulée)',
    run: () => inRollback((client) => expectAccepted(client, EMPRUNT_RENDU, 'un emprunt enregistré par app_valmorin'), as('app_valmorin'))
  },
  {
    id: 'runbook-executable',
    label: 'project/runbooks/sauvegarde.sh existe et est exécutable',
    run: async () => requireExecutable(RUNBOOK)
  }
];

export const hints = [
  'Le dump contient bien plus que emprunt. Comment n’en prendre qu’une partie ? Et qu’est-ce qui, dans un dump, appartient à emprunt sans être la table elle-même ?',
  'pg_restore -l <dump> > liste.txt ; garde les lignes qui concernent emprunt : table, données, séquence, contraintes, clés étrangères, index, droits ; puis pg_restore -L liste.txt -d valmorin <dump>. -t emprunt seul oublie les clés étrangères.',
  'dump=$(ls -t backups/valmorin-*.dump | head -1) ; pg_restore -l "$dump" | grep emprunt > "$liste" ; pg_restore -h pg -U postgres -d valmorin --exit-on-error -L "$liste" "$dump" ; puis analyze emprunt.'
];

export const points = 200;
