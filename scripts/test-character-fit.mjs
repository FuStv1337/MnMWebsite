import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeClassFitScore, getClassFitWeights, getDefensiveFitSkills } from '../src/character-fit.js';
import { parseDefensiveSkills } from './class-skill-parser.mjs';

const data = JSON.parse(readFileSync(new URL('../data/character-creation.json', import.meta.url), 'utf8'));
const before = JSON.stringify(data.classes);
for (const cls of data.classes) {
  const weights = getClassFitWeights(cls);
  const extra = ['Tank', 'Melee/Hybrid'].includes(cls.role) ? 2 : 0;
  assert(Array.isArray(cls.defensiveSkills), `${cls.name}: skill data missing`);
  const agiExtra = getDefensiveFitSkills(cls).length;
  assert.equal(weights.AGI ?? 0, (cls.statModifiers.AGI ?? 0) + agiExtra, cls.name);
  assert.equal(weights.DEX ?? 0, (cls.statModifiers.DEX ?? 0) + extra, cls.name);
  for (const race of data.races) {
    const stats = race.startingStats.find((row) => row.class === cls.name);
    if (!stats || !data.statKeys.every((key) => Number.isFinite(stats[key]))) continue;
    const oldScore = computeClassFitScore(stats, cls.statModifiers);
    assert.equal(computeClassFitScore(stats, weights), oldScore + stats.DEX * extra + stats.AGI * agiExtra, `${race.name}/${cls.name}`);
  }
}
assert.equal(JSON.stringify(data.classes), before, 'Fit must not alter class bonuses');
const shadowKnight = data.classes.find((cls) => cls.name === 'Shadow Knight');
const goblinStats = data.races.find((race) => race.name === 'Goblin').startingStats.find((row) => row.class === shadowKnight.name);
assert.deepEqual(shadowKnight.defensiveSkills, ['Parry', 'Dodge', 'Block']);
assert.equal(computeClassFitScore(goblinStats, getClassFitWeights(shadowKnight)), 243);
for (let count = 0; count <= 3; count++) {
  const defensiveSkills = ['Parry', 'Dodge', 'Block'].slice(0, count);
  assert.equal(getClassFitWeights({ role: 'Caster', statModifiers: { AGI: 2 }, defensiveSkills }).AGI, 2 + count);
}
assert.deepEqual(getDefensiveFitSkills({ defensiveSkills: ['Dodge', 'Dodge', 'Defense'] }), ['Dodge']);
assert.deepEqual(parseDefensiveSkills('<p>Parry Block</p><table><tr><th>Level</th><th>Trained</th><th>Skill</th></tr><tr><td>20</td><td>Yes</td><td>Dodge</td></tr></table>'), ['Dodge']);
assert.throws(() => parseDefensiveSkills('<p>Parry, Dodge, Block</p>'), /No class skill table/);
assert.equal(computeClassFitScore(null, { DEX: 2 }), null);
assert.equal(computeClassFitScore({ DEX: null }, { DEX: 2 }), null);
assert.equal(computeClassFitScore({ DEX: 0 }, { DEX: 2 }), 0);
assert.equal(getClassFitWeights(null), null);
console.log('PASS: +2 melee DEX, +1 AGI per defensive skill for all roles, additive weights, unchanged character bonuses, skill-table parsing and missing stats');
