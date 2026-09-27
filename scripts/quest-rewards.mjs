import {parseItem} from './quest-item-parser.mjs';
export async function fetchQuestRewards(quests,get){
  const titles=[...new Set(quests.flatMap(q=>q.sections.flatMap(s=>(s.links||[]).map(l=>l.title))))];
  const items={};const fetchedAt=new Date().toISOString();
  for(let i=0;i<titles.length;i+=40){
    const batch=titles.slice(i,i+40);
    const d=await get({action:'query',formatversion:'2',prop:'revisions',rvprop:'ids|timestamp|content',rvslots:'main',redirects:'1',titles:batch.join('|')});
    const aliases=Object.fromEntries([...(d.query.normalized||[]),...(d.query.redirects||[])].map(a=>[a.from,a.to]));
    for(const title of batch){let target=title;const seen=new Set();while(aliases[target]&&!seen.has(target)){seen.add(target);target=aliases[target];}
      const page=d.query.pages.find(p=>p.title===target);if(!page)throw Error(`Missing API result for ${title}`);
      items[title]=parseItem(page,fetchedAt);
    }
  }
  return items;
}
