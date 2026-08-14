import { parseEffects } from './parse-effects.mjs';

/**
 * @param {string} description
 */
export function scoreDescription(description) {
  const { effects, summary } = parseEffects(description || '');
  return {
    effectCount: effects.length,
    hasSummary: summary ? 1 : 0,
    length: (description || '').length,
  };
}

/**
 * @param {string[]} descriptions
 */
export function pickCanonicalDescription(descriptions) {
  const unique = [...new Set(descriptions.filter(Boolean))];
  if (!unique.length) return '';
  if (unique.length === 1) return unique[0];

  return unique.sort((a, b) => {
    const sa = scoreDescription(a);
    const sb = scoreDescription(b);
    if (sb.effectCount !== sa.effectCount) return sb.effectCount - sa.effectCount;
    if (sb.hasSummary !== sa.hasSummary) return sb.hasSummary - sa.hasSummary;
    return sb.length - sa.length;
  })[0];
}

/**
 * @param {object[]} entries
 * @returns {Map<string, string>}
 */
export function buildCanonicalDescriptionMap(entries) {
  /** @type {Map<string, string[]>} */
  const bySlug = new Map();

  for (const entry of entries) {
    if (!entry?.slug || !entry.description) continue;
    if (!bySlug.has(entry.slug)) bySlug.set(entry.slug, []);
    bySlug.get(entry.slug).push(entry.description);
  }

  /** @type {Map<string, string>} */
  const canonical = new Map();
  for (const [slug, descriptions] of bySlug) {
    canonical.set(slug, pickCanonicalDescription(descriptions));
  }

  return canonical;
}

/**
 * @param {object} entry
 * @param {Map<string, string>} canonicalMap
 */
export function withCanonicalDescription(entry, canonicalMap) {
  if (!entry?.slug) return entry;
  const canonical = canonicalMap.get(entry.slug);
  if (!canonical || canonical === entry.description) return entry;
  return { ...entry, description: canonical };
}
