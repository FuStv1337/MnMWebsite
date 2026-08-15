import './style.css';
import { sitePath } from './site-paths.js';
import { renderSiteHeader } from './site-header.js';
import indexData from '../data/index.json';
import meta from '../data/meta.json';
import { SORT_OPTIONS, tagLabel, QUICK_TAG_GROUPS, getQuickGroupMemberTags, isQuickGroupActive, toggleQuickGroup, quickGroupHint, quickGroupTitle, getTagColor, sortDisplayTags, sortAvailableTags } from './constants.js';
import {
  filterEntries,
  sortEntries,
  getAvailableTags,
  getLevelRange,
} from './filters.js';
import { readUrlBindings, syncUrlBindings, urlParsers, urlSerializers, bindShareControl, renderShareControl } from './url-state.js';

const app = document.querySelector('#app');
const classIndex = indexData.classes.sort((a, b) => a.name.localeCompare(b.name));
const classModules = import.meta.glob('../data/classes/*.json');

/** @type {{ className: string | null, classMeta: object | null, entries: object[], filters: object, expandedRows: Set<string> }} */
const state = {
  className: null,
  classMeta: null,
  entries: [],
  filters: {
    search: '',
    tags: new Set(),
    levelMin: null,
    levelMax: null,
    sort: 'level-asc',
    primaryTagOnly: false,
    groupByLevel: false,
  },
  expandedRows: new Set(),
};

/** @type {string | null} */
let urlClassOverride = null;

const urlBindings = [
  {
    key: 'class',
    param: 'class',
    get: () => state.className,
    set: (value) => {
      urlClassOverride = typeof value === 'string' ? value : null;
    },
    serialize: urlSerializers.string,
  },
  {
    key: 'search',
    param: 'q',
    get: () => state.filters.search,
    set: (value) => {
      state.filters.search = typeof value === 'string' ? value : '';
    },
    serialize: urlSerializers.string,
  },
  {
    key: 'tags',
    param: 'tags',
    get: () => state.filters.tags,
    set: (value) => {
      state.filters.tags = value instanceof Set ? value : new Set();
    },
    serialize: urlSerializers.tags,
    deserialize: urlParsers.tags,
  },
  {
    key: 'levelMin',
    param: 'min',
    get: () => state.filters.levelMin,
    set: (value) => {
      state.filters.levelMin = typeof value === 'number' ? value : null;
    },
    serialize: urlSerializers.int,
    deserialize: urlParsers.int,
  },
  {
    key: 'levelMax',
    param: 'max',
    get: () => state.filters.levelMax,
    set: (value) => {
      state.filters.levelMax = typeof value === 'number' ? value : null;
    },
    serialize: urlSerializers.int,
    deserialize: urlParsers.int,
  },
  {
    key: 'sort',
    get: () => state.filters.sort,
    set: (value) => {
      if (typeof value === 'string') state.filters.sort = value;
    },
    defaultValue: 'level-asc',
    serialize: (value) => (value === 'level-asc' ? null : urlSerializers.string(value)),
  },
  {
    key: 'primaryTagOnly',
    param: 'primary',
    get: () => state.filters.primaryTagOnly,
    set: (value) => {
      state.filters.primaryTagOnly = Boolean(value);
    },
    defaultValue: false,
    serialize: (value) => urlSerializers.bool(value, false),
    deserialize: urlParsers.bool,
  },
  {
    key: 'groupByLevel',
    param: 'group',
    get: () => state.filters.groupByLevel,
    set: (value) => {
      state.filters.groupByLevel = Boolean(value);
    },
    defaultValue: false,
    serialize: (value) => urlSerializers.bool(value, false),
    deserialize: urlParsers.bool,
  },
];

function syncUrl() {
  syncUrlBindings(urlBindings);
}

function entryKey(entry) {
  return `${entry.level}-${entry.slug || entry.name}`;
}

function loadSavedClass() {
  return localStorage.getItem('mnm-selected-class') || classIndex[0]?.name || null;
}

function saveClass(name) {
  localStorage.setItem('mnm-selected-class', name);
}

async function loadClassData(classMeta) {
  const path = `../data/${classMeta.file}`;
  const loader = classModules[path];
  if (!loader) {
    throw new Error(`Class data not found: ${classMeta.file}`);
  }
  const mod = await loader();
  return mod.default || mod;
}

