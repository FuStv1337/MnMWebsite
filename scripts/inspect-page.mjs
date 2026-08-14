const page = process.argv[2] || 'Fighter';
const res = await fetch(
  `https://monstersandmemories.miraheze.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&format=json&prop=text`
);
const { parse } = await res.json();
const html = parse.text['*'];

const headings = [...html.matchAll(/<h[12][^>]*id="([^"]*)"[^>]*>([^<]+)/g)].map((m) => ({
  id: m[1],
  text: m[2].trim(),
}));

console.log('Headings:', headings.filter((h) => /spell|ability|level|skill/i.test(h.text)));

const spellSection = html.match(/<h1[^>]*id="[^"]*Spells[^"]*"[\s\S]*?(?=<h1|$)/i)
  || html.match(/<h1[^>]*id="[^"]*Abilities[^"]*"[\s\S]*?(?=<h1 id="Skills|$)/i);

if (spellSection) {
  console.log('\nSection sample:\n', spellSection[0].slice(0, 5000));
}
