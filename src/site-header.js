import { sitePath } from './site-paths.js';

/** @type {{ id: string, label: string, href: string }[]} */
const NAV_ITEMS = [
  { id: 'browser', label: 'Spells', href: '/' },
  { id: 'find', label: 'Find', href: 'find.html' },
  { id: 'buffs', label: 'Buffs', href: 'buffs.html' },
  { id: 'party', label: 'Party', href: 'party.html' },
  { id: 'races', label: 'Races', href: 'races.html' },
  { id: 'creator', label: 'Create', href: 'creator.html' },
];

/**
 * @param {object} options
 * @param {string} options.active Nav item id
 * @param {string} options.tagline Page subtitle
 */
export function renderSiteHeader({ active, tagline }) {
  const nav = NAV_ITEMS.map(
    (item) =>
      `<a href="${sitePath(item.href)}" class="site-nav-link${active === item.id ? ' site-nav-link--active' : ''}">${item.label}</a>`
  ).join('');

  return `
    <header class="site-header">
      <div class="site-header-inner">
        <div class="site-brand">
          <a class="site-title" href="${sitePath('/')}">Monsters &amp; Memories</a>
          <p class="site-tagline">${tagline}</p>
        </div>
        <nav class="site-nav" aria-label="Site">${nav}</nav>
      </div>
    </header>
  `;
}
