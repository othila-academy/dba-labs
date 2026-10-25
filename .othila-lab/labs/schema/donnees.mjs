import { assert } from '@othila-academy/lab';
import { withPg } from '../../shared/db.mjs';

export const title = 'Les données de l’ancien logiciel';
export const explain = 'Quelle contrainte de ton schéma a refusé des données (ou aurait pu le faire), et pourquoi les données avaient-elles raison ?';
export const instructions = `Lance scripts/db rebuild et lis son étape 4/9 : les données de l'ancien logiciel se chargent sur ton
schéma. Si une contrainte les refuse, rebuild s'arrête et la cite : compare-la au dictionnaire (infra/seed/CONTRAT.md). Qui a
raison, la règle ou les données ? Corrige, relance, jusqu'au bout. Puis explore, dans scripts/db psql postgres valmorin :
combien d'emprunts sont en cours ? Combien d'adhérents n'ont pas de téléphone ?

À expliquer (npx lab submit schema donnees) : quelle contrainte de ton schéma a refusé des données (ou aurait pu le faire), et pourquoi les données avaient-elles raison ?`;

export const prediction = {
  promptId: 'schema-seeds-refuses',
  question: 'Si ta règle sur etat oublie la valeur abime, que fait scripts/db rebuild ?\n  a) il ignore les exemplaires abîmés\n  b) il charge quand même tout\n  c) il s’arrête sur la contrainte',
  choices: ['a', 'b', 'c'],
  expected: 'c'
};

export const checks = [
  {
    id: 'donnees-chargees',
    label: 'les données de démonstration sont chargées : 50 000 adhérents et 2 000 000 d’emprunts',
    run: () =>
      withPg(async (client) => {
        const count = async (table) => {
          try {
            return (await client.query(`select count(*)::int as n from ${table}`)).rows[0].n;
          } catch (error) {
            throw new Error(`Attendu : la table ${table}. Constaté : « ${error.message} ».`);
          }
        };
        const adherents = await count('adherent');
        const emprunts = await count('emprunt');
        assert(
          adherents === 50000 && emprunts === 2000000,
          `Attendu : 50 000 adhérents et 2 000 000 d’emprunts. Constaté : ${adherents} et ${emprunts}. La sortie de scripts/db rebuild (étape 4/9) dit ce qui bloque.`
        );
      })
  }
];

export const hints = [
  'Que dit la sortie de scripts/db rebuild, à l’étape 4/9 ?',
  'Quand un fichier de données échoue, l’erreur cite la contrainte et la ligne refusées : compare-les à infra/seed/CONTRAT.md, puis assouplis la règle ou agrandis la colonne.',
  'Les pièges habituels : un varchar trop court (un email va jusqu’à 60 caractères), un NOT NULL sur telephone, isbn ou editeur, une unicité sur (nom, prenom) d’auteur ou sur le titre, une règle contre les chevauchements d’emprunts.'
];

export const points = 100;
