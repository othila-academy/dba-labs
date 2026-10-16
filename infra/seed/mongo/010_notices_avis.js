// Les notices du catalogue telles que les anciens logiciels les ont exportées : hétérogènes selon le type,
// et les avis des lecteurs. PRNG à graine fixe (LCG de Numerical Recipes), jamais Math.random.
let state = 42;
const rand = () => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 4294967296;
};
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (list) => list[Math.floor(rand() * list.length)];
const some = (list, max) => {
  const n = int(0, max);
  const out = [];
  while (out.length < n) {
    const v = pick(list);
    if (!out.includes(v)) out.push(v);
  }
  return out;
};

const NOMS = ['Arnaud', 'Benoît', 'Carré', 'Delmas', 'Faure', 'Hamon', 'Joly', 'Lemaire', 'Perrin', 'Tessier'];
const PRENOMS = ['Anne', 'Bruno', 'Claire', 'Denis', 'Élise', 'Henri', 'Iris', 'Luc', 'Marie', 'Théo'];
const DEBUTS = ['Le jardin', 'La rivière', 'Les voyages', 'Le silence', 'La maison', 'Les nuits', 'La mémoire', 'Le port'];
const FINS = ['oublié', 'du nord', 'des brumes', 'perdu', 'de Valmorin', 'sans fin', "d'hiver", 'du Morin'];
const TAGS = ['roman', 'policier', 'jeunesse', 'histoire', 'science', 'poésie', 'bande dessinée', 'voyage', 'cuisine', 'nature'];
const AVIS = ['Captivant.', 'Un peu long.', 'À recommander.', 'Décevant.', 'Parfait pour les vacances.', 'Lu en une soirée.'];
const titre = () => `${pick(DEBUTS)} ${pick(FINS)}`;

function notice(id) {
  const r = rand();
  if (r < 0.6) {
    const annee = int(1950, 2025);
    return {
      _id: id, type: 'livre', titre: titre(),
      auteurs: Array.from({ length: int(1, 3) }, () => ({ nom: pick(NOMS), prenom: pick(PRENOMS) })),
      annee: rand() < 0.05 ? String(annee) : annee,   // l'ancien export écrivait parfois l'année en texte
      ...(rand() < 0.85 ? { isbn: `978${String(id).padStart(10, '0')}` } : {}),
      pages: int(60, 900), tags: some(TAGS, 4)
    };
  }
  if (r < 0.8) {
    return { _id: id, type: 'dvd', titre: titre(), realisateur: `${pick(PRENOMS)} ${pick(NOMS)}`, annee: int(1960, 2025), duree_min: int(70, 200), tags: some(TAGS, 3) };
  }
  if (r < 0.9) {
    // Les jeux viennent d'un autre logiciel : « nom » au lieu de « titre », « mots_cles » au lieu de « tags ».
    return { _id: id, type: 'jeu', nom: titre(), editeur: pick(['Asmodee', 'Iello', 'Gigamic', 'Repos']), annee: int(1990, 2025), joueurs: { min: int(1, 2), max: int(3, 8) }, mots_cles: some(TAGS, 3) };
  }
  // Les revues n'ont pas d'année : une date de parution.
  return { _id: id, type: 'revue', titre: titre(), numero: int(1, 400), parution: new Date(Date.UTC(int(1995, 2026), int(0, 11), int(1, 28))), tags: some(TAGS, 2) };
}

const BATCH = 5000;
db.notices_brutes.drop();
db.avis_bruts.drop();
for (let start = 1; start <= 100000; start += BATCH) {
  db.notices_brutes.insertMany(Array.from({ length: BATCH }, (_, i) => notice(start + i)), { ordered: false });
}
for (let start = 1; start <= 300000; start += BATCH) {
  db.avis_bruts.insertMany(Array.from({ length: BATCH }, (_, i) => ({
    _id: start + i,
    notice_id: Math.min(100000, 1 + Math.floor(100000 * rand() * rand())),   // quelques notices très commentées
    note: int(1, 5),
    date: new Date(Date.UTC(2023, 0, 1) + int(0, 1383) * 86400000),
    texte: pick(AVIS),
    auteur: `adherent${int(1, 50000)}`
  })), { ordered: false });
}
db.avis_bruts.createIndex({ notice_id: 1, date: -1 });
print(`notices_brutes : ${db.notices_brutes.countDocuments()} · avis_bruts : ${db.avis_bruts.countDocuments()}`);
