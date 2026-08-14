import indexData from '../data/index.json';
import {
  STAT_TAGS,
  BUFF_PAGE_TAGS,
  SHIELD_SECTION,
  THORNS_SECTION,
  SONG_SECTION,
  BUFF_SPECIAL_SECTIONS,
} from './constants.js';
import { statToTag } from './stat-tags.js';

export { SHIELD_SECTION, THORNS_SECTION, SONG_SECTION };

const classModules = import.meta.glob('../data/classes/*.json');

/** @type {string[]} */
export const BUFF_SECTION_ORDER = [
  ...STAT_TAGS,
  ...BUFF_SPECIAL_SECTIONS.map((section) => section.id),
];

/**
 * @param {string[]} tags
 */
export function isBuffPageEntry(tags = []) {
  if (tags.includes('self') || tags.includes('pet')) return false;
  return BUFF_PAGE_TAGS.some((tag) => tags.includes(tag));
}

/**
 * @param {object} effect
 */
export function getEffectStatTag(effect) {
  if (effect.statTag && STAT_TAGS.includes(effect.statTag)) return effect.statTag;
  if (!effect.stat) return null;
  const tag = statToTag(effect.stat);
  return tag && STAT_TAGS.includes(tag) ? tag : null;
}

/**
 * @param {object} effect
 */
export function getEffectValue(effect) {
  return effect.max ?? effect.amount ?? effect.min ?? 0;
}

/**
 * @param {object} entry
 */
function getShieldFallback(entry) {
  const text = entry.description || '';
  const absorbMatch = text.match(/\babsorb(?:ing|s)?\s+(\d+(?:\.\d+)?)(?:\s*(?:points?\s+of)?\s*([\w\s]+?)Damage)?/i);
  if (!absorbMatch) return null;

  const amount = Number(absorbMatch[1]);
  const typeLabel = absorbMatch[2]?.trim();
  const display = typeLabel ? `${amount} ${typeLabel.trim()} absorb` : `${amount} absorb`;
  return { amount, display };
}

/**
 * @param {object} entry
 * @param {object} data
 * @param {string} sectionTag
 * @param {object} options
 */
function createRow(entry, data, sectionTag, options) {
  return {
    name: entry.name,
    slug: entry.slug,
    wikiUrl: entry.wikiUrl,
    description: entry.description,
    className: data.className,
    classType: data.type,
    level: entry.level,
    mana: entry.mana,
    castTime: entry.castTime,
    location: entry.location,
    tags: entry.tags || [],
    primaryTag: entry.primaryTag,
    effects: entry.effects || [],
    sectionTag,
    statTag: options.statTag,
    stat: options.stat,
    effect: options.effect,
    value: options.value ?? 0,
    isPercent: options.isPercent ?? false,
    valueDisplay: options.valueDisplay || entry.valuesSummary || '—',
  };
}

/**
 * @returns {Promise<object[]>}
 */
export async function loadBuffPageRows() {
  /** @type {object[]} */
  const rows = [];
  const sortedClasses = [...indexData.classes].sort((a, b) => a.name.localeCompare(b.name));

  for (const classMeta of sortedClasses) {
    const loader = classModules[`../data/${classMeta.file}`];
    if (!loader) continue;

    const mod = await loader();
    const data = mod.default || mod;

    for (const entry of data.entries || []) {
      const tags = entry.tags || [];
      if (!isBuffPageEntry(tags)) continue;

      /** @type {Set<string>} */
      const rowKeys = new Set();

      const pushRow = (row) => {
        const key = `${row.className}-${row.slug || row.name}-${row.sectionTag}-${row.valueDisplay}`;
        if (rowKeys.has(key)) return;
        rowKeys.add(key);
        rows.push(row);
      };

      for (const effect of entry.effects || []) {
        if (effect.kind === 'buff') {
          const statTag = getEffectStatTag(effect);
          if (!statTag) continue;
          pushRow(
            createRow(entry, data, statTag, {
              statTag,
              stat: effect.stat,
              effect,
              value: getEffectValue(effect),
              isPercent: effect.unit === '%',
              valueDisplay: effect.display,
            })
          );
          continue;
        }

        if (effect.kind === 'shield') {
          pushRow(
            createRow(entry, data, SHIELD_SECTION, {
              effect,
              value: getEffectValue(effect),
              isPercent: false,
              valueDisplay: effect.display,
            })
          );
          continue;
        }

        if (effect.kind === 'thorns') {
          pushRow(
            createRow(entry, data, THORNS_SECTION, {
              effect,
              value: getEffectValue(effect),
              isPercent: false,
              valueDisplay: effect.display,
            })
          );
        }
      }

      if (tags.includes('shield')) {
        const hasShieldRow = [...rowKeys].some((key) => key.includes(`-${SHIELD_SECTION}-`));
        if (!hasShieldRow) {
          const fallback = getShieldFallback(entry);
          if (fallback) {
            pushRow(
              createRow(entry, data, SHIELD_SECTION, {
                value: fallback.amount,
                isPercent: false,
                valueDisplay: fallback.display,
              })
            );
          }
        }
      }

      if (tags.includes('song') && rowKeys.size === 0 && (entry.valuesSummary || entry.effects?.length)) {
        const primaryEffect = entry.effects?.[0];
        pushRow(
          createRow(entry, data, SONG_SECTION, {
            effect: primaryEffect,
            value: primaryEffect ? getEffectValue(primaryEffect) : 0,
            isPercent: primaryEffect?.unit === '%',
            valueDisplay: entry.valuesSummary || primaryEffect?.display || entry.name,
          })
        );
      }
    }
  }

  return rows;
}

