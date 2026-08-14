import indexData from '../data/index.json';
import { isBuffPageEntry, groupBySection, getBestValues } from './buff-data.js';
import {
  STAT_FILTER_GROUPS,
  BUFF_SPECIAL_SECTIONS,
  STAT_TAGS,
  getBuffSectionLabel,
  getBuffSectionColor,
  TAG_COLORS,
  TAG_LABELS,
  CLASS_ROLES,
} from './constants.js';

const classModules = import.meta.glob('../data/classes/*.json');

export const PARTY_SIZE = 6;
export const STORAGE_KEY = 'mnm-party-composition';

/** CC subtypes shown as individual coverage bars (excludes umbrella crowd-control tag). */
const CC_SUBTYPE_TAGS = ['stun', 'mez', 'root', 'fear', 'silence'];

/** @returns {Promise<Map<string, { meta: object, entries: object[] }>>} */
export async function loadAllClassEntries() {
  /** @type {Map<string, { meta: object, entries: object[] }>} */
  const map = new Map();

  for (const classMeta of indexData.classes) {
    const loader = classModules[`../data/${classMeta.file}`];
    if (!loader) continue;
    const mod = await loader();
    const data = mod.default || mod;
    map.set(classMeta.name, { meta: classMeta, entries: data.entries || [] });
  }

  return map;
}

/**
 * @param {(string | null)[]} slots
 * @returns {string[]}
 */
export function getSelectedClasses(slots) {
  return slots.filter(Boolean);
}

/**
 * @param {object} entry
 * @param {number} levelCap
 */
function isAvailableAtLevel(entry, levelCap) {
  return entry.level <= levelCap;
}

/**
 * @param {object} entry
 * @param {string} tag
 */
function entryHasTag(entry, tag) {
  return (entry.tags || []).includes(tag);
}

/**
 * @param {number | null | undefined} party
 * @param {number | null | undefined} max
 */
function toPercent(party, max) {
  if (max == null || max <= 0) return party != null && party > 0 ? 100 : 0;
  if (party == null || party <= 0) return 0;
  return Math.min(100, Math.round((party / max) * 100));
}

/**
 * @param {object[]} rows
 * @param {number} levelCap
 */
function filterRowsByLevel(rows, levelCap) {
  return rows.filter((row) => row.level <= levelCap);
}

/**
 * @param {object[]} rows
 */
function getSectionValueMap(rows) {
  /** @type {Map<string, { bestFlat: number | null, bestPercent: number | null, bestFlatRow: object | null, bestPercentRow: object | null }>} */
  const map = new Map();

  for (const group of groupBySection(rows)) {
    const best = getBestValues(group.rows);
    map.set(group.sectionTag, {
      bestFlat: best.bestFlat,
      bestPercent: best.bestPercent,
      bestFlatRow: group.rows.find((row) => !row.isPercent && row.value === best.bestFlat) || null,
      bestPercentRow:
        group.rows.find((row) => row.isPercent && row.value === best.bestPercent) || null,
    });
  }

  return map;
}

/**
 * @param {string} className
 * @param {object} entry
 * @param {{ valueDisplay?: string, value?: number | null }} [extra]
 */
function toSpellSummary(className, entry, extra = {}) {
  return {
    className,
    name: entry.name,
    level: entry.level,
    wikiUrl: entry.wikiUrl,
    description: entry.description || '',
    valueDisplay: extra.valueDisplay || entry.valuesSummary || '',
    value: extra.value ?? null,
  };
}

/**
 * @param {object} row
 */
function buffRowToSpellSummary(row) {
  return {
    className: row.className,
    name: row.name,
    level: row.level,
    wikiUrl: row.wikiUrl,
    description: row.description || '',
    valueDisplay: row.valueDisplay,
    value: row.value,
  };
}

/**
 * @param {string[]} classNames
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 * @param {string | string[]} tags
 */
