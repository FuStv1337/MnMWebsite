import './style.css';
import { sitePath } from './site-paths.js';
import { renderSiteHeader } from './site-header.js';
import meta from '../data/meta.json';
import {
  STAT_FILTER_GROUPS,
  BUFF_SPECIAL_SECTIONS,
  SHIELD_SECTION,
  tagLabel,
  statTagLabel,
  getTagColor,
  getBuffSectionLabel,
  getBuffSectionColor,
  getBuffSectionSubtitle,
  sortDisplayTags,
} from './constants.js';
import {
  loadBuffPageRows,
  filterBuffRows,
  groupBySection,
  getBestValues,
  isBestValue,
  getSectionCounts,
} from './buff-data.js';
import { bindShareControl, readUrlBindings, renderShareControl, syncUrlBindings, urlSerializers } from './url-state.js';

const app = document.querySelector('#app');

/** @type {{ rows: object[], search: string, selectedSection: string | null, expandedRows: Set<string> }} */
const state = {
  rows: [],
  search: '',
  selectedSection: null,
  expandedRows: new Set(),
};

const urlBindings = [
  {
    key: 'search',
    param: 'q',
    get: () => state.search,
    set: (value) => {
      state.search = typeof value === 'string' ? value : '';
    },
    serialize: urlSerializers.string,
  },
  {
    key: 'selectedSection',
    param: 'section',
    get: () => state.selectedSection,
    set: (value) => {
      state.selectedSection = typeof value === 'string' && value ? value : null;
    },
    serialize: urlSerializers.string,
  },
];

function syncUrl() {
  syncUrlBindings(urlBindings);
}

function rowKey(row) {
  return `${row.className}-${row.slug || row.name}-${row.sectionTag}-${row.valueDisplay}`;
}

function renderTagBadge(tag) {
  const color = getTagColor(tag);
  return `<span class="tag-badge" data-tag="${escapeHtml(tag)}" style="--tag-color:${color}" title="${escapeHtml(tagLabel(tag))}">${escapeHtml(tagLabel(tag))}</span>`;
}

function renderTags(row) {
  const tags = sortDisplayTags(row.tags || [], row.primaryTag);
  if (!tags.length) return '';
  return tags.map((tag) => renderTagBadge(tag)).join('');
}

