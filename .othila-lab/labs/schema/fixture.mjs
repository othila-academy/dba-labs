// Des lignes valides pour les checks, insérées dans la transaction (annulée) du check. Leurs valeurs ne croisent jamais
// celles des données de démonstration : cartes VAL9…, codes-barres EX9…, ISBN 979… (des ISBN-13 valides ; les données n'ont que des 978…)
import { expectAccepted } from '../../shared/db.mjs';

let n = 0;
const next = () => ++n;
const pad = (value, width) => String(value).padStart(width, '0');
const idOf = async (client, q, what) => (await expectAccepted(client, q, what)).rows[0].id;

export const siteRow = () => ({
  sql: "insert into site (nom, ville) values ('Site des checks', 'Valmorin') returning id",
  params: []
});

export function adherentRow(site, { carte, email, telephone = '0600000000' } = {}) {
  const k = next();
  return {
    sql: `insert into adherent (numero_carte, nom, prenom, email, telephone, date_inscription, site_id)
          values ($1, 'Check', 'Camille', $2, $3, date '2020-01-15', $4) returning id`,
    params: [carte ?? `VAL9${pad(k, 5)}`, email ?? `check.${k}@lab.example`, telephone, site]
  };
}

export const auteurRow = () => ({ sql: "insert into auteur (nom, prenom) values ('Check', 'Dominique') returning id", params: [] });

export function ouvrageRow({ isbn, editeur = 'Seuil', titre = 'Le livre des checks' } = {}) {
  const k = next();
  return {
    sql: 'insert into ouvrage (isbn, titre, annee, editeur) values ($1, $2, 2020, $3) returning id',
    params: [isbn === undefined ? `979${pad(k, 10)}` : isbn, titre, editeur]
  };
}

export function exemplaireRow(ouvrage, site, { etat = 'bon' } = {}) {
  const k = next();
  return {
    sql: 'insert into exemplaire (ouvrage_id, site_id, code_barre, etat) values ($1, $2, $3, $4) returning id',
    params: [ouvrage, site, `EX9${pad(k, 7)}`, etat]
  };
}

export const empruntRow = (exemplaire, adherent, { debut = '2026-10-01', prevu = '2026-10-22', retour = null } = {}) => ({
  sql: `insert into emprunt (exemplaire_id, adherent_id, date_emprunt, date_retour_prevue, date_retour)
        values ($1, $2, $3, $4, $5) returning id`,
  params: [exemplaire, adherent, debut, prevu, retour]
});

export const insertSite = (client) => idOf(client, siteRow(), 'un site valide');
export const insertAdherent = (client, site, options) => idOf(client, adherentRow(site, options), 'un adhérent valide');
export const insertOuvrage = (client, options) => idOf(client, ouvrageRow(options), 'un ouvrage valide');

// Une ligne valide par table, reliées entre elles ; l'emprunt est en cours.
export async function fixture(client) {
  const site = await insertSite(client);
  const adherent = await insertAdherent(client, site);
  const auteur = await idOf(client, auteurRow(), 'un auteur valide');
  const ouvrage = await insertOuvrage(client);
  await expectAccepted(client, { sql: 'insert into ouvrage_auteur (ouvrage_id, auteur_id) values ($1, $2)', params: [ouvrage, auteur] }, 'un lien ouvrage_auteur valide');
  const exemplaire = await idOf(client, exemplaireRow(ouvrage, site), 'un exemplaire valide');
  const emprunt = await idOf(client, empruntRow(exemplaire, adherent), 'un emprunt en cours valide');
  return { site, adherent, auteur, ouvrage, exemplaire, emprunt };
}
