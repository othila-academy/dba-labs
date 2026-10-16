// Ce que le catalogue de PostgreSQL dit du schéma de l'étudiant, table par table.
import { TABLES } from '../../shared/valmorin.mjs';

// { table: Map(colonne → { nullable, identity, generation, defaut }) } pour le schéma public.
export async function columnsOf(client) {
  const { rows } = await client.query(
    `select table_name, column_name, is_nullable, is_identity, identity_generation, column_default
     from information_schema.columns where table_schema = 'public'`
  );
  const tables = {};
  for (const r of rows) {
    tables[r.table_name] ??= new Map();
    tables[r.table_name].set(r.column_name, {
      nullable: r.is_nullable === 'YES',
      identity: r.is_identity === 'YES',
      generation: r.identity_generation,
      defaut: r.column_default
    });
  }
  return tables;
}

// Les tables ou colonnes du dictionnaire qui manquent, sous la forme table ou table.colonne.
export function missingFrom(columns) {
  const missing = [];
  for (const [table, cols] of Object.entries(TABLES)) {
    if (!columns[table]) missing.push(`table ${table}`);
    else for (const c of cols) if (!columns[table].has(c)) missing.push(`${table}.${c}`);
  }
  return missing;
}

// Les colonnes du dictionnaire, ou l'échec qui renvoie au check tables-colonnes.
export async function requireDictionary(client) {
  const columns = await columnsOf(client);
  const missing = missingFrom(columns);
  if (missing.length > 0)
    throw new Error(`Attendu : les tables du dictionnaire. Constaté : il manque ${missing.join(', ')} (regarde le check tables-colonnes).`);
  return columns;
}
