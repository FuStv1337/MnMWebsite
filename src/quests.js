import './style.css';
import './quests.css';
import './item-stats.css';
import {renderSiteHeader} from './site-header.js';
import {sitePath} from './site-paths.js';
import {filterQuests} from './quest-filters.js';
import {renderRewardSection} from './quest-reward-view.js';
import {rankedRewards,sortQuests} from './quest-value.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=v=>`<option value="${esc(v)}">${esc(v)}</option>`;
document.querySelector('#app').innerHTML=`${renderSiteHeader({active:'quests',tagline:'Quest journal · Monsters & Memories'})}<main class="quests-page"><p class="quest-eyebrow">THE ADVENTURER’S JOURNAL</p><h1>Find your next quest</h1><p class="quest-intro">Explore the community wiki’s quests, rewards and walkthroughs.</p><div id="quest-content" role="status">Loading quests…</div></main>`;
function rewardSummary(quest,items){
 const rewards=rankedRewards(quest,items);
 if(!rewards.length)return '<p class="quest-note">Reward attributes unknown</p>';
 return `<div class="quest-value"><strong>Best reward: ${rewards[0].total} total attributes</strong><ul>${rewards.map(r=>`<li>${renderRewardSection({text:r.label,links:[r]},items)} <b>${r.total}</b></li>`).join('')}</ul></div>`;
}
async function init(){
 try {
  const response=await fetch(sitePath('quests/database.json'));if(!response.ok)throw Error(`HTTP ${response.status}`);
  const data=await response.json(), quests=data.quests;
  const zones=[...new Set(quests.map(q=>q.zone).filter(Boolean))].sort();
  const classes=[...new Set(quests.flatMap(q=>q.classes))].sort();
  const root=document.querySelector('#quest-content');root.removeAttribute('role');
  root.innerHTML=`<div class="quest-overview"><strong>${quests.length} quests</strong><span>${zones.length} starting locations</span><span>Updated ${esc(new Date(data.fetchedAt).toLocaleDateString())}</span></div>
  <form class="quest-controls"><label class="quest-search">Search quests, NPCs or rewards<input id="quest-search" type="search" placeholder="A quest, an item, a familiar name…"></label><label>Starting location<select id="quest-zone"><option value="">All locations</option>${zones.map(option).join('')}<option value="unknown">Unknown location</option></select></label><label>Class<select id="quest-class"><option value="">All classes</option>${classes.map(option).join('')}<option value="unknown">Unknown restrictions</option></select></label><label>Your level<input id="quest-level" type="number" min="1" max="100" placeholder="Any" /></label><label>Status<select id="quest-status"><option value="">All statuses</option><option value="unmarked">Not marked disabled</option><option value="disabled">Marked disabled</option></select></label><label>Sort by<select id="quest-sort"><option value="name">Quest name</option><option value="attributes">Highest reward attributes</option></select></label><label class="quest-check"><input id="quest-unknown" type="checkbox" checked> Include unknown levels</label><button type="reset">Clear filters</button></form>
  <p class="quest-note">Level filters use the wiki’s minimum starting level, not difficulty or later quest stages. Class filters include quests listed for all classes. “Not marked disabled” does not confirm availability.</p>
  <p class="quest-note">Reward score = STR + STA + DEX + AGI + INT + WIS + CHA, including penalties. Quests rank by their best documented item; AC, HP, mana and resists are separate. Unknown scores appear last. Check item class and race restrictions before choosing a quest.</p><p id="quest-count" role="status" aria-live="polite"></p><div id="quest-results"></div><div class="quest-pagination"><button id="quest-prev">Previous</button><span id="quest-page"></span><button id="quest-next">Next</button></div>
  <footer class="quest-note">Adapted from <a href="${data.source}" target="_blank" rel="noopener noreferrer">Monsters &amp; Memories Community Wiki contributors</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · <a href="${sitePath('quests/database.json')}">Download quest data</a>. Each quest links to its source revision.</footer>`;
  const el=id=>document.getElementById(`quest-${id}`);let page=0;
  root.addEventListener('keydown',e=>{if(e.key==='Escape')root.querySelectorAll('.quest-reward-tip').forEach(t=>t.classList.add('dismissed'));});
  for(const event of ['pointerover','focusin'])root.addEventListener(event,e=>{const reward=e.target.closest('.quest-reward');if(reward&&!reward.contains(e.relatedTarget))reward.querySelector('.quest-reward-tip')?.classList.remove('dismissed');});
  function render(){
   const rows=sortQuests(filterQuests(quests,{search:el('search').value,zone:el('zone').value,className:el('class').value,level:el('level').value,status:el('status').value,includeUnknown:el('unknown').checked}),data.rewardItems,el('sort').value);
   const pages=Math.max(1,Math.ceil(rows.length/20));page=Math.min(page,pages-1);
   el('count').textContent=`${rows.length} of ${quests.length} quests`;
   el('results').innerHTML=rows.slice(page*20,(page+1)*20).map(q=>`<article class="quest-card"><div class="quest-card-top"><span>${esc(q.zone||'Unknown location')}</span><span class="${q.status==='disabled'?'quest-disabled':''}">${q.status==='disabled'?'Marked disabled':`Min. level ${esc(q.levelText||'unknown')}`}</span></div><h2><a href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">${esc(q.title)}</a></h2><p class="quest-meta">${esc(q.allClasses?'All classes':q.classText||q.classes.join(', ')||'Class restrictions unknown')}</p><p><b>Quest giver:</b> ${esc(q.giver&&q.giver!=='-'?q.giver:'Unknown')}</p>${q.relatedNpcs?`<p><b>Related NPCs:</b> ${esc(q.relatedNpcs)}</p>`:''}${rewardSummary(q,data.rewardItems)}<details><summary>Rewards &amp; walkthrough</summary>${q.sections.map(s=>`<section><h3>${esc(s.title)}</h3><div class="quest-prose">${renderRewardSection(s,data.rewardItems)}</div></section>`).join('')||'<p>No walkthrough documented.</p>'}<p><a href="https://monstersandmemories.miraheze.org/w/index.php?oldid=${q.revision}" target="_blank" rel="noopener noreferrer">Source revision ${q.revision}</a></p></details></article>`).join('')||'<p class="quest-empty">No matching quests. Try clearing a filter or including unknown levels.</p>';
   el('page').textContent=`Page ${page+1} of ${pages}`;el('prev').disabled=page===0;el('next').disabled=page>=pages-1;
  }
  const form=root.querySelector('form');form.addEventListener('submit',e=>e.preventDefault());form.addEventListener('input',()=>{page=0;render();});form.addEventListener('reset',()=>{setTimeout(()=>{page=0;render();},0);});
  el('prev').onclick=()=>{page--;render();};el('next').onclick=()=>{page++;render();};render();
 }catch(e){document.querySelector('#quest-content').textContent=`Unable to load quests. Please reload the page. (${e.message})`;}
}
init();
