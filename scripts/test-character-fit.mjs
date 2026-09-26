import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeClassFitScore, getClassFitWeights } from '../src/character-fit.js';

const data = JSON.parse(readFileSync(new URL('../data/character-creation.json', import.meta.url), 'utf8'));
const before = JSON.stringify(data.classes);
for (const cls of data.classes) {
  const weights = getClassFitWeights(cls);
  const extra = ['Tank', 'Melee/Hybrid'].includes(cls.role) ? 2 : 0;
  assert.equal(weights.DEX ?? 0, (cls.statModifiers.DEX ?? 0) + extra, cls.name);
  for (const race of data.races) {
    const stats = race.startingStats.find((row) => row.class === cls.name);
    if (!stats || !data.statKeys.every((key) => Number.isFinite(stats[key]))) continue;
    const oldScore = computeClassFitScore(stats, cls.statModifiers);
    assert.equal(computeClassFitScore(stats, weights), oldScore + stats.DEX * extra, `${race.name}/${cls.name}`);
  }
}
assert.equal(JSON.stringify(data.classes), before, 'Fit must not alter class bonuses');
const shadowKnight = data.classes.find((cls) => cls.name === 'Shadow Knight');
const goblinStats = data.races.find((race) => race.name === 'Goblin').startingStats.find((row) => row.class === shadowKnight.name);
assert.equal(computeClassFitScore(goblinStats, getClassFitWeights(shadowKnight)), 186);
assert.equal(computeClassFitScore(null, { DEX: 2 }), null);
assert.equal(computeClassFitScore({ DEX: null }, { DEX: 2 }), null);
assert.equal(computeClassFitScore({ DEX: 0 }, { DEX: 2 }), 0);
assert.equal(getClassFitWeights(null), null);
console.log('PASS: +2 DEX for tanks/melee, additive existing weights, unchanged caster/priest scores and character bonuses, missing stats');
