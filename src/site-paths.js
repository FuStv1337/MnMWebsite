/** Base URL prefix from Vite (e.g. `/` locally, `/MnMWebsite/` on GitHub Pages). */
export const BASE = import.meta.env.BASE_URL;

/**
 * @param {string} path
 */
export function sitePath(path = '') {
  if (!path || path === '/') return BASE;
  return `${BASE}${path.replace(/^\//, '')}`;
}
