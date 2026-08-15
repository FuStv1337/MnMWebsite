/** @param {string} text */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object} options
 * @param {string} options.label Trigger label HTML/text
 * @param {string} [options.title] Tooltip title
 * @param {string} [options.body] Tooltip body
 * @param {string} [options.footer] Optional footer link HTML
 * @param {string} [options.className] Extra class on wrapper
 */
export function renderInfoTip({ label, title, body, footer, className = '' }) {
  if (!body && !title) return label;

  return `
    <span class="info-tip ${className}">
      <button type="button" class="info-tip-trigger" aria-describedby="">${label}</button>
      <span class="info-tip-panel" role="tooltip">${[
        title ? `<span class="info-tip-title">${title}</span>` : '',
        body ? `<span class="info-tip-body">${body}</span>` : '',
        footer ? `<span class="info-tip-footer">${footer}</span>` : '',
      ]
        .filter(Boolean)
        .join('')}</span>
    </span>
  `;
}

/** @param {ParentNode} [root] */
export function initInfoTips(root = document) {
  root.querySelectorAll('.info-tip:not([data-tip-init])').forEach((tip) => {
    tip.dataset.tipInit = '1';

    const trigger = tip.querySelector('.info-tip-trigger');
    const panel = tip.querySelector('.info-tip-panel');
    if (!trigger || !panel) return;

    const tipId = `info-tip-${Math.random().toString(36).slice(2, 9)}`;
    panel.id = tipId;
    trigger.setAttribute('aria-describedby', tipId);

    const position = () => {
      panel.classList.add('info-tip-panel--visible');
      panel.style.top = '-9999px';
      panel.style.left = '0';

      const triggerRect = trigger.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const gap = 8;
      const padding = 12;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;

      let top = triggerRect.bottom + gap;
      let left = triggerRect.left;

      if (top + panelRect.height > viewportHeight - padding) {
        top = triggerRect.top - panelRect.height - gap;
      }
      if (top < padding) {
        top = Math.max(padding, triggerRect.bottom + gap);
      }

      if (left + panelRect.width > viewportWidth - padding) {
        left = viewportWidth - panelRect.width - padding;
      }
      if (left < padding) left = padding;

      panel.style.top = `${Math.round(top)}px`;
      panel.style.left = `${Math.round(left)}px`;
    };

    const show = () => {
      panel.classList.add('info-tip-panel--visible');
      position();
    };

    const hide = () => {
      panel.classList.remove('info-tip-panel--visible');
      panel.style.removeProperty('top');
      panel.style.removeProperty('left');
    };

    tip.addEventListener('mouseenter', show);
    tip.addEventListener('mouseleave', hide);
    tip.addEventListener('focusin', show);
    tip.addEventListener('focusout', (event) => {
      if (!tip.contains(event.relatedTarget)) hide();
    });

    const reposition = () => {
      if (panel.classList.contains('info-tip-panel--visible')) position();
    };

    window.addEventListener('scroll', reposition, { passive: true, capture: true });
    window.addEventListener('resize', reposition, { passive: true });
  });
}

/**
 * @param {object | null | undefined} ability
 * @param {string} [fallbackLabel]
 */
export function renderRacialAbilityTip(ability, fallbackLabel = 'Unknown') {
  if (!ability?.name) {
    return `<span class="muted">${escapeHtml(fallbackLabel)}</span>`;
  }

  const footer = ability.url
    ? `<a href="${escapeHtml(ability.url)}" target="_blank" rel="noopener">Wiki ↗</a>`
    : '';

  return renderInfoTip({
    label: escapeHtml(ability.name),
    body: escapeHtml(ability.description || 'No description on the wiki yet.'),
    footer,
    className: 'info-tip--ability',
  });
}

/**
 * @param {object | null | undefined} classDetails
 * @param {string} className
 */
export function renderClassStatTip(classDetails, className) {
  if (!classDetails?.primaryStat && !classDetails?.modifierText) {
    return '';
  }

  const parts = [];
  if (classDetails.primaryStat) {
    parts.push(`Primary stat: ${classDetails.primaryStat}`);
  }
  if (classDetails.secondaryStat) {
    parts.push(`Also prioritize: ${classDetails.secondaryStat}`);
  }
  if (classDetails.modifierText) {
    parts.push(`Race base modifiers: ${classDetails.modifierText}`);
  }
  if (classDetails.bonusPointsAdvice) {
    parts.push(classDetails.bonusPointsAdvice);
  }

  return renderInfoTip({
    label: `${escapeHtml(classDetails.primaryStat || className)}`,
    title: `${escapeHtml(className)} stat info`,
    body: escapeHtml(parts.join('\n\n')),
    footer: classDetails.wikiUrl
      ? `<a href="${escapeHtml(classDetails.wikiUrl)}" target="_blank" rel="noopener">Class wiki ↗</a>`
      : '',
    className: 'info-tip--class-stat',
  });
}