function collectTaggedEntriesByTags(classNames, levelCap, allClassEntries, tags) {
  const tagList = Array.isArray(tags) ? tags : [tags];
  /** @type {{ className: string, entry: object }[]} */
  const results = [];

  for (const className of classNames) {
    const data = allClassEntries.get(className);
    if (!data) continue;

    for (const entry of data.entries) {
      if (!isAvailableAtLevel(entry, levelCap)) continue;
      if (!tagList.some((tag) => entryHasTag(entry, tag))) continue;
      results.push({ className, entry });
    }
  }

  return results;
}

/**
 * @param {object[]} spells
 */
function sortSpellSummaries(spells) {
  return [...spells].sort(
    (a, b) =>
      (b.value ?? 0) - (a.value ?? 0) ||
      a.level - b.level ||
      a.name.localeCompare(b.name) ||
      a.className.localeCompare(b.className)
  );
}

/**
 * @param {string} sectionTag
 * @param {boolean} isPercent
 * @param {object[]} levelRows
 * @param {object[]} partyRows
 * @param {Set<string>} selectedSet
 */
function buildBuffBarDetail(sectionTag, isPercent, levelRows, partyRows, selectedSet) {
  const partyMatches = partyRows.filter(
    (row) => row.sectionTag === sectionTag && !!row.isPercent === isPercent
  );
  const partyBest = partyMatches.length ? Math.max(...partyMatches.map((row) => row.value)) : 0;
  const betterRows = levelRows.filter(
    (row) =>
      row.sectionTag === sectionTag &&
      !!row.isPercent === isPercent &&
      !selectedSet.has(row.className) &&
      row.value > partyBest
  );

  return {
    partySpells: sortSpellSummaries(partyMatches.map(buffRowToSpellSummary)),
    betterSpells: sortSpellSummaries(betterRows.map(buffRowToSpellSummary)),
  };
}

/**
 * @param {string[]} partyClasses
 * @param {string[]} allClassNames
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 * @param {string | string[]} tags
 * @param {(entry: object) => { valueDisplay: string, value: number } | null} [getValue]
 */
function buildTaggedBarDetail(
  partyClasses,
  allClassNames,
  levelCap,
  allClassEntries,
  tags,
  getValue = null
) {
  const selectedSet = new Set(partyClasses);
  const otherClasses = allClassNames.filter((className) => !selectedSet.has(className));

  const partyEntries = collectTaggedEntriesByTags(partyClasses, levelCap, allClassEntries, tags);
  const partySpells = sortSpellSummaries(
    partyEntries.map(({ className, entry }) => {
      const valueInfo = getValue?.(entry);
      return toSpellSummary(className, entry, valueInfo || {});
    })
  );

  let partyBest = partySpells.length ? Math.max(...partySpells.map((spell) => spell.value ?? 0)) : 0;
  if (!getValue) partyBest = partySpells.length;

  const otherEntries = collectTaggedEntriesByTags(otherClasses, levelCap, allClassEntries, tags);
  const betterSpells = sortSpellSummaries(
    otherEntries
      .map(({ className, entry }) => {
        const valueInfo = getValue?.(entry);
        return toSpellSummary(className, entry, valueInfo || {});
      })
      .filter((spell) => {
        if (getValue) return (spell.value ?? 0) > partyBest;
        return true;
      })
  );

  return { partySpells, betterSpells };
}

/**
 * @param {string[]} partyClasses
 * @param {string[]} allClassNames
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 */
function buildHealBarDetail(partyClasses, allClassNames, levelCap, allClassEntries) {
  /** @type {object[]} */
  const partySpells = [];
  /** @type {object[]} */
  const otherSpells = [];

  const selectedSet = new Set(partyClasses);

  for (const className of allClassNames) {
    const data = allClassEntries.get(className);
    if (!data) continue;

    for (const entry of data.entries) {
      if (!isAvailableAtLevel(entry, levelCap)) continue;
      if (!entryHasTag(entry, 'heal') && !entryHasTag(entry, 'hot')) continue;

      const heal = getBestHealValue(entry);
      if (!heal) continue;

      const summary = toSpellSummary(className, entry, {
        valueDisplay: heal.display,
        value: heal.value,
      });

      if (selectedSet.has(className)) partySpells.push(summary);
      else otherSpells.push(summary);
    }
  }

  const partyBest = partySpells.length ? Math.max(...partySpells.map((spell) => spell.value ?? 0)) : 0;

  return {
    partySpells: sortSpellSummaries(partySpells),
    betterSpells: sortSpellSummaries(
      otherSpells.filter((spell) => (spell.value ?? 0) > partyBest)
    ),
  };
}

