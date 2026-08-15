import statisticsData from '../data/statistics.json';
import { renderInfoTip } from './info-tip.js';

export const { primaryStats, secondaryStats, source: statisticsSource } = statisticsData;

/** @param {string} abbrev */
export function getPrimaryStatInfo(abbrev) {
  return primaryStats[abbrev] ?? null;
}

/** @param {string} text */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {string[]} statKeys @param {{ compact?: boolean }} [options] */
export function renderStatGuide(statKeys, { compact = false } = {}) {
  const cards = statKeys
    .map((key) => {
      const info = getPrimaryStatInfo(key);
      if (!info) return '';
      const notes = info.notes?.length
        ? `<ul class="stat-guide-notes">${info.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
        : '';
      return `
        <article class="stat-guide-card${compact ? ' stat-guide-card--compact' : ''}">
          <div class="stat-guide-card-head">
            <span class="stat-guide-abbrev">${escapeHtml(key)}</span>
            <span class="stat-guide-name">${escapeHtml(info.name)}</span>
          </div>
          <p class="stat-guide-desc">${escapeHtml(info.description)}</p>
          ${notes}
        </article>
      `;
    })
    .join('');

  return `
    <section class="stat-guide">
      <div class="stat-guide-head">
        <h3>What each stat does</h3>
        <a class="stat-guide-link" href="${escapeHtml(statisticsSource)}" target="_blank" rel="noopener">Wiki ↗</a>
      </div>
      <div class="stat-guide-grid">${cards}</div>
    </section>
  `;
}

/** @param {string} key @param {{ withTip?: boolean }} [options] */
export function renderStatLabel(key, { withTip = false } = {}) {
  const info = getPrimaryStatInfo(key);
  if (!info) return escapeHtml(key);

  const label = `<span class="stat-label-wrap"><span class="stat-label-abbrev">${escapeHtml(key)}</span><span class="stat-label-name">${escapeHtml(info.name)}</span></span>`;

  if (!withTip) {
    return label;
  }

  const notes = info.notes?.length
    ? `\n\n${info.notes.map((note) => `• ${note}`).join('\n')}`
    : '';

  return renderInfoTip({
    label,
    body: escapeHtml(`${info.description}${notes}`),
    footer: `<a href="${escapeHtml(statisticsSource)}" target="_blank" rel="noopener">Wiki ↗</a>`,
    className: 'info-tip--stat',
  });
}

export { escapeHtml as escapeStatHtml };
