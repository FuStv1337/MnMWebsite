import spellIndex from '../data/spells/index.json';
import { getMaxEffectValue } from './filters.js';

/**
 * @param {object} entry
 */
function normalizeEntry(entry) {
  const classes = entry.classes || [];
  const levels = classes.map((c) => c.level).filter((n) => Number.isFinite(n));

  return {
    ...entry,
    minLevel: levels.length ? Math.min(...levels) : null,
    maxLevel: levels.length ? Math.max(...levels) : null,
    classCount: classes.length,
  };
}

export async function loadFindEntries() {
  return Object.values(spellIndex).map(normalizeEntry);
}

/** @param {object} entry */
export function isInGameEntry(entry) {
  return !/\bNOT currently in game\b/i.test(entry.name || '');
}

/**
 * @param {object[]} entries
 * @param {object} filters
 */
export function filterFindEntries(entries, filters) {
  const { search, tags, levelMin, levelMax, primaryTagOnly, inGameOnly, className } = filters;
  const query = search.trim().toLowerCase();

  return entries.filter((entry) => {
    if (inGameOnly && !isInGameEntry(entry)) return false;

    if (className) {
      const hasClass = (entry.classes || []).some((c) => c.className === className);
      if (!hasClass) return false;
    }

    if (query) {
      const classNames = (entry.classes || []).map((c) => c.className).join(' ');
      const haystack = `${entry.name} ${entry.description} ${entry.category || ''} ${classNames}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (tags.size > 0) {
      const entryTags = entry.tags || [];
      const matches = primaryTagOnly
        ? tags.has(entry.primaryTag)
        : [...tags].some((tag) => entryTags.includes(tag));
      if (!matches) return false;
    }

    if (levelMin != null || levelMax != null) {
      const levels = (entry.classes || []).map((c) => c.level).filter((n) => Number.isFinite(n));
      if (!levels.length) return false;

      const min = Math.min(...levels);
      const max = Math.max(...levels);
      if (levelMin != null && max < levelMin) return false;
      if (levelMax != null && min > levelMax) return false;
    }

    return true;
  });
}

/**
 * @param {object[]} entries
 * @param {string} sortKey
 */
export function sortFindEntries(entries, sortKey) {
  const [column, dir] = sortKey.split('-');
  const mult = dir === 'desc' ? -1 : 1;

  return [...entries].sort((a, b) => {
    let cmp = 0;

    switch (column) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'classes':
        cmp = a.classCount - b.classCount || a.name.localeCompare(b.name);
        break;
      case 'category':
        cmp = (a.category || '').localeCompare(b.category || '');
        break;
      case 'value': {
        const va = getMaxEffectValue(a);
        const vb = getMaxEffectValue(b);
        if (va == null && vb == null) cmp = 0;
        else if (va == null) cmp = 1;
        else if (vb == null) cmp = -1;
        else cmp = va - vb;
        break;
      }
      case 'level':
      default: {
        const la = a.minLevel;
        const lb = b.minLevel;
        if (la == null && lb == null) cmp = 0;
        else if (la == null) cmp = 1;
        else if (lb == null) cmp = -1;
        else cmp = la - lb || a.name.localeCompare(b.name);
        break;
      }
    }

    return cmp * mult;
  });
}

/** @param {object[]} entries */
export function getFindLevelRange(entries) {
  const levels = entries.flatMap((entry) =>
    (entry.classes || []).map((c) => c.level).filter((n) => Number.isFinite(n))
  );
  if (!levels.length) return { min: 1, max: 60 };
  return { min: Math.min(...levels), max: Math.max(...levels) };
}

/** @param {object} entry */
export function getSortedClasses(entry) {
  return [...(entry.classes || [])].sort((a, b) => a.className.localeCompare(b.className));
}

/** @param {object} entry */
export function formatClassSummary(entry, maxVisible = 4) {
  const classes = getSortedClasses(entry);
  if (!classes.length) return '—';

  const parts = classes.map((c) => `${c.className} L${c.level}`);
  if (parts.length <= maxVisible) return parts.join(' · ');

  const visible = parts.slice(0, maxVisible).join(' · ');
  const remaining = parts.length - maxVisible;
  return `${visible} · +${remaining} more`;
}