/**
 * @param {object | null} row
 */
function rowSource(row) {
  if (!row) return null;
  return {
    name: row.name,
    className: row.className,
    valueDisplay: row.valueDisplay,
  };
}

/**
 * @param {string} sectionTag
 * @param {{ bestFlat: number | null, bestPercent: number | null, bestFlatRow: object | null, bestPercentRow: object | null }} global
 * @param {{ bestFlat: number | null, bestPercent: number | null, bestFlatRow: object | null, bestPercentRow: object | null } | undefined} party
 * @param {string} groupId
 * @param {string} groupLabel
 * @param {string} color
 * @param {object[]} levelRows
 * @param {object[]} partyRows
 * @param {Set<string>} selectedSet
 */
function buildStatSectionBars(
  sectionTag,
  global,
  party,
  groupId,
  groupLabel,
  color,
  levelRows,
  partyRows,
  selectedSet
) {
  /** @type {object[]} */
  const bars = [];
  const label = getBuffSectionLabel(sectionTag);

  if (global.bestFlat != null && global.bestFlat > 0) {
    const partyFlat = party?.bestFlat ?? 0;
    bars.push({
      id: `${sectionTag}-flat`,
      label,
      groupId,
      groupLabel,
      color,
      valueType: 'flat',
      partyValue: partyFlat,
      maxValue: global.bestFlat,
      percent: toPercent(partyFlat, global.bestFlat),
      partyDisplay: partyFlat > 0 ? String(partyFlat) : '0',
      maxDisplay: String(global.bestFlat),
      source: rowSource(party?.bestFlatRow),
      maxSource: rowSource(global.bestFlatRow),
      detail: buildBuffBarDetail(sectionTag, false, levelRows, partyRows, selectedSet),
    });
  }

  if (global.bestPercent != null && global.bestPercent > 0) {
    const partyPercent = party?.bestPercent ?? 0;
    bars.push({
      id: `${sectionTag}-percent`,
      label: `${label} %`,
      groupId,
      groupLabel,
      color,
      valueType: 'percent',
      partyValue: partyPercent,
      maxValue: global.bestPercent,
      percent: toPercent(partyPercent, global.bestPercent),
      partyDisplay: `${partyPercent}%`,
      maxDisplay: `${global.bestPercent}%`,
      source: rowSource(party?.bestPercentRow),
      maxSource: rowSource(global.bestPercentRow),
      detail: buildBuffBarDetail(sectionTag, true, levelRows, partyRows, selectedSet),
    });
  }

  return bars;
}

/**
 * @param {object} entry
 */
function getBestHealValue(entry) {
  let best = null;
  for (const effect of entry.effects || []) {
    if (effect.kind !== 'heal' && effect.kind !== 'hot') continue;
    const value = effect.sortKey ?? effect.amount ?? effect.max ?? effect.min ?? 0;
    if (best == null || value > best.value) {
      best = {
        value,
        display: effect.display || `${value} ${effect.kind}`,
        kind: effect.kind,
      };
    }
  }
  return best;
}

/**
 * @param {string[]} classNames
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 */
function findBestHeal(classNames, levelCap, allClassEntries) {
  /** @type {{ className: string, name: string, level: number, value: number, display: string, kind: string } | null} */
  let best = null;

  for (const className of classNames) {
    const data = allClassEntries.get(className);
    if (!data) continue;

    for (const entry of data.entries) {
      if (!isAvailableAtLevel(entry, levelCap)) continue;
      if (!entryHasTag(entry, 'heal') && !entryHasTag(entry, 'hot')) continue;

      const heal = getBestHealValue(entry);
      if (!heal) continue;

      if (!best || heal.value > best.value) {
        best = {
          className,
          name: entry.name,
          level: entry.level,
          value: heal.value,
          display: heal.display,
          kind: heal.kind,
        };
      }
    }
  }

  return best;
}

