export const TAG_LABELS = {
  damage: 'Damage',
  dot: 'DoT',
  heal: 'Heal',
  hot: 'HoT',
  song: 'Song',
  buff: 'Buff',
  debuff: 'Debuff',
  'crowd-control': 'CC',
  stun: 'Stun',
  mez: 'Mez',
  root: 'Root',
  interrupt: 'Interrupt',
  silence: 'Silence',
  fear: 'Fear',
  taunt: 'Taunt',
  shield: 'Shield',
  thorns: 'Thorns',
  dispel: 'Dispel',
  purge: 'Purge',
  cure: 'Cure',
  summon: 'Summon',
  portal: 'Portal',
  escape: 'Escape',
  teleport: 'Teleport',
  invisibility: 'Invis',
  resurrection: 'Rez',
  stance: 'Stance',
  slow: 'Slow',
  haste: 'Haste',
  exhaust: 'Exhaust',
  movement: 'Movement',
  utility: 'Utility',
  self: 'Self',
  pet: 'Pet',
  charm: 'Charm',
  aoe: 'AOE',
  'mana-drain': 'Mana Drain',
};

export const STAT_FILTER_GROUPS = [
  {
    id: 'attributes',
    label: 'Attributes',
    color: '#c9785a',
    stats: ['STR', 'DEX', 'AGI', 'INT', 'WIS', 'CHA', 'STA'],
  },
  {
    id: 'vitality',
    label: 'Vitality',
    color: '#5ab87a',
    stats: ['MAX HP', 'HP REGEN', 'MANA'],
  },
  {
    id: 'defense',
    label: 'Defense',
    color: '#5aa8c9',
    stats: ['AC', 'BLOCK', 'DEF'],
  },
  {
    id: 'resists',
    label: 'Resists',
    color: '#7a5ae0',
    stats: ['MR', 'FR', 'CR', 'PR', 'DR', 'HR', 'COR', 'ER'],
  },
  {
    id: 'combat',
    label: 'Combat',
    color: '#e0885a',
    stats: ['ATK', 'CAST', 'MS', 'OFF', 'DMG', 'THREAT'],
  },
];

export const STAT_TAGS = STAT_FILTER_GROUPS.flatMap((group) => group.stats);

/** Tags that qualify an entry for the cross-class buffs page (target/group buffs). */
export const BUFF_PAGE_TAGS = ['buff', 'haste', 'shield', 'thorns', 'song'];

export const SHIELD_SECTION = 'SHIELD';
export const THORNS_SECTION = 'THORNS';
export const SONG_SECTION = 'SONG';

export const STAT_TAG_LABELS = {
  MS: 'Move Speed',
  ATK: 'Attack Speed',
  HR: 'Holy Resist',
  COR: 'Corruption Resist',
  ER: 'Electric Resist',
};

export function statTagLabel(statTag) {
  return STAT_TAG_LABELS[statTag] || statTag;
}

export function getStatFilterGroup(statTag) {
  return STAT_FILTER_GROUPS.find((group) => group.stats.includes(statTag)) || null;
}

export const TAG_COLORS = {
  damage: '#e85555',
  dot: '#e07848',
  aoe: '#d45050',
  heal: '#4cb87a',
  hot: '#42b8a8',
  song: '#d4a830',
  buff: '#4a88e8',
  debuff: '#a858e0',
  'crowd-control': '#8060e0',
  stun: '#e8c040',
  mez: '#9870d8',
  root: '#52a048',
  interrupt: '#d07050',
  silence: '#6888a0',
  fear: '#906878',
  taunt: '#c08850',
  shield: '#3aa8d8',
  thorns: '#7a9858',
  dispel: '#7898b0',
  purge: '#b87898',
  cure: '#58b868',
  summon: '#b89060',
  portal: '#9888d8',
  escape: '#88a8c8',
  teleport: '#5890b8',
  invisibility: '#687888',
  resurrection: '#d8c050',
  stance: '#b87848',
  slow: '#6090b0',
  haste: '#e8b840',
  exhaust: '#907088',
  movement: '#48b8c8',
  utility: '#889098',
  self: '#a89878',
  pet: '#907860',
  charm: '#a88868',
  'mana-drain': '#6888d8',
};

