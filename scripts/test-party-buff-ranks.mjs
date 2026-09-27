import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { highestBuffRanks } from '../src/party-buff-ranks.js';

const rows = [
  {className:'Cleric',name:'Blessed Barrier',level:1,value:100},
  {className:'Cleric',name:'Blessed Barrier II',level:10,value:50},
  {className:'Cleric',name:'Divine Barrier',level:30,value:200},
  {className:'Cleric',name:'Sense Magic',level:5,value:1},
  {className:'Wizard',name:'Sense Magic',level:5,value:1},
];
assert.deepEqual(highestBuffRanks(rows, 9).map(r=>r.name), ['Blessed Barrier','Sense Magic','Sense Magic']);
assert.deepEqual(highestBuffRanks(rows, 20).map(r=>r.name), ['Blessed Barrier II','Sense Magic','Sense Magic']);
assert.deepEqual(highestBuffRanks(rows, 60).map(r=>r.name), ['Divine Barrier','Sense Magic','Sense Magic']);
assert.equal(highestBuffRanks(rows, 0).length, 0);
const multi = [{className:'Shaman',name:'Tribal Spirit',level:1,stat:'STR'},
  {className:'Shaman',name:'Tribal Fury',level:30,stat:'STR'},
  {className:'Shaman',name:'Tribal Fury',level:30,stat:'STA'}];
assert.deepEqual(highestBuffRanks(multi,60).map(r=>r.stat),['STR','STA']);
const cleric = JSON.parse(readFileSync(new URL('../data/classes/cleric.json', import.meta.url))).entries.map(e=>({...e,className:'Cleric'}));
const resilience = cleric.filter(e=>/^(?:(?:Lesser|Greater) )?Resilien|^(?:(?:Lesser|Greater) )?Resolution|^Hymn of/.test(e.name));
assert.deepEqual(highestBuffRanks(resilience,60).map(e=>e.name),['Greater Resolution','Hymn of Greater Resolution']);
assert.deepEqual(highestBuffRanks(resilience,10).map(e=>e.name),['Resilience']);
console.log('PASS: level-cap filtering, highest level rather than value, numbered/named upgrades, distinct classes/buffs, multi-effect retention, real Cleric upgrades');
