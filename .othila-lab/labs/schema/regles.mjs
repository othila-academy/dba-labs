import { assert } from '@othila-academy/lab';
import { expectAccepted, expectRejected, inRollback, withPg } from '../../shared/db.mjs';
import { OPTIONAL, TABLES } from '../../shared/valmorin.mjs';
import { requireDictionary } from './catalogue.mjs';
import { adherentRow, auteurRow, empruntRow, exemplaireRow, fixture, insertAdherent, insertSite, ouvrageRow } from './fixture.mjs';

export const title = 'Les règles métier';
export const explain = "Quelle règle as-tu failli écrire trop stricte, et qu'aurait-elle refusé ?";
export const instructions = `Fais respecter les règles métier par la base, pas par l'application :
  - le numéro de carte et l'email d'un adhérent sont uniques ;
  - l'ISBN d'un ouvrage est unique quand il est connu (certains ouvrages n'en ont pas) ;
  - l'état d'un exemplaire est neuf, bon, abime ou retire ;
  - la date de retour prévue est après la date d'emprunt ;
  - la date de retour effective n'est jamais avant la date d'emprunt ;
  - un champ que le dictionnaire ne dit jamais absent est obligatoire.
Relis aussi ce que le dictionnaire autorise : des homonymes, des titres répétés, des périodes d'emprunt qui se chevauchent
dans l'historique. Une règle plus stricte que la réalité refuserait les données. Complète 001_schema.sql, puis scripts/db rebuild.

À expliquer (npx lab submit schema regles) : quelle règle as-tu failli écrire trop stricte, et qu'aurait-elle refusé ?`;

export const prediction = {
  promptId: 'schema-unique-null',
  question: 'Une colonne isbn déclarée UNIQUE accepte-t-elle deux ouvrages sans ISBN (NULL) ?',
  choices: ['oui', 'non'],
  expected: 'oui'
};

// Une règle à tester : les lignes valides de fixture, puis la ligne fautive, refusée.
const rejects = (what, build) => () =>
  inRollback(async (client) => expectRejected(client, await build(client, await fixture(client)), what));

export const checks = [
  {
    id: 'obligatoires',
    label: 'les champs que le dictionnaire ne dit jamais absents sont obligatoires (NOT NULL)',
    run: () =>
      withPg(async (client) => {
        const columns = await requireDictionary(client);
        const nullable = Object.entries(TABLES).flatMap(([t, cols]) =>
          cols.filter((c) => columns[t].get(c).nullable && !OPTIONAL.includes(`${t}.${c}`)).map((c) => `${t}.${c}`)
        );
        assert(nullable.length === 0, `Attendu : des champs obligatoires. Constaté : ${nullable.join(', ')} acceptent l’absence de valeur.`);
      })
  },
  {
    id: 'rejet-carte-double',
    label: 'la base refuse un deuxième adhérent avec un numéro de carte déjà pris',
    run: rejects('un deuxième adhérent avec le même numéro de carte', async (client, { site }) => {
      await insertAdherent(client, site, { carte: 'VAL900000' });
      return adherentRow(site, { carte: 'VAL900000' });
    })
  },
  {
    id: 'rejet-email-double',
    label: 'la base refuse un deuxième adhérent avec un email déjà pris',
    run: rejects('un deuxième adhérent avec le même email', async (client, { site }) => {
      await insertAdherent(client, site, { email: 'check.double@lab.example' });
      return adherentRow(site, { email: 'check.double@lab.example' });
    })
  },
  {
    id: 'rejet-isbn-double',
    label: 'la base refuse un deuxième ouvrage avec un ISBN déjà pris',
    run: rejects('un deuxième ouvrage avec le même ISBN', async (client) => {
      await expectAccepted(client, ouvrageRow({ isbn: '9790000000000' }), 'un ouvrage valide');
      return ouvrageRow({ isbn: '9790000000000' });
    })
  },
  {
    id: 'rejet-etat-inconnu',
    label: 'la base refuse un exemplaire dans un état hors de la liste (perdu)',
    run: rejects('un exemplaire « perdu »', async (client, { ouvrage, site }) => exemplaireRow(ouvrage, site, { etat: 'perdu' }))
  },
  {
    id: 'rejet-retour-prevu',
    label: 'la base refuse un emprunt dont le retour prévu n’est pas après la date d’emprunt',
    run: rejects('un retour prévu le jour même de l’emprunt', async (client, { exemplaire, adherent }) =>
      empruntRow(exemplaire, adherent, { debut: '2026-10-01', prevu: '2026-10-01', retour: '2026-10-05' })
    )
  },
  {
    id: 'rejet-retour-avant-emprunt',
    label: 'la base refuse un emprunt rendu avant d’avoir été emprunté',
    run: rejects('un retour effectif la veille de l’emprunt', async (client, { exemplaire, adherent }) =>
      empruntRow(exemplaire, adherent, { debut: '2026-10-01', prevu: '2026-10-22', retour: '2026-09-30' })
    )
  },
  {
    id: 'accepte-valides',
    label: 'la base accepte des données valides : sans téléphone, sans ISBN ni éditeur, homonymes, titres répétés, emprunts qui se chevauchent',
    run: () =>
      inRollback(async (client) => {
        const { site, exemplaire, adherent } = await fixture(client);
        await expectAccepted(client, adherentRow(site, { telephone: null }), 'un adhérent sans téléphone');
        await expectAccepted(client, ouvrageRow({ isbn: null, editeur: null }), 'un ouvrage sans ISBN ni éditeur');
        await expectAccepted(client, ouvrageRow({ isbn: null, editeur: null }), 'un second ouvrage sans ISBN');
        await expectAccepted(client, ouvrageRow({ titre: 'Le livre des checks' }), 'un ouvrage au titre déjà pris');
        await expectAccepted(client, auteurRow(), 'un auteur homonyme d’un autre');
        await expectAccepted(client, empruntRow(exemplaire, adherent, { debut: '2026-01-05', prevu: '2026-01-26', retour: '2026-02-10' }), 'un emprunt rendu');
        await expectAccepted(client, empruntRow(exemplaire, adherent, { debut: '2026-01-20', prevu: '2026-02-10', retour: '2026-01-30' }), 'un emprunt qui chevauche le précédent, sur le même exemplaire');
      })
  }
];

export const hints = [
  'Pour chaque règle : porte-t-elle sur une valeur seule, sur une comparaison entre deux colonnes, ou sur une unicité ? Chacune a sa contrainte SQL.',
  'UNIQUE pour la carte, l’email et l’ISBN (NULL n’entre pas en conflit avec NULL) ; CHECK (etat in (…)) ; un CHECK entre deux colonnes de emprunt ; NOT NULL partout sauf sur les quatre champs facultatifs.',
  'numero_carte varchar(9) not null unique, email varchar(60) not null unique, isbn char(13) unique, etat varchar(6) not null check (etat in (\'neuf\', \'bon\', \'abime\', \'retire\')), check (date_retour_prevue > date_emprunt), check (date_retour >= date_emprunt).'
];

export const points = 200;
