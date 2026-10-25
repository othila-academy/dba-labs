import { existsSync } from 'node:fs';
import path from 'node:path';
import { assert } from '@othila-academy/lab';
import { ROOT } from '../../shared/db.mjs';
import { missingSections } from '../../shared/fichiers.mjs';

export const title = 'La stratégie de sécurité';
export const explain = 'Quelle menace de ta liste reste la plus probable une fois ce lab fait, et pourquoi ?';
export const instructions = `Écris project/legacy/PLAN-SECURITE.md, la stratégie de sécurité des deux bases de la médiathèque, avec ces sections :
  ## Menaces : qui, quoi, comment (un poste du réseau, une injection SQL, un mot de passe volé, l'erreur d'un stagiaire…) ;
  ## Mesures techniques : ce que tu as corrigé dans ce lab, et ce qui reste (chiffrement des sauvegardes, TLS de MongoDB…) ;
  ## Mesures organisationnelles : comptes nominatifs, rotation des mots de passe, revue des droits, secrets hors de git ;
  ## Sauvegarde et reprise : RPO et RTO visés, ce que font backup.sh et backup-mongo.sh, les tests de restauration ;
  ## Surveillance : ce qu'on journalise, qui le lit, quelles alertes (connexions refusées, requêtes lentes, verrous).
C'est la section 6 de ton dossier : écris-la une fois, dans le dossier, puis copie-la ici avec ses cinq titres (## …), pour le
check. Le formateur évalue le fond, dans le dossier ; le check ne regarde que les titres des sections.

À expliquer (npx lab submit durcissement plan-securite) : quelle menace de ta liste reste la plus probable une fois ce lab fait, et pourquoi ?`;

const PLAN = path.join(ROOT, 'project/legacy/PLAN-SECURITE.md');
const SECTIONS = ['Menaces', 'Mesures techniques', 'Mesures organisationnelles', 'Sauvegarde et reprise', 'Surveillance'];

export const checks = [
  {
    id: 'plan-securite-sections',
    label: 'project/legacy/PLAN-SECURITE.md a les sections Menaces, Mesures techniques, Mesures organisationnelles, Sauvegarde et reprise, Surveillance',
    run: async () => {
      assert(existsSync(PLAN), 'Attendu : project/legacy/PLAN-SECURITE.md. Constaté : absent.');
      const manquent = missingSections(PLAN, SECTIONS);
      assert(manquent.length === 0, `Attendu : une section (## …) pour chacun des cinq thèmes. Constaté : il manque ${manquent.join(', ')}.`);
    }
  }
];

export const hints = [
  'Pars des menaces : chaque mesure, technique ou non, doit répondre à l’une d’elles.',
  'Reprends ce que tu as fait aux labs roles, sauvegarde, incident-verrou, replica-set et dans celui-ci : chaque lab est une mesure.',
  'Cinq titres de niveau 2, exactement : Menaces, Mesures techniques, Mesures organisationnelles, Sauvegarde et reprise, Surveillance.'
];

export const points = 150;
