import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync } from 'fs';

const WIKI_BASE = 'https://monstersandmemories.miraheze.org';
const API_URL = `${WIKI_BASE}/w/api.php`;
const PAGE = 'Character_Creation_Guide';
const OUTPUT_FILE = new URL('../data/character-creation.json', import.meta.url);
const RACES_FILE = new URL('../data/races.json', import.meta.url);

/** @param {string} text */
function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
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

/** @param {string[]} items */
function uniqueInOrder(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

/** @param {import('cheerio').CheerioAPI} $ @param {import('cheerio').Cheerio<any>} cell */
function parseClassLinks($, cell) {
  return cell
    .find('a')
    .map((_, a) => stripHtml($(a).text()))
    .get()
    .filter(Boolean);
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio<any>} table
 */
function parseWikiTable($, table) {
  const headers = table
    .find('tr')
    .first()
    .find('th, td')
    .map((_, el) => stripHtml($(el).text()))
    .get();

  const rows = table
    .find('tr')
    .slice(1)
    .map((_, row) => {
      const cells = $(row).find('td');
      if (!cells.length) return null;
      /** @type {Record<string, string>} */
      const record = {};
      headers.forEach((header, index) => {
        record[header] = stripHtml(cells.eq(index).text());
      });
      return record;
    })
    .get()
    .filter(Boolean);

  return { headers, rows };
}

/** @param {string} text */
function parseAbbrevList(text) {
  if (!text || text === 'Any') return { type: 'any' };
  if (/^all but/i.test(text)) {
    const excluded = text
      .replace(/^all but\s*/i, '')
      .split(/[,\s•]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return { type: 'exclude', values: excluded };
  }
  return {
    type: 'include',
    values: text
      .split(/[,\s•]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  };
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio<any>} table
 * @param {string} nameKey
 */
function parseTraitTable($, table, nameKey) {
  return table
    .find('tr')
    .slice(1)
    .map((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 4) return null;
      const link = cells.eq(0).find('a').first();
      const name = stripHtml(link.text() || cells.eq(0).text());
      const slug = link.length
        ? decodeURIComponent((link.attr('href') || '').replace(/^\/wiki\//, '').split('?')[0])
        : null;
      return {
        name,
        slug,
        races: parseAbbrevList(stripHtml(cells.eq(1).text())),
        classes: parseAbbrevList(stripHtml(cells.eq(2).text())),
        // Keep the current attribute rules when refreshing older wiki descriptions.
        description: stripHtml(cells.eq(3).text()).replace(
          /Passive: Your (?:base )?(Strength|Stamina|Dexterity|Agility|Intelligence|Wisdom|Charisma) is increased by \d+\. Active: .*/i,
          (_, stat) => `Passive: Increases your total ${stat} attribute by 5%. On use: Gives 50% extra ${stat} for 15 seconds.`
        ),
      };
    })
    .get()
    .filter((trait) => trait?.name);
}

function findTableAfterHeading($, headingId) {
  const heading = $(`h2#${headingId}, h1#${headingId}`).first();
  if (!heading.length) return null;
  const container = heading.closest('.mw-heading');
  return container.length ? container.nextAll('table.wikitable').first() : heading.nextAll('table').first();
}

async function main() {
  console.log(`Fetching ${PAGE}…`);
  const html = await fetchPageHtml(PAGE);
  const $ = cheerio.load(html);
  const racesJson = JSON.parse(readFileSync(RACES_FILE, 'utf8'));

  const raceTable = findTableAfterHeading($, 'Races');
  const classTable = findTableAfterHeading($, 'Classes');
  if (!raceTable?.length || !classTable?.length) {
    throw new Error('Could not locate race/class tables on Character Creation Guide');
  }

  const parsedRaces = parseWikiTable($, raceTable);
  const parsedClasses = parseWikiTable($, classTable);

  /** @type {Record<string, string>} */
  const raceAbbrevToName = {};
  /** @type {Record<string, string>} */
  const raceNameToAbbrev = {};

  const races = parsedRaces.rows.map((row) => {
    const name = row.Race;
    const abbrev = row.Abbreviated;
    raceAbbrevToName[abbrev] = name;
    raceNameToAbbrev[name] = abbrev;

    const raceLinksCell = raceTable
      .find('tr')
      .filter((_, tr) => stripHtml($(tr).find('td').first().text()) === name)
      .find('td')
      .last();

    const classes = parseClassLinks($, raceLinksCell);
    const wikiRace = racesJson.races.find(
      (race) => race.name === name || race.displayName?.toLowerCase() === name.toLowerCase()
    );

    return {
      name,
      abbrev,
      alignment: row.Alignment === '??' ? null : row.Alignment,
      startingCity: row['Starting City'] || null,
      // Individual race pages are the source for eligibility; guide tables disagree.
      classes: wikiRace?.classes?.length ? wikiRace.classes : classes,
      classesSource: wikiRace?.classes?.length ? wikiRace.wikiUrl : `${WIKI_BASE}/wiki/${PAGE}`,
      wikiPage: wikiRace?.wikiPage ?? null,
      wikiUrl: wikiRace?.wikiUrl ?? null,
      imageUrl: wikiRace?.imageUrl ?? null,
      resistances: wikiRace?.resistances ?? null,
      racialAbility: wikiRace?.racialAbility ?? null,
      baseStats: wikiRace?.baseStats ?? {},
      startingStats: wikiRace?.startingStats ?? [],
    };
  });

  /** @type {Record<string, string>} */
  const classAbbrevToName = {};
  /** @type {Record<string, string>} */
  const classNameToAbbrev = {};

  const classes = parsedClasses.rows.map((row) => {
    const link = classTable
      .find('tr')
      .filter((_, tr) => stripHtml($(tr).find('td').first().text()) === row.Class)
      .find('td')
      .first()
      .find('a')
      .first();
    const name = stripHtml(link.text() || row.Class);
    const abbrev = row.Abbreviated;
    classAbbrevToName[abbrev] = name;
    classNameToAbbrev[name] = abbrev;

    const raceCell = classTable
      .find('tr')
      .filter((_, tr) => stripHtml($(tr).find('td').first().text()) === name)
      .find('td')
      .last();

    const raceAbbrevs = uniqueInOrder(
      raceCell
        .find('a')
        .map((_, a) => stripHtml($(a).text()))
        .get()
        .filter(Boolean)
    );

    return {
      name,
      abbrev,
      role: row.Role,
      armor: row['Armour Types'] || row['Armor Types'] || null,
      pet: row.Pet === 'Yes',
      raceAbbrevs,
      races: uniqueInOrder(raceAbbrevs.map((code) => raceAbbrevToName[code]).filter(Boolean)),
    };
  });

  // Derive both selector directions from one relation instead of independent tables.
  for (const race of races) {
    for (const name of race.classes) {
      if (!classNameToAbbrev[name]) throw new Error(`Unknown class ${name} for ${race.name}`);
    }
  }
  for (const cls of classes) {
    const eligible = races.filter((race) => race.classes.includes(cls.name));
    cls.races = eligible.map((race) => race.name);
    cls.raceAbbrevs = eligible.map((race) => race.abbrev);
  }

  const traitSections = [
    { id: 'classSpecific', heading: 'Class_Specific_Traits', label: 'Class Specific', selectable: false },
    { id: 'racialCombat', heading: 'Racial_Combat_Abilities', label: 'Racial Combat', selectable: false },
    { id: 'majorCombat', heading: 'Major_Combat_Traits', label: 'Major Combat', selectable: true, slot: 'majorCombat' },
    { id: 'minorCombat', heading: 'Minor_Combat_Traits', label: 'Minor Combat', selectable: true, slot: 'minorCombat' },
    { id: 'majorNonCombat', heading: 'Major_Non-Combat_Traits', label: 'Major Non-Combat', selectable: true, slot: 'majorNonCombat' },
    { id: 'minorNonCombat', heading: 'Minor_Non-Combat_Traits', label: 'Minor Non-Combat', selectable: true, slot: 'minorNonCombat' },
  ];

  /** @type {Record<string, object[]>} */
  const traits = {};
  for (const section of traitSections) {
    const table = findTableAfterHeading($, section.heading);
    traits[section.id] = table?.length ? parseTraitTable($, table, 'Trait') : [];
    console.log(`  ${section.label}: ${traits[section.id].length} entries`);
  }

  const output = {
    source: `${WIKI_BASE}/wiki/${PAGE}`,
    racesSource: racesJson.source,
    fetchedAt: new Date().toISOString(),
    statKeys: racesJson.statKeys,
    statPointBudget: 10,
    traitSlots: [
      { id: 'majorCombat', label: 'Major Combat Trait', category: 'majorCombat' },
      { id: 'minorCombat', label: 'Minor Combat Trait', category: 'minorCombat' },
      { id: 'majorNonCombat', label: 'Major Non-Combat Trait', category: 'majorNonCombat' },
      { id: 'minorNonCombat', label: 'Minor Non-Combat Trait', category: 'minorNonCombat' },
    ],
    raceAbbrevToName,
    raceNameToAbbrev,
    classAbbrevToName,
    classNameToAbbrev,
    races,
    classes,
    traits,
  };

  writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote character creation data (${races.length} races, ${classes.length} classes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
