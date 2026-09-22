import { mkdir, writeFile } from 'node:fs/promises';
import { zones } from '../src/world-map-data.js';
const files = {
  evershade: 'Evershade_Weald_june_26.jpg', keepers: 'Keepersbighteg.png', scarwood: 'Scarwood.png',
  shoals: 'Shallowshoalseg.png', zintar: 'Valeofzintareg.png', glass: 'Glass_Flats_Map.png',
  sungreet: 'Sungreet_Strand_v4.jpg', tel: 'Tel-ekir-isometric.jpg', irem: 'Caves_of_Irem_By_Naawa.png',
  ancient: 'Ancient_Crypt_Map.png', tomb: 'WyrmsbaneCombined_v0.91.png', fallen: 'Fallen_pass_v1.jpg',
  dunes: 'Shaded_Dunes_Map.jpg', harbor: 'Night_harbor_V5.jpg', infested: 'Infested_Crypt_Map.png', underdocks: 'Underdocks_map.png',
};
const base = 'https://monstersandmemories.miraheze.org';
const output = new URL('../public/maps/', import.meta.url);
await mkdir(output, { recursive: true });
const manifest = {};
for (const [id, file] of Object.entries(files)) {
  const params = new URLSearchParams({ action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|size|extmetadata', format: 'json' });
  const res = await fetch(`${base}/w/api.php?${params}`);
  if (!res.ok) throw new Error(`Metadata ${file}: ${res.status}`);
  const json = await res.json();
  const info = Object.values(json.query.pages)[0].imageinfo?.[0];
  if (!info) throw new Error(`Missing file: ${file}`);
  const image = await fetch(info.url);
  if (!image.ok) throw new Error(`Download ${file}: ${image.status}`);
  const path = `${id}.${file.split('.').pop()}`;
  await writeFile(new URL(path, output), Buffer.from(await image.arrayBuffer()));
  manifest[id] = { path: `maps/${path}`, width: info.width, height: info.height, source: info.descriptionurl, original: info.url, page: `${base}/wiki/${encodeURIComponent(zones.find(z => z.id === id).name.replaceAll('’', "'").replaceAll(' ', '_'))}`, metadata: info.extmetadata || {} };
  console.log(`${id}: ${info.width} × ${info.height}`);
}
await writeFile(new URL('../data/zone-maps.json', import.meta.url), JSON.stringify(manifest, null, 2));