/**
 * @param {string[]} classNames
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 * @param {string | string[]} tags
 */
function countTaggedEntries(classNames, levelCap, allClassEntries, tags) {
  const tagList = Array.isArray(tags) ? tags : [tags];
  let count = 0;

  for (const className of classNames) {
    const data = allClassEntries.get(className);
    if (!data) continue;

    for (const entry of data.entries) {
      if (!isAvailableAtLevel(entry, levelCap)) continue;
      if (!tagList.some((tag) => entryHasTag(entry, tag))) continue;
      count += 1;
    }
  }

  return count;
}

/**
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 * @param {string | string[]} tags
 */
function maxTaggedCountPerClass(levelCap, allClassEntries, tags) {
  const tagList = Array.isArray(tags) ? tags : [tags];
  let max = 0;

  for (const [, data] of allClassEntries) {
    let count = 0;
    for (const entry of data.entries) {
      if (!isAvailableAtLevel(entry, levelCap)) continue;
      if (!tagList.some((tag) => entryHasTag(entry, tag))) continue;
      count += 1;
    }
    max = Math.max(max, count);
  }

  return max;
}

/**
 * @param {string} tag
 * @param {string[]} selected
 * @param {string[]} allClassNames
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 */
function buildCountCoverageBar(tag, selected, allClassNames, levelCap, allClassEntries) {
  const max = maxTaggedCountPerClass(levelCap, allClassEntries, tag);
  if (max <= 0) return null;

  const count = countTaggedEntries(selected, levelCap, allClassEntries, tag);
  const entries = collectTaggedEntries(selected, levelCap, allClassEntries, tag);
  const label = TAG_LABELS[tag] || tag;

  return {
    id: tag,
    label,
    groupId: 'crowd-control',
    groupLabel: 'Crowd Control',
    color: TAG_COLORS[tag] || TAG_COLORS['crowd-control'],
    valueType: 'count',
    partyValue: count,
    maxValue: max,
    percent: toPercent(count, max),
    partyDisplay: String(count),
    maxDisplay: String(max),
    source: count
      ? {
          name: `${label} options`,
          className: [...new Set(entries.map((item) => item.className))].join(', '),
          valueDisplay: `${count} spell${count === 1 ? '' : 's'}`,
        }
      : null,
    maxSource: { name: 'Best single class', className: '—', valueDisplay: `${max} spells` },
    detail: buildTaggedBarDetail(selected, allClassNames, levelCap, allClassEntries, tag),
  };
}

/**
 * @param {string[]} selected
 * @param {string[]} allClassNames
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 */
function buildCrowdControlBars(selected, allClassNames, levelCap, allClassEntries) {
  return CC_SUBTYPE_TAGS.map((tag) =>
    buildCountCoverageBar(tag, selected, allClassNames, levelCap, allClassEntries)
  ).filter(Boolean);
}

/**
 * @param {string[]} selected
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 * @param {string} tag
 */
function collectTaggedEntries(selected, levelCap, allClassEntries, tag) {
  /** @type {{ className: string, entry: object }[]} */
  const results = [];

  for (const className of selected) {
    const data = allClassEntries.get(className);
    if (!data) continue;

    for (const entry of data.entries) {
      if (!isAvailableAtLevel(entry, levelCap)) continue;
      if (!entryHasTag(entry, tag)) continue;
      results.push({ className, entry });
    }
  }

  return results;
}

/**
 * @param {string[]} selected
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 */
function countBuffSpells(selected, levelCap, allClassEntries) {
  /** @type {Set<string>} */
  const spellKeys = new Set();
  /** @type {{ className: string, entry: object }[]} */
  const spells = [];

  for (const className of selected) {
    const data = allClassEntries.get(className);
    if (!data) continue;

    for (const entry of data.entries) {
      if (!isAvailableAtLevel(entry, levelCap)) continue;
      if (!isBuffPageEntry(entry.tags || [])) continue;

      const key = `${className}-${entry.slug || entry.name}`;
      if (spellKeys.has(key)) continue;
      spellKeys.add(key);
      spells.push({ className, entry });
    }
  }

  return { count: spellKeys.size, spells };
}

