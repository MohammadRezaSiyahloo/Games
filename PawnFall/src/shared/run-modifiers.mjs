export const RUN_MODIFIERS = {
  none: { name: 'Standard rules', text: 'The court as intended.' },
  scarce: { name: 'Scarce flasks', text: 'Begin with one flask instead of three.' },
  patrol: { name: 'Elite patrol', text: 'An extra elite knight joins each non-boss encounter.' },
  relentless: {
    name: 'Relentless court',
    text: 'Regular enemies move 20% faster and recover 20% sooner.',
  },
};
export const validModifier = (id) => (Object.hasOwn(RUN_MODIFIERS, id) ? id : 'none');