function getFilteredEntries() {
  const filtered = filterEntries(state.entries, state.filters);
  return sortEntries(filtered, state.filters.sort);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTagBadge(tag) {
  const color = getTagColor(tag);
  return `<span class="tag-badge" data-tag="${escapeHtml(tag)}" style="--tag-color:${color}" title="${escapeHtml(tagLabel(tag))}">${escapeHtml(tagLabel(tag))}</span>`;
}

function renderTags(entry) {
  const tags = sortDisplayTags(entry.tags || [], entry.primaryTag);
  if (!tags.length) return '<span class="muted">—</span>';
  return tags.map((tag) => renderTagBadge(tag)).join('');
}

function renderValues(entry) {
  if (entry.valuesSummary) {
    return `<span class="values-summary">${escapeHtml(entry.valuesSummary)}</span>`;
  }
  return '<span class="muted">—</span>';
}

function renderMana(mana) {
  if (mana === 'Innate') return '<span class="mana-innate">Innate</span>';
  if (mana === '' || mana == null) return '<span class="muted">—</span>';
  return escapeHtml(String(mana));
}

function renderTableRow(entry) {
  const key = entryKey(entry);
  const expanded = state.expandedRows.has(key);
  const wikiLink = entry.wikiUrl
    ? `<a href="${escapeHtml(entry.wikiUrl)}" target="_blank" rel="noopener noreferrer" class="wiki-link" title="View on wiki">↗</a>`
    : '';

  return `
    <tr
      class="spell-row${expanded ? ' spell-row--expanded' : ''}"
      data-action="toggle-row"
      data-key="${escapeHtml(key)}"
      tabindex="0"
      role="button"
      aria-expanded="${expanded}"
    >
      <td class="col-level">${entry.level}</td>
      <td class="col-name">
        <span class="col-name-inner">
          <span class="spell-name">${escapeHtml(entry.name)}</span>
          ${wikiLink}
        </span>
      </td>
      <td class="col-values"><span class="col-values-inner">${renderValues(entry)}</span></td>
      <td class="col-category">${escapeHtml(entry.category || '—')}</td>
      <td class="col-location">${escapeHtml(entry.location || '—')}</td>
      <td class="col-mana">${renderMana(entry.mana)}</td>
      <td class="col-cast">${entry.castTime ? escapeHtml(entry.castTime) : '<span class="muted">—</span>'}</td>
      <td class="col-tags"><span class="col-tags-inner">${renderTags(entry)}</span></td>
    </tr>
    ${expanded ? `
    <tr class="detail-row">
      <td colspan="8">
        <p class="spell-description">${escapeHtml(entry.description)}</p>
      </td>
    </tr>` : ''}
  `;
}

function renderGroupedTable(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.level)) groups.set(entry.level, []);
    groups.get(entry.level).push(entry);
  }

  let html = '';
  for (const level of [...groups.keys()].sort((a, b) => a - b)) {
    const groupEntries = groups.get(level);
    html += `
      <tr class="level-group-row">
        <td colspan="8">Level ${level} <span class="level-count">(${groupEntries.length})</span></td>
      </tr>
    `;
    html += groupEntries.map(renderTableRow).join('');
  }
  return html;
}

