import './style.css';
import { sitePath } from './site-paths.js';
import { renderSiteHeader } from './site-header.js';
import meta from '../data/meta.json';
import { loadBuffPageRows } from './buff-data.js';
import {
  PARTY_SIZE,
  analyzeParty,
  loadAllClassEntries,
  loadSavedParty,
  saveParty,
} from './party-data.js';
import { CLASS_ROLES } from './constants.js';
import { bindShareControl, renderShareControl, syncUrlBindings } from './url-state.js';
import { decodePartyProfile, encodePartyProfile } from './share-profile.js';

function loadInitialParty() {
  const share = new URLSearchParams(window.location.search).get('share');
  const shared = decodePartyProfile(share);
  if (shared) {
    saveParty(shared.slots);
    return { slots: shared.slots, levelCap: shared.levelCap };
  }

  return { slots: loadSavedParty(), levelCap: 60 };
}

const initialParty = loadInitialParty();

/** @type {{ slots: (string | null)[], levelCap: number, allClassEntries: Map<string, object> | null, buffRows: object[], expandedBars: Set<string> }} */
const state = {
  slots: initialParty.slots,
  levelCap: initialParty.levelCap,
  allClassEntries: null,
  buffRows: [],
  expandedBars: new Set(),
};

const app = document.querySelector('#app');

function syncShareUrl() {
  const share = encodePartyProfile({
    slots: state.slots,
    levelCap: state.levelCap,
  });

  syncUrlBindings([], { preserve: [], extra: { share } });
}

