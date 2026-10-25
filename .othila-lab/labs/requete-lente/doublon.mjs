import { assert } from '@othila-academy/lab';
import { withPg } from '../../shared/db.mjs';

export const title = 'Facultatif : l’index en double';
export const instructions = `Facultatif. L'ancien prestataire a posé des index sur emprunt : \\d emprunt (dans scripts/db psql postgres valmorin) les liste. Deux d'entre eux
sont identiques, sous deux noms. Un index inutile ne coûte rien en lecture, mais chaque insertion et chaque mise à jour de
emprunt doit le maintenir, et il occupe de la place : select pg_size_pretty(pg_relation_size('<nom de l''index>'));
Supprime le doublon dans project/post/020_perf.sql : les index du prestataire sont posés avec les données, avant project/post.
Puis scripts/db rebuild.

À expliquer (npx lab submit requete-lente doublon) : comment as-tu prouvé que les deux index étaient identiques, et lequel as-tu gardé ?`;

export const checks = [
  {
    id: 'doublon-supprime',
    label: 'emprunt n’a plus deux index identiques',
    run: () =>
      withPg(async (client) => {
        const { rows } = await client.query(
          `select count(*)::int as n
           from pg_index i join pg_class c on c.oid = i.indexrelid
           where i.indrelid = 'public.emprunt'::regclass
           group by c.relam, i.indkey::text, i.indclass::text, i.indisunique,
                    coalesce(pg_get_expr(i.indpred, i.indrelid), ''), coalesce(pg_get_expr(i.indexprs, i.indrelid), '')
           having count(*) > 1`
        );
        assert(rows.length === 0, 'Attendu : aucun index en double sur emprunt. Constaté : deux index identiques. \\d emprunt les liste, avec leur définition.');
      })
  }
];

export const hints = [
  'Deux index identiques portent sur les mêmes colonnes, avec la même méthode et la même condition. Où le catalogue montre-t-il la définition d’un index ?',
  '\\d emprunt, ou select indexname, indexdef from pg_indexes where tablename = \'emprunt\' ; puis drop index dans project/post/020_perf.sql.',
  'drop index idx_emprunt_dateprevue; à la fin de project/post/020_perf.sql (ou l’autre des deux, emprunt_date_retour_prevue_idx), puis scripts/db rebuild.'
];

export const points = 50;
