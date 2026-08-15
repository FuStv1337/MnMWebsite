/** @typedef {{ key: string, param?: string, get: () => unknown, set: (value: unknown) => void, serialize?: (value: unknown) => string | null | undefined, deserialize?: (raw: string) => unknown, defaultValue?: unknown }} UrlBinding */

export const urlParsers = {
  /** @param {string} raw */
  string(raw) {
    return raw;
  },

  /** @param {string} raw */
  int(raw) {
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  },

  /** @param {string} raw */
  bool(raw) {
    return raw === '1' || raw === 'true';
  },

  /** @param {string} raw */
  tags(raw) {
    return new Set(raw.split(',').map((tag) => tag.trim()).filter(Boolean));
  },
};

export const urlSerializers = {
  /** @param {unknown} value */
  string(value) {
    const text = String(value ?? '').trim();
    return text || null;
  },

  /** @param {unknown} value */
  int(value) {
    return Number.isFinite(value) ? String(value) : null;
  },

  /** @param {unknown} value @param {boolean} [defaultValue=false] */
  bool(value, defaultValue = false) {
    if (value === defaultValue) return null;
    return value ? '1' : '0';
  },

  /** @param {unknown} value */
  tags(value) {
    if (!(value instanceof Set) || value.size === 0) return null;
    return [...value].sort().join(',');
  },
};

/**
 * @param {UrlBinding[]} bindings
 * @param {string[]} [preserve]
 */
export function readUrlBindings(bindings, preserve = ['share']) {
  const current = new URLSearchParams(window.location.search);

  for (const binding of bindings) {
    const param = binding.param ?? binding.key;
    const raw = current.get(param);
    if (raw == null || raw === '') continue;

    try {
      const value = binding.deserialize ? binding.deserialize(raw) : raw;
      if (value !== undefined) binding.set(value);
    } catch {
      // Ignore malformed query params.
    }
  }

  return current.get('share');
}

/**
 * @param {UrlBinding[]} bindings
 * @param {{ preserve?: string[], extra?: Record<string, string | null | undefined> }} [options]
 */
export function syncUrlBindings(bindings, options = {}) {
  const preserve = options.preserve ?? ['share'];
  const current = new URLSearchParams(window.location.search);
  const params = new URLSearchParams();

  for (const key of preserve) {
    const value = options.extra?.[key] ?? current.get(key);
    if (value) params.set(key, value);
  }

  for (const binding of bindings) {
    const param = binding.param ?? binding.key;
    const value = binding.get();
    const serialized = binding.serialize
      ? binding.serialize(value)
      : value === binding.defaultValue || value == null || value === ''
        ? null
        : String(value);

    if (serialized != null && serialized !== '') {
      params.set(param, serialized);
    }
  }

  for (const [key, value] of Object.entries(options.extra ?? {})) {
    if (preserve.includes(key)) continue;
    if (value) params.set(key, value);
    else params.delete(key);
  }

  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
  const currentUrl = `${window.location.pathname}${window.location.search}`;

  if (next !== currentUrl) {
    window.history.replaceState(null, '', next);
  }
}

/**
 * @param {{ label?: string }} [options]
 */
export function renderShareControl(options = {}) {
  const label = options.label ?? 'Copy share link';

  return `
    <div class="share-control">
      <button type="button" class="secondary-btn" data-action="copy-share-link">${label}</button>
      <span class="share-feedback muted" data-share-feedback hidden aria-live="polite">Link copied</span>
    </div>
  `;
}

export function bindShareControl(root = document) {
  root.querySelector('[data-action="copy-share-link"]')?.addEventListener('click', async () => {
    const feedback = root.querySelector('[data-share-feedback]');

    try {
      await navigator.clipboard.writeText(window.location.href);
      if (feedback) {
        feedback.hidden = false;
        window.setTimeout(() => {
          feedback.hidden = true;
        }, 2000);
      }
    } catch {
      window.prompt('Copy this link:', window.location.href);
    }
  });
}
