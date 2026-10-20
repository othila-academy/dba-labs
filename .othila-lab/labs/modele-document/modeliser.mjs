import { assert } from '@othila-academy/lab';
import { inAbortedTransaction, withMongo } from '../../shared/db.mjs';
import { CONTRAT, VALIDE } from './contrat.mjs';
import { RS0 } from './requetes.mjs';

export const title = 'Modéliser le catalogue';
export const instructions = `Le catalogue vient de deux exports bruts (lis infra/seed/CONTRAT.md) : notices_brutes, hétérogènes selon le
type, et avis_bruts. L'application veut un document par notice, à ce contrat :
  _id            l'_id de la notice (entier)
  type           livre, dvd, jeu ou revue
  titre          texte non vide (le nom, pour un jeu)
  auteurs        liste de textes « Prénom Nom » : les auteurs d'un livre, le réalisateur d'un DVD ; vide sinon
  annee          entier (un ancien export l'a parfois écrite en texte ; l'année de parution, pour une revue)
  tags           liste de textes (les mots_cles, pour un jeu)
  avis_recents   les 5 avis les plus récents au plus, du plus récent au plus ancien : { note, date, texte }
  note_moyenne   la moyenne de toutes les notes de la notice, ou null si elle n'a aucun avis
Écris project/mongo/001_catalogue.js (joué par scripts/db rebuild, avec mongosh, sur la base valmorin) :
  - il crée catalogue avec un validateur $jsonSchema qui impose ce contrat (validationLevel: 'strict', validationAction: 'error') ;
  - il construit les documents depuis notices_brutes par un pipeline d'agrégation ($lookup sur avis_bruts, $project, $merge).
Puis scripts/db rebuild, et regarde un document de chaque type : db.catalogue.findOne({ type: 'jeu' }).

À expliquer (npx lab submit modele-document modeliser) : pourquoi ne garder que 5 avis dans le document, et où sont les autres ?`;

export const prediction = {
  promptId: 'modele-moderate',
  question: 'Avec validationLevel: "moderate", la mise à jour d’un document déjà hors contrat est-elle contrôlée par le validateur ?',
  choices: ['oui', 'non'],
  expected: 'non'
};

const REFUS = 121; // DocumentValidationFailure
const catalogue = (client) => client.db('valmorin').collection('catalogue');
const ABSENT = 'Attendu : la collection catalogue. Constaté : absente. project/mongo/001_catalogue.js a-t-il été joué (scripts/db rebuild) ?';

async function infoCatalogue(client) {
  const [info] = await client.db('valmorin').listCollections({ name: 'catalogue' }).toArray();
  assert(info, ABSENT);
  return info;
}

// L'insertion d'un document dans une transaction annulée : null si elle passe, l'erreur sinon.
const essai = (client, doc) =>
  inAbortedTransaction(client, async (session) => {
    try {
      await catalogue(client).insertOne(doc, { session });
      return null;
    } catch (error) {
      return error;
    }
  });

async function expectRefus(client, doc, what) {
  await infoCatalogue(client);
  const error = await essai(client, doc);
  assert(error, `Attendu : le validateur refuse ${what}. Constaté : accepté. Ce champ est-il imposé par ton $jsonSchema (required, bsonType) ?`);
  assert(error.code === REFUS, `Attendu : un refus du validateur pour ${what}. Constaté : une autre erreur (« ${error.message} »).`);
}

// Une notice très commentée : les avis sont tirés surtout vers les petits _id (infra/seed/mongo/010_notices_avis.js).
const NOTICE = 1;