function renderTable(entries) {
  if (!entries.length) {
    return '<div class="empty-state">No spells match your filters.</div>';
  }

  const body = state.filters.groupByLevel
    ? renderGroupedTable(entries)
    : entries.map(renderTableRow).join('');

  const categoryHeader = state.classMeta?.type === 'spell' ? 'School' : 'Skill';

  return `
    <div class="table-wrap">
      <table class="spell-table">
        <thead>
          <tr>
            <th class="col-level">Lvl</th>
            <th class="col-name">Name</th>
            <th class="col-values">Values</th>
            <th class="col-category">${categoryHeader}</th>
            <th class="col-location">Location</th>
            <th class="col-mana">Mana</th>
            <th class="col-cast">Cast</th>
            <th class="col-tags">Tags</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function renderTagChip(tag, count, activeTags) {
  const active = activeTags.has(tag);
  const color = getTagColor(tag);
  return `
    <button
      type="button"
      class="tag-chip${active ? ' tag-chip--active' : ''}"
      data-action="toggle-tag"
      data-tag="${escapeHtml(tag)}"
      style="--tag-color:${color}"
      title="${escapeHtml(tagLabel(tag))}"
    >
      ${escapeHtml(tagLabel(tag))}
      <span class="tag-chip-count">${count}</span>
    </button>
  `;
}

function renderTagFilters(availableTags) {
  if (!availableTags.length) return '';

  const sortedTags = sortAvailableTags(availableTags);
  const activeTags = state.filters.tags;
  const chips = sortedTags
    .map(({ tag, count }) => renderTagChip(tag, count, activeTags))
    .join('');

  return `
    <div class="filter-section">
      <div class="filter-section-header">
        <span class="filter-label">Filter by tag</span>
        <label class="checkbox-label">
          <input type="checkbox" data-action="primary-tag-only" ${state.filters.primaryTagOnly ? 'checked' : ''} />
          Primary tag only
        </label>
        ${activeTags.size ? '<button type="button" class="text-btn" data-action="clear-tags">Clear tags</button>' : ''}
      </div>
      <div class="tag-chips">${chips}</div>
    </div>
  `;
}

function renderQuickFilters(availableTags) {
  const present = QUICK_TAG_GROUPS.filter((group) => getQuickGroupMemberTags(group, availableTags).length > 0);
  if (!present.length) return '';

  return `
    <div class="quick-filters">
      <span class="filter-label">Quick:</span>
      ${present
        .map((group) => {
          const active = isQuickGroupActive(group, availableTags, state.filters.tags);
          const hint = quickGroupHint(group, availableTags);
          const hintHtml = hint
            ? `<span class="quick-chip-hint">${escapeHtml(hint)}</span>`
            : '';
          return `<button type="button" class="quick-chip${active ? ' quick-chip--active' : ''}" data-action="toggle-tag-group" data-tag-group="${escapeHtml(group.id)}" style="--tag-color:${group.color}" title="${escapeHtml(quickGroupTitle(group, availableTags))}">${escapeHtml(group.label)}${hintHtml}</button>`;
        })
        .join('')}
    </div>
  `;
}

function render() {
  const filtered = getFilteredEntries();
  const availableTags = getAvailableTags(state.entries);
  const levelRange = getLevelRange(state.entries);
  const typeLabel = state.classMeta?.type === 'spell' ? 'spells' : 'abilities';

  app.innerHTML = `
    ${renderSiteHeader({ active: 'browser', tagline: 'Spell &amp; ability reference by class' })}

    <section class="controls card">
      <div class="control-row">
        <label class="field">
          <span class="field-label">Class</span>
          <select id="class-select" class="class-select">
            ${classIndex
              .map(
                (c) =>
                  `<option value="${escapeHtml(c.name)}" ${c.name === state.className ? 'selected' : ''}>${escapeHtml(c.name)} (${c.entryCount} ${c.type === 'spell' ? 'spells' : 'abilities'})</option>`
              )
              .join('')}
          </select>
        </label>

        <label class="field field--grow">
          <span class="field-label">Search</span>
          <input
            type="search"
            id="search-input"
            class="search-input"
            placeholder="Name, description, school…"
            value="${escapeHtml(state.filters.search)}"
          />
        </label>
      </div>

      <div class="control-row control-row--filters">
        <label class="field field--narrow">
          <span class="field-label">Min level</span>
          <input type="number" id="level-min" class="level-input" min="${levelRange.min}" max="${levelRange.max}" placeholder="${levelRange.min}" value="${state.filters.levelMin ?? ''}" />
        </label>
        <label class="field field--narrow">
          <span class="field-label">Max level</span>
          <input type="number" id="level-max" class="level-input" min="${levelRange.min}" max="${levelRange.max}" placeholder="${levelRange.max}" value="${state.filters.levelMax ?? ''}" />
        </label>

        <label class="field">
          <span class="field-label">Sort</span>
          <select id="sort-select" class="sort-select">
            ${SORT_OPTIONS.map((o) => `<option value="${o.value}" ${o.value === state.filters.sort ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
        </label>

        <label class="checkbox-label checkbox-label--inline">
          <input type="checkbox" id="group-by-level" ${state.filters.groupByLevel ? 'checked' : ''} />
          Group by level
        </label>

        <button type="button" class="secondary-btn" data-action="reset-filters">Reset filters</button>
        ${renderShareControl({ label: 'Copy link' })}
      </div>

      ${renderQuickFilters(availableTags)}
      ${renderTagFilters(availableTags)}
    </section>

    <section class="results-header">
      <div class="results-stats">
        <strong>${filtered.length}</strong> of <strong>${state.entries.length}</strong> ${typeLabel}
        ${state.classMeta ? `for <strong>${escapeHtml(state.classMeta.name)}</strong>` : ''}
      </div>
      ${state.classMeta?.wikiUrl ? `<a href="${escapeHtml(state.classMeta.wikiUrl)}" target="_blank" rel="noopener noreferrer" class="class-wiki-link">View class on wiki ↗</a>` : ''}
    </section>

    <section class="results">
      ${renderTable(filtered)}
    </section>

    <footer class="site-footer">
      <span>Data from ${new Date(meta.fetchedAt || meta.taggedAt).toLocaleDateString()}</span>
      <span>${meta.totalEntries} total entries · ${meta.uniqueEntries} unique</span>
      <a href="https://monstersandmemories.miraheze.org/wiki/Spells_By_Class" target="_blank" rel="noopener noreferrer">Wiki source ↗</a>
    </footer>
  `;

  syncUrl();
}

function bindEvents() {
  app.querySelector('#class-select')?.addEventListener('change', async (e) => {
    await selectClass(e.target.value);
  });

  app.querySelector('#search-input')?.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    render();
    bindEvents();
    app.querySelector('#search-input')?.focus();
    const input = app.querySelector('#search-input');
    if (input) input.setSelectionRange(input.value.length, input.value.length);
  });

  app.querySelector('#sort-select')?.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    render();
    bindEvents();
  });

  app.querySelector('#group-by-level')?.addEventListener('change', (e) => {
    state.filters.groupByLevel = e.target.checked;
    render();
    bindEvents();
  });

  app.querySelector('#level-min')?.addEventListener('change', (e) => {
    state.filters.levelMin = e.target.value ? Number(e.target.value) : null;
    render();
    bindEvents();
  });

  app.querySelector('#level-max')?.addEventListener('change', (e) => {
    state.filters.levelMax = e.target.value ? Number(e.target.value) : null;
    render();
    bindEvents();
  });

  app.querySelector('[data-action="primary-tag-only"]')?.addEventListener('change', (e) => {
    state.filters.primaryTagOnly = e.target.checked;
    render();
    bindEvents();
  });

  app.querySelector('[data-action="reset-filters"]')?.addEventListener('click', () => {
    state.filters.search = '';
    state.filters.tags.clear();
    state.filters.levelMin = null;
    state.filters.levelMax = null;
    state.filters.sort = 'level-asc';
    state.filters.primaryTagOnly = false;
    state.expandedRows.clear();
    render();
    bindEvents();
  });

  app.querySelector('[data-action="clear-tags"]')?.addEventListener('click', () => {
    state.filters.tags.clear();
    render();
    bindEvents();
  });

  app.querySelectorAll('[data-action="toggle-tag-group"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = QUICK_TAG_GROUPS.find((item) => item.id === btn.dataset.tagGroup);
      if (!group) return;
      toggleQuickGroup(group, getAvailableTags(state.entries), state.filters.tags);
      render();
      bindEvents();
    });
  });

  app.querySelectorAll('[data-action="toggle-tag"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (state.filters.tags.has(tag)) state.filters.tags.delete(tag);
      else state.filters.tags.add(tag);
      render();
      bindEvents();
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

function toggleRow(key) {
  if (state.expandedRows.has(key)) state.expandedRows.delete(key);
  else state.expandedRows.add(key);
  render();
  bindEvents();
}

async function selectClass(name, { resetFilters = true } = {}) {
  const classMeta = classIndex.find((c) => c.name === name);
  if (!classMeta) return;

  state.className = name;
  state.classMeta = classMeta;
  state.entries = [];
  if (resetFilters) {
    state.filters.tags.clear();
    state.filters.levelMin = null;
    state.filters.levelMax = null;
  }
  state.expandedRows.clear();
  saveClass(name);

  app.innerHTML = '<div class="loading">Loading class data…</div>';

  const data = await loadClassData(classMeta);
  state.entries = data.entries || [];
  render();
  bindEvents();
}

async function init() {
  app.innerHTML = '<div class="loading">Loading…</div>';
  readUrlBindings(urlBindings);
  const saved = urlClassOverride || loadSavedClass();
  await selectClass(saved, { resetFilters: false });
}

init();
