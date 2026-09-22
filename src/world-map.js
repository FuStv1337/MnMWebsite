import './style.css';
import './world-map.css';
import { renderSiteHeader } from './site-header.js';
import { sitePath } from './site-paths.js';
import { zones, connections } from './world-map-data.js';
import { layoutMapConnections } from './map-connections.js';
import maps from '../data/zone-maps.json';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = new Map(zones.map(z => [z.id, z]));
const symbols = { boat: '⚓', wizard: '▲', druid: '☾' };
let selected = null;
let camera = { x: 0, y: 0, scale: 1 };
let dimensions = { width: 1580, height: 1400 };
let overviewCamera = null;
let showBoats = true;
let loadVersion = 0;
document.querySelector('#app').innerHTML = `${renderSiteHeader({ active: 'map', tagline: 'Explore the world of Aêthoril' })}
<main class="atlas">
  <div class="atlas-heading"><div><p class="eyebrow">THE EXPLORER’S ATLAS</p><h1>World map</h1><p>Follow the paths. Discover what lies beyond.</p></div><span class="atlas-count">22 zones · 3 regions</span></div>
  <div class="atlas-layout">
    <aside class="atlas-sidebar"><label class="search-label" for="zone-search">Find a destination</label><input id="zone-search" type="search" placeholder="Search zones…" autocomplete="off" /><div id="zone-list"></div><div class="atlas-legend"><h2>Map key</h2><p><i class="key outdoor"></i> Outdoor zone <i class="key indoor"></i> Indoor zone</p><p><i class="key module"></i> Module 1 zone (reference)</p><p><span class="wizard">▲</span> Wizard portal <span class="druid">☾</span> Druid portal</p><label><input id="boat-toggle" type="checkbox" checked /> <span class="boat">⚓</span> Boat routes & stops</label></div></aside>
    <section class="atlas-main" aria-label="Interactive map">
      <div class="atlas-toolbar"><div class="breadcrumbs"><button id="world-button">World</button><span id="breadcrumb"> / All regions</span></div><span id="view-status" role="status"></span></div>
      <div id="map-viewport" tabindex="0" aria-label="Map. Use arrow keys to pan, plus and minus to zoom, and zero to fit."><svg id="map-svg" xmlns="http://www.w3.org/2000/svg" aria-label="World zones"><g id="map-scene"></g></svg><div id="map-message" role="status" hidden></div><div class="map-controls"><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button><button id="fit-map" aria-label="Fit map">⛶</button></div><div class="map-hint">Drag to explore · Scroll or pinch to zoom</div></div>
      <div id="zone-details" aria-live="polite"></div>
    </section>
  </div>
  <p class="atlas-footnote">Connections follow the supplied reference diagram and are schematic. Detailed maps are community contributions from the Monsters & Memories Wiki; availability and in-game geography may change.</p>
</main>`;
const viewport = document.querySelector('#map-viewport');
const scene = document.querySelector('#map-scene');
const status = document.querySelector('#view-status');
const message = document.querySelector('#map-message');
const details = document.querySelector('#zone-details');
const travel = document.createElement('nav');
travel.className = 'map-travel';
travel.setAttribute('aria-label', 'Travel to a connected zone');
travel.hidden = true;
viewport.append(travel);

function renderTravel(zone) {
  travel.hidden = !zone;
  viewport.classList.toggle('has-zone', Boolean(zone));
  document.querySelector('#world-button').textContent = zone ? '← Back to world map' : 'World map';
  if (!zone) { travel.innerHTML = ''; return; }
  travel.innerHTML = '<button class="map-return" data-world>← Back to world map</button>';
}

