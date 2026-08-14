import * as cheerio from 'cheerio';
import { enrichEntry } from './enrich-entry.mjs';
import { pickCanonicalDescription } from './resolve-canonical.mjs';

const WIKI_BASE = 'https://monstersandmemories.miraheze.org';
const API_URL = `${WIKI_BASE}/w/api.php`;
const INDEX_PAGE = 'Spells_By_Class';
const OUTPUT_DIR = new URL('../data/', import.meta.url);

/** @param {string} name */
function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/** @param {string} text */
function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** @param {string} page */
async function fetchPageHtml(page) {
  const url = `${API_URL}?action=parse&page=${encodeURIComponent(page)}&format=json&prop=text`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${page}: ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.info || `API error for ${page}`);
  }
  return data.parse.text['*'];
}

/** @param {import('cheerio').CheerioAPI} $ */
function parseLinkCell($cell) {
  const link = $cell.find('a').first();
  if (link.length) {
    const href = link.attr('href') || '';
    const slug = href.replace(/^\/wiki\//, '').split('?')[0];
    return {
      text: stripHtml(link.text()) || stripHtml($cell.text()),
      slug: decodeURIComponent(slug),
      url: href.startsWith('http') ? href : `${WIKI_BASE}${href}`,
    };
  }
  return {
    text: stripHtml($cell.text()),
    slug: null,
    url: null,
  };
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio<any>} table
 */
function parseTableHeader($, table) {
  const headerRow = table.find('tr').first();
  const headers = headerRow
    .find('td, th')
    .map((_, el) => stripHtml($(el).text()).toLowerCase())
    .get();

  const columnMap = {};
  headers.forEach((header, index) => {
    if (header.includes('spell name') || header === 'name') columnMap.name = index;
    if (header.includes('description')) columnMap.description = index;
    if (header === 'school' || header === 'class') columnMap.category = index;
    if (header === 'location') columnMap.location = index;
    if (header === 'mana') columnMap.mana = index;
    if (header === 'cast') columnMap.castTime = index;
  });

  return columnMap;
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio<any>} table
 * @param {Record<string, number>} columnMap
 * @param {number} level
 */
function parseSpellRows($, table, columnMap, level, className) {
  const rows = table.find('tr').slice(1);
  const entries = [];

  rows.each((_, row) => {
    const cells = $(row).find('td');
    if (!cells.length || columnMap.name === undefined) return;

    const nameCell = cells.eq(columnMap.name);
    const name = parseLinkCell(nameCell);
    if (!name.text) return;

    const description =
      columnMap.description !== undefined
        ? stripHtml(cells.eq(columnMap.description).html() || '')
        : '';

    let category = { text: null, abbr: null, slug: null, url: null };
    if (columnMap.category !== undefined) {
      const catCell = cells.eq(columnMap.category);
      const catLink = parseLinkCell(catCell);
      category = {
        text: catLink.text,
        abbr: catLink.text,
        slug: catLink.slug,
        url: catLink.url,
      };
    }

    const location =
      columnMap.location !== undefined
        ? stripHtml(cells.eq(columnMap.location).text())
        : null;

    const manaRaw =
      columnMap.mana !== undefined ? stripHtml(cells.eq(columnMap.mana).text()) : null;
    const mana = manaRaw && /^\d+$/.test(manaRaw) ? Number(manaRaw) : manaRaw;

    const castTime =
      columnMap.castTime !== undefined
        ? stripHtml(cells.eq(columnMap.castTime).text()) || null
        : null;

    entries.push(enrichEntry(
      {
        name: name.text,
        slug: name.slug,
        wikiUrl: name.url,
        description,
        category: category.text,
        categorySlug: category.slug,
        categoryUrl: category.url,
        location,
        mana,
        castTime: castTime || null,
        level,
      },
      className
    ));
  });

  return entries;
}

/**
 * @param {string} html
 * @param {string} className
 */
function parseClassPage(html, className) {
  const $ = cheerio.load(html);

  const spellsHeading = $('h1').filter((_, el) => /spells|abilities/i.test($(el).text())).first();
  if (!spellsHeading.length) {
    return {
      className,
      type: 'unknown',
      sectionTitle: null,
      entries: [],
      entriesByLevel: {},
    };
  }

  const sectionTitle = stripHtml(spellsHeading.text());
  const type = /abilities/i.test(sectionTitle) ? 'ability' : 'spell';

  /** @type {Record<number, any[]>} */
  const entriesByLevel = {};
  /** @type {any[]} */
  const entries = [];

  let currentLevel = null;
  let node = spellsHeading.parent().next();

  while (node.length) {
    const h1 = node.is('h1') ? node : node.find('h1').first();
    if (h1.length && !/level/i.test(h1.text())) break;

    const h2 = node.is('.mw-heading') ? node.find('h2').first() : null;
    const levelHeading = h2?.length ? h2 : node.is('h2') ? node : null;

    if (levelHeading?.length) {
      const match = stripHtml(levelHeading.text()).match(/level\s+(\d+)/i);
      if (match) currentLevel = Number(match[1]);
    }

    const table = node.is('table') ? node : node.find('table').first();
    if (table.length && currentLevel !== null) {
      const columnMap = parseTableHeader($, table);
      const levelEntries = parseSpellRows($, table, columnMap, currentLevel, className).map((entry) => ({
        ...entry,
        type,
      }));

      if (!entriesByLevel[currentLevel]) entriesByLevel[currentLevel] = [];
      entriesByLevel[currentLevel].push(...levelEntries);
      entries.push(...levelEntries);
    }

    node = node.next();
  }

  // Fallback: scan all level headings + following tables within page
  if (entries.length === 0) {
    $('h2').each((_, el) => {
      const match = stripHtml($(el).text()).match(/level\s+(\d+)/i);
      if (!match) return;

      const level = Number(match[1]);
      const table = $(el).closest('.mw-heading').nextAll('table').first();
      if (!table.length) return;

      const columnMap = parseTableHeader($, table);
      const levelEntries = parseSpellRows($, table, columnMap, level, className).map((entry) => ({
        ...entry,
        type,
      }));

      if (!entriesByLevel[level]) entriesByLevel[level] = [];
      entriesByLevel[level].push(...levelEntries);
      entries.push(...levelEntries);
    });
  }

  return {
    className,
    slug: className.replace(/ /g, '_'),
    type,
    sectionTitle,
    wikiUrl: `${WIKI_BASE}/wiki/${encodeURIComponent(className.replace(/ /g, '_'))}`,
    entryCount: entries.length,
    levels: Object.keys(entriesByLevel)
      .map(Number)
      .sort((a, b) => a - b),
    entriesByLevel,
    entries,
  };
}

async function fetchClassLinks() {
  const html = await fetchPageHtml(INDEX_PAGE);
  const $ = cheerio.load(html);

  const classes = new Set();
  $('a[href^="/wiki/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const title = $(el).attr('title') || stripHtml($(el).text());
    if (!href.startsWith('/wiki/') || href.includes(':')) return;
    const name = decodeURIComponent(href.replace('/wiki/', '').split('?')[0].replace(/_/g, ' '));
    if (['Spells By Class', 'Spell List', 'Ability List', 'Main Page'].includes(name)) return;
    if (title) classes.add(title);
  });

  // Prefer API links for reliability
  const res = await fetch(`${API_URL}?action=parse&page=${INDEX_PAGE}&format=json&prop=links`);
  const data = await res.json();
  const apiClasses = (data.parse?.links || [])
    .filter((link) => link.ns === 0)
    .map((link) => link['*']);

  return apiClasses.length ? apiClasses : [...classes];
}

