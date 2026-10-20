import { existsSync } from 'node:fs';
import path from 'node:path';
import { assert } from '@othila-academy/lab';
import { ROOT } from '../../shared/db.mjs';
import { missingSections } from '../../shared/fichiers.mjs';

export const title = 'Justifier le modèle';
export const instructions = `Écris project/mongo/MODELE.md, pour l'équipe qui maintiendra le catalogue, avec au moins deux sections :
  ## Choix d'imbrication : ce que tu as imbriqué (auteurs, avis récents), ce qui reste à part (tous les avis), et pourquoi ;
     le motif « subset » : garder dans le document ce que l'écran affiche, et le reste ailleurs ;
  ## Différences avec le modèle relationnel : ce que PostgreSQL aurait imposé (tables, jointures, contraintes), ce que le
     document permet (une lecture d'un coup, des notices hétérogènes), et ce qu'il coûte (des données en double, à tenir à jour).
Le fond est relu par le formateur ; le check ne regarde que les titres des sections.

À expliquer (npx lab submit modele-document justifier) : quand un lecteur ajoute un avis, qu'est-ce qui doit être mis à jour dans ton modèle ?`;

export const MODELE = path.join(ROOT, 'project/mongo/MODELE.md');
const SECTIONS = ["Choix d'imbrication", 'Différences avec le modèle relationnel'];

export const checks = [
  {
    id: 'modele-sections',
    label: 'project/mongo/MODELE.md existe, avec les sections « Choix d’imbrication » et « Différences avec le modèle relationnel »',
    run: async () => {
      assert(existsSync(MODELE), 'Attendu : project/mongo/MODELE.md. Constaté : absent.');
      const manquent = missingSections(MODELE, SECTIONS);
      assert(manquent.length === 0, `Attendu : une section (## …) pour ${SECTIONS.join(' et ')}. Constaté : il manque ${manquent.join(', ')}.`);
    }
  }
];

export const hints = [
  'Pour chaque champ du document : est-il lu avec la notice, change-t-il souvent, peut-il grossir sans limite ?',
  'Le motif « subset » : les 5 avis que l’écran montre dans le document, tous les avis dans avis_bruts. Compare avec les tables et les jointures du lab schema.',
  'Deux titres : « ## Choix d’imbrication » et « ## Différences avec le modèle relationnel », chacun avec quelques phrases argumentées.'
];

export const points = 100;