function drawZone(zone, asset) {
  const width = asset?.width || 1000, height = asset?.height || 800;
  const destinations = new Map();
  for (const edge of connections) {
    if (edge.from !== zone.id && edge.to !== zone.id) continue;
    const id = edge.from === zone.id ? edge.to : edge.from;
    if (!destinations.has(id)) destinations.set(id, new Set());
    destinations.get(id).add(edge.type);
  }
  const layout = layoutMapConnections(zone, [...destinations.keys()].map(id => byId.get(id)), width, height);
  dimensions = layout.bounds;
  const u = layout.unit;
  scene.innerHTML = `<rect class="detail-map-border" width="${width}" height="${height}"/>${asset ? `<image class="detail-map-image" href="${sitePath(asset.path)}" width="${width}" height="${height}" role="img" aria-label="${escape(zone.name)} detailed community map"/>` : ''}
    <g class="map-connections" role="group" aria-label="Travel to a connected zone">${layout.nodes.map(node => {
      const { destination, direction } = node;
      const modes = [...destinations.get(destination.id)].map(type => type === 'boat' ? '⚓ Boat' : 'Land').join(' · ');
      const label = lines(destination.name);
      return `<line class="map-connection-line" x1="${node.anchorX}" y1="${node.anchorY}" x2="${node.endX}" y2="${node.endY}"/>
        <circle class="map-connection-anchor" cx="${node.anchorX}" cy="${node.anchorY}" r="${5*u}"/>
        <g class="map-connection-node" data-zone="${destination.id}" data-direction="${direction.id}" role="button" tabindex="0" aria-label="Travel to ${escape(destination.name)}" transform="translate(${node.x} ${node.y}) scale(${u})">
          <title>${direction.label} of ${escape(zone.name)} · ${modes}</title><rect width="260" height="140" rx="12"/>
          <text class="connection-direction" x="130" y="25">${direction.arrow} ${direction.label}</text>
          <text class="connection-name" x="130" y="${70-(label.length-1)*12}">${label.map((part,i) => `<tspan x="130" dy="${i ? 24 : 0}">${escape(part)}</tspan>`).join('')}</text>
          <text class="connection-mode" x="130" y="113">${modes}</text>${maps[destination.id] ? '' : '<text class="connection-mode" x="130" y="131">Map unavailable</text>'}
        </g>`;
    }).join('')}</g>`;
}

function renderList() {
  const query = document.querySelector('#zone-search').value.trim().toLowerCase();
  document.querySelector('#zone-list').innerHTML = ['Calafrey', 'Szuur', 'The Deep'].map(region => {
    const matches = zones.filter(z => z.region === region && `${z.name} ${z.region}`.toLowerCase().includes(query));
    return matches.length ? `<section class="zone-group"><h2>${region}<span>${matches.length}</span></h2>${matches.map(z => `<button class="zone-link ${selected?.id === z.id ? 'selected' : ''}" data-zone="${z.id}" ${selected?.id === z.id ? 'aria-current="true"' : ''}><i class="key ${z.type}"></i><span>${escape(z.name)}</span><small>${maps[z.id] ? '↗' : '—'}</small></button>`).join('')}</section>` : '';
  }).join('') || '<p class="no-results">No zones match your search.</p>';
}

