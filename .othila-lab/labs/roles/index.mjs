export const title = 'Rôles et privilèges';
export const steps = ['proprietaire', 'application', 'analyste'];
export const duration = '1 h';
export const summary = `Jusqu'ici, tout passe par postgres, le superutilisateur : il peut tout, y compris tout casser. Trois
populations vont se servir de la base : l'équipe qui la fait évoluer, l'application des médiathèques, les analystes du service
culturel. Tu donnes à chacune un rôle qui a ce qu'il lui faut, et rien de plus : c'est le moindre privilège. Les checks se
connectent avec chaque rôle, et essaient.`;
export const objectives = [
  'séparer le propriétaire du schéma, l’application et la lecture analytique',
  'accorder des privilèges par table et par colonne (GRANT)',
  'vérifier un privilège en se connectant avec le rôle, pas en relisant le script'
];
