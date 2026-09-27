import * as cheerio from 'cheerio';
const clean = s => s.replace(/\s+/g, ' ').trim();
export function parseQuest(page) {
  const $ = cheerio.load(page.text['*']);
  $('style,script,.mw-editsection,.toc,.quest-image-wrapper').remove();
  $('[class*="embedvideo"],iframe,video').remove();
  $('a[href*="youtube.com"],a[href*="youtu.be"]').remove();
  const fields = {};
  $('.questTopTable tr').each((_, row) => {
    const key = clean($(row).find('.quest-label').text()).replace(/:$/, '');
    const cell = $(row).find('.quest-data').clone();
    cell.find('br').replaceWith(' | ');
    if (key) fields[key] = clean(cell.text());
  });
  const categories = (page.categories || []).map(c => c['*'].replaceAll('_', ' '));
  const classes = categories.filter(c => c.endsWith(' Quests') && !['All Class Quests','Quests by Zone'].includes(c)).map(c=>c.slice(0,-7)).filter(c=>/^(Archer|Bard|Beastmaster|Cleric|Druid|Elementalist|Enchanter|Fighter|Inquisitor|Monk|Necromancer|Paladin|Ranger|Rogue|Shadow Knight|Shaman|Spellblade|Wizard)$/.test(c));
  const sections = []; let section; let rewards=false;
  $('.mw-parser-output').children().each((_, el) => {
    const node = $(el), heading = node.is('h2,h3,h4') ? node : node.find('h2,h3,h4').first();
    if (heading.length) {
      if(heading.is('h2') || /walkthrough|walk-through/i.test(heading.text())) rewards=/rewards?/i.test(heading.text());
      section = {title:clean(heading.text()), text:[], links:[], isReward:rewards||/^rewards?$/i.test(clean(heading.text()))}; sections.push(section);
    }
    else if (section && !node.is('.questTopTable') && !node.find('.questTopTable').length) {
      node.find('br').replaceWith('\n');
      if(section.isReward) node.find('a[href]').each((_,a)=>{
        const label=clean($(a).text()), href=$(a).attr('href');
        let url;try{url=new URL(href,'https://monstersandmemories.miraheze.org');}catch{return;}
        if(!label||url.origin!=='https://monstersandmemories.miraheze.org'||!url.pathname.startsWith('/wiki/'))return;
        const title=decodeURIComponent(url.pathname.slice(6)).replaceAll('_',' ');
        if(title.includes(':'))return;
        section.links.push({label,title,url:url.href});
      });
      const text = node.text().split('\n').filter(line=>!/(?:youtube|youtu\.be|^\s*video walk[- ]?through:?\s*$)/i.test(line)).join('\n').trim(); if (text && !/^[{}\s]+$/.test(text)) section.text.push(text);
    }
  });
  const body = clean($('.mw-parser-output').text());
  const levelText = fields['Minimum Level'] || '';
  return {id:page.pageid, title:page.title, revision:page.revid,
    url:`https://monstersandmemories.miraheze.org/wiki/${encodeURIComponent(page.title.replaceAll(' ','_'))}`,
    zone:fields['Start Zone'] && fields['Start Zone'] !== '-' ? fields['Start Zone'] : null,
    giver:fields['Quest Giver'] || null, levelText, minLevel:/^\d+$/.test(levelText)?Number(levelText):null,
    classes, allClasses:categories.includes('All Class Quests') || /all class/i.test(fields.Classes || ''),
    classText:fields.Classes || '', relatedNpcs:fields['Related NPCs'] || '',
    status:/quest (?:is |is now )?disabled/i.test(body)?'disabled':'unmarked',
    sections:sections.map(s=>({...s,text:s.text.join('\n\n')})).filter(s=>s.text),
    categories, fields};
}
