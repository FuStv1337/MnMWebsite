import './style.css';
import { sitePath } from './site-paths.js';
import { renderSiteHeader } from './site-header.js';
import racesData from '../data/races.json';
import { renderStatGuide } from './stat-info.js';

const app = document.querySelector('#app');
const { statKeys, races, source, fetchedAt } = racesData;

/** @type {{ selectedId: string, search: string, classFilter: string }} */
const state = {
  selectedId: races[0]?.id ?? '',
  search: '',
  classFilter: '',
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatStat(value) {
  return value == null ? '—' : String(value);
}

function getFilteredRaces() {
  const query = state.search.trim().toLowerCase();
  return races.filter((race) => {
    if (state.classFilter && !race.classes.includes(state.classFilter)) return false;
    if (!query) return true;
    const haystack = [
      race.name,
      race.displayName,
      race.description,
      race.faction,
      race.racialAbility?.name,
      race.classes.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

function getSelectedRace() {
  return races.find((race) => race.id === state.selectedId) ?? races[0] ?? null;
}

function renderStatTable(stats, { highlightBase = false } = {}) {
  const values = statKeys.map((key) => stats[key]);
  const numericValues = values.filter((v) => v != null);
  const max = numericValues.length ? Math.max(...numericValues) : null;
  const min = numericValues.length ? Math.min(...numericValues) : null;

  return `
    <table class="race-stat-table">
      <thead>
        <tr>
          ${statKeys.map((key) => `<th>${key}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr>
          ${statKeys
            .map((key) => {
              const value = stats[key];
              let cls = '';
              if (highlightBase && value != null && max != null) {
                if (value === max) cls = ' race-stat--high';
                else if (value === min) cls = ' race-stat--low';
              }
              return `<td class="race-stat${cls}">${formatStat(value)}</td>`;
            })
            .join('')}
        </tr>
      </tbody>
    </table>
  `;
}

function renderStartingStatsTable(race) {
  if (!race.startingStats?.length) {
    return '<p class="muted">No starting stats listed.</p>';
  }

  const rows = race.startingStats;
  const statHighs = Object.fromEntries(
    statKeys.map((key) => {
      const nums = rows.map((row) => row[key]).filter((v) => v != null);
      return [key, nums.length ? Math.max(...nums) : null];
    })
  );

  return `
    <div class="race-table-scroll">
      <table class="race-starting-table">
        <thead>
          <tr>
            <th>Class</th>
            ${statKeys.map((key) => `<th>${key}</th>`).join('')}
            <th>Bonus</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const cells = statKeys
                .map((key) => {
                  const value = row[key];
                  const high = statHighs[key];
                  const cls =
                    value != null && high != null && value === high
                      ? ' race-stat--high'
                      : '';
                  return `<td class="race-stat${cls}">${formatStat(value)}</td>`;
                })
                .join('');
              return `
                <tr>
                  <td class="race-class-name">${escapeHtml(row.class)}</td>
                  ${cells}
                  <td class="race-stat">${formatStat(row.bonus)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderRaceCard(race, active) {
  return `
    <button
      type="button"
      class="race-card${active ? ' race-card--active' : ''}"
      data-action="select-race"
      data-race-id="${escapeHtml(race.id)}"
    >
      <img class="race-card-image" src="${escapeHtml(race.imageUrl)}" alt="" loading="lazy" />
      <span class="race-card-name">${escapeHtml(race.displayName || race.name)}</span>
      <span class="race-card-meta">${race.classes.length} classes</span>
    </button>
  `;
}

function renderRaceDetail(race) {
  if (!race) {
    return '<p class="empty-state">Select a race to view details.</p>';
  }

  const ability = race.racialAbility;
  const cities = race.startingCities?.length
    ? race.startingCities
        .map((city) =>
          city.url
            ? `<a href="${escapeHtml(city.url)}" target="_blank" rel="noopener">${escapeHtml(city.name)}</a>`
            : escapeHtml(city.name)
        )
        .join(', ')
    : '<span class="muted">Unknown</span>';

  const infoRows = [
    ['Faction', race.faction],
    ['Languages', race.languages],
    ['Resistances', race.resistances],
    ['Starting cities', cities],
  ].filter(([, value]) => value);

  return `
    <article class="race-detail card">
      <header class="race-detail-header">
        <div>
          <h2 class="race-detail-title">${escapeHtml(race.displayName || race.name)}</h2>
          <p class="race-detail-subtitle">${escapeHtml(race.name)}</p>
        </div>
        <a class="wiki-source" href="${escapeHtml(race.wikiUrl)}" target="_blank" rel="noopener">Wiki ↗</a>
      </header>

      <div class="race-detail-body">
        <figure class="race-detail-hero">
          <img src="${escapeHtml(race.imageUrl)}" alt="${escapeHtml(race.name)}" loading="lazy" />
        </figure>

        <div class="race-detail-main">
          <section class="race-section">
            <h3>Description</h3>
            <div class="race-description">${escapeHtml(race.description).replace(/\n\n/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>')}</div>
          </section>

          <section class="race-section race-info-grid">
            ${infoRows
              .map(
                ([label, value]) => `
              <div class="race-info-item">
                <span class="race-info-label">${escapeHtml(label)}</span>
                <span class="race-info-value">${typeof value === 'string' && !value.includes('<') ? escapeHtml(value) : value}</span>
              </div>
            `
              )
              .join('')}
          </section>

          <section class="race-section race-ability-card">
            <h3>Racial ability</h3>
            ${
              ability
                ? `
              <div class="race-ability">
                <div class="race-ability-head">
                  ${
                    ability.url
                      ? `<a class="race-ability-name" href="${escapeHtml(ability.url)}" target="_blank" rel="noopener">${escapeHtml(ability.name)}</a>`
                      : `<span class="race-ability-name">${escapeHtml(ability.name)}</span>`
                  }
                  ${ability.note ? `<span class="race-ability-note">${escapeHtml(ability.note)}</span>` : ''}
                </div>
                ${
                  ability.description
                    ? `<p class="race-ability-desc">${escapeHtml(ability.description)}</p>`
                    : '<p class="muted">No ability description on the wiki yet.</p>'
                }
              </div>
            `
                : '<p class="muted">Not yet revealed on the wiki.</p>'
            }
          </section>

          <section class="race-section">
            <h3>Base stats</h3>
            <p class="race-section-note">Untrained stats before class selection. Highest values highlighted when known.</p>
            ${renderStatTable(race.baseStats, { highlightBase: true })}
          </section>

          <section class="race-section">
            <h3>Starting stats by class</h3>
            <p class="race-section-note">Stats at character creation for each playable class on this race.</p>
            ${renderStartingStatsTable(race)}
          </section>

          <section class="race-section">
            <h3>Playable classes</h3>
            <div class="race-class-chips">
              ${race.classes.map((className) => `<span class="race-class-chip">${escapeHtml(className)}</span>`).join('')}
            </div>
          </section>
        </div>
      </div>
    </article>
  `;
}

function render() {
  const filtered = getFilteredRaces();
  const selected = getSelectedRace();

  if (selected && !filtered.some((race) => race.id === selected.id)) {
    state.selectedId = filtered[0]?.id ?? state.selectedId;
  }

  const activeRace = getSelectedRace();
  const allClasses = [...new Set(races.flatMap((race) => race.classes))].sort();

  app.innerHTML = `
    ${renderSiteHeader({ active: 'races', tagline: 'Playable race reference' })}

    <section class="controls card">
      <p class="race-intro">
        Base stats, racial abilities, and per-class starting stats for all playable races from the
        <a href="${escapeHtml(source)}" target="_blank" rel="noopener">Character Races</a> wiki.
        Use the <a href="${sitePath('creator.html')}">Character Creator</a> to compare combinations and plan your build.
        Data fetched ${new Date(fetchedAt).toLocaleDateString()}.
      </p>
      <div class="race-controls-row">
        <label class="field field--grow">
          <span class="field-label">Search</span>
          <input
            type="search"
            id="race-search"
            class="search-input"
            placeholder="Race name, ability, class…"
            value="${escapeHtml(state.search)}"
          />
        </label>
        <label class="field">
          <span class="field-label">Class</span>
          <select id="race-class-filter" class="class-select">
            <option value="">All classes</option>
            ${allClasses.map((className) => `<option value="${escapeHtml(className)}"${state.classFilter === className ? ' selected' : ''}>${escapeHtml(className)}</option>`).join('')}
          </select>
        </label>
      </div>
      <details class="stat-guide-details">
        <summary class="stat-guide-summary">What each stat does</summary>
        ${renderStatGuide(statKeys)}
      </details>
    </section>

    <div class="race-layout">
      <aside class="race-sidebar card">
        <h2 class="race-sidebar-title">Playable races (${filtered.length})</h2>
        <div class="race-card-grid">
          ${
            filtered.length
              ? filtered.map((race) => renderRaceCard(race, activeRace?.id === race.id)).join('')
              : '<p class="empty-state">No races match your filters.</p>'
          }
        </div>
      </aside>

      <div class="race-detail-wrap">
        ${renderRaceDetail(activeRace)}
      </div>
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  document.getElementById('race-search')?.addEventListener('input', (event) => {
    state.search = event.target.value;
    render();
  });

  document.getElementById('race-class-filter')?.addEventListener('change', (event) => {
    state.classFilter = event.target.value;
    render();
  });

  app.querySelectorAll('[data-action="select-race"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedId = button.getAttribute('data-race-id') || state.selectedId;
      render();
      app.querySelector('.race-detail-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

render();
