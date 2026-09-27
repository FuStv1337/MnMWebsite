import { mkdir, writeFile } from 'node:fs/promises';
import { parseQuest } from './quest-parser.mjs';
import { fetchQuestRewards } from './quest-rewards.mjs';
const api = 'https://monstersandmemories.miraheze.org/w/api.php';
async function get(params) {
  for (let attempt=0; attempt<3; attempt++) {
    try { const r=await fetch(`${api}?${new URLSearchParams({...params,format:'json'})}`); if(!r.ok) throw Error(`HTTP ${r.status}`); const d=await r.json(); if(d.error) throw Error(JSON.stringify(d.error)); return d; }
    catch(e) { if(attempt===2) throw e; await new Promise(r=>setTimeout(r,1000)); }
  }
}
const categories = ['Category:Quests'], seen = new Set(), titles = new Set();
while(categories.length) {
  const title=categories.shift(); if(seen.has(title)) continue; seen.add(title);
  let continuation;
  do {
    const d=await get({action:'query',list:'categorymembers',cmtitle:title,cmlimit:'500',...(continuation?{cmcontinue:continuation}:{})});
    for(const p of d.query.categorymembers) {if(p.ns===14) categories.push(p.title); else if(p.ns===0) titles.add(p.title);}
    continuation=d.continue?.cmcontinue;
  } while(continuation);
}
await mkdir('asset-inspection.local/quests',{recursive:true});
const quests=[], excluded=[], canonical = new Set();
for(const title of [...titles].sort()) {
  const d=await get({action:'parse',page:title,redirects:'1',prop:'text|categories|revid'});
  if(canonical.has(d.parse.pageid)) continue; canonical.add(d.parse.pageid);
  await writeFile(`asset-inspection.local/quests/${d.parse.pageid}.json`,JSON.stringify(d.parse));
  const quest=parseQuest(d.parse);
  if(quest.categories.includes('NPCs') && !quest.categories.includes('Quests') && !Object.keys(quest.fields).length) {excluded.push({title:quest.title,reason:'NPC page, not a quest'});continue;}
  quests.push(quest);
  if(quests.length%20===0) console.log(`Parsed ${quests.length} quests`);
}
quests.sort((a,b)=>a.title.localeCompare(b.title));
const data={source:'https://monstersandmemories.miraheze.org/wiki/Category:Quests',fetchedAt:new Date().toISOString(),categoryCount:seen.size,excluded,quests};
data.rewardItems=await fetchQuestRewards(quests,get);
await mkdir('public/quests',{recursive:true});
await writeFile('public/quests/database.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({quests:quests.length,unknownLevels:quests.filter(q=>q.minLevel===null).length,unknownZones:quests.filter(q=>!q.zone).length,disabled:quests.filter(q=>q.status==='disabled').length}));