/**
 * @param {string[]} selected
 * @param {object[]} buffRows
 * @param {number} levelCap
 */
function analyzeBuffCoverage(selected, buffRows, levelCap) {
  const selectedSet = new Set(selected);
  const partyRows = buffRows.filter(
    (row) => selectedSet.has(row.className) && row.level <= levelCap
  );
  const sectionGroups = groupBySection(partyRows);

  return {
    effectCount: partyRows.length,
    sectionsCovered: sectionGroups.length,
    statSectionsCovered: sectionGroups.filter((group) => STAT_TAGS.includes(group.sectionTag))
      .length,
    sections: sectionGroups.map((group) => ({
      tag: group.sectionTag,
      count: group.rows.length,
      best: group.rows[0] || null,
    })),
  };
}

/**
 * @param {string[]} selected
 * @param {number} levelCap
 * @param {object[]} buffRows
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 */
function buildCoverageGroups(selected, levelCap, buffRows, allClassEntries) {
  const allClassNames = [...allClassEntries.keys()];
  const levelRows = filterRowsByLevel(buffRows, levelCap);
  const globalSections = getSectionValueMap(levelRows);

  const selectedSet = new Set(selected);
  const partyRows = levelRows.filter((row) => selectedSet.has(row.className));
  const partySections = getSectionValueMap(partyRows);

  /** @type {{ id: string, label: string, color: string, bars: object[] }[]} */
  const groups = [];

  for (const statGroup of STAT_FILTER_GROUPS) {
    /** @type {object[]} */
    const bars = [];

    for (const statTag of statGroup.stats) {
      const global = globalSections.get(statTag);
      if (!global) continue;
      bars.push(
        ...buildStatSectionBars(
          statTag,
          global,
          partySections.get(statTag),
          statGroup.id,
          statGroup.label,
          statGroup.color,
          levelRows,
          partyRows,
          selectedSet
        )
      );
    }

    if (bars.length) {
      groups.push({
        id: statGroup.id,
        label: statGroup.label,
        color: statGroup.color,
        bars,
      });
    }
  }

  /** @type {object[]} */
  const specialBars = [];
  for (const section of BUFF_SPECIAL_SECTIONS) {
    const global = globalSections.get(section.id);
    if (!global) continue;
    specialBars.push(
      ...buildStatSectionBars(
        section.id,
        global,
        partySections.get(section.id),
        'special',
        'Shields & Songs',
        section.color,
        levelRows,
        partyRows,
        selectedSet
      )
    );
  }

  if (specialBars.length) {
    groups.push({
      id: 'special',
      label: 'Shields & Songs',
      color: TAG_COLORS.shield,
      bars: specialBars,
    });
  }

  const ccBars = buildCrowdControlBars(selected, allClassNames, levelCap, allClassEntries);
  if (ccBars.length) {
    groups.push({
      id: 'crowd-control',
      label: 'Crowd Control',
      color: TAG_COLORS['crowd-control'],
      bars: ccBars,
    });
  }

  /** @type {object[]} */
  const supportBars = [];

  const globalHeal = findBestHeal(allClassNames, levelCap, allClassEntries);
  const partyHeal = findBestHeal(selected, levelCap, allClassEntries);

  if (globalHeal) {
    supportBars.push({
      id: 'heal',
      label: 'Best Heal',
      groupId: 'support',
      groupLabel: 'Support',
      color: TAG_COLORS.heal,
      valueType: 'heal',
      partyValue: partyHeal?.value ?? 0,
      maxValue: globalHeal.value,
      percent: toPercent(partyHeal?.value, globalHeal.value),
      partyDisplay: partyHeal ? partyHeal.display : 'None',
      maxDisplay: globalHeal.display,
      source: partyHeal
        ? { name: partyHeal.name, className: partyHeal.className, valueDisplay: partyHeal.display }
        : null,
      maxSource: {
        name: globalHeal.name,
        className: globalHeal.className,
        valueDisplay: globalHeal.display,
      },
      detail: buildHealBarDetail(selected, allClassNames, levelCap, allClassEntries),
    });
  }

  const tauntEntries = collectTaggedEntries(selected, levelCap, allClassEntries, 'taunt');
  const tauntClasses = [...new Set(tauntEntries.map((item) => item.className))];
  supportBars.push({
    id: 'taunt',
    label: 'Taunt',
    groupId: 'support',
    groupLabel: 'Support',
    color: TAG_COLORS.taunt,
    valueType: 'binary',
    partyValue: tauntClasses.length > 0 ? 1 : 0,
    maxValue: 1,
    percent: tauntClasses.length > 0 ? 100 : 0,
    partyDisplay: tauntClasses.length ? tauntClasses.join(', ') : 'None',
    maxDisplay: 'Available',
    source: tauntEntries.length
      ? {
          name: tauntEntries[0].entry.name,
          className: tauntEntries[0].className,
          valueDisplay: `${tauntEntries.length} spell${tauntEntries.length === 1 ? '' : 's'}`,
        }
      : null,
    detail: buildTaggedBarDetail(selected, allClassNames, levelCap, allClassEntries, 'taunt'),
  });

  const dispelMax = maxTaggedCountPerClass(levelCap, allClassEntries, ['dispel', 'purge', 'cure']);
  const dispelCount = countTaggedEntries(selected, levelCap, allClassEntries, ['dispel', 'purge', 'cure']);
  if (dispelMax > 0) {
    supportBars.push({
      id: 'dispel',
      label: 'Dispel / Purge / Cure',
      groupId: 'support',
      groupLabel: 'Support',
      color: TAG_COLORS.dispel,
      valueType: 'count',
      partyValue: dispelCount,
      maxValue: dispelMax,
      percent: toPercent(dispelCount, dispelMax),
      partyDisplay: String(dispelCount),
      maxDisplay: String(dispelMax),
      source: dispelCount
        ? { name: 'Utility options', className: 'Party', valueDisplay: `${dispelCount} spells` }
        : null,
      detail: buildTaggedBarDetail(selected, allClassNames, levelCap, allClassEntries, [
        'dispel',
        'purge',
        'cure',
      ]),
    });
  }

  const rezEntries = collectTaggedEntries(selected, levelCap, allClassEntries, 'resurrection');
  supportBars.push({
    id: 'resurrection',
    label: 'Resurrection',
    groupId: 'support',
    groupLabel: 'Support',
    color: TAG_COLORS.resurrection,
    valueType: 'binary',
    partyValue: rezEntries.length > 0 ? 1 : 0,
    maxValue: 1,
    percent: rezEntries.length > 0 ? 100 : 0,
    partyDisplay: rezEntries.length ? 'Yes' : 'None',
    maxDisplay: 'Available',
    source: rezEntries.length
      ? {
          name: rezEntries[0].entry.name,
          className: rezEntries[0].className,
          valueDisplay: `${rezEntries.length} option${rezEntries.length === 1 ? '' : 's'}`,
        }
      : null,
    detail: buildTaggedBarDetail(selected, allClassNames, levelCap, allClassEntries, 'resurrection'),
  });

  const songMax = maxTaggedCountPerClass(levelCap, allClassEntries, 'song');
  const songCount = countTaggedEntries(selected, levelCap, allClassEntries, 'song');
  if (songMax > 0) {
    supportBars.push({
      id: 'song',
      label: 'Songs',
      groupId: 'support',
      groupLabel: 'Support',
      color: TAG_COLORS.song,
      valueType: 'count',
      partyValue: songCount,
      maxValue: songMax,
      percent: toPercent(songCount, songMax),
      partyDisplay: String(songCount),
      maxDisplay: String(songMax),
      source: songCount
        ? { name: 'Bard songs', className: 'Bard', valueDisplay: `${songCount} songs` }
        : null,
      detail: buildTaggedBarDetail(selected, allClassNames, levelCap, allClassEntries, 'song'),
    });
  }

  if (supportBars.length) {
    groups.push({
      id: 'support',
      label: 'Support & Utility',
      color: TAG_COLORS.heal,
      bars: supportBars,
    });
  }

  return groups;
}

