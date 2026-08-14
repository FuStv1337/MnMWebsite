import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ALL_TAGS } from './classify-spell.mjs';
import { classifySpell } from './classify-spell.mjs';
import { withEffects } from './parse-effects.mjs';
import { enrichEntry, finalizeTags } from './enrich-entry.mjs';
import {
  buildCanonicalDescriptionMap,
  withCanonicalDescription,
} from './resolve-canonical.mjs';

const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));

/**
 * @param {object} entry
 * @param {string} className
 */
function enrichClassEntry(entry, className) {
  return enrichEntry(entry, className);
}

/**
 * @param {object} classData
 * @param {Map<string, string>} canonicalMap
 */
function normalizeClassData(classData, canonicalMap) {
  const normalize = (entry) => withCanonicalDescription(entry, canonicalMap);

  classData.entries = classData.entries.map(normalize).map((entry) => enrichClassEntry(entry, classData.className));

  for (const level of Object.keys(classData.entriesByLevel)) {
    classData.entriesByLevel[level] = classData.entriesByLevel[level]
      .map(normalize)
      .map((entry) => enrichClassEntry(entry, classData.className));
  }

  return classData;
}

/**
 * @param {string} filePath
 * @param {Map<string, string>} canonicalMap
 */
async function tagClassFile(filePath, canonicalMap) {
  const raw = await readFile(filePath, 'utf8');
  const classData = JSON.parse(raw);
  normalizeClassData(classData, canonicalMap);
  await writeFile(filePath, `${JSON.stringify(classData, null, 2)}\n`, 'utf8');
  return classData.entryCount;
}

/**
 * @param {string} filePath
 * @param {Map<string, string>} canonicalMap
 */
async function tagSpellsIndex(filePath, canonicalMap) {
  const raw = await readFile(filePath, 'utf8');
  const spells = JSON.parse(raw);

  for (const key of Object.keys(spells)) {
    const spell = spells[key];
    const canonical = canonicalMap.get(spell.slug || key) || spell.description;
    spell.description = canonical;

    const { tags, primaryTag } = classifySpell(spell.description || '', spell.name || '', {
      category: spell.category,
      className: spell.classes?.[0]?.className,
    });
    const enriched = withEffects({ ...spell, tags, primaryTag });
    const finalized = finalizeTags(tags, enriched.statTags, enriched.effects);
    spell.effects = enriched.effects;
    spell.valuesSummary = enriched.valuesSummary;
    spell.statTags = finalized.statTags;
    spell.tags = finalized.tags;
    spell.primaryTag = primaryTag;
  }

  await writeFile(filePath, `${JSON.stringify(spells, null, 2)}\n`, 'utf8');
  return Object.keys(spells).length;
}

async function main() {
  const classesDir = path.join(DATA_DIR, 'classes');
  const classFiles = (await readdir(classesDir)).filter((f) => f.endsWith('.json'));

  /** @type {object[]} */
  const allEntries = [];
  for (const file of classFiles) {
    const classData = JSON.parse(await readFile(path.join(classesDir, file), 'utf8'));
    allEntries.push(...(classData.entries || []));
  }

  const canonicalMap = buildCanonicalDescriptionMap(allEntries);
  let normalizedCount = 0;
  for (const entry of allEntries) {
    const canonical = canonicalMap.get(entry.slug);
    if (canonical && canonical !== entry.description) normalizedCount++;
  }

  console.log(`Resolved ${canonicalMap.size} spell descriptions (${normalizedCount} class entries will use a richer variant)`);

  console.log('Tagging class files...');
  let totalEntries = 0;
  for (const file of classFiles) {
    const count = await tagClassFile(path.join(classesDir, file), canonicalMap);
    totalEntries += count;
    console.log(`  ${file}: ${count} entries`);
  }

  console.log('\nTagging spells index...');
  const uniqueCount = await tagSpellsIndex(path.join(DATA_DIR, 'spells', 'index.json'), canonicalMap);

  const metaPath = path.join(DATA_DIR, 'meta.json');
  const meta = JSON.parse(await readFile(metaPath, 'utf8'));
  meta.tags = ALL_TAGS;
  meta.taggedAt = new Date().toISOString();
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  const wizard = JSON.parse(await readFile(path.join(classesDir, 'wizard.json'), 'utf8'));
  const tagCounts = {};
  for (const entry of wizard.entries) {
    for (const tag of entry.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  console.log('\nDone!');
  console.log(`  Tagged ${totalEntries} class entries across ${classFiles.length} classes`);
  console.log(`  Tagged ${uniqueCount} unique spells/abilities`);
  console.log('\nSample tag counts (Wizard):');
  for (const [tag, count] of Object.entries(tagCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tag}: ${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
