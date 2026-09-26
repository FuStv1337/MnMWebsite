import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../data/character-creation.json', import.meta.url), 'utf8'));
const goblin = data.races.find((race) => race.name === 'Goblin');
assert(goblin.classes.includes('Shadow Knight'));
assert(goblin.startingStats.some((row) => row.class === 'Shadow Knight' && data.statKeys.every((key) => Number.isFinite(row[key]))));
let combinations = 0;
for (const race of data.races) {
  for (const cls of data.classes) {
    const allowed = race.classes.includes(cls.name);
    assert.equal(cls.races.includes(race.name), allowed, `${race.name}/${cls.name}: selector mismatch`);
    assert.equal(cls.raceAbbrevs.includes(race.abbrev), allowed, `${race.name}/${cls.name}: abbreviation mismatch`);
    if (allowed) combinations++;
  }
}
console.log(`PASS: Goblin Shadow Knight stats and ${combinations} combinations consistent across ${data.races.length} races / ${data.classes.length} classes`);
