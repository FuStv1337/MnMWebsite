export const attributes = ['str','sta','dex','agi','int','wis','cha'];
export function attributeTotal(item) {
  if(item?.status!=='item' || !Object.keys(item.stats||{}).length)return null;
  let total=0;
  for(const key of attributes){
    const value=String(item.stats[key]??'0').trim();
    if(!/^[+-]?\d+(?:\.\d+)?$/.test(value))return null;
    total+=Number(value);
  }
  return total;
}
export function rankedRewards(quest,items={}) {
  const links=[...new Map(quest.sections.flatMap(s=>s.links||[]).map(l=>[l.title,l])).values()];
  return links.map(link=>({...link,total:attributeTotal(items[link.title])})).filter(r=>r.total!==null).sort((a,b)=>b.total-a.total||a.title.localeCompare(b.title));
}
export function sortQuests(quests,items,sort) {
  const scores=new Map(quests.map(q=>[q.id,rankedRewards(q,items)[0]?.total??null]));
  return [...quests].sort((a,b)=>{
    if(sort==='attributes'){
      const x=scores.get(a.id),y=scores.get(b.id);
      if(x===null&&y!==null)return 1;if(y===null&&x!==null)return -1;
      if(x!==y)return y-x;
    }
    return a.title.localeCompare(b.title);
  });
}
