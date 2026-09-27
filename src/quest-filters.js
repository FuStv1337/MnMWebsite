export function filterQuests(quests, {search='',zone='',className='',level='',status='',includeUnknown=true}={}) {
  const term=search.trim().toLowerCase();
  return quests.filter(q => (!zone || (zone==='unknown'?!q.zone:q.zone===zone))
    && (!className || (className==='unknown'? !q.allClasses&&!q.classes.length:q.allClasses||q.classes.includes(className)))
    && (level==='' || (q.minLevel===null?includeUnknown:q.minLevel<=Number(level)))
    && (!status || q.status===status)
    && (!term || [q.title,q.zone,q.giver,q.relatedNpcs,...q.sections.map(s=>s.text)].join(' ').toLowerCase().includes(term)));
}
