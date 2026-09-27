import * as cheerio from 'cheerio';
export const normalize = value => value.normalize('NFKC').replace(/[’‘]/g, "'").replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
export const wikiUrl = title => `https://monstersandmemories.miraheze.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
export function clean(value = '') {
  return cheerio.load(value.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => label || target).replace(/'{2,}/g, '').replace(/\{\{[^{}]*\}\}/g, ' ').replace(/^[*#:;]+/gm, '')).text().replace(/\s+/g, ' ').trim();
}
// Split only at the outer template's parameter boundaries, preserving nested templates/links.
export function fieldsFrom(text) {
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  const fields = {}; let depth = 0, links = 0, start = -1;
  function save(end) {
    if (start < 0) return;
    const part = text.slice(start, end), eq = part.indexOf('=');
    if (eq > 0) fields[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
  }
  for (let i = 0; i < text.length; i++) {
    const pair = text.slice(i, i + 2);
    if (pair === '{{') { depth++; i++; }
    else if (pair === '}}') { if (depth === 1) { save(i); start = -1; } depth--; i++; }
    else if (pair === '[[') { links++; i++; }
    else if (pair === ']]') { links--; i++; }
    else if (text[i] === '|' && depth === 1 && links === 0) { save(i); start = i + 1; }
  }
  return fields;
}
export function parseItem(page, fetchedAt) {
  const rev = page?.revisions?.[0], raw = rev?.slots?.main?.content || '';
  const fields = fieldsFrom(raw);
  const supported = /\{\{\s*ItemBox\b/i.test(raw);
  const stats = supported ? Object.fromEntries(Object.entries(fields).filter(([key,value]) =>
    /^(slot|handed|dmg|damage|delay|skill|ac|str|sta|agi|dex|int|wis|cha|hp|mana|hp_regen|mana_regen|haste|spell_haste|ranged_haste|cr|cor|dr|er|fr|mr|pr|hr|brass|percussion|singing|stringed|wind|effect\d*|cont_\w+|weight|size|class|race|item_stats|magic|lore|unique|nodrop|norent|nozone)$/.test(key) && clean(value) && !/^(false|no)$/i.test(clean(value))).map(([key,value])=>[key,clean(value)])) : {};
  return {title:page.title,url:wikiUrl(page.title),revision:rev?.revid,revisedAt:rev?.timestamp,fetchedAt,
    status:page.missing?'missing':supported?'item':'group-or-unsupported',stats};
}
