import './launch-countdown.css';

// October 1, 2026 at 07:00 BST (Europe/London), the owner's local time.
export const LAUNCH_AT = Date.parse('2026-10-01T07:00:00+01:00');

export function launchRemaining(now = Date.now()) {
  const total = Math.max(0, Math.ceil((LAUNCH_AT - now) / 1000));
  return { days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60, seconds: total % 60, launched: now >= LAUNCH_AT };
}

class LaunchCountdown extends HTMLElement {
  connectedCallback() {
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Game launch countdown');
    this.innerHTML = `<div class="launch-copy"><strong>Monsters &amp; Memories launches in</strong><span>October 1 · 7:00 AM BST (UK time)</span></div><div class="launch-clock" role="timer" aria-live="off">${['days', 'hours', 'minutes', 'seconds'].map(unit => `<span class="launch-unit"><b data-unit="${unit}">00</b><small>${unit}</small></span>`).join('')}</div>`;
    this.update();
    if (!launchRemaining().launched) this.timer = setInterval(() => this.update(), 1000);
  }

  disconnectedCallback() { clearInterval(this.timer); }

  update() {
    const remaining = launchRemaining();
    if (remaining.launched) {
      this.innerHTML = '<div class="launch-copy"><strong>The wait is over — launch time is here!</strong><span>October 1, 2026 · 7:00 AM BST (UK time)</span></div>';
      clearInterval(this.timer);
      return;
    }
    this.querySelectorAll('[data-unit]').forEach(node => {
      node.textContent = String(remaining[node.dataset.unit]).padStart(2, '0');
    });
  }
}

if (!customElements.get('launch-countdown')) customElements.define('launch-countdown', LaunchCountdown);