export const checks = [
  {
    id: 'validateur-strict',
    label: 'catalogue a un validateur $jsonSchema, en validationLevel strict et validationAction error',
    run: () =>
      withMongo(async (client) => {
        const { options } = await infoCatalogue(client);
        assert(options.validator?.$jsonSchema, 'Attendu : un validateur $jsonSchema sur catalogue. Constaté : aucun. db.getCollectionInfos({ name: "catalogue" }) le montre.');
        const level = options.validationLevel ?? 'strict';
        const action = options.validationAction ?? 'error';
        assert(level === 'strict' && action === 'error', `Attendu : validationLevel strict, validationAction error. Constaté : ${level}, ${action}. Que laisse passer chacun ?`);
      }, RS0)
  },
  {
    id: 'rejet-sans-titre',
    label: 'le validateur refuse une notice sans titre (transaction annulée)',
    run: () =>
      withMongo(async (client) => {
        const { titre, ...sansTitre } = VALIDE();
        await expectRefus(client, sansTitre, 'une notice sans titre');
      }, RS0)
  },
  {
    id: 'rejet-annee-texte',
    label: 'le validateur refuse une année écrite en texte (transaction annulée)',
    run: () => withMongo((client) => expectRefus(client, { ...VALIDE(), annee: '2024' }, 'une année en texte ("2024")'), RS0)
  },
  {
    id: 'accepte-valide',
    label: 'le validateur accepte une notice au contrat (transaction annulée)',
    run: () =>
      withMongo(async (client) => {
        await infoCatalogue(client);
        const error = await essai(client, VALIDE());
        assert(!error, `Attendu : une notice au contrat de la fiche est acceptée. Constaté : refusée (« ${error?.message} »). Ton validateur impose-t-il plus que le contrat ?`);
      }, RS0)
  },
  {
    id: 'catalogue-complet',
    label: 'catalogue a autant de documents que notices_brutes',
    run: () =>
      withMongo(async (client) => {
        await infoCatalogue(client);
        const db = client.db('valmorin');
        const [n, attendu] = await Promise.all([catalogue(client).countDocuments(), db.collection('notices_brutes').countDocuments()]);
        assert(n === attendu, `Attendu : ${attendu} documents, un par notice. Constaté : ${n}. Le $merge s'est-il arrêté sur un document refusé par ton validateur ?`);
      }, RS0)
  },
  {
    id: 'contrat-champs',
    label: 'chaque document du catalogue respecte le contrat des champs de la fiche',
    run: () =>
      withMongo(async (client) => {
        await infoCatalogue(client);
        const hors = { $nor: [{ $jsonSchema: CONTRAT }] };
        const total = await catalogue(client).estimatedDocumentCount();
        assert(total > 0, 'Attendu : des documents dans catalogue. Constaté : aucun. Le pipeline a-t-il un $merge final ?');
        const n = await catalogue(client).countDocuments(hors);
        const [exemple] = await catalogue(client).find(hors, { projection: { _id: 1 } }).limit(1).toArray();
        assert(n === 0, `Attendu : chaque document au contrat de la fiche. Constaté : ${n} hors contrat, par exemple db.catalogue.findOne({ _id: ${exemple?._id} }) : compare-le au contrat, champ par champ.`);
      }, RS0)
  },
  {
    id: 'avis-recents',
    label: 'avis_recents garde les 5 avis les plus récents, et note_moyenne est la moyenne de tous les avis (ou null)',
    run: () =>
      withMongo(async (client) => {
        await infoCatalogue(client);
        const db = client.db('valmorin');
        const trop = await catalogue(client).countDocuments({ 'avis_recents.5': { $exists: true } });
        assert(trop === 0, `Attendu : 5 avis récents au plus par document. Constaté : ${trop} document(s) en ont davantage.`);
        const doc = await catalogue(client).findOne({ _id: NOTICE });
        assert(doc, `Attendu : la notice ${NOTICE} dans catalogue. Constaté : absente.`);
        const avis = await db.collection('avis_bruts').find({ notice_id: NOTICE }).sort({ date: -1 }).toArray();
        const jour = (d) => new Date(d).toISOString().slice(0, 10);
        const attendus = avis.slice(0, 5).map((a) => jour(a.date)).join(', ');
        const vus = (doc.avis_recents ?? []).map((a) => jour(a.date)).join(', ');
        assert(vus === attendus, `Attendu : pour la notice ${NOTICE}, les avis du ${attendus}. Constaté : ${vus || 'aucun'}. Dans quel ordre le $lookup les rend-il ?`);
        const moyenne = avis.reduce((s, a) => s + a.note, 0) / avis.length;
        assert(
          typeof doc.note_moyenne === 'number' && Math.abs(doc.note_moyenne - moyenne) < 1e-9,
          `Attendu : note_moyenne ${moyenne.toFixed(3)} pour la notice ${NOTICE} (ses ${avis.length} avis). Constaté : ${doc.note_moyenne}. Sur quels avis la moyenne est-elle calculée ?`
        );
        const sansAvis = await catalogue(client).countDocuments({ avis_recents: { $size: 0 }, note_moyenne: { $ne: null } });
        assert(sansAvis === 0, `Attendu : note_moyenne null pour une notice sans avis. Constaté : ${sansAvis} document(s) ont une note sans avis.`);
      }, RS0)
  }
];

export const hints = [
  'Deux questions à part : ce que le validateur refuse (required, bsonType, enum, maxItems), et comment chaque type de notice devient un document du contrat ($ifNull, $switch, $toInt).',
  "db.createCollection('catalogue', { validator: { $jsonSchema: { bsonType: 'object', required: […], properties: { … } } }, validationLevel: 'strict' }) ; puis db.notices_brutes.aggregate([{ $lookup: { from: 'avis_bruts', localField: '_id', foreignField: 'notice_id', as: 'avis', pipeline: [{ $sort: { date: -1 } }] } }, { $project: { … } }, { $merge: { into: 'catalogue' } }]).",
  "Dans le $project : titre: { $ifNull: ['$titre', '$nom'] }, tags: { $ifNull: ['$tags', '$mots_cles'] }, annee: { $ifNull: [{ $toInt: '$annee' }, { $year: '$parution' }] }, auteurs : un $switch sur type ($map de $concat prenom ' ' nom ; ['$realisateur'] ; []), avis_recents: { $slice: ['$avis', 5] }, note_moyenne: { $avg: '$avis.note' }."
];

export const points = 250;