/**
 * @param {string[]} selected
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 */
export function analyzeTankStatus(selected, levelCap, allClassEntries) {
  const tankClasses = CLASS_ROLES.tank.classes;
  const tanksInParty = selected.filter((className) => tankClasses.includes(className));

  const tauntEntries = collectTaggedEntries(selected, levelCap, allClassEntries, 'taunt');
  const tauntClassSet = new Set(tauntEntries.map((item) => item.className));
  const tauntClasses = selected.filter((className) => tauntClassSet.has(className));
  const tauntFallbackClasses = tauntClasses.filter((className) => !tankClasses.includes(className));

  if (tanksInParty.length > 0) {
    return {
      status: 'covered',
      tone: 'good',
      headline: 'Tank',
      classes: tanksInParty,
      tauntClasses,
      badge: 'Primary tank',
      detail:
        tanksInParty.length === 1
          ? `${tanksInParty[0]} fills the tank role.`
          : `${tanksInParty.join(', ')} can share tank responsibilities.`,
    };
  }

  if (tauntFallbackClasses.length > 0) {
    return {
      status: 'taunt-fallback',
      tone: 'warn',
      headline: 'No Tank Role',
      classes: tauntFallbackClasses,
      tauntClasses,
      badge: 'Taunt tank',
      detail: `${tauntFallbackClasses.join(', ')} can act as tank via taunt — no tank class selected.`,
    };
  }

  return {
    status: 'none',
    tone: 'bad',
    headline: 'No Tank Coverage',
    classes: [],
    tauntClasses: [],
    badge: null,
    detail: `Add a tank (${tankClasses.join(', ')}) or a class with taunt.`,
  };
}

