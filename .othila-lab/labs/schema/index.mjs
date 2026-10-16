export const title = 'Le schéma relationnel';
export const steps = ['tables', 'cles-etrangeres', 'regles', 'donnees'];
export const duration = '1 h 15';
export const summary = `Le réseau de Valmorin change de logiciel de prêts. Tu écris son schéma relationnel à partir du modèle
conceptuel (.othila-lab/labs/schema/MCD.md) et du dictionnaire de données (infra/seed/CONTRAT.md) : les tables et leurs
clés, puis les règles métier, que la base fera respecter elle-même. Les données de l'ancien logiciel se chargent ensuite
sur ton schéma : s'il est plus strict que la réalité, scripts/db rebuild te le dira.`;
export const objectives = [
  'traduire un MCD en tables : entités, associations, cardinalités',
  'choisir les clés primaires et étrangères, dont une clé composite',
  'faire respecter les règles métier par le schéma : NOT NULL, UNIQUE, CHECK, ON DELETE',
  'confronter son schéma à des données réelles'
];
