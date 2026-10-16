export const title = 'Étape invalide';
export const instructions = 'Une consigne sans question de soumission.';
export const prediction = { promptId: 'invalide', question: '?', choices: ['a', 'b'], expected: 'c' };
export const checks = [{ id: 'trop-long', label: 'x'.repeat(201), passesOnStart: true, run: async () => {} }];
export const hints = ['un', 'deux'];
export const points = 10;