/**
 * @param {string[]} selected
 */
function analyzeHealerStatus(selected) {
  const healerClasses = CLASS_ROLES.healer.classes;
  const healersInParty = selected.filter((className) => healerClasses.includes(className));

  if (healersInParty.length > 0) {
    return {
      status: 'covered',
      tone: 'good',
      headline: 'Healer',
      classes: healersInParty,
      badge: healersInParty.length > 1 ? 'Multiple healers' : 'Primary healer',
      detail:
        healersInParty.length === 1
          ? `${healersInParty[0]} fills the healer role.`
          : `${healersInParty.join(', ')} provide healing coverage.`,
    };
  }

  return {
    status: 'none',
    tone: 'bad',
    headline: 'No Healer',
    classes: [],
    badge: null,
    detail: `Add a healer (${healerClasses.join(', ')}).`,
  };
}

/**
 * @param {string[]} selected
 */
function analyzeSupportStatus(selected) {
  const supportClasses = CLASS_ROLES.support.classes;
  const supportInParty = selected.filter((className) => supportClasses.includes(className));

  if (supportInParty.length > 0) {
    return {
      status: 'covered',
      tone: 'good',
      headline: 'Support',
      classes: supportInParty,
      badge: supportInParty.length > 1 ? 'Full support' : 'Support',
      detail:
        supportInParty.length === 1
          ? `${supportInParty[0]} fills the support role.`
          : `${supportInParty.join(', ')} cover buffs and utility.`,
    };
  }

  return {
    status: 'none',
    tone: 'warn',
    headline: 'No Support',
    classes: [],
    badge: null,
    detail: `Consider ${supportClasses.join(' or ')} for group buffs and utility.`,
  };
}

/**
 * @param {string[]} selected
 */
