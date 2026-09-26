// Transcribed from user-supplied character creation screenshots, 2026-09-26.
// These are allocation caps before trait bonuses, not starting-stat modifiers.
export const capStatKeys = ['STR', 'STA', 'DEX', 'AGI', 'INT', 'WIS', 'CHA'];
export const racialCaps = {
  Human: [25, 25, 25, 25, 25, 25, 25],
  Ogre: [27, 26, 24, 24, 26, 25, 23],
  Goblin: [25, 25, 26, 27, 25, 24, 23],
  'Wood Elf': [24, 23, 26, 27, 24, 26, 25],
  Dwarf: [25, 26, 25, 25, 25, 25, 24],
  Gnome: [24, 24, 27, 25, 27, 24, 24],
  Halfling: [25, 25, 26, 26, 24, 25, 24],
  'Deep Elf': [25, 25, 25, 25, 27, 25, 23],
  'Deep Gnome': [23, 23, 26, 26, 27, 25, 25],
};
export const classCapStats = {
  Archer: ['DEX', 'CHA'], Bard: ['STA', 'CHA'], Beastmaster: ['STR', 'WIS'],
  Cleric: ['STA', 'WIS'], Druid: ['WIS', 'CHA'], Elementalist: ['STA', 'INT'],
  Enchanter: ['INT', 'CHA'], Fighter: ['STR', 'STA'], Inquisitor: ['STA', 'CHA'],
  Monk: ['DEX', 'AGI'], Necromancer: ['INT'], Paladin: ['STA', 'WIS'],
  Ranger: ['STA', 'WIS'], Rogue: ['STR', 'DEX'], 'Shadow Knight': ['STA', 'INT'],
  Shaman: ['AGI', 'WIS'], Spellblade: ['STR', 'INT'], Wizard: ['DEX', 'INT'],
};

export function getAttributeCaps(raceName, className) {
  const base = racialCaps[raceName];
  const bonuses = classCapStats[className];
  if (!base || !bonuses) return null;
  return Object.fromEntries(capStatKeys.map((key, index) => [key, base[index] + (bonuses.includes(key) ? 2 : 0)]));
}

export function normalizeAllocation(allocation, startingStats, caps, budget = 10) {
  let remaining = budget;
  return Object.fromEntries(capStatKeys.map((key) => {
    const requested = Number.isFinite(allocation?.[key]) ? Math.max(0, Math.floor(allocation[key])) : 0;
    const limit = startingStats?.[key] == null ? 0
      : caps?.[key] == null ? budget : Math.max(0, caps[key] - startingStats[key]);
    const points = Math.min(requested, limit, remaining);
    remaining -= points;
    return [key, points];
  }));
}
