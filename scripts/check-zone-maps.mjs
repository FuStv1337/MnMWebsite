import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { zones, connections } from '../src/world-map-data.js';
import { layoutMapConnections } from '../src/map-connections.js';
const maps = JSON.parse(await readFile(new URL('../data/zone-maps.json', import.meta.url)));
const ids = new Set(zones.map(z => z.id));
for (const zone of zones) {
  const asset = maps[zone.id] || { width: 1000, height: 800 };
  const adjacent = new Set(connections.filter(e => e.from === zone.id || e.to === zone.id).map(e => e.from === zone.id ? e.to : e.from));
  const layout = layoutMapConnections(zone, zones.filter(z => adjacent.has(z.id)), asset.width, asset.height);
  assert.equal(layout.nodes.length, adjacent.size);
  for (const node of layout.nodes) {
    assert(node.anchorX === 0 || node.anchorX === asset.width || node.anchorY === 0 || node.anchorY === asset.height, 'Lines must start on the image border');
    assert(node.x + node.width <= 0 || node.x >= asset.width || node.y + node.height <= 0 || node.y >= asset.height, 'Nodes must sit outside the map image');
    assert(node.x >= layout.bounds.x && node.y >= layout.bounds.y, 'Fit bounds include every node');
    assert(node.x + node.width <= layout.bounds.x + layout.bounds.width + 0.001);
    assert(node.y + node.height <= layout.bounds.y + layout.bounds.height + 0.001);
    if (zone.id === 'harbor' && node.destination.id === 'dunes') {
      assert.equal(node.anchorX, 0, 'Shaded Dunes attaches to Night Harbor’s west border');
      assert(node.x + node.width < 0);
    }
  }
}
assert.equal(ids.size, zones.length, 'Zone IDs must be unique');
for (const edge of connections) {
  assert(ids.has(edge.from) && ids.has(edge.to), 'Every connection must reference existing zones');
  assert.notEqual(edge.from, edge.to);
}
for (const [id, asset] of Object.entries(maps)) {
  assert(ids.has(id));
  assert(asset.width > 0 && asset.height > 0);
  assert(asset.source.startsWith('https://monstersandmemories.miraheze.org/wiki/File:'));
  for (const path of [asset.path, asset.thumbnail]) {
    assert(path?.startsWith('maps/') && !path.includes('..'));
    assert((await stat(new URL(`../public/${path}`, import.meta.url))).size > 0);
  }
}
console.log(`Verified ${zones.length} zones, ${connections.length} connections and ${Object.keys(maps).length} local maps with thumbnails and source links.`);
