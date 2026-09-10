/* Independent scenery, landmark art, frames, paths and live campaign metadata.
 * Resizing never changes the game. Routes follow DOM anchors, not bitmap pixels. */
(() => {
  'use strict';
  const E = window.Emberfall, D = EmberData, A = EmberArt;
  const regions = Object.freeze({
    warden: 'asset:maps/regions/warden.webp',
    queen: 'asset:maps/regions/queen.webp',
    oracle: 'asset:maps/regions/oracle.webp',
    frost: 'asset:maps/regions/frost.webp',
    dragon: 'asset:maps/regions/dragon.webp',
    moonkeeper: 'asset:maps/regions/moonkeeper.webp',
  });
  const textures = ['asset:maps/terrain.webp', 'asset:maps/walnut.webp'];
  let assetReadiness;
  function prepareArtwork() {
    if (!assetReadiness) assetReadiness = Promise.all([...Object.values(regions), ...textures].map(src =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => image.decode().then(resolve, reject);
        image.onerror = () => reject(new Error('Map artwork could not load'));
        image.src = src;
      })
    )).catch(error => { assetReadiness = null; throw error; });
    return assetReadiness;
  }
  const escape = text => String(text).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  const compass = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="33"/><circle cx="50" cy="50" r="40"/><path d="M50 3 60 40 97 50 60 60 50 97 40 60 3 50 40 40Z"/><path d="M50 3V97M3 50H97M20 20 80 80M20 80 80 20"/></svg>';
  const lock = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3"/></svg>';

  function campaignState() {
    if (E.inBattle && E.game.s) return E.game.s;
    try {
      const state = JSON.parse(localStorage.getItem('emberfall.v1'));
      if (EmberState.valid(state, D)) return state;
    } catch { /* An absent/invalid save displays the start of the campaign. */ }
    return null;
  }

  function showMap() {
    if (EmberFX.busy || (document.getElementById('modal').dataset.locked === '1' && E.modal)) return;
    const state = campaignState(), chapter = state?.bossIndex ?? 0;
    const complete = state?.phase === 'over' && state?.winner === 'p' && chapter === D.bosses.length - 1;
    const condition = i => complete || i < chapter ? 'done' : i === chapter ? 'current' : 'locked';
    const status = i => ({done: '已战胜', current: state ? '当前挑战' : '冒险起点', locked: '尚未抵达'})[condition(i)];
    const relics = (state?.relics || []).map(id => D.relics.find(r => r.id === id)).filter(Boolean);
    E.showModal(`<section class="modal-box adventure-atlas" aria-labelledby="atlas-title">
      <span class="atlas-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <div class="modal-heading atlas-heading">
        <span class="atlas-emblem">${compass}</span>
        <div><span class="atlas-kicker">远征图志 · ${String(D.bosses.length).padStart(2, '0')} 境</span><h2 id="atlas-title">冒险地图</h2></div>
        <div class="atlas-chapter"><span>${complete ? '远征完成' : '当前旅程'}</span><strong>${String(chapter + 1).padStart(2, '0')}<small> / ${String(D.bosses.length).padStart(2, '0')}</small></strong></div>
      </div>
      <div class="atlas-stage" aria-label="战役路线" aria-busy="true">
        <div class="atlas-loading" role="status"><span>${compass}</span><p>正在展开远征图…</p><button type="button" hidden>重新加载</button></div>
        <span class="atlas-cartography" aria-hidden="true">${compass}</span>
        <svg class="atlas-paths" aria-hidden="true"><g></g></svg>
        ${D.bosses.map((boss, i) => {
          if (!regions[boss.id]) throw new Error('Missing map landmark: ' + boss.id);
          return `<article class="atlas-location ${condition(i)}" data-region="${boss.id}">
            <button class="atlas-node" data-map-node="${i}" aria-pressed="${i === chapter}" aria-label="查看${escape(boss.title)}，${status(i)}">
              <span class="atlas-landmark">
                <span class="atlas-portrait"><img src="${regions[boss.id]}" alt="${escape(boss.title)}的地貌" width="640" height="640" draggable="false"></span>
                <span class="atlas-pennant" aria-hidden="true">${i > chapter && !complete ? lock : compass}</span>
                <span class="atlas-number">${String(i + 1).padStart(2, '0')}</span>
              </span>
              <span class="atlas-location-copy"><strong class="atlas-name">${escape(boss.title)}</strong><span class="atlas-boss">${escape(boss.name)} <span>· ${boss.hp} 生命</span></span><span class="atlas-status">${condition(i) === 'done' ? '✓ ' : condition(i) === 'current' ? '◆ ' : ''}${status(i)}</span></span>
            </button>
          </article>`;
        }).join('')}
      </div>
      <div class="modal-footer atlas-footer">
        <div class="atlas-focus" aria-live="polite"><strong></strong><span></span></div>
        <div class="atlas-relics" aria-label="旅途遗物"><span class="atlas-relic-label">旅途遗物</span>${relics.length ? relics.map(r => `<span class="atlas-relic" title="${escape(r.name + '：' + r.text)}"><img src="${A.relic(r.id)}" alt="${escape(r.name)}" width="30" height="30"></span>`).join('') : '<span class="atlas-relic-empty">击败首领后获得</span>'}</div>
        <button class="gold-btn" id="map-continue">${E.inBattle ? '回到战场' : '准备出发'} ${A.icon('arrow')}</button>
      </div>
    </section>`, 'map');
    const box = document.querySelector('.adventure-atlas');
    const buttons = [...box.querySelectorAll('[data-map-node]')];
    const select = i => {
      buttons.forEach((button, n) => button.setAttribute('aria-pressed', String(i === n)));
      box.querySelector('.atlas-focus strong').textContent = `${D.bosses[i].title} · ${status(i)}`;
      box.querySelector('.atlas-focus > span').textContent = i > chapter && !complete
        ? `击败${D.bosses[i - 1].name}后抵达` : D.bosses[i].quote;
    };
    buttons.forEach((button, i) => {
      button.onclick = () => select(i);
      button.onkeydown = event => {
        if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
          : (i + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus(); select(next);
      };
    });
    select(chapter);
    box.querySelector('#map-continue').onclick = () => {
      const inBattle = E.inBattle;
      E.closeModal();
      if (!inBattle) document.getElementById('start-btn').click();
    };

    const stage = box.querySelector('.atlas-stage'), svg = box.querySelector('.atlas-paths');
    const reveal = () => {
      const loading = stage.querySelector('.atlas-loading');
      loading.querySelector('button').hidden = true;
      loading.querySelector('p').textContent = '正在展开远征图…';
      prepareArtwork().then(() => {
        if (!stage.isConnected) return;
        stage.classList.add('atlas-ready');
        stage.setAttribute('aria-busy', 'false');
        loading.hidden = true;
      }).catch(() => {
        if (!stage.isConnected) return;
        loading.querySelector('p').textContent = '地图素材暂未加载完成';
        loading.querySelector('button').hidden = false;
      });
    };
    stage.querySelector('.atlas-loading button').onclick = reveal;
    reveal();
    let frame = 0;
    const drawRoute = () => {
      frame = 0;
      if (!stage.isConnected) return;
      const bounds = stage.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
      const anchors = buttons.map(button => {
        const rect = button.querySelector('.atlas-landmark').getBoundingClientRect();
        return { x: rect.left - bounds.left + rect.width / 2,
          y: rect.top - bounds.top + rect.height / 2, w: rect.width, h: rect.height };
      });
      const paths = anchors.slice(1).map((b, i) => {
        const a = anchors[i], horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
        let start, end, c1, c2;
        if (horizontal) {
          const sign = Math.sign(b.x - a.x);
          start = [a.x + sign * (a.w / 2 + 9), a.y];
          end = [b.x - sign * (b.w / 2 + 9), b.y];
          const mid = (start[0] + end[0]) / 2;
          c1 = [mid, start[1] - 16]; c2 = [mid, end[1] + 16];
        } else {
          // A serpentine side turn skirts the labels rather than crossing them.
          const sign = a.x > bounds.width / 2 ? 1 : -1;
          const side = a.x + sign * (a.w / 2 + 24);
          start = [a.x + sign * (a.w / 2 + 6), a.y];
          end = [b.x + sign * (b.w / 2 + 6), b.y];
          c1 = [side, start[1] + (end[1] - start[1]) * .35];
          c2 = [side, end[1] - (end[1] - start[1]) * .35];
        }
        const d = `M${start} C${c1} ${c2} ${end}`;
        return `<path class="atlas-route-shadow" d="${d}"/><path class="${complete || i < chapter ? 'traversed' : ''}" d="${d}"/><circle cx="${start[0]}" cy="${start[1]}" r="4"/><circle cx="${end[0]}" cy="${end[1]}" r="4"/>`;
      });
      svg.querySelector('g').innerHTML = paths.join('');
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(drawRoute); };
    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    buttons.forEach(button => observer.observe(button));
    schedule();
    EmberDialogs.onClose(() => { observer.disconnect(); cancelAnimationFrame(frame); });
  }
  E.showMap = showMap;
  const entrance = document.getElementById('adventure-nav');
  entrance.onclick = showMap;
  entrance.addEventListener('pointerenter', () => { prepareArtwork().catch(() => {}); }, { once: true });
})();