function renderEffectList(row) {
  const effects = row.effects || [];
  if (!effects.length) return '';
  return `
    <ul class="effect-list">
      ${effects.map((e) => `<li class="effect-item effect-item--${e.kind}">${escapeHtml(e.display)}</li>`).join('')}
    </ul>
  `;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMana(mana) {
  if (mana === 'Innate') return '<span class="mana-innate">Innate</span>';
  if (mana === '' || mana == null) return '<span class="muted">—</span>';
  return escapeHtml(String(mana));
}

function renderSectionChip({ section, label, count, color, active }) {
  return `
    <button
      type="button"
      class="stat-nav-chip${active ? ' stat-nav-chip--active' : ''}"
      data-action="select-section"
      data-section="${section}"
      style="--tag-color:${color}"
    >
      ${label}
      <span class="tag-chip-count">${count}</span>
    </button>
  `;
}

function renderSectionNav(sectionCounts, filteredRows) {
  const total = filteredRows.length;
  const allActive = state.selectedSection == null;

  const statGroups = STAT_FILTER_GROUPS.map((group) => {
    const statsInGroup = group.stats.filter((stat) => sectionCounts.has(stat));
    if (!statsInGroup.length) return '';

    return `
      <div class="stat-nav-group" style="--group-color:${group.color}">
        <span class="stat-nav-group-label">${group.label}</span>
        <div class="stat-nav-group-chips">
          ${statsInGroup
            .map((stat) =>
              renderSectionChip({
                section: stat,
                label: statTagLabel(stat),
                count: sectionCounts.get(stat),
                color: group.color,
                active: state.selectedSection === stat,
              })
            )
            .join('')}
        </div>
      </div>
    `;
  }).join('');

  const specialGroups = BUFF_SPECIAL_SECTIONS.filter((section) => sectionCounts.has(section.id))
    .map(
      (section) => `
        <div class="stat-nav-group" style="--group-color:${section.color}">
          <span class="stat-nav-group-label">${section.id === SHIELD_SECTION ? 'Shields' : section.label}</span>
          <div class="stat-nav-group-chips">
            ${renderSectionChip({
              section: section.id,
              label: section.label,
              count: sectionCounts.get(section.id),
              color: section.color,
              active: state.selectedSection === section.id,
            })}
          </div>
        </div>
      `
    )
    .join('');

  return `
    <div class="stat-nav">
      <div class="stat-nav-top">
        <button
          type="button"
          class="stat-nav-chip stat-nav-chip--all${allActive ? ' stat-nav-chip--active' : ''}"
          data-action="select-section"
          data-section=""
          style="--tag-color:#c9a227"
        >
          All sections
          <span class="tag-chip-count">${total}</span>
        </button>
      </div>
      <div class="stat-nav-groups">
        ${statGroups}
        ${specialGroups}
      </div>
    </div>
  `;
}

function renderBuffRow(row, best) {
  const key = rowKey(row);
  const expanded = state.expandedRows.has(key);
  const bestClass = isBestValue(row, best) ? ' buff-row--best' : '';
  const wikiLink = row.wikiUrl
    ? `<a href="${escapeHtml(row.wikiUrl)}" target="_blank" rel="noopener noreferrer" class="wiki-link" title="View on wiki">↗</a>`
    : '';

  return `
    <tr
      class="spell-row buff-row${bestClass}${expanded ? ' spell-row--expanded' : ''}"
      data-action="toggle-row"
      data-key="${escapeHtml(key)}"
      tabindex="0"
      role="button"
      aria-expanded="${expanded}"
    >
      <td class="col-value${bestClass ? ' col-value--best' : ''}">
        <span class="col-value-inner">
          ${bestClass ? '<span class="best-badge" title="Highest value">★</span>' : ''}
          <span class="col-value-text">${escapeHtml(row.valueDisplay)}</span>
        </span>
      </td>
      <td class="col-name">
        <span class="col-name-inner">
          <span class="spell-name">${escapeHtml(row.name)}</span>
          ${wikiLink}
        </span>
      </td>
      <td class="col-class">${escapeHtml(row.className)}</td>
      <td class="col-level">${row.level}</td>
      <td class="col-mana">${renderMana(row.mana)}</td>
      <td class="col-cast">${row.castTime ? escapeHtml(row.castTime) : '<span class="muted">—</span>'}</td>
      <td class="col-location">${escapeHtml(row.location || '—')}</td>
    </tr>
    ${expanded ? `
    <tr class="detail-row">
      <td colspan="7">
        ${renderEffectList(row)}
        ${renderTags(row) ? `<div class="detail-tags">${renderTags(row)}</div>` : ''}
        <p class="spell-description">${escapeHtml(row.description || 'No description available.')}</p>
      </td>
    </tr>` : ''}
  `;
}

function renderSection({ sectionTag, rows }) {
  const best = getBestValues(rows);
  const bestLabels = [];
  if (best.bestFlat != null) bestLabels.push(`${best.bestFlat} flat`);
  if (best.bestPercent != null) bestLabels.push(`${best.bestPercent}%`);

  return `
    <section class="buff-stat-section" id="section-${sectionTag}">
      <div class="buff-stat-header">
        <h2 class="buff-stat-title">
          <span class="stat-title-badge" style="--tag-color:${getBuffSectionColor(sectionTag)}">${getBuffSectionLabel(sectionTag)}</span>
          ${getBuffSectionSubtitle(sectionTag)}
        </h2>
        <span class="buff-stat-meta">
          ${rows.length} entries
          ${bestLabels.length ? ` · Best: <strong>${bestLabels.join(' / ')}</strong>` : ''}
        </span>
      </div>
      <div class="table-wrap">
        <table class="spell-table buff-table">
          <thead>
            <tr>
              <th class="col-value">Value</th>
              <th class="col-name">Name</th>
              <th class="col-class">Class</th>
              <th class="col-level">Lvl</th>
              <th class="col-mana">Mana</th>
              <th class="col-cast">Cast</th>
              <th class="col-location">Location</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => renderBuffRow(row, best)).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function getResultsDetail(sectionCount) {
  if (!state.selectedSection) {
    return `across <strong>${sectionCount}</strong> sections`;
  }
  return `in <strong>${getBuffSectionLabel(state.selectedSection)}</strong>`;
}

function render() {
  const filteredRows = filterBuffRows(state.rows, state.search);
  const sectionCounts = getSectionCounts(filteredRows);
  const sectionGroups = groupBySection(filteredRows).filter(
    (group) => !state.selectedSection || group.sectionTag === state.selectedSection
  );

  const visibleSectionCount = state.selectedSection ? 1 : sectionGroups.length;
  const sections = sectionGroups.map((group) => renderSection(group));

  app.innerHTML = `
    ${renderSiteHeader({ active: 'buffs', tagline: 'Cross-class buff comparison' })}

    <section class="controls card">
      <p class="buff-intro">
        Target and group buffs tagged as ${['buff', 'haste', 'shield', 'thorns', 'song'].join(', ')} — grouped by stat plus absorb shields, thorns, and songs. Self-only and pet effects are excluded. The highest value in each section is highlighted.
      </p>
      <label class="field field--grow">
        <span class="field-label">Search</span>
        <input
          type="search"
          id="search-input"
          class="search-input"
          placeholder="Buff name, class, stat, tag…"
          value="${escapeHtml(state.search)}"
        />
      </label>
      ${renderShareControl({ label: 'Copy link' })}
      ${renderSectionNav(sectionCounts, filteredRows)}
    </section>

    <section class="results-header">
      <div class="results-stats">
        <strong>${filteredRows.length}</strong> buff effects ${getResultsDetail(visibleSectionCount)}
      </div>
    </section>

    <section class="buff-sections">
      ${
        sections.length
          ? sections.join('')
          : '<div class="empty-state">No buffs match your filters.</div>'
      }
    </section>

    <footer class="site-footer">
      <span>Data from ${new Date(meta.fetchedAt || meta.taggedAt).toLocaleDateString()}</span>
      <span>Excludes self-only and pet buffs</span>
    </footer>
  `;

  syncUrl();
}

function toggleRow(key) {
  if (state.expandedRows.has(key)) state.expandedRows.delete(key);
  else state.expandedRows.add(key);
  render();
  bindEvents();
}

function bindEvents() {
  app.querySelector('#search-input')?.addEventListener('input', (e) => {
    state.search = e.target.value;
    render();
    bindEvents();
    const input = app.querySelector('#search-input');
    input?.focus();
    if (input) input.setSelectionRange(input.value.length, input.value.length);
  });

  app.querySelectorAll('[data-action="select-section"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedSection = btn.dataset.section || null;
      render();
      bindEvents();
      if (state.selectedSection) {
        document
          .getElementById(`section-${state.selectedSection}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  app.querySelectorAll('[data-action="toggle-row"]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('.wiki-link')) return;
      toggleRow(row.dataset.key);
    });
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleRow(row.dataset.key);
      }
    });
  });

  bindShareControl(app);
}

async function init() {
  app.innerHTML = '<div class="loading">Loading buff data…</div>';
  readUrlBindings(urlBindings);
  state.rows = await loadBuffPageRows();
  render();
  bindEvents();
}

init();
