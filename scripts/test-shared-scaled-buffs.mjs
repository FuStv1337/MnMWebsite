import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEffects } from './parse-effects.mjs';

const bard = JSON.parse(readFileSync(new URL('../data/classes/bard.json', import.meta.url), 'utf8'));
const song = bard.entries.find(e => e.name === 'Beats of War');
const { effects } = parseEffects(song.description, 'song');
const buffs = effects.filter(e => e.kind === 'buff');
assert.deepEqual(buffs.map(e=>e.stat).sort(), ['Agility', 'Dexterity', 'Strength']);
for (const effect of buffs) {
  assert.equal(effect.min, 2); assert.equal(effect.max, 4);
  assert.equal(effect.minLevel, 1); assert.equal(effect.maxLevel, 16);
}
const debuffs = parseEffects('Decreasing their Strength and Agility by 2 (L1) to 4 (L16) for 18 seconds.').effects.filter(e=>e.kind==='debuff');
assert.equal(debuffs.length, 2);
console.log('PASS: Beats of War STR/AGI/DEX scaling and shared scaled debuffs');