/** @deprecated Use loadBuffPageRows */
export async function loadBuffRows() {
  const rows = await loadBuffPageRows();
  return rows.filter((row) => isStatSection(row.sectionTag));
}

/** @deprecated Use loadBuffPageRows */
export async function loadThornsRows() {
  const rows = await loadBuffPageRows();
  return rows.filter((row) => row.sectionTag === THORNS_SECTION);
}

/**
 * @param {string} sectionTag
 */
export function isStatSection(sectionTag) {
  return STAT_TAGS.includes(sectionTag);
}

/**
 * @param {object[]} rows
 * @param {string} search
 */
export function filterBuffRows(rows, search) {
  if (!search.trim()) return rows;
  const q = search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      row.name.toLowerCase().includes(q) ||
      row.className.toLowerCase().includes(q) ||
      (row.sectionTag || '').toLowerCase().includes(q) ||
      (row.statTag || '').toLowerCase().includes(q) ||
      (row.stat || '').toLowerCase().includes(q) ||
      (row.description || '').toLowerCase().includes(q) ||
      (row.valueDisplay || '').toLowerCase().includes(q) ||
      (row.tags || []).some((tag) => tag.toLowerCase().includes(q))
  );
}

/** @param {object[]} rows @param {string} search */
export function filterThornsRows(rows, search) {
  return filterBuffRows(rows, search);
}

/**
 * @param {object[]} rows
 */
export function sortSectionRows(rows) {
  return [...rows].sort(
    (a, b) => {
      if (a.isPercent !== b.isPercent) return a.isPercent ? 1 : -1;
      return b.value - a.value || a.level - b.level || a.name.localeCompare(b.name);
    }
  );
}

/** @deprecated Use sortSectionRows */
export function sortThornsRows(rows) {
  return sortSectionRows(rows);
}

/**
 * @param {object[]} rows
 */
export function groupBySection(rows) {
  /** @type {Map<string, object[]>} */
  const groups = new Map();
  for (const section of BUFF_SECTION_ORDER) groups.set(section, []);

  for (const row of rows) {
    groups.get(row.sectionTag)?.push(row);
  }

  /** @type {{ sectionTag: string, rows: object[] }[]} */
  const result = [];
  for (const sectionTag of BUFF_SECTION_ORDER) {
    const sectionRows = groups.get(sectionTag) || [];
    if (!sectionRows.length) continue;
    result.push({ sectionTag, rows: sortSectionRows(sectionRows) });
  }

  return result;
}

/** @deprecated Use groupBySection */
export function groupByStat(rows) {
  return groupBySection(rows.filter((row) => isStatSection(row.sectionTag)));
}

/**
 * @param {object[]} rows
 */
export function getBestValues(rows) {
  /** @type {{ bestFlat: number | null, bestPercent: number | null }} */
  const best = { bestFlat: null, bestPercent: null };

  for (const row of rows) {
    if (row.isPercent) {
      if (best.bestPercent == null || row.value > best.bestPercent) best.bestPercent = row.value;
    } else if (best.bestFlat == null || row.value > best.bestFlat) {
      best.bestFlat = row.value;
    }
  }

  return best;
}

/**
 * @param {object} row
 * @param {{ bestFlat: number | null, bestPercent: number | null }} best
 */
export function isBestValue(row, best) {
  if (row.isPercent) return best.bestPercent != null && row.value === best.bestPercent;
  return best.bestFlat != null && row.value === best.bestFlat;
}

/**
 * @param {object[]} rows
 */
export function getSectionCounts(rows) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.sectionTag, (counts.get(row.sectionTag) || 0) + 1);
  }
  return counts;
}

/** @deprecated Use getSectionCounts */
export function getStatCounts(rows) {
  return getSectionCounts(rows);
}
