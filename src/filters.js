/** @param {string | number | null | undefined} mana */
export function parseMana(mana) {
  if (mana === 'Innate' || mana === '' || mana == null) return null;
  const n = Number(mana);
  return Number.isFinite(n) ? n : null;
}

/** @param {string | null | undefined} castTime */
export function parseCastTime(castTime) {
  if (!castTime) return null;
  const match = String(castTime).match(/([\d.]+)/);
  return match ? Number(match[1]) : null;
}

/**
 * @param {object[]} entries
 * @param {object} filters
 */
export function filterEntries(entries, filters) {
  const { search, tags, levelMin, levelMax, primaryTagOnly } = filters;
  const query = search.trim().toLowerCase();

  return entries.filter((entry) => {
    if (query) {
      const haystack = `${entry.name} ${entry.description} ${entry.category || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (tags.size > 0) {
      const entryTags = entry.tags || [];
      const matches = primaryTagOnly
        ? tags.has(entry.primaryTag)
        : [...tags].some((tag) => entryTags.includes(tag));
      if (!matches) return false;
    }

    if (levelMin != null && entry.level < levelMin) return false;
    if (levelMax != null && entry.level > levelMax) return false;

    return true;
  });
}

/** @param {object[]} entries */
export function getMaxEffectValue(entry) {
  if (!entry.effects?.length) return null;
  return Math.max(...entry.effects.map((e) => e.sortKey || 0));
}

/**
 * @param {object[]} entries
 * @param {string} sortKey
 */
export function sortEntries(entries, sortKey) {
  const [column, dir] = sortKey.split('-');
  const mult = dir === 'desc' ? -1 : 1;

  return [...entries].sort((a, b) => {
    let cmp = 0;

    switch (column) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'mana': {
        const ma = parseMana(a.mana);
        const mb = parseMana(b.mana);
        if (ma == null && mb == null) cmp = 0;
        else if (ma == null) cmp = 1;
        else if (mb == null) cmp = -1;
        else cmp = ma - mb;
        break;
      }
      case 'cast': {
        const ca = parseCastTime(a.castTime);
        const cb = parseCastTime(b.castTime);
        if (ca == null && cb == null) cmp = 0;
        else if (ca == null) cmp = 1;
        else if (cb == null) cmp = -1;
        else cmp = ca - cb;
        break;
      }
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
      default:
        cmp = a.level - b.level || a.name.localeCompare(b.name);
        break;
    }

    return cmp * mult;
  });
}

/** @param {object[]} entries */
export function getAvailableTags(entries) {
  const counts = new Map();
  for (const entry of entries) {
    for (const tag of entry.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()].map(([tag, count]) => ({ tag, count }));
}

/** @param {object[]} entries */
export function getLevelRange(entries) {
  if (!entries.length) return { min: 1, max: 60 };
  const levels = entries.map((e) => e.level);
  return { min: Math.min(...levels), max: Math.max(...levels) };
}
