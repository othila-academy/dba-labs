import { expectAccepted, expectDenied, inRollback } from '../../shared/db.mjs';
import { as } from '../../shared/valmorin.mjs';

export const title = 'La lecture analytique';
export const instructions = `Crée le rôle analyste (mot de passe de lab analyste-lab), pour le service culturel. Il lit tout le
catalogue, l'historique des prêts et les adhérents, mais jamais leurs coordonnées (email, téléphone) : donne-lui des
privilèges sur les colonnes de adherent. Il n'écrit rien.
Puis scripts/db rebuild, connecte-toi avec lui (psql -h pg -U analyste -d valmorin) et essaie select * from adherent.

À expliquer (npx lab submit roles analyste) : qu'aurait changé une vue sans email ni téléphone, à la place des privilèges par colonne ?`;

export const prediction = {
  promptId: 'roles-select-etoile',
  question: 'Pour analyste, que donne select * from adherent ?\n  a) toutes les colonnes sauf email et téléphone\n  b) une erreur de permission\n  c) email et téléphone vides',
  choices: ['a', 'b', 'c'],
  expected: 'b'
};

const analyste = (fn) => () => inRollback(fn, as('analyste'));

export const checks = [
  {
    id: 'analyste-lit',
    label: 'analyste lit le catalogue et l’historique des prêts (ouvrage, emprunt)',
    run: analyste(async (client) => {
      await expectAccepted(client, 'select titre from ouvrage limit 1', 'la lecture de ouvrage par analyste');
      await expectAccepted(client, 'select date_emprunt from emprunt limit 1', 'la lecture de emprunt par analyste');
    })
  },
  {
    id: 'analyste-adherents',
    label: 'analyste lit le nom et le site d’inscription des adhérents',
    run: analyste((client) => expectAccepted(client, 'select nom, site_id from adherent limit 1', 'la lecture de adherent.nom par analyste'))
  },
  {
    id: 'analyste-sans-email',
    label: 'analyste ne lit pas adherent.email',
    run: analyste((client) => expectDenied(client, 'select email from adherent limit 1', 'lire adherent.email'))
  },
  {
    id: 'analyste-sans-telephone',
    label: 'analyste ne lit pas adherent.telephone',
    run: analyste((client) => expectDenied(client, 'select telephone from adherent limit 1', 'lire adherent.telephone'))
  },
  {
    id: 'analyste-sans-ecriture',
    label: 'analyste n’écrit rien (insertion dans ouvrage refusée)',
    run: analyste((client) => expectDenied(client, "insert into ouvrage (titre, annee) values ('Check', 2020)", 'insérer dans ouvrage'))
  }
];

export const hints = [
  'Un GRANT SELECT peut porter sur une table entière, ou sur une liste de colonnes.',
  'Select sur toutes les tables sauf adherent ; sur adherent, select sur la liste des colonnes permises, sans email ni telephone.',
  'grant select on site, auteur, ouvrage, ouvrage_auteur, exemplaire, emprunt to analyste; grant select (id, numero_carte, nom, prenom, date_inscription, site_id) on adherent to analyste;'
];

export const points = 150;
