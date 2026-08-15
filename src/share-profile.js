import creationData from '../data/character-creation.json';
import indexData from '../data/index.json';
import { statKeys, traitSlots, findTraitByName } from './character-creator-data.js';
import { PARTY_SIZE } from './party-data.js';

const {
  raceNameToAbbrev,
  raceAbbrevToName,
  classNameToAbbrev,
  classAbbrevToName,
} = creationData;

const validClasses = new Set(indexData.classes.map((entry) => entry.name));

/** @param {object} payload */
function encodeSharePayload(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} encoded */
function decodeSharePayload(encoded) {
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
  const binary = atob(normalized + padding);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** @param {string | undefined} abbrevOrName @param {Record<string, string>} abbrevToName @param {Set<string>} validNames */
function resolveClassName(abbrevOrName, abbrevToName, validNames) {
  if (!abbrevOrName) return null;
  const resolved = abbrevToName[abbrevOrName] || abbrevOrName;
  return validNames.has(resolved) ? resolved : null;
}

/** @param {string | undefined} abbrevOrName */
function resolveRaceName(abbrevOrName) {
  if (!abbrevOrName) return null;
  return raceAbbrevToName[abbrevOrName] || abbrevOrName;
}

/** @param {object} build */
export function encodeCharacterBuild(build) {
  const stats = statKeys.map((key) => build.statAllocation?.[key] ?? 0);
  const traits = traitSlots.map((slot) => build.traits?.[slot.id] || '');

  const payload = {
    v: 1,
    t: 'build',
    race: raceNameToAbbrev[build.raceName] || build.raceName,
    class: classNameToAbbrev[build.className] || build.className,
    stats,
    traits,
    view: build.compareView === 'race' ? 'race' : undefined,
  };

  const isDefault =
    payload.race === 'HUM' &&
    payload.class === 'CLR' &&
    stats.every((value) => value === 0) &&
    traits.every((value) => !value) &&
    !payload.view;

  if (isDefault) return null;
  return encodeSharePayload(payload);
}

/** @param {string | null | undefined} encoded */
export function decodeCharacterBuild(encoded) {
  if (!encoded) return null;

  try {
    const payload = decodeSharePayload(encoded);
    if (payload?.t !== 'build') return null;

    const raceName = resolveRaceName(payload.race);
    const className = resolveClassName(payload.class, classAbbrevToName, validClasses);
    if (!raceName || !className) return null;

    /** @type {Record<string, number>} */
    const statAllocation = Object.fromEntries(statKeys.map((key, index) => [key, Number(payload.stats?.[index]) || 0]));
    /** @type {Record<string, string | null>} */
    const traits = Object.fromEntries(
      traitSlots.map((slot, index) => {
        const traitName = payload.traits?.[index];
        if (!traitName || !findTraitByName(traitName)) return [slot.id, null];
        return [slot.id, traitName];
      })
    );

    return {
      raceName,
      className,
      statAllocation,
      traits,
      compareView: payload.view === 'race' ? 'race' : 'class',
    };
  } catch {
    return null;
  }
}

/** @param {{ slots: (string | null)[], levelCap: number }} profile */
export function encodePartyProfile(profile) {
  const slots = profile.slots.slice(0, PARTY_SIZE).map((className) => {
    if (!className) return '';
    return classNameToAbbrev[className] || className;
  });

  while (slots.length < PARTY_SIZE) slots.push('');

  const payload = {
    v: 1,
    t: 'party',
    level: profile.levelCap !== 60 ? profile.levelCap : undefined,
    slots,
  };

  const isDefault = payload.level == null && slots.every((slot) => !slot);
  if (isDefault) return null;
  return encodeSharePayload(payload);
}

/** @param {string | null | undefined} encoded */
export function decodePartyProfile(encoded) {
  if (!encoded) return null;

  try {
    const payload = decodeSharePayload(encoded);
    if (payload?.t !== 'party') return null;

    const levelCap = Number(payload.level);
    const slots = Array(PARTY_SIZE).fill(null);

    for (let index = 0; index < PARTY_SIZE; index += 1) {
      const raw = payload.slots?.[index];
      if (!raw) continue;
      const className = resolveClassName(raw, classAbbrevToName, validClasses);
      if (className) slots[index] = className;
    }

    return {
      slots,
      levelCap: Number.isFinite(levelCap) ? Math.min(60, Math.max(1, levelCap)) : 60,
    };
  } catch {
    return null;
  }
}
