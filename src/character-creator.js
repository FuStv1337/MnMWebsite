import './style.css';
import { sitePath } from './site-paths.js';
import { renderSiteHeader } from './site-header.js';
import { CLASS_ROLES } from './constants.js';
import {
  creationData,
  statKeys,
  statPointBudget,
  traitSlots,
  races,
  classes,
  getRacesForClass,
  getStartingStats,
  getAvailableTraits,
  computeFinalStats,
  getRemainingPoints,
  buildClassComparison,
  buildRaceComparison,
  getStatBreakdown,
  loadSavedBuild,
  saveBuild,
  getStatHighlights,
  getClassDetails,
  computeClassFitScore,
  computeTraitStatBonuses,
  findTraitByName,
  parseTraitStatModifiers,
  formatTraitStatModifierSummary,
  getMajorCombatTraitGroup,
} from './character-creator-data.js';
import { renderStatLabel, getPrimaryStatInfo, statisticsSource } from './stat-info.js';
import { renderRacialAbilityTip, renderInfoTip, initInfoTips } from './info-tip.js';
import { bindShareControl, renderShareControl, syncUrlBindings } from './url-state.js';
import { decodeCharacterBuild, encodeCharacterBuild } from './share-profile.js';

const app = document.querySelector('#app');

const defaultAllocation = Object.fromEntries(statKeys.map((key) => [key, 0]));
const defaultTraits = Object.fromEntries(traitSlots.map((slot) => [slot.id, null]));

function loadInitialBuild() {
  const share = new URLSearchParams(window.location.search).get('share');
  const shared = decodeCharacterBuild(share);
  if (shared) return shared;
  return loadSavedBuild();
}

const initialBuild = loadInitialBuild();