/** Official class role groupings for party composition. */
export const CLASS_ROLES = {
  tank: {
    id: 'tank',
    label: 'Tank',
    classes: ['Fighter', 'Inquisitor', 'Paladin', 'Shadow Knight'],
    color: TAG_COLORS.taunt,
  },
  healer: {
    id: 'healer',
    label: 'Healer',
    classes: ['Cleric', 'Druid', 'Shaman'],
    color: TAG_COLORS.heal,
  },
  dps: {
    id: 'dps',
    label: 'Damage Dealer',
    classes: [
      'Archer',
      'Beastmaster',
      'Elementalist',
      'Monk',
      'Necromancer',
      'Ranger',
      'Rogue',
      'Spellblade',
      'Wizard',
    ],
    color: TAG_COLORS.damage,
  },
  support: {
    id: 'support',
    label: 'Support',
    classes: ['Bard', 'Enchanter'],
    color: TAG_COLORS.buff,
  },
};

/** @type {Map<string, string>} */
const classRoleMap = new Map(
  Object.values(CLASS_ROLES).flatMap((role) =>
    role.classes.map((className) => [className, role.id])
  )
);

/** @param {string} className */
export function getClassRole(className) {
  return classRoleMap.get(className) || null;
}

/** @param {string} roleId */
export function getRoleDefinition(roleId) {
  return CLASS_ROLES[roleId] || null;
}

/** @param {string} className */
export function getClassRoleLabel(className) {
  const roleId = getClassRole(className);
  return roleId ? CLASS_ROLES[roleId].label : null;
}

/** Non-stat sections shown after stat groups on the buffs page. */
export const BUFF_SPECIAL_SECTIONS = [
  {
    id: SHIELD_SECTION,
    label: 'Absorb Shields',
    color: TAG_COLORS.shield,
    subtitle: 'Damage absorption',
  },
  {
    id: THORNS_SECTION,
    label: 'Thorns',
    color: TAG_COLORS.thorns,
    subtitle: 'Retaliation on hit',
  },
  {
    id: SONG_SECTION,
    label: 'Songs',
    color: TAG_COLORS.song,
    subtitle: 'Group songs',
  },
];

/** @type {Map<string, string>} */
const statColorMap = new Map(
  STAT_FILTER_GROUPS.flatMap((group) => group.stats.map((stat) => [stat, group.color]))
);

export function getStatFilterColor(statTag) {
  return statColorMap.get(statTag) || STAT_TAG_COLOR;
}

export function getBuffSectionLabel(sectionTag) {
  if (isStatTag(sectionTag)) return statTagLabel(sectionTag);
  const special = BUFF_SPECIAL_SECTIONS.find((section) => section.id === sectionTag);
  return special?.label || sectionTag;
}

export function getBuffSectionColor(sectionTag) {
  if (isStatTag(sectionTag)) return getStatFilterColor(sectionTag);
  const special = BUFF_SPECIAL_SECTIONS.find((section) => section.id === sectionTag);
  return special?.color || STAT_TAG_COLOR;
}

export function getBuffSectionSubtitle(sectionTag) {
  if (isStatTag(sectionTag)) return 'Buffs';
  const special = BUFF_SPECIAL_SECTIONS.find((section) => section.id === sectionTag);
  return special?.subtitle || 'Buffs';
}

/**
 * Quick filter groups — each button matches any spell carrying one of its member tags.
 * @type {{ id: string, label: string, tags: string[], color: string }[]}
 */
export const QUICK_TAG_GROUPS = [
  { id: 'damage', label: 'Damage', tags: ['damage', 'dot', 'aoe'], color: TAG_COLORS.damage },
  { id: 'heal', label: 'Heal', tags: ['heal', 'hot'], color: TAG_COLORS.heal },
  {
    id: 'buff',
    label: 'Buff',
    tags: ['buff', 'shield', 'thorns', 'haste', 'stance', 'self'],
    color: TAG_COLORS.buff,
  },
  {
    id: 'debuff',
    label: 'Debuff',
    tags: ['debuff', 'slow', 'exhaust', 'mana-drain'],
    color: TAG_COLORS.debuff,
  },
  {
    id: 'crowd-control',
    label: 'CC',
    tags: ['crowd-control', 'stun', 'mez', 'root', 'fear', 'silence'],
    color: TAG_COLORS['crowd-control'],
  },
  { id: 'interrupt', label: 'Interrupt', tags: ['interrupt'], color: TAG_COLORS.interrupt },
  { id: 'taunt', label: 'Taunt', tags: ['taunt'], color: TAG_COLORS.taunt },
  { id: 'pet', label: 'Pet', tags: ['pet', 'charm', 'summon'], color: TAG_COLORS.pet },
  { id: 'song', label: 'Song', tags: ['song'], color: TAG_COLORS.song },
  {
    id: 'utility',
    label: 'Utility',
    tags: ['utility', 'dispel', 'purge', 'cure', 'portal', 'escape', 'teleport', 'invisibility', 'resurrection', 'movement'],
    color: TAG_COLORS.utility,
  },
];