function applyCamera() {
  scene.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.scale})`);
  status.textContent = `${Math.round(camera.scale * 100)}%`;
}
function fit() {
  const scale = Math.min((viewport.clientWidth - 50) / dimensions.width, (viewport.clientHeight - (selected ? 120 : 50)) / dimensions.height);
  camera = { scale, x: (viewport.clientWidth - dimensions.width * scale) / 2 - (dimensions.x || 0) * scale, y: (viewport.clientHeight - dimensions.height * scale) / 2 - (dimensions.y || 0) * scale };
  applyCamera();
}
function zoom(factor, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) {
  const min = Math.min(viewport.clientWidth / dimensions.width, viewport.clientHeight / dimensions.height) * 0.3;
  const next = Math.max(min, Math.min(5, camera.scale * factor));
  const ratio = next / camera.scale;
  camera = { scale: next, x: x - (x - camera.x) * ratio, y: y - (y - camera.y) * ratio };
  applyCamera();
}
function lines(name) {
  const result = [''];
  for (const word of name.split(' ')) {
    if ((result.at(-1) + ' ' + word).trim().length > 16) result.push(word);
    else result[result.length - 1] = (result.at(-1) + ' ' + word).trim();
  }
  return result;
}
function drawWorld() {
  scene.innerHTML = `<rect class="region calafrey" x="10" y="10" width="1090" height="390" rx="20"/><text class="region-title" x="650" y="56">CALAFREY REGION</text>
    <rect class="region szuur" x="10" y="425" width="1090" height="955" rx="20"/><text class="region-title" x="780" y="465">SZUUR REGION</text>
    <rect class="region deep" x="1150" y="170" width="410" height="480" rx="20"/><text class="region-title" x="1180" y="213">THE DEEP</text><text class="region-note" x="1180" y="244">Connections unknown · Module 1</text>
    ${connections.filter(e => showBoats || e.type !== 'boat').map(e => { const a = byId.get(e.from), b = byId.get(e.to); return `<polyline class="route ${e.type}" points="${[[a.x,a.y], ...e.via, [b.x,b.y]].map(p => p.join(',')).join(' ')}"/>`; }).join('')}
    ${zones.map(z => { const label = lines(z.name); return `<g class="zone-node ${z.type}" data-zone="${z.id}" tabindex="0" role="button" aria-label="Open ${escape(z.name)}${maps[z.id] ? ' detailed map' : ', map unavailable'}" transform="translate(${z.x - 70} ${z.y - 70})"><title>${escape(z.name)} — ${maps[z.id] ? 'Open detailed map' : 'Detailed map not yet available'}</title><rect width="140" height="140" rx="9"/>${maps[z.id] ? `<image href="${sitePath(maps[z.id].thumbnail || maps[z.id].path)}" x="3" y="3" width="134" height="134" preserveAspectRatio="xMidYMid slice" opacity="0.22"/>` : ''}<text class="zone-name" x="70" y="${61 - (label.length - 1) * 10}">${label.map((s,i) => `<tspan x="70" dy="${i ? 21 : 0}">${escape(s)}</tspan>`).join('')}</text><text class="zone-availability" x="70" y="111">${maps[z.id] ? 'EXPLORE MAP ↗' : 'MAP UNAVAILABLE'}</text><text class="travel-symbols" x="128" y="133">${z.travel.filter(t => showBoats || t !== 'boat').map(t => symbols[t]).join(' ')}</text></g>`; }).join('')}
    <g class="settlement"><circle cx="280" cy="30" r="34"/><text x="280" y="35">Faelindral</text></g>`;
}
function updateUrl(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set('zone', id); else url.searchParams.delete('zone');
  history.pushState({}, '', url);
}
function world(push = true) {
  loadVersion++;
  selected = null;
  renderTravel(null);
  dimensions = { width: 1580, height: 1400 };
  document.querySelector('#breadcrumb').textContent = ' / All regions';
  message.hidden = true;
  drawWorld();
  if (overviewCamera) { camera = { ...overviewCamera }; applyCamera(); } else fit();
  details.innerHTML = '<div><p class="eyebrow">CHOOSE YOUR NEXT DESTINATION</p><h2>A connected world, waiting to be explored.</h2><p>Select a square to open its detailed map. Use the zone list to find any destination.</p></div><span class="detail-count">16 detailed maps</span>';
  renderList();
  if (push) updateUrl(null);
}
function openZone(id, push = true) {
  const zone = byId.get(id);
  if (!zone) return world(false);
  if (!selected) overviewCamera = { ...camera };
  selected = zone;
  renderTravel(zone);
  const version = ++loadVersion;
  const asset = maps[id];
  document.querySelector('#breadcrumb').textContent = ` / ${zone.region} / ${zone.name}`;
  const neighbors = connections.filter(e => e.from === id || e.to === id);
  details.innerHTML = `<div class="zone-summary"><p class="eyebrow">${escape(zone.region)} · ${zone.type === 'module' ? 'MODULE 1 (REFERENCE)' : zone.type.toUpperCase() + ' ZONE'}</p><h2>${escape(zone.name)}</h2><p>${zone.travel.map(t => `${symbols[t]} ${t === 'boat' ? 'Boat stop' : t + ' portal'}`).join(' · ') || 'Explore connected destinations below.'}</p>${asset ? `<a href="${escape(asset.source)}" target="_blank" rel="noopener noreferrer">Map source & credits ↗</a> · <a href="${escape(asset.page)}" target="_blank" rel="noopener noreferrer">Zone wiki ↗</a>` : ''}</div><div class="zone-connections"><h3>Connected zones</h3><div>${neighbors.map(e => { const z = byId.get(e.from === id ? e.to : e.from); return `<button data-zone="${z.id}">${e.type === 'boat' ? '⚓ ' : ''}${escape(z.name)} <span>↗</span></button>`; }).join('') || '<p>No known connections in the reference.</p>'}</div></div>`;
  drawZone(zone, asset);
  message.hidden = false;
  message.textContent = asset ? 'Loading detailed map…' : 'A detailed map is not available for this zone yet. Explore a connected zone or return to the world map.';
  fit();
  if (asset) {
    const img = new Image();
    img.onload = () => {
      if (version !== loadVersion) return;
      message.hidden = true;
    };
    img.onerror = () => { if (version === loadVersion) message.textContent = 'This map could not be loaded. Try reopening the zone or use the map source link below.'; };
    img.src = sitePath(asset.path);
  }
  renderList();
  if (push) updateUrl(id);
}
document.querySelector('#zone-search').addEventListener('input', renderList);
document.querySelector('#world-button').addEventListener('click', () => world());
travel.addEventListener('click', e => { if (e.target.closest('[data-world]')) world(); });
// Keep navigation controls independent of map gestures, including after dragging.
travel.addEventListener('pointerdown', e => e.stopPropagation());
travel.addEventListener('wheel', e => e.stopPropagation());
travel.addEventListener('keydown', e => e.stopPropagation());
document.querySelector('#boat-toggle').addEventListener('change', e => { showBoats = e.target.checked; if (!selected) drawWorld(); });
document.querySelector('#zoom-in').addEventListener('click', () => zoom(1.4));
document.querySelector('#zoom-out').addEventListener('click', () => zoom(1 / 1.4));
document.querySelector('#fit-map').addEventListener('click', fit);
let moved = false;
document.querySelector('.atlas').addEventListener('click', e => { const target = e.target.closest('[data-zone]'); if (target && !(scene.contains(target) && moved)) openZone(target.dataset.zone); });
viewport.addEventListener('wheel', e => { e.preventDefault(); const rect = viewport.getBoundingClientRect(); zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top); }, { passive: false });
const pointers = new Map();
let previous = null;
function gesture() {
  const ps = [...pointers.values()];
  return { x: ps.reduce((a,p) => a+p.x,0)/ps.length, y: ps.reduce((a,p) => a+p.y,0)/ps.length, distance: ps.length > 1 ? Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y) : 0 };
}
viewport.addEventListener('pointerdown', e => {
  if (e.target.closest('button') || e.button !== 0) return;
  if (!pointers.size) moved = false;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); previous = gesture();
});
viewport.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const next = gesture();
  if (!moved && Math.hypot(next.x - previous.x, next.y - previous.y) < 4 && pointers.size === 1) return;
  moved = true;
  viewport.setPointerCapture(e.pointerId);
  camera.x += next.x - previous.x; camera.y += next.y - previous.y;
  if (next.distance && previous.distance) { const rect = viewport.getBoundingClientRect(); zoom(next.distance / previous.distance, next.x - rect.left, next.y - rect.top); } else applyCamera();
  previous = next;
});
function release(e) { pointers.delete(e.pointerId); previous = pointers.size ? gesture() : null; }
window.addEventListener('pointerup', release);
viewport.addEventListener('pointercancel', release);
viewport.addEventListener('keydown', e => {
  const node = e.target.closest('[data-zone]');
  if (node && ['Enter', ' '].includes(e.key)) { e.preventDefault(); openZone(node.dataset.zone); return; }
  if (e.target.closest('button')) return;
  if (['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) e.preventDefault();
  if (e.key === '+' || e.key === '=') zoom(1.4);
  if (e.key === '-') zoom(1/1.4);
  if (e.key === '0') fit();
  if (e.key === 'Escape') world();
  if (e.key.startsWith('Arrow')) { camera.x += e.key === 'ArrowLeft' ? 60 : e.key === 'ArrowRight' ? -60 : 0; camera.y += e.key === 'ArrowUp' ? 60 : e.key === 'ArrowDown' ? -60 : 0; applyCamera(); }
});
window.addEventListener('popstate', () => { const id = new URLSearchParams(location.search).get('zone'); id ? openZone(id, false) : world(false); });
new ResizeObserver(() => { overviewCamera = null; fit(); }).observe(viewport);
world(false);
const initial = new URLSearchParams(location.search).get('zone');
if (initial) openZone(initial, false);