async function writeJson(path, data) {
  const fs = await import('node:fs/promises');
  await fs.writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function main() {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  const classesDir = new URL('classes/', OUTPUT_DIR);
  const spellsDir = new URL('spells/', OUTPUT_DIR);
  await fs.mkdir(classesDir, { recursive: true });
  await fs.mkdir(spellsDir, { recursive: true });

  console.log('Fetching class list from Spells By Class...');
  const classNames = await fetchClassLinks();
  console.log(`Found ${classNames.length} classes: ${classNames.join(', ')}`);

  /** @type {any[]} */
  const index = [];
  /** @type {Record<string, any>} */
  const allEntriesBySlug = {};

  for (const className of classNames) {
    process.stdout.write(`  Fetching ${className}...`);
    const html = await fetchPageHtml(className);
    const classData = parseClassPage(html, className);

    const fileName = `${slugify(className)}.json`;
    await writeJson(new URL(fileName, classesDir), classData);

    index.push({
      name: className,
      slug: classData.slug,
      file: `classes/${fileName}`,
      type: classData.type,
      wikiUrl: classData.wikiUrl,
      entryCount: classData.entryCount,
      levels: classData.levels,
    });

    for (const entry of classData.entries) {
      const key = entry.slug || entry.name;
      if (!allEntriesBySlug[key]) {
        allEntriesBySlug[key] = {
          name: entry.name,
          slug: entry.slug,
          wikiUrl: entry.wikiUrl,
          description: entry.description,
          category: entry.category,
          categorySlug: entry.categorySlug,
          type: entry.type,
          tags: entry.tags,
          primaryTag: entry.primaryTag,
          statTags: entry.statTags,
          effects: entry.effects,
          valuesSummary: entry.valuesSummary,
          classes: [],
        };
      } else {
        allEntriesBySlug[key].description = pickCanonicalDescription([
          allEntriesBySlug[key].description,
          entry.description,
        ]);
      }
      allEntriesBySlug[key].classes.push({
        className,
        classSlug: classData.slug,
        level: entry.level,
        location: entry.location,
        mana: entry.mana,
        castTime: entry.castTime,
      });
    }

    console.log(` ${classData.entryCount} entries`);
    await new Promise((r) => setTimeout(r, 300));
  }

  const meta = {
    source: `${WIKI_BASE}/wiki/Spells_By_Class`,
    fetchedAt: new Date().toISOString(),
    classCount: classNames.length,
    totalEntries: index.reduce((sum, c) => sum + c.entryCount, 0),
    uniqueEntries: Object.keys(allEntriesBySlug).length,
  };

  await writeJson(new URL('meta.json', OUTPUT_DIR), meta);
  await writeJson(new URL('index.json', OUTPUT_DIR), { meta, classes: index });
  await writeJson(new URL('spells/index.json', OUTPUT_DIR), allEntriesBySlug);

  console.log('\nDone!');
  console.log(`  Classes: ${meta.classCount}`);
  console.log(`  Total entries: ${meta.totalEntries}`);
  console.log(`  Unique spells/abilities: ${meta.uniqueEntries}`);
  console.log(`  Output: ${path.resolve(new URL('.', OUTPUT_DIR).pathname.replace(/^\/([A-Z]:)/, '$1'))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