/** @param {{ tags: string[] }} group @param {{ tag: string }[]} availableTags */
export function getQuickGroupMemberTags(group, availableTags) {
  const available = new Set(availableTags.map(({ tag }) => tag));
  return group.tags.filter((tag) => available.has(tag));
}

/** @param {{ tags: string[] }} group @param {{ tag: string }[]} availableTags @param {Set<string>} selectedTags */
export function isQuickGroupActive(group, availableTags, selectedTags) {
  const members = getQuickGroupMemberTags(group, availableTags);
  if (!members.length) return false;
  return members.every((tag) => selectedTags.has(tag));
}

/** @param {{ tags: string[] }} group @param {{ tag: string }[]} availableTags @param {Set<string>} selectedTags */
export function toggleQuickGroup(group, availableTags, selectedTags) {
  const members = getQuickGroupMemberTags(group, availableTags);
  const allActive = members.every((tag) => selectedTags.has(tag));
  for (const tag of members) {
    if (allActive) selectedTags.delete(tag);
    else selectedTags.add(tag);
  }
}

/** @param {{ tags: string[] }} group @param {{ tag: string }[]} availableTags */
export function quickGroupHint(group, availableTags) {
  const members = getQuickGroupMemberTags(group, availableTags);
  const extras = members.slice(1).map(tagLabel);
  return extras.length ? extras.join(', ') : '';
}

/** @param {{ tags: string[] }} group @param {{ tag: string }[]} availableTags */
export function quickGroupTitle(group, availableTags) {
  return getQuickGroupMemberTags(group, availableTags).map(tagLabel).join(', ');
}

/** Flat display order derived from quick filter groups. */
export const TAG_DISPLAY_ORDER = QUICK_TAG_GROUPS.flatMap((group) => group.tags);

/** @type {Map<string, number>} */
const tagDisplayIndex = new Map(TAG_DISPLAY_ORDER.map((tag, index) => [tag, index]));

/** @param {string} tag */
export function getTagDisplayIndex(tag) {
  return tagDisplayIndex.has(tag) ? tagDisplayIndex.get(tag) : 999;
}

/** @param {string} tag */
export function getTagColor(tag) {
  if (isStatTag(tag)) return getStatFilterColor(tag);
  return TAG_COLORS[tag] || '#888';
}

/**
 * Sort tags for display: primary first, then logical category order.
 * @param {string[]} tags
 * @param {string | null | undefined} [primaryTag]
 */
export function sortDisplayTags(tags, primaryTag = null) {
  return [...tags].sort((a, b) => {
    if (a === primaryTag) return -1;
    if (b === primaryTag) return 1;
    const indexDiff = getTagDisplayIndex(a) - getTagDisplayIndex(b);
    if (indexDiff !== 0) return indexDiff;
    return a.localeCompare(b);
  });
}

/** @param {{ tag: string, count: number }[]} availableTags */
export function sortAvailableTags(availableTags) {
  return [...availableTags].sort((a, b) => {
    const indexDiff = getTagDisplayIndex(a.tag) - getTagDisplayIndex(b.tag);
    if (indexDiff !== 0) return indexDiff;
    return a.tag.localeCompare(b.tag);
  });
}

export const STAT_TAG_COLOR = '#7a8a9a';

export const SORT_OPTIONS = [
  { value: 'level-asc', label: 'Level (low → high)' },
  { value: 'level-desc', label: 'Level (high → low)' },
  { value: 'name-asc', label: 'Name (A → Z)' },
  { value: 'name-desc', label: 'Name (Z → A)' },
  { value: 'mana-asc', label: 'Mana (low → high)' },
  { value: 'mana-desc', label: 'Mana (high → low)' },
  { value: 'cast-asc', label: 'Cast time (fast → slow)' },
  { value: 'cast-desc', label: 'Cast time (slow → fast)' },
  { value: 'value-desc', label: 'Value (high → low)' },
  { value: 'value-asc', label: 'Value (low → high)' },
];

export function tagLabel(tag) {
  return TAG_LABELS[tag] || tag;
}

export function isStatTag(tag) {
  return STAT_TAGS.includes(tag);
}
