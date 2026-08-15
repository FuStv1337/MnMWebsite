import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';

const WIKI_BASE = 'https://monstersandmemories.miraheze.org';
const API_URL = `${WIKI_BASE}/w/api.php`;
const PAGE = 'Statistics';
const OUTPUT_FILE = new URL('../data/statistics.json', import.meta.url);

const PRIMARY_STATS = ['STR', 'STA', 'DEX', 'AGI', 'INT', 'WIS', 'CHA'];

/** @param {string} text */
function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** @param {string} page */
async function fetchPageHtml(page) {
  const url = `${API_URL}?action=parse&page=${encodeURIComponent(page)}&format=json&prop=text`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${page}: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.info || `API error for ${page}`);
  return data.parse.text['*'];
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} startHeadingId
 * @param {string | null} endHeadingId
 */
function parseStatSections($, startHeadingId, endHeadingId) {
  /** @type {Record<string, object>} */
  const stats = {};
  const start = $(`h2#${startHeadingId}`).closest('.mw-heading');
  if (!start.length) return stats;

  let cursor = start.next();
  const end = endHeadingId ? $(`h2#${endHeadingId}`).closest('.mw-heading') : null;

  while (cursor.length && (!end?.length || !cursor.is(end))) {
    if (cursor.hasClass('mw-heading') && cursor.find('h3').length) {
      const headingText = stripHtml(cursor.find('h3').first().text());
      const match = headingText.match(/^(.+?)\s*\(([A-Z]{2,5})\)$/);
      if (match) {
        const [, name, abbrev] = match;
        const paragraphs = [];
        let sibling = cursor.next();
        while (sibling.length && !sibling.hasClass('mw-heading')) {
          if (sibling[0]?.tagName === 'p') {
            const text = stripHtml(sibling.text());
            if (text) paragraphs.push(text);
          }
          sibling = sibling.next();
        }

        stats[abbrev] = {
          name,
          abbrev,
          description: paragraphs[0] ?? '',
          notes: paragraphs.slice(1).filter(Boolean),
        };
      }
    }
    cursor = cursor.next();
  }

  return stats;
}

async function main() {
  console.log(`Fetching ${PAGE}…`);
  const html = await fetchPageHtml(PAGE);
  const $ = cheerio.load(html);

  const primaryStats = parseStatSections($, 'Primary_Stats', 'Secondary_Stats');
  const secondaryStats = parseStatSections($, 'Secondary_Stats', 'Tertiary_statistics');

  for (const abbrev of PRIMARY_STATS) {
    if (!primaryStats[abbrev]) {
      console.warn(`  Missing primary stat: ${abbrev}`);
    }
  }

  const output = {
    source: `${WIKI_BASE}/wiki/${PAGE}`,
    fetchedAt: new Date().toISOString(),
    primaryStats,
    secondaryStats,
  };

  writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    `Wrote ${Object.keys(primaryStats).length} primary and ${Object.keys(secondaryStats).length} secondary stats`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
