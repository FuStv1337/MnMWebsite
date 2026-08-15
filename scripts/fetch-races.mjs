import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';

const WIKI_BASE = 'https://monstersandmemories.miraheze.org';
const API_URL = `${WIKI_BASE}/w/api.php`;
const INDEX_PAGE = 'Character_Races';
const OUTPUT_FILE = new URL('../data/races.json', import.meta.url);

const STAT_KEYS = ['STR', 'STA', 'DEX', 'AGI', 'INT', 'WIS', 'CHA'];

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

/** @param {string} name */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, '-');
}

/** @param {import('cheerio').CheerioAPI} $cell */
function parseLinks($, cell) {
  const links = [];
  $(cell)
    .find('a')
    .each((_, a) => {
      const href = $(a).attr('href') || '';
      const slug = href.replace(/^\/wiki\//, '').split('?')[0];
      links.push({
        name: stripHtml($(a).text()),
        slug: decodeURIComponent(slug),
        url: href.startsWith('http') ? href : `${WIKI_BASE}${href}`,
      });
    });
  return links;
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

/** @param {string} value */
function parseStatValue(value) {
  const text = stripHtml(value);
  if (!text || text === '??' || text === '?') return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio<any>} table
 */
function parseStatHeaderRow($, table) {
  const headerRow = table.find('tr').first();
  return headerRow
    .find('td, th')
    .map((_, el) => stripHtml($(el).text()).toUpperCase())
    .get();
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio<any>} table
 */
function parseBaseStatsTable($, table) {
  const headers = parseStatHeaderRow($, table);
  const dataRow = table.find('tr').eq(1);
  const cells = dataRow.find('td').map((_, el) => stripHtml($(el).text())).get();
  /** @type {Record<string, number | null>} */
  const stats = {};
  headers.forEach((header, index) => {
    if (STAT_KEYS.includes(header)) {
      stats[header] = parseStatValue(cells[index]);
    }
  });
  return stats;
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio<any>} table
 */
function parseStartingStatsTable($, table) {
  const headers = parseStatHeaderRow($, table);
  const statIndexes = {};
  headers.forEach((header, index) => {
    if (STAT_KEYS.includes(header)) statIndexes[header] = index;
    if (header === 'CLASS') statIndexes.class = index;
    if (header === 'BONUS') statIndexes.bonus = index;
  });

  return table
    .find('tr')
    .slice(1)
    .map((_, row) => {
      const cells = $(row).find('td');
      if (!cells.length) return null;

      const classCell = cells.eq(statIndexes.class ?? 0);
      const classLink = classCell.find('a').first();
      const className = stripHtml(classLink.text() || classCell.text());
      if (!className) return null;

      /** @type {Record<string, number | null>} */
      const stats = {};
      for (const key of STAT_KEYS) {
        const index = statIndexes[key];
        stats[key] = index != null ? parseStatValue(cells.eq(index).text()) : null;
      }

      const bonusIndex = statIndexes.bonus;
      const bonus =
        bonusIndex != null ? parseStatValue(cells.eq(bonusIndex).text()) : null;

      return {
        class: className,
        ...stats,
        bonus,
      };
    })
    .get()
    .filter(Boolean);
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} html
 */
function parseCharacterRacesOverview($, html) {
  const cards = [];
  const root = cheerio.load(html);
  root('h3.mw-html-heading, h3[id]').each((_, heading) => {
    const cardRoot = root(heading).closest('div[style*="flex-direction:column"]');
    if (!cardRoot.length) return;

    const displayName = stripHtml(root(heading).text());
    const descLink = cardRoot.find('p a[href*="/wiki/"]').first();
    const wikiPage = descLink.attr('href')?.replace(/^\/wiki\//, '').split('?')[0];
    if (!wikiPage) return;

    const paragraphs = cardRoot.find('p');
    const description = stripHtml(paragraphs.first().text());

    let startingCities = [];
    let racialAbility = null;
    paragraphs.each((_, p) => {
      const text = stripHtml(root(p).text());
      if (text.startsWith('Starting Cities:')) {
        const cityText = text.replace(/^Starting Cities:\s*/, '');
        startingCities =
          cityText === '???'
            ? []
            : parseLinks(root, root(p)).length
              ? parseLinks(root, root(p))
              : [{ name: cityText, slug: null, url: null }];
      }
      if (text.startsWith('Racial Ability:')) {
        const links = parseLinks(root, root(p));
        if (links.length) {
          racialAbility = links[0];
        } else {
          const name = text.replace(/^Racial Ability:\s*/, '');
          if (name && name !== '???') {
            racialAbility = { name, slug: null, url: null };
          }
        }
      }
    });

    const classes = cardRoot
      .find('div[style*="flex-wrap:wrap"] a')
      .map((_, a) => stripHtml(root(a).text()))
      .get()
      .filter(Boolean);

    const img = cardRoot.find('img').first();
    const imageSrc = img.attr('src') || '';
    const imageUrl = imageSrc.startsWith('//') ? `https:${imageSrc}` : imageSrc;

    cards.push({
      displayName,
      wikiPage: decodeURIComponent(wikiPage),
      wikiUrl: `${WIKI_BASE}/wiki/${wikiPage}`,
      description,
      imageUrl,
      startingCities,
      racialAbility,
      classes,
    });
  });

  return cards;
}

/** @param {import('cheerio').CheerioAPI} $ @param {string} title */
function sectionAfterHeading($, title) {
  const heading = $('h2')
    .filter((_, el) => stripHtml($(el).text()) === title)
    .first();
  if (!heading.length) return null;
  return heading.closest('.mw-heading').length ? heading.closest('.mw-heading') : heading;
}

/**
 * @param {import('cheerio').CheerioAPI} $
 */
function parseBasicInformation($) {
  /** @type {Record<string, string>} */
  const info = {};
  const heading = sectionAfterHeading($, 'Basic Information');
  if (!heading) return info;

  heading
    .next('ul')
    .find('li')
    .each((_, li) => {
      const label = stripHtml($(li).find('b').first().text()).replace(/:$/, '');
      const clone = $(li).clone();
      clone.find('b').first().remove();
      const value = stripHtml(clone.text()).replace(/^:\s*/, '');
      if (label && value) info[label] = value;
    });

  return info;
}

/**
 * @param {import('cheerio').CheerioAPI} $
 */
function parseRaceDetailPage($) {
  const descriptionHeading = sectionAfterHeading($, 'Description');
  const descriptionParts = [];
  if (descriptionHeading) {
    descriptionHeading.nextUntil('.mw-heading').each((_, el) => {
      if (el.tagName === 'p') {
        const text = stripHtml($(el).text());
        if (text) descriptionParts.push(text);
      }
    });
  }
  const description = descriptionParts.join('\n\n');

  const basicInfo = parseBasicInformation($);

  const tables = $('table');
  let baseStats = {};
  let startingStats = [];

  tables.each((_, table) => {
    const headers = parseStatHeaderRow($, $(table));
    if (headers.includes('STR') && headers.includes('CLASS') && !startingStats.length) {
      startingStats = parseStartingStatsTable($, $(table));
    } else if (
      headers.includes('STR') &&
      !headers.includes('CLASS') &&
      Object.keys(baseStats).length === 0
    ) {
      baseStats = parseBaseStatsTable($, $(table));
    }
  });

  /** @type {{ name: string, slug: string | null, url: string | null, note?: string } | null} */
  let racialAbility = null;
  const racialText = basicInfo['Racial(s)'] || basicInfo.Racial || '';
  if (racialText && racialText !== '???' && racialText.toLowerCase() !== 'unknown') {
    const racialLi = sectionAfterHeading($, 'Basic Information')
      ?.next('ul')
      ?.find('li')
      ?.filter((_, li) => /^Racial/i.test(stripHtml($(li).find('b').text())))
      ?.first();
    const link = racialLi?.find('a').first();
    const noteMatch = racialText.match(/\((as of[^)]+)\)/i);
    racialAbility = {
      name: stripHtml(link.text()) || racialText.replace(/\s*\([^)]*\)\s*$/, ''),
      slug: link.length ? decodeURIComponent((link.attr('href') || '').replace(/^\/wiki\//, '')) : null,
      url: link.length
        ? link.attr('href')?.startsWith('http')
          ? link.attr('href')
          : `${WIKI_BASE}${link.attr('href')}`
        : null,
      ...(noteMatch ? { note: noteMatch[1] } : {}),
    };
  }

  const basicList = sectionAfterHeading($, 'Basic Information')?.next('ul');
  const startingCities = basicList
    ? basicList
        .find('li')
        .filter((_, li) => /^Starting Cities/i.test(stripHtml($(li).find('b').text())))
        .toArray()
        .flatMap((li) => {
          const links = parseLinks($, $(li));
          if (links.length) return links;
          const clone = $(li).clone();
          clone.find('b').first().remove();
          const text = stripHtml(clone.text()).replace(/^:\s*/, '');
          if (!text || text === '???') return [];
          return [{ name: text, slug: null, url: null }];
        })
    : [];

  const classes = basicList
    ? basicList
        .find('li')
        .filter((_, li) => /^Playable Classes/i.test(stripHtml($(li).find('b').text())))
        .find('a')
        .map((_, a) => stripHtml($(a).text()))
        .get()
        .filter(Boolean)
    : [];

  return {
    description,
    faction: basicInfo['Faction Alignment'] || null,
    languages: basicInfo.Languages || null,
    resistances: basicInfo.Resistances || null,
    startingCities,
    racialAbility,
    classes,
    baseStats,
    startingStats,
  };
}

/**
 * Merge racial ability from race detail page and Character_Races overview card.
 * Detail pages often list the name without a wiki link; overview cards link to ability pages.
 * @param {object | null | undefined} detailAbility
 * @param {object | null | undefined} cardAbility
 */
function mergeRacialAbility(detailAbility, cardAbility) {
  const base = detailAbility || cardAbility;
  if (!base) return null;

  const other =
    detailAbility && cardAbility
      ? detailAbility === base
        ? cardAbility
        : detailAbility
      : null;

  const name = base.name || other?.name;
  const slug =
    base.slug || other?.slug || (name ? name.replace(/\s+/g, '_') : null);
  const url =
    base.url ||
    other?.url ||
    (slug ? `${WIKI_BASE}/wiki/${slug.replace(/ /g, '_')}` : null);

  return {
    name,
    slug,
    url,
    ...(base.note || other?.note ? { note: base.note || other?.note } : {}),
  };
}

/** @param {object | null | undefined} ability */
function abilityWikiSlug(ability) {
  if (!ability) return null;
  return ability.slug || (ability.name ? ability.name.replace(/\s+/g, '_') : null);
}

/** @param {string} abilityPage */
async function fetchRacialAbilityDescription(abilityPage) {
  try {
    const html = await fetchPageHtml(abilityPage);
    const $ = cheerio.load(html);
    const firstTable = $('table').first();
    const description = stripHtml(firstTable.find('td').last().text());
    return description || null;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`Fetching ${INDEX_PAGE}…`);
  const indexHtml = await fetchPageHtml(INDEX_PAGE);
  const $index = cheerio.load(indexHtml);
  const overviewCards = parseCharacterRacesOverview($index, indexHtml);
  console.log(`Found ${overviewCards.length} races on overview page`);

  /** @type {object[]} */
  const races = [];

  for (const card of overviewCards) {
    console.log(`  → ${card.wikiPage}`);
    const detailHtml = await fetchPageHtml(card.wikiPage);
    const $detail = cheerio.load(detailHtml);
    const detail = parseRaceDetailPage($detail);

    const racialAbility = mergeRacialAbility(detail.racialAbility, card.racialAbility);
    let racialAbilityDescription = null;
    const abilitySlug = abilityWikiSlug(racialAbility);
    if (abilitySlug) {
      racialAbilityDescription = await fetchRacialAbilityDescription(abilitySlug);
    }

    const name = card.wikiPage.replace(/_/g, ' ');
    races.push({
      id: slugify(name),
      name,
      displayName: card.displayName,
      wikiPage: card.wikiPage,
      wikiUrl: card.wikiUrl,
      imageUrl: card.imageUrl,
      description: detail.description || card.description,
      faction: detail.faction,
      languages: detail.languages,
      resistances: detail.resistances,
      startingCities: detail.startingCities.length ? detail.startingCities : card.startingCities,
      racialAbility: racialAbility
        ? { ...racialAbility, description: racialAbilityDescription }
        : null,
      classes: detail.classes.length ? detail.classes : card.classes,
      baseStats: detail.baseStats,
      startingStats: detail.startingStats,
    });

    await new Promise((r) => setTimeout(r, 150));
  }

  const output = {
    source: `${WIKI_BASE}/wiki/${INDEX_PAGE}`,
    fetchedAt: new Date().toISOString(),
    statKeys: STAT_KEYS,
    races,
  };

  writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${races.length} races to data/races.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