/** @type {object} */
const state = {
  raceName: initialBuild?.raceName ?? 'Human',
  className: initialBuild?.className ?? 'Cleric',
  statAllocation: { ...defaultAllocation, ...(initialBuild?.statAllocation ?? {}) },
  traits: { ...defaultTraits, ...(initialBuild?.traits ?? {}) },
  compareView: initialBuild?.compareView ?? 'class',
  expandedTraitSlot: null,
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

function persist() {
  saveBuild({
    raceName: state.raceName,
    className: state.className,
    statAllocation: state.statAllocation,
    traits: state.traits,
    compareView: state.compareView,
  });
  syncShareUrl();
}

function syncShareUrl() {
  const share = encodeCharacterBuild({
    raceName: state.raceName,
    className: state.className,
    statAllocation: state.statAllocation,
    traits: state.traits,
    compareView: state.compareView,
  });

  syncUrlBindings([], { preserve: [], extra: { share } });
}

function ensureValidCombo() {
  if (!state.className) return;
  const racesForClass = getRacesForClass(state.className);
  if (!racesForClass.length) return;
  if (!state.raceName || !racesForClass.includes(state.raceName)) {
    state.raceName = racesForClass[0];
  }
}

function resetAllocation() {
  state.statAllocation = { ...defaultAllocation };
}

function resetTraits() {
  state.traits = { ...defaultTraits };
}

function renderClassOptions(selectedClass) {
  return Object.values(CLASS_ROLES)
    .map((role) => {
      const options = role.classes
        .map(
          (className) =>
            `<option value="${escapeHtml(className)}"${selectedClass === className ? ' selected' : ''}>${escapeHtml(className)}</option>`
        )
        .join('');
      return `<optgroup label="${escapeHtml(role.label)}">${options}</optgroup>`;
    })
    .join('');
}

function renderRaceOptions() {
  const available = getRacesForClass(state.className);
  return available
    .map((raceName) => {
      const race = races.find((entry) => entry.name === raceName);
      const ability = race?.racialAbility?.name;
      const suffix = [race?.alignment, ability].filter(Boolean).join(' · ');
      return `<option value="${escapeHtml(raceName)}"${state.raceName === raceName ? ' selected' : ''}>${escapeHtml(raceName)}${suffix ? ` (${escapeHtml(suffix)})` : ''}</option>`;
    })
    .join('');
}

function formatModifierChip(key, value) {
  return `<span class="creator-mod-chip">+${value} ${key}</span>`;
}

function formatTraitMod(value) {
  if (!value) return '—';
  return value > 0 ? `+${value}` : String(value);
}

function renderTraitStatChips(mods) {
  const entries = statKeys.filter((key) => mods[key]);
  if (!entries.length) return '';
  return `
    <div class="creator-trait-stat-chips">
      ${entries
        .map(
          (key) =>
            `<span class="creator-trait-stat-chip">${escapeHtml(formatTraitMod(mods[key]))}% ${key}</span>`
        )
        .join('')}
    </div>
  `;
}

function renderStatAllocator(baseStats, finalStats, statBreakdown, primaryStat, secondaryStat, traitBonuses) {
  const remaining = getRemainingPoints(state.statAllocation);
  const hasTraitBonuses = statKeys.some((key) => traitBonuses[key]);

  return `
    <section class="creator-stat-panel card">
      <div class="creator-section-head">
        <div>
          <h2>Attribute points</h2>
          <p class="creator-note">
            Starting = race base + class modifiers. Distribute ${statPointBudget} bonus points.
            ${hasTraitBonuses ? ' Trait passives add 5% after allocation, shown in the +Traits column.' : ''}
            ${primaryStat ? `Primary stat: <strong>${escapeHtml(primaryStat)}</strong>${secondaryStat ? ` · Also prioritize <strong>${escapeHtml(secondaryStat)}</strong>` : ''}.` : ''}
          </p>
        </div>
        <span class="creator-points-badge${remaining === 0 ? ' creator-points-badge--done' : ''}">
          ${remaining} / ${statPointBudget} left
        </span>
      </div>
      ${
        statBreakdown?.modifierText
          ? `<div class="creator-modifiers">${statBreakdown.modifierText.split(/,\s*/).map((part) => {
              const m = part.trim().match(/\+\s*(\d+)\s*([A-Z]{3})/);
              return m ? formatModifierChip(m[2], m[1]) : '';
            }).join('')}</div>`
          : ''
      }
      <div class="creator-stat-table-wrap">
        <div class="creator-stat-table-head">
          <span>Attribute</span>
          <span>Base</span>
          <span>+Class</span>
          <span>Starting</span>
          <span>+Traits</span>
          <span>Allocate</span>
          <span>Final</span>
        </div>
        <div class="creator-stat-grid">
          ${statKeys
            .map((key) => {
              const row = statBreakdown?.breakdown?.[key];
              const base = row?.base ?? baseStats?.[key];
              const modifier = row?.modifier ?? 0;
              const starting = row?.starting ?? baseStats?.[key];
              const traitMod = traitBonuses[key] ?? 0;
              const bonus = state.statAllocation[key] ?? 0;
              const finalValue = finalStats[key];
              const info = getPrimaryStatInfo(key);
              let rowClass = 'creator-stat-row';
              if (key === primaryStat) rowClass += ' creator-stat-row--primary';
              if (key === secondaryStat) rowClass += ' creator-stat-row--secondary';
              return `
                <div class="${rowClass}">
                  <div class="creator-stat-label-block">
                    ${renderStatLabel(key, { withTip: Boolean(info) })}
                  </div>
                  <span class="creator-stat-base">${formatStat(base)}</span>
                  <span class="creator-stat-mod">${modifier ? `+${modifier}` : '—'}</span>
                  <span class="creator-stat-start">${formatStat(starting)}</span>
                  <span class="creator-stat-trait${traitMod ? ' creator-stat-trait--active' : ''}">${formatTraitMod(traitMod)}</span>
                  <div class="creator-stat-controls">
                    <button type="button" class="creator-stat-btn" data-action="stat-dec" data-stat="${key}"${bonus <= 0 ? ' disabled' : ''} aria-label="Remove point from ${key}">−</button>
                    <span class="creator-stat-bonus">+${bonus}</span>
                    <button type="button" class="creator-stat-btn" data-action="stat-inc" data-stat="${key}"${remaining <= 0 ? ' disabled' : ''} aria-label="Add point to ${key}">+</button>
                  </div>
                  <strong class="creator-stat-final">${formatStat(finalValue)}</strong>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
      <div class="creator-stat-actions">
        <button type="button" class="btn-secondary" data-action="reset-stats">Reset points</button>
        <a class="creator-stat-link" href="${escapeHtml(statisticsSource)}" target="_blank" rel="noopener">Stat definitions ↗</a>
      </div>
    </section>
  `;
}

function renderComparisonTable() {
  ensureValidCombo();

  if (!state.raceName || !state.className) {
    return '<p class="muted">Pick a race and class to see comparison tables.</p>';
  }

  if (state.compareView === 'class') {
    const rows = buildClassComparison(state.className);
    return renderStatsMatrix({
      title: `${state.className} — race comparison`,
      subtitle: 'Starting stats for every race that can play this class. Click a row to select a race.',
      rowHeader: 'Race',
      compareView: 'class',
      classDetails: getClassDetails(state.className),
      rows: rows.map((row) => ({
        id: row.raceName,
        label: row.raceName,
        meta: row.alignment,
        racialAbility: row.racialAbility,
        stats: row.stats,
        selected: row.raceName === state.raceName,
        pickAction: 'pick-race',
      })),
    });
  }

  const rows = buildRaceComparison(state.raceName);
  return renderStatsMatrix({
    title: `${state.raceName} — class comparison`,
    subtitle: 'Starting stats for every class this race can play. Click a row to select a class.',
    rowHeader: 'Class',
    compareView: 'race',
    rows: rows.map((row) => ({
        id: row.className,
        label: row.className,
        meta: [row.role, row.armor, row.pet ? 'Pet' : null].filter(Boolean).join(' · '),
        stats: row.stats,
        selected: row.className === state.className,
        pickAction: 'pick-class',
      })),
  });
}

function getCompareCellClass(key, value, statHighlight, compareView, classDetails, rowId) {
  if (value == null) return '';

  if (compareView === 'class' && classDetails) {
    const primary = classDetails.primaryStat;
    const secondary = classDetails.secondaryStat;
    const { max, min } = statHighlight ?? { max: null, min: null };

    if (key === primary) {
      let cls = ' creator-stat-col--primary';
      if (max != null && value === max && max !== min) cls += ' creator-stat--best';
      else if (min != null && value === min && max !== min) cls += ' creator-stat--worst';
      return cls;
    }
    if (key === secondary) {
      let cls = ' creator-stat-col--secondary';
      if (max != null && value === max && max !== min) cls += ' creator-stat--best';
      return cls;
    }
    return ' creator-stat-col--muted';
  }

  if (compareView === 'race') {
    const rowClass = getClassDetails(rowId);
    if (key === rowClass?.primaryStat) return ' creator-stat-col--primary';
    if (key === rowClass?.secondaryStat) return ' creator-stat-col--secondary';
  }

  return '';
}

function getCompareHeaderClass(key, compareView, classDetails) {
  if (compareView !== 'class' || !classDetails) return '';
  if (key === classDetails.primaryStat) return ' creator-compare-th--primary';
  if (key === classDetails.secondaryStat) return ' creator-compare-th--secondary';
  return ' creator-compare-th--muted';
}

function renderCompareLegend(compareView, classDetails) {
  if (compareView === 'class' && classDetails?.primaryStat) {
    const secondary = classDetails.secondaryStat
      ? ` · <span class="creator-legend-secondary">${escapeHtml(classDetails.secondaryStat)} secondary</span>`
      : '';
    return `<p class="creator-compare-legend"><span class="creator-legend-primary">${escapeHtml(classDetails.primaryStat)} primary</span>${secondary} highlighted · green = best among races · red = lowest primary · <strong>Fit</strong> = starting stats weighted by class modifiers (${escapeHtml(classDetails.modifierText || '')})</p>`;
  }
  if (compareView === 'race') {
    return '<p class="creator-compare-legend">Gold and blue columns show each class’s primary and secondary stat.</p>';
  }
  return '';
}

function renderStatsMatrix({ title, subtitle, rowHeader, rows, compareView = 'class', classDetails = null }) {
  const highlights = Object.fromEntries(
    statKeys.map((key) => [key, getStatHighlights(rows, key)])
  );

  const showFitColumn = compareView === 'class' && classDetails?.statModifiers;
  const fitScores = showFitColumn
    ? rows.map((row) => computeClassFitScore(row.stats, classDetails.statModifiers))
    : [];
  const fitMax =
    fitScores.length && fitScores.some((score) => score != null)
      ? Math.max(...fitScores.filter((score) => score != null))
      : null;
  const fitMin =
    fitScores.length && fitScores.some((score) => score != null)
      ? Math.min(...fitScores.filter((score) => score != null))
      : null;

  return `
    <section class="creator-compare card">
      <div class="creator-section-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p class="creator-note">${escapeHtml(subtitle)}</p>
          ${renderCompareLegend(compareView, classDetails)}
        </div>
        <div class="creator-compare-toggle">
          <button type="button" class="creator-toggle-btn${state.compareView === 'class' ? ' creator-toggle-btn--active' : ''}" data-action="compare-class">By class</button>
          <button type="button" class="creator-toggle-btn${state.compareView === 'race' ? ' creator-toggle-btn--active' : ''}" data-action="compare-race">By race</button>
        </div>
      </div>
      <div class="creator-table-scroll">
        <table class="creator-compare-table">
          <thead>
            <tr>
              <th>${escapeHtml(rowHeader)}</th>
              ${statKeys.map((key) => `<th class="creator-compare-th${getCompareHeaderClass(key, compareView, classDetails)}">${key}</th>`).join('')}
              ${showFitColumn ? '<th class="creator-compare-th creator-compare-th--fit">Fit</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row, rowIndex) => {
                const cells = statKeys
                  .map((key) => {
                    const value = row.stats?.[key];
                    const cls = getCompareCellClass(
                      key,
                      value,
                      highlights[key],
                      compareView,
                      classDetails,
                      row.id
                    );
                    return `<td class="creator-stat${cls}">${formatStat(value)}</td>`;
                  })
                  .join('');

                const fitScore = showFitColumn ? fitScores[rowIndex] : null;
                let fitCell = '';
                if (showFitColumn) {
                  let fitCls = ' creator-fit-cell';
                  if (fitScore != null && fitMax != null && fitScore === fitMax && fitMax !== fitMin) {
                    fitCls += ' creator-stat--best';
                  }
                  const fillWidth =
                    fitScore != null && fitMax != null && fitMax > 0
                      ? Math.round((fitScore / fitMax) * 100)
                      : 0;
                  fitCell = `
                    <td class="creator-stat${fitCls}">
                      <span class="creator-fit-score">${fitScore != null ? fitScore : '—'}</span>
                      ${
                        fitScore != null
                          ? `<span class="creator-fit-gauge" aria-hidden="true"><span class="creator-fit-fill" style="width: ${fillWidth}%"></span></span>`
                          : ''
                      }
                    </td>
                  `;
                }

                return `
                  <tr class="creator-compare-row${row.selected ? ' creator-compare-row--selected' : ''}"${row.pickAction ? ` data-action="${row.pickAction}" data-pick-value="${escapeHtml(row.id)}" tabindex="0" role="button"` : ''}>
                    <td class="creator-compare-label">
                      <strong>${escapeHtml(row.label)}</strong>
                      ${row.meta ? `<span class="creator-compare-meta">${escapeHtml(row.meta)}</span>` : ''}
                      ${row.racialAbility ? `<span class="creator-compare-ability">${renderRacialAbilityTip(row.racialAbility)}</span>` : ''}
                    </td>
                    ${cells}
                    ${fitCell}
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderClassPicker() {
  return `
    <label class="field field--grow">
      <span class="field-label">Choose class</span>
      <select id="class-select" class="class-select">
        ${renderClassOptions(state.className)}
      </select>
    </label>
  `;
}

function renderRacePicker() {
  const available = getRacesForClass(state.className);
  return `
    <label class="field field--grow">
      <span class="field-label">Choose race</span>
      <select id="race-select" class="class-select"${available.length ? '' : ' disabled'}>
        ${
          available.length
            ? renderRaceOptions()
            : '<option value="">No races available</option>'
        }
      </select>
    </label>
  `;
}

function renderSetupBar(race, cls) {
  const remaining = getRemainingPoints(state.statAllocation);
  const traitsPicked = traitSlots.filter((slot) => state.traits[slot.id]).length;
  const ready = remaining === 0 && traitsPicked === traitSlots.length;

  const primaryStatTip = cls?.primaryStat
    ? renderInfoTip({
        label: escapeHtml(cls.primaryStat),
        title: `${escapeHtml(cls.name)} stats`,
        body: escapeHtml(
          [
            `Primary: ${cls.primaryStat}`,
            cls.secondaryStat ? `Also prioritize: ${cls.secondaryStat}` : '',
            cls.modifierText ? `Class modifiers: ${cls.modifierText}` : '',
            cls.bonusPointsAdvice,
          ]
            .filter(Boolean)
            .join('\n\n')
        ),
        footer: cls.wikiUrl
          ? `<a href="${escapeHtml(cls.wikiUrl)}" target="_blank" rel="noopener">Class wiki ↗</a>`
          : '',
        className: 'info-tip--inline',
      })
    : '';

  return `
    <section class="creator-setup card">
      <div class="creator-setup-pickers">
        ${renderClassPicker()}
        ${renderRacePicker()}
      </div>
      <div class="creator-setup-summary">
        <div class="creator-setup-chip">
          <span class="creator-summary-label">Class</span>
          <strong>${escapeHtml(cls?.name ?? '—')}</strong>
          <span class="creator-summary-meta">${escapeHtml(cls?.role ?? '')}${cls?.armor ? ` · ${escapeHtml(cls.armor)}` : ''}</span>
          ${
            primaryStatTip
              ? `<div class="creator-setup-inline"><span class="creator-summary-label">Primary</span>${primaryStatTip}${cls?.secondaryStat ? `<span class="creator-setup-secondary">· ${escapeHtml(cls.secondaryStat)}</span>` : ''}</div>`
              : ''
          }
          ${cls?.modifierText ? `<span class="creator-summary-meta creator-modifier-line">${escapeHtml(cls.modifierText)}</span>` : ''}
        </div>
        <div class="creator-setup-chip">
          <span class="creator-summary-label">Race</span>
          <strong>${escapeHtml(race?.name ?? '—')}</strong>
          <span class="creator-summary-meta">${escapeHtml(race?.alignment ?? '')}${race?.resistances ? ` · ${escapeHtml(race.resistances)}` : ''}</span>
          <div class="creator-setup-inline">
            <span class="creator-summary-label">Ability</span>
            ${renderRacialAbilityTip(race?.racialAbility)}
          </div>
        </div>
        <div class="creator-setup-chip creator-setup-chip--stats">
          <span class="creator-summary-label">Progress</span>
          <span class="creator-setup-progress">${statPointBudget - remaining}/${statPointBudget} points · ${traitsPicked}/${traitSlots.length} traits</span>
          <span class="creator-ready-badge${ready ? ' creator-ready-badge--ready' : ''}">
            ${ready ? 'Ready to create' : 'In progress'}
          </span>
        </div>
      </div>
      ${renderShareControl({ label: 'Copy build link' })}
    </section>
  `;
}

function renderTraitOptionsList(slot, available, selected) {
  if (slot.category !== 'majorCombat') {
    return available.map((trait) => renderTraitOption(slot.id, trait, selected)).join('');
  }

  const groups = [
    { id: 'stat', label: 'Attribute bonuses' },
    { id: 'resist', label: 'Resistances' },
    { id: 'other', label: 'Other' },
  ];

  return groups
    .map(({ id, label }) => {
      const traitsInGroup = available.filter((trait) => getMajorCombatTraitGroup(trait) === id);
      if (!traitsInGroup.length) return '';
      return `
        <div class="creator-trait-group">
          <div class="creator-trait-group-label">${escapeHtml(label)}</div>
          ${traitsInGroup.map((trait) => renderTraitOption(slot.id, trait, selected)).join('')}
        </div>
      `;
    })
    .join('');
}

function renderTraitOption(slotId, trait, selected) {
  const mods = parseTraitStatModifiers(trait.description);
  const modSummary = formatTraitStatModifierSummary(mods);

  return `
    <button
      type="button"
      class="creator-trait-option${selected === trait.name ? ' creator-trait-option--active' : ''}"
      data-action="pick-trait"
      data-slot="${slotId}"
      data-trait="${escapeHtml(trait.name)}"
    >
      <span class="creator-trait-option-top">
        <span class="creator-trait-option-name">${escapeHtml(trait.name)}</span>
        ${modSummary ? `<span class="creator-trait-option-stat">${escapeHtml(modSummary)}</span>` : ''}
      </span>
      <span class="creator-trait-option-desc">${escapeHtml(trait.description)}</span>
    </button>
  `;
}

function renderTraitPicker(raceName, className) {
  const traitsPicked = traitSlots.filter((slot) => state.traits[slot.id]).length;

  return `
    <section class="creator-traits card">
      <div class="creator-section-head">
        <div>
          <h2>Traits</h2>
          <p class="creator-note">${traitsPicked}/${traitSlots.length} selected · filtered for your race and class</p>
        </div>
        <button type="button" class="btn-secondary" data-action="reset-traits">Clear all</button>
      </div>
      <div class="creator-trait-grid">
        ${traitSlots
          .map((slot) => {
            const available = getAvailableTraits(slot.category, raceName, className);
            const selected = state.traits[slot.id];
            const selectedTrait =
              available.find((trait) => trait.name === selected) ?? findTraitByName(selected);
            const statMods = selectedTrait ? parseTraitStatModifiers(selectedTrait.description) : {};
            const expanded = state.expandedTraitSlot === slot.id;
            const slotLabel = slot.label.replace(' Trait', '');
            const slotSpace = slotLabel.indexOf(' ');
            const slotTag = slotSpace === -1 ? slotLabel : slotLabel.slice(0, slotSpace);
            const slotKind = slotSpace === -1 ? '' : slotLabel.slice(slotSpace + 1);

            return `
              <article class="creator-trait-card${selectedTrait ? ' creator-trait-card--filled' : ''}${expanded ? ' creator-trait-card--open' : ''}">
                <button type="button" class="creator-trait-card-head" data-action="toggle-trait-slot" data-slot="${slot.id}" aria-expanded="${expanded}">
                  <span class="creator-trait-card-badge">
                    <span class="creator-trait-slot-tag">${escapeHtml(slotTag)}</span>
                    <span class="creator-trait-slot-kind">${escapeHtml(slotKind)}</span>
                  </span>
                  <span class="creator-trait-card-pick">
                    ${
                      selectedTrait
                        ? `<strong class="creator-trait-pick-name">${escapeHtml(selectedTrait.name)}</strong>`
                        : `<span class="creator-trait-pick-empty">Choose a trait…</span>`
                    }
                  </span>
                  <span class="creator-trait-chevron" aria-hidden="true">${expanded ? '▴' : '▾'}</span>
                </button>
                ${
                  selectedTrait && !expanded
                    ? `
                  <div class="creator-trait-summary">
                    <p class="creator-trait-detail">${escapeHtml(selectedTrait.description)}</p>
                    ${renderTraitStatChips(statMods)}
                  </div>
                `
                    : ''
                }
                ${
                  expanded
                    ? `
                  <div class="creator-trait-picker">
                    <button type="button" class="creator-trait-option creator-trait-option--clear${!selected ? ' creator-trait-option--active' : ''}" data-action="pick-trait" data-slot="${slot.id}" data-trait="">
                      <span class="creator-trait-option-name">None</span>
                      <span class="creator-trait-option-desc">Leave this slot empty.</span>
                    </button>
                    ${renderTraitOptionsList(slot, available, selected)}
                  </div>
                `
                    : ''
                }
              </article>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function render() {
  ensureValidCombo();
  persist();

  const race = races.find((entry) => entry.name === state.raceName);
  const cls = classes.find((entry) => entry.name === state.className);
  const baseStats = getStartingStats(state.raceName, state.className);
  const traitBonuses = computeTraitStatBonuses(state.traits, baseStats, state.statAllocation);
  const finalStats = computeFinalStats(baseStats, state.statAllocation, traitBonuses);
  const statBreakdown = getStatBreakdown(state.raceName, state.className);

  app.innerHTML = `
    ${renderSiteHeader({ active: 'creator', tagline: 'Character creation simulator' })}

    <p class="creator-intro">
      Choose a class, compare races, allocate ${statPointBudget} attribute points, and pick traits.
      <a href="${escapeHtml(creationData.source)}" target="_blank" rel="noopener">Creation guide ↗</a>
    </p>

    ${renderSetupBar(race, cls)}

    ${renderComparisonTable()}

    <div class="creator-workspace">
      ${renderStatAllocator(baseStats, finalStats, statBreakdown, cls?.primaryStat, cls?.secondaryStat, traitBonuses)}
      ${renderTraitPicker(state.raceName, state.className)}
    </div>
  `;

  bindEvents();
  bindShareControl(app);
  initInfoTips(app);
}

function bindEvents() {
  document.getElementById('class-select')?.addEventListener('change', (event) => {
    state.className = event.target.value;
    ensureValidCombo();
    resetAllocation();
    resetTraits();
    state.expandedTraitSlot = null;
    render();
  });

  document.getElementById('race-select')?.addEventListener('change', (event) => {
    state.raceName = event.target.value;
    resetAllocation();
    resetTraits();
    state.expandedTraitSlot = null;
    render();
  });

  app.querySelectorAll('[data-action="stat-inc"]').forEach((button) => {
    button.addEventListener('click', () => {
      const stat = button.getAttribute('data-stat');
      if (!stat || getRemainingPoints(state.statAllocation) <= 0) return;
      state.statAllocation[stat] = (state.statAllocation[stat] ?? 0) + 1;
      render();
    });
  });

  app.querySelectorAll('[data-action="stat-dec"]').forEach((button) => {
    button.addEventListener('click', () => {
      const stat = button.getAttribute('data-stat');
      if (!stat || (state.statAllocation[stat] ?? 0) <= 0) return;
      state.statAllocation[stat] -= 1;
      render();
    });
  });

  app.querySelector('[data-action="reset-stats"]')?.addEventListener('click', () => {
    resetAllocation();
    render();
  });

  app.querySelector('[data-action="reset-traits"]')?.addEventListener('click', () => {
    resetTraits();
    state.expandedTraitSlot = null;
    render();
  });

  app.querySelector('[data-action="compare-class"]')?.addEventListener('click', () => {
    state.compareView = 'class';
    render();
  });

  app.querySelector('[data-action="compare-race"]')?.addEventListener('click', () => {
    state.compareView = 'race';
    render();
  });

  app.querySelectorAll('[data-action="toggle-trait-slot"]').forEach((button) => {
    button.addEventListener('click', () => {
      const slot = button.getAttribute('data-slot');
      state.expandedTraitSlot = state.expandedTraitSlot === slot ? null : slot;
      render();
    });
  });

  app.querySelectorAll('[data-action="pick-trait"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const slot = button.getAttribute('data-slot');
      const trait = button.getAttribute('data-trait');
      if (!slot) return;
      state.traits[slot] = trait || null;
      state.expandedTraitSlot = null;
      render();
    });
  });

  app.querySelectorAll('[data-action="pick-race"]').forEach((row) => {
    const pick = (event) => {
      if (event?.target?.closest('.info-tip')) return;
      const value = row.getAttribute('data-pick-value');
      if (!value || value === state.raceName) return;
      state.raceName = value;
      resetAllocation();
      resetTraits();
      state.expandedTraitSlot = null;
      render();
    };
    row.addEventListener('click', pick);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pick();
      }
    });
  });

  app.querySelectorAll('[data-action="pick-class"]').forEach((row) => {
    const pick = () => {
      const value = row.getAttribute('data-pick-value');
      if (!value || value === state.className) return;
      state.className = value;
      ensureValidCombo();
      resetAllocation();
      resetTraits();
      state.expandedTraitSlot = null;
      render();
    };
    row.addEventListener('click', pick);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pick();
      }
    });
  });
}

render();
