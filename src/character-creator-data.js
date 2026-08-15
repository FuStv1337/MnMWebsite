import creationData from '../data/character-creation.json';

const {
  statKeys,
  statPointBudget,
  traitSlots,
  raceNameToAbbrev,
  classNameToAbbrev,
  classAbbrevToName,
  races,
  classes,
  traits,
} = creationData;

export { creationData, statKeys, statPointBudget, traitSlots, races, classes, traits };

const STAT_NAME_TO_KEY = {
  Strength: 'STR',
  Stamina: 'STA',
  Dexterity: 'DEX',
  Agility: 'AGI',
  Intelligence: 'INT',
  Wisdom: 'WIS',
  Charisma: 'CHA',
};

/** @param {string | null | undefined} description */
export function parseTraitStatModifiers(description) {
  /** @type {Record<string, number>} */
  const bonuses = {};
  if (!description) return bonuses;

  const pattern =
    /Your (?:base )?(Strength|Stamina|Dexterity|Agility|Intelligence|Wisdom|Charisma) is (increased|decreased) by (\d+)/gi;
  let match = pattern.exec(description);
  while (match) {
    const key = STAT_NAME_TO_KEY[match[1]];
    const delta = Number(match[3]) * (match[2].toLowerCase() === 'decreased' ? -1 : 1);
    if (key) bonuses[key] = (bonuses[key] ?? 0) + delta;
    match = pattern.exec(description);
  }

  return bonuses;
}

/** @param {string | null | undefined} name */
export function findTraitByName(name) {
  if (!name) return null;
  for (const category of Object.keys(traits)) {
    const found = traits[category]?.find((trait) => trait.name === name);
    if (found) return found;
  }
  return null;
}

/** @param {Record<string, string | null>} traitState */
export function computeTraitStatBonuses(traitState) {
  /** @type {Record<string, number>} */
  const totals = Object.fromEntries(statKeys.map((key) => [key, 0]));

  for (const slot of traitSlots) {
    const trait = findTraitByName(traitState[slot.id]);
    if (!trait) continue;
    const mods = parseTraitStatModifiers(trait.description);
    for (const key of statKeys) {
      totals[key] += mods[key] ?? 0;
    }
  }

  return totals;
}

/** @param {Record<string, number>} mods */
export function formatTraitStatModifierSummary(mods) {
  return statKeys
    .filter((key) => mods[key])
    .map((key) => `${mods[key] > 0 ? '+' : ''}${mods[key]} ${key}`)
    .join(', ');
}

/** @param {object} trait */
export function getMajorCombatTraitGroup(trait) {
  if (Object.keys(parseTraitStatModifiers(trait.description)).length > 0) {
    return 'stat';
  }
  if (/ Resistant$/i.test(trait.name) || /Resistance is increased/i.test(trait.description)) {
    return 'resist';
  }
  return 'other';
}

const MAJOR_COMBAT_GROUP_ORDER = { stat: 0, resist: 1, other: 2 };

/** @param {string} category @param {object[]} traitList */
export function sortTraitsForPicker(category, traitList) {
  if (category !== 'majorCombat') {
    return [...traitList].sort((a, b) => a.name.localeCompare(b.name));
  }

  return [...traitList].sort((a, b) => {
    const groupA = MAJOR_COMBAT_GROUP_ORDER[getMajorCombatTraitGroup(a)] ?? 9;
    const groupB = MAJOR_COMBAT_GROUP_ORDER[getMajorCombatTraitGroup(b)] ?? 9;
    if (groupA !== groupB) return groupA - groupB;
    return a.name.localeCompare(b.name);
  });
}

/** @param {string | null | undefined} raceName */
export function getRaceAbbrev(raceName) {
  return raceName ? raceNameToAbbrev[raceName] ?? null : null;
}

/** @param {string | null | undefined} className */
export function getClassAbbrev(className) {
  return className ? classNameToAbbrev[className] ?? null : null;
}

/** @param {string | null | undefined} raceName @param {string | null | undefined} className */
export function isValidCombo(raceName, className) {
  if (!raceName || !className) return false;
  const race = races.find((entry) => entry.name === raceName);
  return race?.classes.includes(className) ?? false;
}

/** @param {string | null | undefined} raceName */
export function getClassesForRace(raceName) {
  if (!raceName) return [];
  const race = races.find((entry) => entry.name === raceName);
  return race?.classes ?? [];
}

/** @param {string | null | undefined} className */
export function getRacesForClass(className) {
  if (!className) return [];
  const cls = classes.find((entry) => entry.name === className);
  const list = cls?.races ?? [];
  return [...new Set(list)];
}

/** @param {string} raceName @param {string} className */
export function getStartingStats(raceName, className) {
  const race = races.find((entry) => entry.name === raceName);
  const row = race?.startingStats?.find((entry) => entry.class === className);
  if (!row) return null;
  return Object.fromEntries(statKeys.map((key) => [key, row[key] ?? null]));
}

/** @param {string | null | undefined} className */
export function getClassDetails(className) {
  if (!className) return null;
  return classes.find((entry) => entry.name === className) ?? null;
}

/** @param {string | null | undefined} raceName */
export function getRaceByName(raceName) {
  if (!raceName) return null;
  return races.find((entry) => entry.name === raceName) ?? null;
}

