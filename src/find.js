import './style.css';
import { sitePath } from './site-paths.js';
import { renderSiteHeader } from './site-header.js';
import indexData from '../data/index.json';
import meta from '../data/meta.json';
import {
  QUICK_TAG_GROUPS,
  getQuickGroupMemberTags,
  isQuickGroupActive,
  toggleQuickGroup,
  quickGroupHint,
  quickGroupTitle,
  getTagColor,
  sortDisplayTags,
  sortAvailableTags,
  tagLabel,
} from './constants.js';
import { getAvailableTags } from './filters.js';
import {
  loadFindEntries,
  filterFindEntries,
  sortFindEntries,
  getFindLevelRange,
  getSortedClasses,
  formatClassSummary,
} from './find-data.js';
import { bindShareControl, readUrlBindings, renderShareControl, syncUrlBindings, urlParsers, urlSerializers } from './url-state.js';

const app = document.querySelector('#app');
const classNames = indexData.classes.map((c) => c.name).sort((a, b) => a.localeCompare(b));

const FIND_SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A → Z)' },
  { value: 'name-desc', label: 'Name (Z → A)' },
  { value: 'level-asc', label: 'Min level (low → high)' },
  { value: 'level-desc', label: 'Min level (high → low)' },
  { value: 'classes-desc', label: 'Most classes first' },
  { value: 'category-asc', label: 'School / skill (A → Z)' },
  { value: 'value-desc', label: 'Value (high → low)' },
];

/** @type {{ entries: object[], filters: object, expandedRows: Set<string> }} */
const state = {
  entries: [],
  filters: {
    search: '',
    tags: new Set(),
    levelMin: null,
    levelMax: null,
    sort: 'name-asc',
    primaryTagOnly: false,
    inGameOnly: true,
    className: '',
  },
  expandedRows: new Set(),
};

const urlBindings = [
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
    key: 'className',
    param: 'class',
    get: () => state.filters.className,
    set: (value) => {
      state.filters.className = typeof value === 'string' ? value : '';
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
    defaultValue: 'name-asc',
    serialize: (value) => (value === 'name-asc' ? null : urlSerializers.string(value)),
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
    key: 'inGameOnly',
    param: 'inGame',
    get: () => state.filters.inGameOnly,
    set: (value) => {
      state.filters.inGameOnly = value !== false;
    },
    defaultValue: true,
    serialize: (value) => urlSerializers.bool(value, true),
    deserialize: (raw) => raw !== '0',
  },
];

function syncUrl() {
  syncUrlBindings(urlBindings);
}

