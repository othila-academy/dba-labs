// Le fil rouge vu des checks. Le dictionnaire de données du lab schema est un contrat avec les données de démonstration
// (infra/seed/CONTRAT.md) : les noms, et les champs qui peuvent manquer.
export const TABLES = {
  site: ['id', 'nom', 'ville'],
  adherent: ['id', 'numero_carte', 'nom', 'prenom', 'email', 'telephone', 'date_inscription', 'site_id'],
  auteur: ['id', 'nom', 'prenom'],
  ouvrage: ['id', 'isbn', 'titre', 'annee', 'editeur'],
  ouvrage_auteur: ['ouvrage_id', 'auteur_id'],
  exemplaire: ['id', 'ouvrage_id', 'site_id', 'code_barre', 'etat'],
  emprunt: ['id', 'exemplaire_id', 'adherent_id', 'date_emprunt', 'date_retour_prevue', 'date_retour']
};
export const TABLE_NAMES = Object.keys(TABLES);
// Les champs que les données laissent parfois vides ; tous les autres sont obligatoires.
export const OPTIONAL = ['adherent.telephone', 'ouvrage.isbn', 'ouvrage.editeur', 'emprunt.date_retour'];
// Les clés étrangères du MCD : table, colonne, table référencée.
export const FOREIGN_KEYS = [
  ['adherent', 'site_id', 'site'],
  ['ouvrage_auteur', 'ouvrage_id', 'ouvrage'],
  ['ouvrage_auteur', 'auteur_id', 'auteur'],
  ['exemplaire', 'ouvrage_id', 'ouvrage'],
  ['exemplaire', 'site_id', 'site'],
  ['emprunt', 'exemplaire_id', 'exemplaire'],
  ['emprunt', 'adherent_id', 'adherent']
];
