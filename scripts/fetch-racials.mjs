import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';

const source = 'https://monstersandmemories.com/updates/necromancer-ranger-and-shadow-knight-deep-dives-and-traits-preview';
const file = process.argv[2];
const response = file ? null : await fetch(source);
if (response && !response.ok) throw new Error(`Source returned ${response.status}`);
const html = file ? await readFile(file, 'utf8') : await response.text();
const $ = cheerio.load(html);
const content = $('.sqs-html-content').filter((_, el) => $(el).find('h2').toArray().some(h => $(h).text().trim() === 'Racial Innates and Backgrounds')).first();
const clean = value => value.replace(/\s+/g, ' ').trim();
function nodes(list) {
  return list.children('li').toArray().map(li => ({
    text: clean($(li).clone().children('ul,ol').remove().end().text()),
    children: nodes($(li).children('ul,ol')),
  }));
}
const heading = content.children('h2').filter((_, el) => $(el).text().trim() === 'Racial Innates and Backgrounds');
const races = heading.nextUntil('h2', 'h3').toArray().map(el => {
  const label = clean($(el).text());
  const name = label.replace(/ \(WIP\)$/, '');
  const groups = nodes($(el).next('ul'));
  if (groups.length !== 2 || groups[0].text !== 'Innates' || !/one of three/.test(groups[1].text)) throw new Error(`Unexpected groups: ${name}`);
  return { id: name.toLowerCase().replaceAll(' ', '-'), name, wip: label.includes('(WIP)'), innates: groups[0].children, backgrounds: groups[1].children };
});
const personalities = nodes(content.children('h2').filter((_, el) => $(el).text().trim() === 'Some Examples of Personality Traits').next('ul'));
if (races.length !== 9 || races.some(r => r.innates.length !== 3 || r.backgrounds.length !== 3) || personalities.length !== 5) throw new Error('Unexpected preview counts; review source before replacing data.');
const data = { source, fetchedAt: new Date().toISOString(), status: 'Unimplemented design preview; subject to change.', races, personalities };
await writeFile('data/racials.json', JSON.stringify(data, null, 2) + '\n');
await mkdir('docs/reports', { recursive: true });
await writeFile('docs/reports/racials-extraction.json', JSON.stringify({ source, fetchedAt: data.fetchedAt, sourceSha256: createHash('sha256').update(html).digest('hex'), races: races.map(r => ({ name: r.name, innates: r.innates.length, backgrounds: r.backgrounds.length })), personalities: personalities.length, exclusions: ['Class deep dives', 'Subscriber and beta breakdown images'], normalization: 'Whitespace only; original wording and nested effects retained.' }, null, 2) + '\n');
console.log(`Parsed ${races.length} races, 27 innates, 27 backgrounds and ${personalities.length} personality examples.`);