function entryKey(entry) {
  return entry.slug || entry.name;
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

function renderLevelRange(entry) {
  if (entry.minLevel == null) return '<span class="muted">—</span>';
  if (entry.minLevel === entry.maxLevel) return String(entry.minLevel);
  return `${entry.minLevel}–${entry.maxLevel}`;
}

function renderClassBreakdown(entry) {
  const classes = getSortedClasses(entry);
  if (!classes.length) return '';

  return `
    <table class="class-breakdown-table">
      <thead>
        <tr>
          <th>Class</th>
          <th>Lvl</th>
          <th>Mana</th>
          <th>Cast</th>
          <th>Location</th>
        </tr>
      </thead>
      <tbody>
        ${classes
          .map(
            (c) => `
          <tr>
            <td>${escapeHtml(c.className)}</td>
            <td>${c.level}</td>
            <td>${renderMana(c.mana)}</td>
            <td>${c.castTime ? escapeHtml(c.castTime) : '<span class="muted">—</span>'}</td>
            <td>${escapeHtml(c.location || '—')}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
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
      <td class="col-name">
        <span class="col-name-inner">
          <span class="spell-name">${escapeHtml(entry.name)}</span>
          ${wikiLink}
        </span>
      </td>
      <td class="col-values"><span class="col-values-inner">${renderValues(entry)}</span></td>
      <td class="col-category">${escapeHtml(entry.category || '—')}</td>
      <td class="col-level">${renderLevelRange(entry)}</td>
      <td class="col-classes"><span class="class-summary">${escapeHtml(formatClassSummary(entry))}</span></td>
      <td class="col-tags"><span class="col-tags-inner">${renderTags(entry)}</span></td>
    </tr>
    ${expanded ? `
    <tr class="detail-row">
      <td colspan="6">
        ${renderClassBreakdown(entry)}
        <p class="spell-description">${escapeHtml(entry.description || 'No description available.')}</p>
      </td>
    </tr>` : ''}
  `;
}

function renderTable(entries) {
  if (!entries.length) {
    return '<div class="empty-state">No spells or abilities match your filters.</div>';
  }

  return `
    <div class="table-wrap">
      <table class="spell-table find-table">
        <thead>
          <tr>
            <th class="col-name">Name</th>
            <th class="col-values">Values</th>
            <th class="col-category">School / Skill</th>
            <th class="col-level">Lvl</th>
            <th class="col-classes">Classes</th>
            <th class="col-tags">Tags</th>
          </tr>
        </thead>
        <tbody>${entries.map(renderTableRow).join('')}</tbody>
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

function getFilteredEntries() {
  const filtered = filterFindEntries(state.entries, state.filters);
  return sortFindEntries(filtered, state.filters.sort);
}

function render() {
  const filtered = getFilteredEntries();
  const availableTags = getAvailableTags(state.entries);
  const levelRange = getFindLevelRange(state.entries);

  app.innerHTML = `
    ${renderSiteHeader({ active: 'find', tagline: 'Search spells &amp; abilities across all classes' })}

    <section class="controls card">
      <p class="find-intro">
        Search the full spell and ability list across every class. Expand a row to see per-class level, mana, cast time, and location — useful for shared spells like Gate or group ports.
      </p>

      <div class="control-row">
        <label class="field field--grow">
          <span class="field-label">Search</span>
          <input
            type="search"
            id="search-input"
            class="search-input"
            placeholder="Name, description, class, school…"
            value="${escapeHtml(state.filters.search)}"
          />
        </label>

        <label class="field">
          <span class="field-label">Class</span>
          <select id="class-filter" class="class-select">
            <option value="">Any class</option>
            ${classNames
              .map(
                (name) =>
                  `<option value="${escapeHtml(name)}" ${name === state.filters.className ? 'selected' : ''}>${escapeHtml(name)}</option>`
              )
              .join('')}
          </select>
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
            ${FIND_SORT_OPTIONS.map((o) => `<option value="${o.value}" ${o.value === state.filters.sort ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
        </label>

        <label class="checkbox-label checkbox-label--inline">
          <input type="checkbox" id="in-game-only" ${state.filters.inGameOnly ? 'checked' : ''} />
          In game only
        </label>

        <button type="button" class="secondary-btn" data-action="reset-filters">Reset filters</button>
        ${renderShareControl({ label: 'Copy link' })}
      </div>

      ${renderQuickFilters(availableTags)}
      ${renderTagFilters(availableTags)}
    </section>

    <section class="results-header">
      <div class="results-stats">
        <strong>${filtered.length}</strong> of <strong>${state.entries.length}</strong> unique spells &amp; abilities
      </div>
    </section>

    <section class="results">
      ${renderTable(filtered)}
    </section>

    <footer class="site-footer">
      <span>Data from ${new Date(meta.fetchedAt || meta.taggedAt).toLocaleDateString()}</span>
      <span>${meta.uniqueEntries} unique entries across ${meta.classCount} classes</span>
    </footer>
  `;

  syncUrl();
}

function bindEvents() {
  app.querySelector('#search-input')?.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    render();
    bindEvents();
    const input = app.querySelector('#search-input');
    input?.focus();
    if (input) input.setSelectionRange(input.value.length, input.value.length);
  });

  app.querySelector('#class-filter')?.addEventListener('change', (e) => {
    state.filters.className = e.target.value;
    render();
    bindEvents();
  });

  app.querySelector('#sort-select')?.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    render();
    bindEvents();
  });

  app.querySelector('#in-game-only')?.addEventListener('change', (e) => {
    state.filters.inGameOnly = e.target.checked;
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
    state.filters.sort = 'name-asc';
    state.filters.primaryTagOnly = false;
    state.filters.inGameOnly = true;
    state.filters.className = '';
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

async function init() {
  app.innerHTML = '<div class="loading">Loading spell index…</div>';
  readUrlBindings(urlBindings);
  state.entries = await loadFindEntries();
  render();
  bindEvents();
}

init();
