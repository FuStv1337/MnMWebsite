// Named upgrades in the current spell dataset that do not use numbered ranks.
// Keep group versions (Hymn/Communion), distinct targets and unrelated buffs separate.
const upgradeLines = [
  ['Resilience', 'Resolution'],
  ['Hymn of Resilience', 'Hymn of Resolution'],
  ['Blessed Barrier', 'Divine Barrier', 'Devine Barrier'],
  ['Promise of Mending', 'Promise of Renewal'],
  ['Woodskin', 'Stoneskin', 'Steelskin', 'Diamondskin', 'Natureskin'],
  ['Prickly Barrier', 'Bristly Barrier', 'Brambly Barrier', 'Spiky Barrier', 'Thorny Barrier', 'Jagged Barrier'],
  ['Flame Shield', 'Fire Shield', 'Magma Shield', 'Lava Shield', 'Blazing Shield', 'Inferno Shield', 'Firestorm Shield'],
  ['Mind Surge', 'Mana Surge', 'Mental Surge', 'Arcane Surge'],
  ['Berserker Spirit', 'Berserker Rage', 'Berserker Fury', 'Berserker Frenzy', 'Berserkers Wrath'],
  ['Tribal Spirit', 'Tribal Rage', 'Tribal Fury', 'Tribal Frenzy'],
  ['Pact of Haste', 'Rite of Haste'],
  ['Haste', 'Adrenaline', 'Rapidity', 'Zeal', 'Swiftness'],
  ['Tranquility', 'Insight', 'Brilliance', 'Enlightenment'],
  ['Allegro Lento', 'Allegro Moderato', 'Allegro Assai', 'Molto Allegro'],
  ['Holy Fortitude', 'Holy Focus', 'Holy Valor', 'Holy Resilience', 'Holy Resolve'],
  ['Spell Ward', 'Mana Ward', 'Magic Ward', 'Arcane Ward', 'Mystical Ward'],
];

function normalizeRankName(name) {
  return (name || '').replace(/\s+(?:[IVXLCDM]+|\d+)$/i, '')
    .replace(/\b(?:Minor|Lesser|Greater|Exceptional)\s+/gi, '')
    .replace(/\bProtection\b/gi, 'Resistance')
    .replace(/\bElectricity\b/gi, 'Electric')
    .trim().toLowerCase();
}

const aliases = new Map(upgradeLines.flatMap((line) => line.map((name) => [normalizeRankName(name), normalizeRankName(line[0])])));

export function buffLineKey(row) {
  const name = normalizeRankName(row.name);
  return `${row.className}\0${aliases.get(name) || name}`;
}

// Select before aggregating effects so multi-stat spells retain every effect row.
export function highestBuffRanks(rows, levelCap) {
  const available = rows.filter((row) => row.level <= levelCap);
  const winners = new Map();
  for (const row of available) {
    const key = buffLineKey(row);
    const previous = winners.get(key);
    if (!previous || row.level > previous.level) winners.set(key, row);
  }
  return available.filter((row) => {
    const winner = winners.get(buffLineKey(row));
    return row.level === winner.level && row.name === winner.name;
  });
}