/** @param {string | null | undefined} raceName */
export function getRaceBaseStats(raceName) {
  return getRaceByName(raceName)?.baseStats ?? null;
}

/** @param {string | null | undefined} raceName @param {string | null | undefined} className */
export function getStatBreakdown(raceName, className) {
  const baseStats = getRaceBaseStats(raceName);
  const classDetails = getClassDetails(className);
  const startingStats = getStartingStats(raceName, className);
  const modifiers = classDetails?.statModifiers ?? {};

  /** @type {Record<string, { base: number | null, modifier: number, starting: number | null }>} */
  const breakdown = {};
  for (const key of statKeys) {
    breakdown[key] = {
      base: baseStats?.[key] ?? null,
      modifier: modifiers[key] ?? 0,
      starting: startingStats?.[key] ?? null,
    };
  }

  return {
    baseStats,
    modifiers,
    modifierText: classDetails?.modifierText ?? null,
    startingStats,
    breakdown,
    primaryStat: classDetails?.primaryStat ?? null,
    secondaryStat: classDetails?.secondaryStat ?? null,
  };
}

/**
 * @param {{ type: string, values?: string[] }} requirement
 * @param {string | null} abbrev
 * @param {string} kind 'race' | 'class'
 */
function matchesRequirement(requirement, abbrev, kind, allAbbrevs) {
  if (!requirement || requirement.type === 'any') return true;
  if (!abbrev) return false;

  if (requirement.type === 'include') {
    return requirement.values?.includes(abbrev) ?? false;
  }

  if (requirement.type === 'exclude') {
    return !(requirement.values?.includes(abbrev));
  }

  return false;
}

/** @param {object} trait @param {string | null} raceAbbrev @param {string | null} classAbbrev */
export function isTraitAvailable(trait, raceAbbrev, classAbbrev) {
  return (
    matchesRequirement(trait.races, raceAbbrev, 'race') &&
    matchesRequirement(trait.classes, classAbbrev, 'class')
  );
}

/** @param {string} category @param {string | null} raceName @param {string | null} className */
export function getAvailableTraits(category, raceName, className) {
  const raceAbbrev = getRaceAbbrev(raceName);
  const classAbbrev = getClassAbbrev(className);
  const list = traits[category] ?? [];
  const available = list.filter((trait) => isTraitAvailable(trait, raceAbbrev, classAbbrev));
  return sortTraitsForPicker(category, available);
}

/** @param {Record<string, number | null> | null} baseStats @param {Record<string, number>} allocation @param {Record<string, number>} [traitBonuses] */
export function computeFinalStats(baseStats, allocation = {}, traitBonuses = {}) {
  /** @type {Record<string, number | null>} */
  const finalStats = {};
  for (const key of statKeys) {
    const base = baseStats?.[key];
    const bonus = allocation[key] ?? 0;
    const traitBonus = traitBonuses[key] ?? 0;
    if (base == null) {
      finalStats[key] = null;
    } else {
      finalStats[key] = base + bonus + traitBonus;
    }
  }
  return finalStats;
}

/** @param {Record<string, number>} allocation */
export function getRemainingPoints(allocation) {
  const spent = statKeys.reduce((sum, key) => sum + (allocation[key] ?? 0), 0);
  return statPointBudget - spent;
}

/** @param {string | null} raceName @param {string | null} className */
export function getRacialAbilityForCombo(raceName, className) {
  if (!raceName) return null;
  const race = races.find((entry) => entry.name === raceName);
  return race?.racialAbility ?? null;
}

/** @param {string | null} className */
export function buildClassComparison(className) {
  return getRacesForClass(className)
    .map((raceName) => {
      const race = races.find((entry) => entry.name === raceName);
      const stats = getStartingStats(raceName, className);
      return {
        raceName,
        abbrev: getRaceAbbrev(raceName),
        alignment: race?.alignment ?? null,
        resistances: race?.resistances ?? null,
        racialAbility: race?.racialAbility ?? null,
        stats,
      };
    })
    .filter((row) => row.stats);
}

/** @param {string | null} raceName */
export function buildRaceComparison(raceName) {
  return getClassesForRace(raceName).map((className) => {
    const cls = classes.find((entry) => entry.name === className);
    return {
      className,
      abbrev: getClassAbbrev(className),
      role: cls?.role ?? null,
      armor: cls?.armor ?? null,
      pet: cls?.pet ?? false,
      stats: getStartingStats(raceName, className),
    };
  });
}

const STORAGE_KEY = 'mnm-character-creator';

/** @returns {object | null} */
export function loadSavedBuild() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** @param {object} build */
export function saveBuild(build) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(build));
}

/** @param {Record<string, number | null> | null | undefined} stats @param {Record<string, number> | null | undefined} statModifiers */
export function computeClassFitScore(stats, statModifiers) {
  if (!stats || !statModifiers) return null;

  let score = 0;
  let hasValue = false;

  for (const key of statKeys) {
    const modifier = statModifiers[key] ?? 0;
    const value = stats[key];
    if (modifier > 0 && value != null) {
      score += value * modifier;
      hasValue = true;
    }
  }

  return hasValue ? score : null;
}

/** @param {object[]} rows @param {string} stat */
export function getStatHighlights(rows, stat) {
  const values = rows.map((row) => row.stats?.[stat]).filter((value) => value != null);
  if (!values.length) return { max: null, min: null };
  return { max: Math.max(...values), min: Math.min(...values) };
}
