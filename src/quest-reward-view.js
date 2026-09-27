const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
import {renderItemStats} from './item-stats-view.js';
let sequence=0;
export function renderRewardSection(section,items={}){
  const links=[...new Map((section.links||[]).map(l=>[l.label,l])).values()].sort((a,b)=>b.label.length-a.label.length);
  if(!links.length)return esc(section.text);
  const pattern=new RegExp(links.map(l=>l.label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
  let html='',offset=0;
  for(const match of section.text.matchAll(pattern)){
    html+=esc(section.text.slice(offset,match.index));offset=match.index+match[0].length;
    const link=links.find(l=>l.label===match[0]),item=items[link.title],id=`reward-preview-${++sequence}`;
    const stats=Object.entries(item?.stats||{});
    html+=`<span class="quest-reward"><a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer" aria-describedby="${id}">${esc(link.label)}</a><span class="quest-reward-tip" role="tooltip" id="${id}"><strong>${esc(item?.title||link.label)}</strong>${stats.length?renderItemStats(item.stats):`<span>${item?.status==='missing'?'This wiki page does not exist yet.':'No item stats documented for this reward page.'}</span>`}${item?.revision?`<small>Wiki item revision ${item.revision}</small>`:''}</span></span>`;
  }
  return html+esc(section.text.slice(offset));
}
