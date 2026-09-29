import './style.css';
import './racials.css';
import { renderSiteHeader } from './site-header.js';
import data from '../data/racials.json';
import raceData from '../data/races.json';

const classesByRace = new Map(raceData.races.map(race => [race.id, race.classes]));
function availableClasses(race) {
  const classes = classesByRace.get(race.id) || [];
  return `<div class="trait-classes"><span>Available classes</span><ul aria-label="${escape(race.name)} available classes">${classes.map(name => `<li>${escape(name)}</li>`).join('')}</ul></div>`;
}

const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const params = new URLSearchParams(location.search);
let selected = data.races.some(r => r.id === params.get('race')) ? params.get('race') : 'all';
let query = params.get('q') || '';
function effects(nodes) {
  return `<ul class="trait-effects">${nodes.map(n => `<li><span class="${/activat|ability:/i.test(n.text) ? 'trait-ability' : ''}">${escape(n.text)}</span>${n.children.length ? effects(n.children) : ''}</li>`).join('')}</ul>`;
}
function cards(nodes, kind) {
  return nodes.map((node, i) => `<article class="trait-card ${kind}"><div class="trait-card-label">${kind === 'innate' ? 'Innate' : kind === 'background' ? `Background 0${i + 1}` : 'Optional personality'}</div><h4>${escape(node.text)}</h4>${effects(node.children)}</article>`).join('');
}
document.querySelector('#app').innerHTML = `${renderSiteHeader({ active: 'racials', tagline: 'A field guide to your next character' })}
<main class="racials-page">
  <section class="traits-hero"><div><p class="traits-eyebrow">CHARACTER FIELD GUIDE · SEPTEMBER 29, 2026</p><h1>Roots, gifts &amp; possibilities.</h1><p class="traits-intro">Explore the new racial traits. Find your natural advantages, then discover the background that makes your character yours.</p><a href="${data.source}" target="_blank" rel="noopener noreferrer">Read the official preview ↗</a></div><div class="traits-total"><strong>9</strong><span>races to explore</span><small>27 innates · 27 backgrounds</small></div></section>
  <aside class="traits-notice"><strong>Design preview — not yet implemented at publication.</strong> These are proposed traits, with values and effects subject to change. The developers plan to let players reselect traits when the revamp goes live.</aside>
  <div class="traits-toolbar"><label for="trait-search">Search races, traits &amp; effects<input id="trait-search" type="search" placeholder="Try: infravision, fishing, fear…" value="${escape(query)}"></label><button type="button" id="trait-reset">Reset filters</button><p id="trait-count" role="status" aria-live="polite"></p></div>
  <nav class="race-pills" aria-label="Filter racial traits"><button data-race="all">All races</button>${data.races.map(r => `<button data-race="${r.id}">${r.name}</button>`).join('')}</nav>
  <div id="trait-results"></div>
  <section class="traits-personalities"><h2>A little more personality</h2><p>Optional examples from the preview. Availability depends on race and class; “Bland” carries no bonuses or penalties.</p><div class="traits-grid">${cards(data.personalities, 'personality')}</div></section>
  <aside class="traits-more"><h2>Beyond your background</h2><p><strong>Vision:</strong> Ultravision is unchanged. Infravision is planned as an activated ability, with additional effects such as highlighting warm-blooded creatures.</p><p><strong>Starting boons:</strong> Choose a starting item independently of trait bonuses and penalties. Specific boon options are not listed in this preview.</p><p><strong>Progression:</strong> Earn further traits through quests as you level, with possible race, class or prerequisite restrictions.</p></aside>
  <footer>Transcribed from the <a href="${data.source}">official September 29 traits preview</a>. Original wording and unresolved values are retained. Search filters racial entries; personality examples remain below.</footer>
</main>`;
function render() {
  const q = query.trim().toLowerCase();
  const visible = data.races.filter(r => (selected === 'all' || r.id === selected) && JSON.stringify(r).toLowerCase().includes(q));
  document.querySelector('#trait-count').textContent = `${visible.length} of ${data.races.length} races shown`;
  document.querySelectorAll('[data-race]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.race === selected)));
  document.querySelector('#trait-results').innerHTML = visible.length ? visible.map(r => `<section class="race-section" id="${r.id}"><header class="race-heading"><div><p class="traits-eyebrow">RACIAL TRAITS</p><h2>${r.name}${r.wip ? ' <span class="trait-wip">WIP</span>' : ''}</h2></div><a href="?race=${r.id}">Link to race ↗</a></header>${availableClasses(r)}${r.id === 'gnome' ? '<p class="trait-source-note">Source note: Gnome of the Forest lists both +1 Stamina and −1 Stamina. Both are preserved pending clarification.</p>' : ''}${r.id === 'ogre' || r.id === 'dwarf' ? '<p class="trait-source-note">Some ability values are unspecified in the preview; no values have been assumed.</p>' : ''}<h3>Born with it <span>All three innates</span></h3><div class="traits-grid">${cards(r.innates, 'innate')}</div><h3>Choose your story <span>Pick one background</span></h3><div class="traits-grid">${cards(r.backgrounds, 'background')}</div></section>`).join('') : '<div class="traits-empty"><h2>No matching races</h2><p>Try a broader search or reset the filters.</p></div>';
  const url = new URL(location.href);
  selected === 'all' ? url.searchParams.delete('race') : url.searchParams.set('race', selected);
  query ? url.searchParams.set('q', query) : url.searchParams.delete('q');
  history.replaceState(null, '', url);
}
document.querySelector('#trait-search').addEventListener('input', event => { query = event.target.value; render(); });
document.querySelector('.race-pills').addEventListener('click', event => { const button = event.target.closest('[data-race]'); if (button) { selected = button.dataset.race; render(); } });
document.querySelector('#trait-reset').addEventListener('click', () => { selected = 'all'; query = ''; document.querySelector('#trait-search').value = ''; render(); });
render();
