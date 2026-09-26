import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync } from 'fs';
import { parseDefensiveSkills } from './class-skill-parser.mjs';

const WIKI_BASE = 'https://monstersandmemories.miraheze.org';
const API_URL = `${WIKI_BASE}/w/api.php`;
const CATEGORY_PAGE = 'Category:Classes';
const CREATION_FILE = new URL('../data/character-creation.json', import.meta.url);
const OUTPUT_FILE = new URL('../data/class-details.json', import.meta.url);

const STAT_MAP = {
  Strength: 'STR',
  Stamina: 'STA',
  Agility: 'AGI',
  Dexterity: 'DEX',
  Wisdom: 'WIS',
  Intelligence: 'INT',
  Charisma: 'CHA',
};

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

/** @param {string} page */
async function fetchWikitext(page) {
  const url = `${API_URL}?action=query&titles=${encodeURIComponent(page)}&prop=revisions&rvprop=content&format=json`;
  const data = await (await fetch(url)).json();
  const key = Object.keys(data.query.pages)[0];
  return data.query.pages[key].revisions?.[0]?.['*'] ?? '';
}

/** @param {import('cheerio').CheerioAPI} $ */
function parseCategoryPrimaryStats($) {
  /** @type {Record<string, string>} */
  const primaryStats = {};

  $('h3.mw-html-heading, h3[id]').each((_, heading) => {
    const card = $(heading).closest('div[style*="flex-direction:column"]');
    if (!card.length) return;

    const name = stripHtml($(heading).text());
    const paragraphs = card.find('p');
    paragraphs.each((_, p) => {
      const text = stripHtml($(p).text());
      const match = text.match(/Primary Stat:\s*([A-Z]{3})\b/i);
      if (match) primaryStats[name] = match[1].toUpperCase();
    });
  });

  return primaryStats;
}

/** @param {string} wikiText @param {string} html */
function parseClassPageDetails(wikiText, html) {
  const modifierMatch =
    wikiText.match(/Class modifier to race base stats:\s*([^\n]+)/i) ||
    html.match(/Class modifier to race base stats:\s*([^<]+)/i);
  const modifierText = modifierMatch ? stripHtml(modifierMatch[1]).replace(/\.$/, '') : null;

  /** @type {Record<string, number>} */
  const statModifiers = {};
  if (modifierText) {
    for (const match of modifierText.matchAll(/\+\s*(\d+)\s*([A-Z]{3})/g)) {
      statModifiers[match[2]] = Number(match[1]);
    }
  }

  const mainAttrMatch = wikiText.match(/Since ([A-Za-z]+) is a[^']*main attribute/i);
  const secondaryMatch = wikiText.match(/After that, prioritize ([A-Za-z]+)/i);

  const bonusSection = wikiText.split(/==\s*Bonus points\s*==/i)[1];
  const bonusPointsAdvice = bonusSection
    ? stripHtml(bonusSection.split(/==/)[0]).slice(0, 500)
    : null;

  return {
    modifierText,
    statModifiers,
    primaryStatFromPage: mainAttrMatch ? STAT_MAP[mainAttrMatch[1]] ?? null : null,
    secondaryStat: secondaryMatch ? STAT_MAP[secondaryMatch[1]] ?? null : null,
    bonusPointsAdvice,
  };
}

async function main() {
  console.log(`Fetching ${CATEGORY_PAGE}…`);
  const categoryHtml = await fetchPageHtml(CATEGORY_PAGE);
  const $cat = cheerio.load(categoryHtml);
  const primaryStatsFromCategory = parseCategoryPrimaryStats($cat);

  const creation = JSON.parse(readFileSync(CREATION_FILE, 'utf8'));
  const classNames = creation.classes.map((cls) => cls.name);

  /** @type {Record<string, object>} */
  const classes = {};

  for (const name of classNames) {
    console.log(`  → ${name}`);
    const [wikiText, html] = await Promise.all([fetchWikitext(name), fetchPageHtml(name)]);
    const details = parseClassPageDetails(wikiText, html);

    classes[name] = {
      name,
      wikiUrl: `${WIKI_BASE}/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
      primaryStat: primaryStatsFromCategory[name] || details.primaryStatFromPage || null,
      secondaryStat: details.secondaryStat,
      statModifiers: details.statModifiers,
      modifierText: details.modifierText,
      bonusPointsAdvice: details.bonusPointsAdvice,
      defensiveSkills: parseDefensiveSkills(html),
    };

    await new Promise((r) => setTimeout(r, 120));
  }

  const output = {
    source: `${WIKI_BASE}/wiki/${CATEGORY_PAGE}`,
    fetchedAt: new Date().toISOString(),
    classes,
  };

  writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);

  // Merge primary stat + modifiers into character-creation.json classes array
  creation.classes = creation.classes.map((cls) => ({
    ...cls,
    ...classes[cls.name],
  }));
  creation.classDetailsSource = output.source;
  writeFileSync(CREATION_FILE, `${JSON.stringify(creation, null, 2)}\n`);

  console.log(`Wrote class details for ${Object.keys(classes).length} classes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