function persistParty() {
  saveParty(state.slots);
  syncShareUrl();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderClassSelect(slotIndex, usedClasses) {
  const current = state.slots[slotIndex];

  const roleGroups = Object.values(CLASS_ROLES)
    .map((role) => {
      const options = role.classes
        .map((className) => {
          const disabled = usedClasses.has(className) && className !== current;
          return `<option value="${escapeHtml(className)}"${disabled ? ' disabled' : ''}${current === className ? ' selected' : ''}>${escapeHtml(className)}</option>`;
        })
        .join('');

      return `<optgroup label="${escapeHtml(role.label)}">${options}</optgroup>`;
    })
    .join('');

  return `
    <label class="party-slot">
      <span class="party-slot-label">Slot ${slotIndex + 1}</span>
      <select class="party-slot-select" data-slot="${slotIndex}">
        <option value="">— Empty —</option>
        ${roleGroups}
      </select>
    </label>
  `;
}

function renderSummaryCard({ title, value, detail, tone = 'neutral' }) {
  return `
    <div class="party-summary-card party-summary-card--${tone}">
      <span class="party-summary-title">${escapeHtml(title)}</span>
      <strong class="party-summary-value">${value}</strong>
      ${detail ? `<span class="party-summary-detail">${detail}</span>` : ''}
    </div>
  `;
}

function renderRoleBanner(role) {
  const classChips = role.classes.length
    ? role.classes.map((className) => `<span class="party-role-chip">${escapeHtml(className)}</span>`).join('')
    : '<span class="party-role-chip party-role-chip--empty">None</span>';

  return `
    <section class="party-role-banner party-role-banner--${role.tone}">
      <div class="party-role-banner-main">
        <span class="party-role-banner-label">${escapeHtml(role.headline)}</span>
        <div class="party-role-banner-classes">${classChips}</div>
        <p class="party-role-banner-detail">${escapeHtml(role.detail)}</p>
      </div>
      ${role.badge ? `<span class="party-role-banner-badge">${escapeHtml(role.badge)}</span>` : ''}
    </section>
  `;
}

function renderRoleOverview(roles) {
  return `
    <section class="party-role-overview">
      ${renderRoleBanner(roles.tank)}
      ${renderRoleBanner(roles.healer)}
      ${renderRoleBanner(roles.support)}
      ${renderRoleBanner(roles.dps)}
    </section>
  `;
}

function coverageTone(percent) {
  if (percent >= 80) return 'high';
  if (percent >= 40) return 'mid';
  return 'low';
}

function renderBarSpellSection(title, spells, emptyText, tone = 'party') {
  if (!spells.length) {
    return `
      <div class="party-bar-detail-section party-bar-detail-section--${tone}">
        <h4 class="party-bar-detail-title">${escapeHtml(title)}</h4>
        <p class="party-detail-empty">${escapeHtml(emptyText)}</p>
      </div>
    `;
  }

  const groups = groupSpellsByClass(spells);

  return `
    <div class="party-bar-detail-section party-bar-detail-section--${tone}">
      <h4 class="party-bar-detail-title">${escapeHtml(title)}</h4>
      ${groups
        .map(
          (group) => `
            <div class="party-bar-detail-class">
              <span class="party-bar-detail-class-name">${escapeHtml(group.className)}</span>
              <ul class="party-bar-detail-spells">
                ${group.spells
                  .map(
                    (spell) => `
                      <li
                        class="party-bar-detail-spell${spell.description ? ' party-spell-item--has-tip' : ''}"
                        ${spell.description ? `data-description="${escapeHtml(spell.description)}"` : ''}
                      >
                        <span class="party-spell-name">${escapeHtml(spell.name)}</span>
                        ${
                          spell.valueDisplay
                            ? `<span class="party-bar-detail-value">${escapeHtml(spell.valueDisplay)}</span>`
                            : ''
                        }
                        <span class="party-spell-meta">L${spell.level}</span>
                        ${
                          spell.wikiUrl
                            ? `<a href="${escapeHtml(spell.wikiUrl)}" target="_blank" rel="noopener noreferrer" class="wiki-link" title="View on wiki">↗</a>`
                            : ''
                        }
                      </li>
                    `
                  )
                  .join('')}
              </ul>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderBarDetail(bar) {
  const detail = bar.detail || { partySpells: [], betterSpells: [] };

  return `
    <div class="party-coverage-detail">
      ${renderBarSpellSection('Party spells', detail.partySpells, 'No spells in this category from your party.')}
      ${renderBarSpellSection(
        'Better from other classes',
        detail.betterSpells,
        bar.percent >= 100
          ? 'Your party already matches or exceeds the best available.'
          : 'No stronger options found outside your party.',
        'better'
      )}
    </div>
  `;
}

function renderCoverageBar(bar, groupId) {
  const tone = coverageTone(bar.percent);
  const barKey = `${groupId}:${bar.id}`;
  const isExpanded = state.expandedBars.has(barKey);

  return `
    <div
      class="party-coverage-row${isExpanded ? ' party-coverage-row--expanded' : ''}"
      data-action="toggle-bar"
      data-bar-key="${escapeHtml(barKey)}"
      role="button"
      tabindex="0"
      aria-expanded="${isExpanded}"
    >
      <div class="party-coverage-head">
        <span class="party-coverage-label" style="--tag-color:${bar.color}">${escapeHtml(bar.label)}</span>
        <span class="party-coverage-values">
          <span class="party-coverage-party">${escapeHtml(bar.partyDisplay)}</span>
          <span class="party-coverage-sep">/</span>
          <span class="party-coverage-max">${escapeHtml(bar.maxDisplay)}</span>
        </span>
        <span class="party-coverage-pct party-coverage-pct--${tone}">${bar.percent}%</span>
        <span class="party-coverage-chevron" aria-hidden="true">${isExpanded ? '▾' : '▸'}</span>
      </div>
      <div class="party-coverage-track" aria-hidden="true">
        <div class="party-coverage-fill party-coverage-fill--${tone}" style="width:${bar.percent}%"></div>
      </div>
      ${
        !isExpanded && bar.source
          ? `<p class="party-coverage-source">Party: ${escapeHtml(bar.source.valueDisplay)} · ${escapeHtml(bar.source.name)} (${escapeHtml(bar.source.className)})</p>`
          : !isExpanded && bar.percent === 0 && bar.maxSource
            ? `<p class="party-coverage-source party-coverage-source--missing">Max: ${escapeHtml(bar.maxSource.valueDisplay)} · ${escapeHtml(bar.maxSource.name)} (${escapeHtml(bar.maxSource.className)})</p>`
            : ''
      }
      ${isExpanded ? renderBarDetail(bar) : ''}
    </div>
  `;
}

function renderCoverageGroup(group) {
  const avg = group.bars.length
    ? Math.round(group.bars.reduce((sum, bar) => sum + bar.percent, 0) / group.bars.length)
    : 0;

  return `
    <section class="party-coverage-group card">
      <div class="party-coverage-group-head">
        <h2 class="party-coverage-group-title">
          <span class="party-coverage-group-badge" style="--tag-color:${group.color}">${escapeHtml(group.label)}</span>
        </h2>
        <span class="party-coverage-group-avg">${avg}% avg</span>
      </div>
      <div class="party-coverage-bars">
        ${group.bars.map((bar) => renderCoverageBar(bar, group.id)).join('')}
      </div>
    </section>
  `;
}

/**
 * @param {object[]} spells
 */
function groupSpellsByClass(spells) {
  /** @type {Map<string, object[]>} */
  const byClass = new Map();

  for (const spell of spells) {
    if (!byClass.has(spell.className)) byClass.set(spell.className, []);
    byClass.get(spell.className).push(spell);
  }

  const slotOrder = state.slots.filter(Boolean);
  const classNames = [...byClass.keys()].sort((a, b) => {
    const slotA = slotOrder.indexOf(a);
    const slotB = slotOrder.indexOf(b);
    if (slotA !== -1 && slotB !== -1) return slotA - slotB;
    if (slotA !== -1) return -1;
    if (slotB !== -1) return 1;
    return a.localeCompare(b);
  });

  return classNames.map((className) => ({
    className,
    spells: byClass
      .get(className)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
  }));
}

/** @type {HTMLDivElement | null} */
let spellTooltip = null;

function ensureSpellTooltip() {
  if (!spellTooltip) {
    spellTooltip = document.createElement('div');
    spellTooltip.className = 'party-spell-tooltip';
    spellTooltip.hidden = true;
    document.body.appendChild(spellTooltip);
  }
  return spellTooltip;
}

/** @param {HTMLElement} anchor */
function positionSpellTooltip(anchor) {
  if (!spellTooltip) return;

  const rect = anchor.getBoundingClientRect();
  const margin = 8;
  const tipRect = spellTooltip.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + margin;

  if (left + tipRect.width > window.innerWidth - margin) {
    left = window.innerWidth - tipRect.width - margin;
  }
  if (left < margin) left = margin;

  if (top + tipRect.height > window.innerHeight - margin) {
    top = rect.top - tipRect.height - margin;
  }

  spellTooltip.style.left = `${left}px`;
  spellTooltip.style.top = `${top}px`;
}

function hideSpellTooltip() {
  if (spellTooltip) spellTooltip.hidden = true;
}

function bindSpellTooltips() {
  const tooltip = ensureSpellTooltip();

  app.querySelectorAll('.party-bar-detail-spell[data-description]').forEach((item) => {
    item.addEventListener('mouseenter', () => {
      const description = item.dataset.description;
      if (!description) return;
      tooltip.textContent = description;
      tooltip.hidden = false;
      requestAnimationFrame(() => positionSpellTooltip(item));
    });

    item.addEventListener('mousemove', () => {
      if (!tooltip.hidden) positionSpellTooltip(item);
    });

    item.addEventListener('mouseleave', hideSpellTooltip);
  });
}

function getUsedClasses(excludeSlot = null) {
  /** @type {Set<string>} */
  const used = new Set();
  state.slots.forEach((className, index) => {
    if (index === excludeSlot || !className) return;
    used.add(className);
  });
  return used;
}

function render() {
  const analysis =
    state.allClassEntries == null
      ? null
      : analyzeParty(state.slots, state.levelCap, state.allClassEntries, state.buffRows);

  const slotSelectors = Array.from({ length: PARTY_SIZE }, (_, index) =>
    renderClassSelect(index, getUsedClasses(index))
  ).join('');

  app.innerHTML = `
    ${renderSiteHeader({ active: 'party', tagline: 'Party composition analyzer' })}

    <section class="controls card">
      <p class="party-intro">
        Build a party of up to ${PARTY_SIZE} classes. Each bar shows your party's best value vs the game maximum at the level cap. Click a bar to expand and see party spells plus better options from other classes.
      </p>

      <div class="party-controls-row">
        <label class="field">
          <span class="field-label">Level cap</span>
          <input
            type="number"
            id="level-cap"
            class="level-input"
            min="1"
            max="60"
            value="${state.levelCap}"
          />
        </label>
        <button type="button" class="secondary-btn" data-action="clear-party">Clear party</button>
        ${renderShareControl({ label: 'Copy party link' })}
      </div>

      <div class="party-slots">
        ${slotSelectors}
      </div>
    </section>

    ${
      !analysis
        ? '<div class="loading">Loading party data…</div>'
        : analysis.selected.length === 0
          ? '<div class="empty-state">Select classes above to compare party coverage against game maximums.</div>'
          : `
          ${renderRoleOverview(analysis.roles)}

          <section class="party-summary">
            ${renderSummaryCard({
              title: 'Overall Coverage',
              value: `${analysis.overallPercent}%`,
              detail: 'Average across all tracked categories',
              tone: analysis.overallPercent >= 70 ? 'good' : analysis.overallPercent >= 40 ? 'neutral' : 'bad',
            })}
            ${renderSummaryCard({
              title: 'Best Heal',
              value: analysis.heal.best ? analysis.heal.best.display : 'None',
              detail: analysis.heal.best
                ? `${analysis.heal.best.name} · ${analysis.heal.best.className}`
                : 'No heal or HoT available',
              tone: analysis.heal.best ? 'good' : 'bad',
            })}
            ${renderSummaryCard({
              title: 'Group Buffs',
              value: String(analysis.buffs.spellCount),
              detail: `${analysis.buffs.statSectionsCovered} stat categories covered`,
              tone: analysis.buffs.spellCount >= 8 ? 'good' : analysis.buffs.spellCount ? 'neutral' : 'bad',
            })}
            ${renderSummaryCard({
              title: 'Party Size',
              value: `${analysis.filledSlots}/${PARTY_SIZE}`,
              detail: analysis.emptySlots ? `${analysis.emptySlots} open slot${analysis.emptySlots === 1 ? '' : 's'}` : 'Full party',
              tone: analysis.filledSlots === PARTY_SIZE ? 'good' : 'neutral',
            })}
          </section>

          <section class="party-coverage">
            ${analysis.coverageGroups.map((group) => renderCoverageGroup(group)).join('')}
          </section>
        `
    }

    <footer class="site-footer">
      <span>Data from ${new Date(meta.fetchedAt || meta.taggedAt).toLocaleDateString()}</span>
      <span>Compared against max values at level ${state.levelCap} and below</span>
    </footer>
  `;

  syncShareUrl();
}

function toggleCoverageBar(barKey) {
  if (state.expandedBars.has(barKey)) state.expandedBars.delete(barKey);
  else state.expandedBars.add(barKey);
  render();
  bindEvents();
}

function bindEvents() {
  app.querySelectorAll('[data-action="toggle-bar"]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('.wiki-link')) return;
      toggleCoverageBar(row.dataset.barKey);
    });
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleCoverageBar(row.dataset.barKey);
      }
    });
  });

  app.querySelectorAll('.party-slot-select').forEach((select) => {
    select.addEventListener('change', (event) => {
      const slot = Number(event.target.dataset.slot);
      state.slots[slot] = event.target.value || null;
      persistParty();
      render();
      bindEvents();
    });
  });

  app.querySelector('#level-cap')?.addEventListener('change', (event) => {
    const value = Number(event.target.value);
    state.levelCap = Number.isFinite(value) ? Math.min(60, Math.max(1, value)) : 60;
    render();
    bindEvents();
  });

  app.querySelector('[data-action="clear-party"]')?.addEventListener('click', () => {
    state.slots = Array(PARTY_SIZE).fill(null);
    state.expandedBars.clear();
    persistParty();
    render();
    bindEvents();
  });

  bindSpellTooltips();
  bindShareControl(app);
}

async function init() {
  render();
  bindEvents();

  const [allClassEntries, buffRows] = await Promise.all([
    loadAllClassEntries(),
    loadBuffPageRows(),
  ]);

  state.allClassEntries = allClassEntries;
  state.buffRows = buffRows;
  render();
  bindEvents();
}

init();
