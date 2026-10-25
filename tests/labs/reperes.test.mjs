// La revue de progression du 25 octobre : chaque notion qu'une étape suppose est vue avant, ou donnée par un « Repère » de
// la fiche (ou du squelette), sans donner la réponse.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const labs = new URL('../../.othila-lab/labs/', import.meta.url);
const fiche = async (id) => import(new URL(`${id}.mjs`, labs).href);
const avantQuestion = (instructions) => instructions.slice(0, instructions.indexOf('À expliquer'));
const fichier = (nom) => readFileSync(new URL(nom, labs), 'utf8');

const REPERES = {
  'demarrage/base': /Repère : .*create database/s,
  'schema/tables': /Repère : .*primary key \(colonne1, colonne2\)/s,
  'schema/cles-etrangeres': /Repère : ON DELETE CASCADE/,
  'schema/donnees': /Repère : .*is null/s,
  'roles/proprietaire': /Repère : .*owner to/s,
  'roles/analyste': /Repère : une vue/,
  'requete-lente/indexer': /(?=[\s\S]*Repère : un index ne paie que)(?=[\s\S]*Repère : un plan se lit)/,
  'modele-document/modeliser': /Repère, sur un autre exemple : .*\$switch.*\$map/s,
  'modele-document/indexer': /Repère : niveaux du profiler/,
  'replica-set/repliquer': /Repère : 010_replica\.js est du JavaScript/,
  'replica-set/basculer': /Repère : le term/,
  'durcissement/role-applicatif': /Repère : au lab roles/,
  'durcissement/chiffrement': /Repère : un certificat sert à deux choses/
};

for (const [id, motif] of Object.entries(REPERES)) {
  test(`${id} : le repère est dans la fiche, avant la question`, async () => {
    assert.match(avantQuestion((await fiche(id)).instructions), motif);
  });
}

test('schema/tables : la fiche dit que les données se chargent dès les 7 tables, et quoi faire si rebuild s’arrête', async () => {
  assert.match((await fiche('schema/tables')).instructions, /Dès qu'elles\s+existent, il les charge \(étape 4\/9\)/);
});

test('schema/cles-etrangeres : les colonnes <table>_id viennent de MCD.md', async () => {
  assert.match((await fiche('schema/cles-etrangeres')).instructions, /<table>_id de MCD\.md/);
});

test('prédictions posées avant d’être révélées par la fiche (surveiller, analyste)', async () => {
  assert.match((await fiche('requete-lente/surveiller')).instructions, /npx lab check requete-lente surveiller[^\n]*\n?[^\n]*prédiction[\s\S]*reload pg/);
  assert.match((await fiche('roles/analyste')).instructions, /prédiction \(npx lab check roles analyste\)[\s\S]*select \* from adherent/);
});

test('requete-lente : la question de surveiller porte sur le coût, et indexer dit où voir les index posés', async () => {
  assert.match((await fiche('requete-lente/surveiller')).explain, /en temps total, et pourquoi coûtent-elles bien plus/);
  assert.match((await fiche('requete-lente/indexer')).instructions, /\\d emprunt liste les index déjà posés/);
});

test('sauvegarde/restaurer : l’indice qui cite analyze dit ce qu’il fait', async () => {
  assert.match((await fiche('sauvegarde/restaurer')).hints[2], /analyze emprunt \(il recalcule les statistiques/);
});

test('replica-set : l’objectif de la chaîne de connexion est en dernier, et facultatif', async () => {
  const { objectives } = await fiche('replica-set/index');
  assert.match(objectives.at(-1), /chaîne de connexion.*\(facultatif\)/);
});

test('squelettes : les repères de unnest, de $year et de $switch / $map sont dans les commentaires', () => {
  assert.match(fichier('incident-verrou/verrou-squelette.sh'), /Repère : unnest\(tableau\)/);
  const catalogue = fichier('modele-document/catalogue-squelette.js');
  assert.match(catalogue, /Repère : \$toInt d'un champ absent rend null/);
  assert.match(catalogue, /\$switch: \{ branches:/);
});
