import { zones } from '../src/world-map-data.js';
import * as cheerio from 'cheerio';
import { writeFile } from 'node:fs/promises';
const results = {};
for (const zone of zones) {
  const page = zone.name.replaceAll('’', "'").replaceAll(' ', '_');
  const url = `https://monstersandmemories.miraheze.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&format=json&prop=text`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${page}: ${response.status}`);
  const data = await response.json();
  const $ = cheerio.load(data.parse?.text['*'] || '');
  results[zone.id] = { page, images: $('a.mw-file-description').map((_, el) => ({ file: decodeURIComponent($(el).attr('href').replace('/wiki/', '')), caption: $(el).parent().find('figcaption').text(), alt: $(el).find('img').attr('alt') || '' })).get() };
  console.log(zone.id, JSON.stringify(results[zone.id]));
}
await writeFile(new URL('../data/zone-map-candidates.json', import.meta.url), JSON.stringify(results, null, 2));
