const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const priority = ['ac','dmg','damage','delay','str','sta','dex','agi','int','wis','cha','hp','mana','hp_regen','mana_regen','haste'];
const metadata = new Set(['slot','handed','skill','class','race','magic','lore','unique','nodrop','norent','nozone','item_stats']);
export function renderItemStats(stats = {}) {
  const entries = Object.entries(stats).filter(([key]) => !['weight','size'].includes(key));
  const bonuses = entries.filter(([key])=>!metadata.has(key)).sort(([a],[b]) => (priority.indexOf(a)<0?100:priority.indexOf(a))-(priority.indexOf(b)<0?100:priority.indexOf(b)));
  const row = ([key,value]) => `<span class="item-stat${key==='ac'?' item-stat-ac':''}"><b>${escape(key.replaceAll('_',' ').toUpperCase())}</b> ${escape(value)}</span>`;
  const restrictions = ['class','race'].filter(key=>stats[key]).map(key=>`<span><b>${key==='class'?'Class':'Race'}</b> ${escape(stats[key])}</span>`).join('');
  const details = entries.filter(([key])=>metadata.has(key)&&!['class','race','item_stats'].includes(key)).map(([key,value])=>/^(true|yes)$/i.test(value)?escape(key.toUpperCase()):`${escape(key.toUpperCase())} ${escape(value)}`).join(' · ');
  return `${bonuses.length?`<span class="item-stat-bonuses">${bonuses.map(row).join('')}</span>`:''}${restrictions?`<span class="item-stat-restrictions">${restrictions}</span>`:''}${details?`<span class="item-stat-details">${details}</span>`:''}${stats.item_stats?`<span class="item-stat-description">${escape(stats.item_stats)}</span>`:''}`;
}
