import * as cheerio from 'cheerio';

// Match skill-table cells, never mentions in spell descriptions or equipment.
export function parseDefensiveSkills(html) {
  const dom = cheerio.load(html);
  const found = new Set();
  let hasSkillTable = false;
  dom('table').each((_, table) => {
    const rows = dom(table).find('tr');
    const headers = rows.first().find('th, td').map((_, cell) => dom(cell).text().trim()).get();
    const skillIndex = headers.indexOf('Skill');
    if (skillIndex < 0 || !headers.includes('Level')) return;
    hasSkillTable = true;
    rows.slice(1).each((_, row) => {
      const name = dom(row).find('td').eq(skillIndex).text().trim();
      if (['Parry', 'Dodge', 'Block'].includes(name)) found.add(name);
    });
  });
  if (!hasSkillTable) throw new Error('No class skill table found; defensive availability is unknown');
  return ['Parry', 'Dodge', 'Block'].filter((name) => found.has(name));
}
