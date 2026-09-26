import assert from 'node:assert/strict';
import { getAttributeCaps, normalizeAllocation, capStatKeys } from '../src/character-caps.js';

// Max columns transcribed independently from supplied screenshots.
const observations = [
  ['Human', 'Archer', [25,25,27,25,25,25,27]],
  ['Human', 'Bard', [25,27,25,25,25,25,27]],
  ['Human', 'Beastmaster', [27,25,25,25,25,27,25]],
  ['Human', 'Cleric', [25,27,25,25,25,27,25]],
  ['Human', 'Druid', [25,25,25,25,25,27,27]],
  ['Human', 'Elementalist', [25,27,25,25,27,25,25]],
  ['Human', 'Enchanter', [25,25,25,25,27,25,27]],
  ['Human', 'Fighter', [27,27,25,25,25,25,25]],
  ['Human', 'Inquisitor', [25,27,25,25,25,25,27]],
  ['Human', 'Monk', [25,25,27,27,25,25,25]],
  ['Human', 'Necromancer', [25,25,25,25,27,25,25]],
  ['Human', 'Paladin', [25,27,25,25,25,27,25]],
  ['Human', 'Ranger', [25,27,25,25,25,27,25]],
  ['Human', 'Rogue', [27,25,27,25,25,25,25]],
  ['Human', 'Shadow Knight', [25,27,25,25,27,25,25]],
  ['Human', 'Shaman', [25,25,25,27,25,27,25]],
  ['Human', 'Spellblade', [27,25,25,25,27,25,25]],
  ['Human', 'Wizard', [25,25,27,25,27,25,25]],
  ['Ogre', 'Archer', [27,26,26,24,26,25,25]],
  ['Ogre', 'Beastmaster', [29,26,24,24,26,27,23]],
  ['Ogre', 'Elementalist', [27,28,24,24,28,25,23]],
  ['Ogre', 'Fighter', [29,28,24,24,26,25,23]],
  ['Ogre', 'Monk', [27,26,26,26,26,25,23]],
  ['Ogre', 'Ranger', [27,28,24,24,26,27,23]],
  ['Ogre', 'Shadow Knight', [27,28,24,24,28,25,23]],
  ['Ogre', 'Shaman', [27,26,24,26,26,27,23]],
  ['Goblin', 'Archer', [25,25,28,27,25,24,25]],
  ['Goblin', 'Shadow Knight', [25,27,26,27,27,24,23]],
  ['Wood Elf', 'Archer', [24,23,28,27,24,26,27]],
  ['Wood Elf', 'Ranger', [24,25,26,27,24,28,25]],
  ['Dwarf', 'Fighter', [27,28,25,25,25,25,24]],
  ['Dwarf', 'Cleric', [25,28,25,25,25,27,24]],
  ['Gnome', 'Cleric', [24,26,27,25,27,26,24]],
  ['Gnome', 'Wizard', [24,24,29,25,29,24,24]],
  ['Halfling', 'Cleric', [25,27,26,26,24,27,24]],
  ['Halfling', 'Ranger', [25,27,26,26,24,27,24]],
  ['Deep Elf', 'Archer', [25,25,27,25,27,25,25]],
  ['Deep Elf', 'Shadow Knight', [25,27,25,25,29,25,23]],
  ['Deep Gnome', 'Beastmaster', [25,23,26,26,27,27,25]],
  ['Deep Gnome', 'Enchanter', [23,23,26,26,29,25,27]],
];
for (const [race, cls, max] of observations) {
  const caps = getAttributeCaps(race, cls);
  assert.deepEqual(capStatKeys.map(key => caps[key]), max, `${race}/${cls}`);
}
for (const race of ['High Elf', 'Troll', 'Deep Dwarf']) assert.equal(getAttributeCaps(race, 'Cleric'), null);
const caps = getAttributeCaps('Goblin', 'Archer');
const stats = { STR:17, STA:15, DEX:23, AGI:21, INT:17, WIS:16, CHA:13 };
const normalized = normalizeAllocation({ DEX:10 }, stats, caps);
assert.equal(normalized.DEX, 5);
assert.equal(10 - Object.values(normalized).reduce((a,b)=>a+b,0), 5, 'Over-cap points refunded');
assert.equal(normalizeAllocation({ STR:10 }, { STR:16 }, getAttributeCaps('Human', 'Rogue')).STR, 10, 'Budget limits unreachable cap');
assert.equal(normalizeAllocation({ DEX:10 }, { DEX:30 }, caps).DEX, 0);
assert.equal(normalizeAllocation({ DEX:10 }, null, null).DEX, 0);
assert.equal(normalizeAllocation({ DEX:10 }, stats, null).DEX, 10);
assert.deepEqual(normalizeAllocation({ STR:-3, STA:NaN, DEX:2.8, AGI:20 }, stats, caps), {STR:0,STA:0,DEX:2,AGI:6,INT:0,WIS:0,CHA:0});
assert.equal(Object.values(normalizeAllocation({STR:8,STA:8}, stats, caps)).reduce((a,b)=>a+b,0), 10);
console.log(`PASS: ${observations.length} screenshot combinations / ${observations.length * 7} cap values, unknown caps, allocation limits and saved-build normalization`);
