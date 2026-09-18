/* Inspection-only read-only presentation track. Never edits the rule state.
 * Capture DOM before/after a real action; reveal target health and frozen status
 * at that target's authoritative mesh contact, even when seeking backwards.
 * This is deliberately not a complete board/hand/death replay implementation.
 */
(function (G) {
  'use strict';
  const key = ref => ref && `${ref.side}:${ref.uid}`;
  function plan(before, after, group) {
    if (!Array.isArray(group) || !group.length) return [];
    const origin = group[0].start, deadlines = new Map();
    for (const d of group) {
      const k = key(d.targetRef), at = d.impact - origin;
      if (!k || d.visualOnly || !Number.isFinite(at)) continue;
      deadlines.set(k, Math.min(deadlines.get(k) ?? Infinity, Math.max(0, at)));
    }
    return [...deadlines].filter(([k]) => before[k] && after[k]).map(([k, at]) => ({
      key: k, at, before: structuredClone(before[k]), after: structuredClone(after[k])
    }));
  }
  function stateAt(track, ms) {
    const t = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    return Object.fromEntries(track.map(x => [x.key, structuredClone(t < x.at ? x.before : x.after)]));
  }
  function create(doc) {
    let track = [], applied = new Map(), active = false;
    function elements() {
      const list = [...doc.querySelectorAll('#battle .minion[data-uid][data-side]')].map(el => [key(el.dataset), el]);
      for (const side of ['p', 'e']) {
        const el = doc.getElementById(side === 'p' ? 'player-hero' : 'enemy-hero');
        if (el) list.push([`${side}:hero`, el]);
      }
      return new Map(list);
    }
    function capture() {
      return Object.fromEntries([...elements()].map(([k, el]) => {
        const hero = k.endsWith(':hero'), hp = el.querySelector(hero ? '.hero-health' : '.stat.hp');
        return [k, {
          frozen: el.classList.contains('frozen'),
          label: el.getAttribute('aria-label'),
          status: el.querySelector('.minion-status')?.innerHTML ?? null,
          hp: hp?.querySelector('.stat-value')?.textContent ?? null,
          hurt: hp?.classList.contains(hero ? 'damaged' : 'hurt') || false
        }];
      }));
    }
    function paint(states) {
      const live = elements();
      for (const [k, value] of Object.entries(states)) {
        const el = live.get(k); if (!el) continue; // Never resurrect a removed card.
        const signature = JSON.stringify(value), last = applied.get(k);
        if (last?.el === el && last.signature === signature) continue;
        el.classList.toggle('frozen', value.frozen);
        if (value.label === null) el.removeAttribute('aria-label');
        else el.setAttribute('aria-label', value.label);
        const status = el.querySelector('.minion-status');
        if (status && value.status !== null) status.innerHTML = value.status;
        const hero = k.endsWith(':hero'), hp = el.querySelector(hero ? '.hero-health' : '.stat.hp');
        if (hp && value.hp !== null) {
          const number = hp.querySelector('.stat-value'); if (number) number.textContent = value.hp;
          hp.classList.toggle(hero ? 'damaged' : 'hurt', value.hurt);
        }
        applied.set(k, { el, signature });
      }
    }
    return {
      capture,
      set(before, after, group) { this.clear(); track = plan(before, after, group); },
      seek(ms) { active = true; paint(stateAt(track, ms)); },
      restore() {
        if (active) { applied.clear(); paint(Object.fromEntries(track.map(x => [x.key, x.after]))); }
        active = false; applied.clear();
      },
      clear() { this.restore(); track = []; },
      get active() { return active; },
      get checkpoints() { return track.map(x => ({ key: x.key, at: x.at })); }
    };
  }
  const api = Object.freeze({ plan, stateAt, create });
  G.EmberReplayState = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