function analyzeDpsStatus(selected) {
  const dpsClasses = CLASS_ROLES.dps.classes;
  const dpsInParty = selected.filter((className) => dpsClasses.includes(className));

  if (dpsInParty.length > 0) {
    return {
      status: 'covered',
      tone: 'good',
      headline: 'Damage Dealers',
      classes: dpsInParty,
      badge: `${dpsInParty.length} DPS`,
      detail: `${dpsInParty.join(', ')} fill damage roles.`,
    };
  }

  return {
    status: 'none',
    tone: 'warn',
    headline: 'No Damage Dealers',
    classes: [],
    badge: null,
    detail: 'No dedicated DPS classes selected.',
  };
}

/**
 * @param {string[]} selected
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 */
export function analyzePartyRoles(selected, levelCap, allClassEntries) {
  return {
    tank: analyzeTankStatus(selected, levelCap, allClassEntries),
    healer: analyzeHealerStatus(selected),
    support: analyzeSupportStatus(selected),
    dps: analyzeDpsStatus(selected),
  };
}

/**
 * @param {{ bars: object[] }[]} groups
 */
function computeOverallCoverage(groups) {
  const percents = groups.flatMap((group) => group.bars.map((bar) => bar.percent));
  if (!percents.length) return 0;
  return Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length);
}

/**
 * @param {(string | null)[]} slots
 * @param {number} levelCap
 * @param {Map<string, { meta: object, entries: object[] }>} allClassEntries
 * @param {object[]} buffRows
 */
export function analyzeParty(slots, levelCap, allClassEntries, buffRows) {
  const selected = getSelectedClasses(slots);
  const duplicates = selected.filter((name, index) => selected.indexOf(name) !== index);
  const uniqueDuplicates = [...new Set(duplicates)];

  const tauntEntries = collectTaggedEntries(selected, levelCap, allClassEntries, 'taunt');
  const tauntClasses = [...new Set(tauntEntries.map((item) => item.className))];

  const bestHeal = findBestHeal(selected, levelCap, allClassEntries);
  const buffSpells = countBuffSpells(selected, levelCap, allClassEntries);
  const buffCoverage = analyzeBuffCoverage(selected, buffRows, levelCap);
  const coverageGroups = buildCoverageGroups(selected, levelCap, buffRows, allClassEntries);
  const overallPercent = computeOverallCoverage(coverageGroups);
  const tank = analyzeTankStatus(selected, levelCap, allClassEntries);
  const roles = analyzePartyRoles(selected, levelCap, allClassEntries);

  return {
    selected,
    filledSlots: selected.length,
    emptySlots: PARTY_SIZE - selected.length,
    duplicates: uniqueDuplicates,
    levelCap,
    overallPercent,
    tank,
    roles,
    coverageGroups,
    taunt: {
      classes: tauntClasses,
      spells: tauntEntries.map(({ className, entry }) => ({
        className,
        name: entry.name,
        level: entry.level,
        wikiUrl: entry.wikiUrl,
        description: entry.description || '',
      })),
    },
    heal: {
      best: bestHeal,
      hasHealer: !!bestHeal,
    },
    buffs: {
      spellCount: buffSpells.count,
      spells: buffSpells.spells.map(({ className, entry }) => ({
        className,
        name: entry.name,
        level: entry.level,
        tags: entry.tags || [],
        wikiUrl: entry.wikiUrl,
        description: entry.description || '',
      })),
      ...buffCoverage,
    },
  };
}

/**
 * @returns {(string | null)[]}
 */
export function loadSavedParty() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array(PARTY_SIZE).fill(null);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return Array(PARTY_SIZE).fill(null);

    const slots = Array(PARTY_SIZE).fill(null);
    for (let i = 0; i < PARTY_SIZE; i += 1) {
      slots[i] = typeof parsed[i] === 'string' ? parsed[i] : null;
    }
    return slots;
  } catch {
    return Array(PARTY_SIZE).fill(null);
  }
}

/** @param {(string | null)[]} slots */
export function saveParty(slots) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots.slice(0, PARTY_SIZE)));
}

/** @returns {{ name: string }[]} */
export function getClassOptions() {
  return [...indexData.classes].sort((a, b) => a.name.localeCompare(b.name));
}

export { getBuffSectionLabel, getBuffSectionColor };
