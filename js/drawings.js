const PAL = ['#2563eb', '#000000', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#ffffff'];
const TOOLS = [
  ['cursor', 'Select', '<path d="M5 3l13 8-6 1.5L9.5 19z"/>'],
  ['trend', 'Line', '<path d="M4 19L20 5"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="5" r="2"/>'],
  ['ray', 'Ray', '<path d="M4 18L20 7"/><circle cx="4" cy="18" r="2"/><path d="M15 6.5l5 .5-2.2 4.4"/>'],
  ['hline', 'H-line', '<path d="M3 12h18"/><circle cx="12" cy="12" r="2"/>'],
  ['vline', 'V-line', '<path d="M12 3v18"/><circle cx="12" cy="12" r="2"/>'],
  ['rect', 'Box', '<rect x="4" y="6" width="16" height="12" rx="1"/>'],
  ['fib', 'Fib', '<path d="M3 5h18M3 9.5h18M3 14h18M3 19h18"/>'],
  ['measure', 'Measure', '<path d="M5 19L19 5"/><path d="M5 19v-5M5 19h5M19 5v5M19 5h-5"/>'],
  ['note', 'Note', '<path d="M5 6h14M12 6v13"/>']
];
const HINTS = {
  trend: 'Tap the start, then tap the end (or drag)',
  ray: 'Tap the start, then tap a second point',
  rect: 'Tap one corner, then the opposite corner',
  fib: 'Tap swing start, then swing end',
  measure: 'Tap the start, then the end',
  hline: 'Tap where the level goes',
  vline: 'Tap where the line goes',
  note: 'Tap where the note goes'
};
const ONE = { hline: 1, vline: 1, note: 1 };
const FIB = [0, .236, .382, .5, .618, .786, 1];
const MONO = "'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";
const UIF = "'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";

function rectCfg(d) {
  return {
    extend: d.extend || 'none',
    borderOn: d.borderOn ?? true,
    borderColor: d.borderColor || d.color || '#2563eb',
    borderWidth: d.borderWidth ?? (d.width || 1),
    midOn: d.midOn ?? false,
    midColor: d.midColor || '#9333ea',
    midStyle: d.midStyle || 'dashed',
    bgOn: d.bgOn ?? true,
    bgColor: d.bgColor || d.color || '#5eb162',
    bgAlpha: d.bgAlpha ?? 0.24,
    text: d.text || '',
    textColor: d.textColor || '#1e2631',
    fontSize: d.fontSize || 14,
    bold: !!d.bold,
    italic: !!d.italic,
    vAlign: d.vAlign || 'middle',
    hAlign: d.hAlign || 'center'
  };
}

function injectRectModalCSS() {
  if (document.getElementById('rm-css')) return;
  const st = document.createElement('style');
  st.id = 'rm-css';
  st.textContent = `
    #rmWrap{position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;justify-content:flex-end;font-family:${UIF}}
    #rmWrap[hidden]{display:none}
    .rm-back{position:absolute;inset:0;background:rgba(4,7,11,.5)}
    .rm-card{position:relative;background:var(--panel);color:var(--fg);border-radius:16px 16px 0 0;border-top:1px solid var(--line);max-height:86%;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom,0px)}
    .rm-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px}
    .rm-head h2{margin:0;font-size:17px;font-weight:600}
    .rm-x{width:32px;height:32px;border-radius:8px;font-size:20px;line-height:1;color:var(--mute);display:grid;place-items:center}
    .rm-tabs{display:flex;gap:20px;padding:0 16px;border-bottom:1px solid var(--line)}
    .rm-tab{padding:10px 2px;font-size:14px;font-weight:500;color:var(--mute);border-bottom:2px solid transparent}
    .rm-tab[aria-selected="true"]{color:var(--fg);border-bottom-color:var(--fg);font-weight:600}
    .rm-body{overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px}
    .rm-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:36px}
    .rm-lbl{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:500;cursor:pointer}
    .rm-lbl input[type=checkbox]{width:20px;height:20px;accent-color:var(--fg);margin:0}
    .rm-ctrl{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .rm-col{width:34px;height:32px;padding:2px;border-radius:7px;border:1px solid var(--line);background:var(--raise);cursor:pointer}
    .rm-sel{padding:7px 10px;border-radius:8px;background:var(--raise);border:1px solid var(--line);color:var(--fg);font-size:13px}
    .rm-px{display:flex;gap:4px}
    .rm-px button{padding:5px 9px;border-radius:7px;background:var(--raise);border:1px solid var(--line);font-size:12px}
    .rm-px button[aria-pressed="true"]{background:var(--fg);color:var(--bg);border-color:var(--fg)}
    .rm-ta{width:100%;min-height:92px;padding:10px 12px;border-radius:10px;background:var(--raise);border:1px solid var(--line);color:var(--fg);font:14px/1.4 ${UIF};resize:vertical}
    .rm-bi{width:34px;height:32px;border-radius:8px;background:var(--raise);border:1px solid var(--line);font-size:14px;display:grid;place-items:center}
    .rm-bi[aria-pressed="true"]{background:var(--fg);color:var(--bg);border-color:var(--fg)}
    .rm-foot{display:flex;justify-content:flex-end;gap:10px;padding:12px 16px;border-top:1px solid var(--line)}
    .rm-btn{padding:9px 18px;border-radius:9px;font-size:14px;font-weight:600;border:1px solid var(--line);background:var(--raise)}
    .rm-btn.ok{background:var(--fg);color:var(--bg);border-color:var(--fg)}
    .rm-rng{width:95px;accent-color:var(--accent)}
  `;
  document.head.appendChild(st);
}

export function initDrawings({ S, store, $, esc, uid, css, fmt, wrap, ov, chart, candle, ts }) {
  injectRectModalCSS();
  ov.style.zIndex = '10';
  const hintEl = $('#hint');
  if (hintEl) hintEl.style.zIndex = '11';
  const ctx = ov.getContext('2d');
  let clearTimer = null;
  let lastTap = { id: null, t: 0 };

  function timeToLogical(t) {
    const b = S.bars, n = b.length;
    if (!n) return null;
    if (t <= b[0].time) return (t - b[0].time) / S.tf;
    if (t >= b[n - 1].time) return n - 1 + (t - b[n - 1].time) / S.tf;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (b[m].time <= t) lo = m; else hi = m; }
    return lo + (t - b[lo].time) / (b[hi].time - b[lo].time);
  }
  function logicalToTime(l) {
    const b = S.bars, n = b.length;
    if (!n) return null;
    if (l <= 0) return b[0].time + l * S.tf;
    if (l >= n - 1) return b[n - 1].time + (l - (n - 1)) * S.tf;
    const i = Math.floor(l), f = l - i;
    return b[i].time + f * (b[i + 1].time - b[i].time);
  }
  const timeToX = t => { const l = timeToLogical(t); return l == null ? null : ts.logicalToCoordinate(l); };
  const xToLogical = x => ts.coordinateToLogical(x);
  const pt2s = p => ({ x: timeToX(p.t), y: candle.priceToCoordinate(p.p) });
  function plotRect() {
    let pw = 0, ph = wrap.clientHeight;
    try {
      const w = chart.priceScale('right').width();
      if (Number.isFinite(w) && w > 0) pw = w;
      const p0 = chart.panes && chart.panes()[0];
      const h = p0 && p0.getHeight && p0.getHeight();
      if (Number.isFinite(h) && h > 0) ph = h;
    } catch (e) {}
    return { w: Math.max(0, wrap.clientWidth - pw), h: Math.max(0, ph) };
  }
  const rel = e => { const r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function toPoint(x, y, snap) {
    const l = xToLogical(x), p = candle.coordinateToPrice(y);
    if (l == null || p == null) return null;
    let pt = { t: logicalToTime(l), p: +p };
    if (snap && S.magnet) {
      const i = Math.round(l), b = S.bars[i];
      if (b) {
        let best = null, bd = 1e9;
        for (const c of [b.open, b.high, b.low, b.close]) {
          const cy = candle.priceToCoordinate(c);
          if (cy == null) continue;
          const d = Math.abs(cy - y);
          if (d < bd) { bd = d; best = c; }
        }
        if (best != null && bd <= 24) pt = { t: b.time, p: best };
      }
    }
    return pt;
  }

  function renderDock() {
    const mg = '<path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z"/>';
    const tr = '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>';
    $('#dock').innerHTML = TOOLS.map(([k, l, p]) =>
      `<button class="tool" data-tool="${k}" type="button" aria-pressed="${S.tool === k}"><svg viewBox="0 0 24 24">${p}</svg>${l}</button>`
    ).join('')
      + `<div class="sep"></div><button class="tool" data-act="magnet" type="button" aria-pressed="${S.magnet}"><svg viewBox="0 0 24 24">${mg}</svg>Magnet</button>`
      + `<button class="tool" id="clearBtn" data-act="clear" type="button"><svg viewBox="0 0 24 24">${tr}</svg>Clear all</button>`;
  }

  function saveDraw() { store.set('draw:' + S.symbol, S.drawings); }
  function cancelCreate() {
    if (S.creating) { S.drawings = S.drawings.filter(d => d !== S.creating.d); S.creating = null; S.dirty = true; }
  }
  function setTool(t) {
    cancelCreate();
    S.tool = t;
    renderDock();
    const h = $('#hint');
    if (t === 'cursor') h.hidden = true;
    else { h.hidden = false; h.textContent = HINTS[t] || ''; }
  }
  function select(id) { S.selected = id; S.dirty = true; renderSel(); }

  /* ---------- Rectangle Settings Modal (Style + Text) ---------- */
  let rmWrap = null, rmTarget = null, rmSnap = null, rmTab = 'style';
  function ensureModal() {
    if (rmWrap) return;
    rmWrap = document.createElement('div');
    rmWrap.id = 'rmWrap';
    rmWrap.hidden = true;
    rmWrap.innerHTML = `
      <div class="rm-back" data-rm-cancel></div>
      <div class="rm-card">
        <div class="rm-head"><h2>Rectangle</h2><button class="rm-x" type="button" data-rm-cancel aria-label="Close">×</button></div>
        <div class="rm-tabs" role="tablist">
          <button class="rm-tab" type="button" data-rm-tab="style" aria-selected="true">Style</button>
          <button class="rm-tab" type="button" data-rm-tab="text" aria-selected="false">Text</button>
        </div>
        <div class="rm-body" id="rmBody"></div>
        <div class="rm-foot">
          <button class="rm-btn" type="button" data-rm-cancel>Cancel</button>
          <button class="rm-btn ok" type="button" data-rm-ok>Ok</button>
        </div>
      </div>`;
    document.body.appendChild(rmWrap);

    rmWrap.addEventListener('click', e => {
      if (e.target.closest('[data-rm-cancel]')) {
        if (rmTarget && rmSnap) { Object.assign(rmTarget, rmSnap); S.dirty = true; renderSel(); }
        rmWrap.hidden = true; rmTarget = null; rmSnap = null;
        return;
      }
      if (e.target.closest('[data-rm-ok]')) {
        saveDraw(); renderSel(); S.dirty = true;
        rmWrap.hidden = true; rmTarget = null; rmSnap = null;
        return;
      }
      const tb = e.target.closest('[data-rm-tab]');
      if (tb) { rmTab = tb.dataset.rmTab; renderModalBody(); return; }
      const pxb = e.target.closest('[data-rm-bw]');
      if (pxb && rmTarget) {
        rmTarget.borderWidth = +pxb.dataset.rmBw;
        rmTarget.borderOn = true;
        S.dirty = true; renderModalBody();
      }
      const bi = e.target.closest('[data-rm-toggle]');
      if (bi && rmTarget) {
        const k = bi.dataset.rmToggle;
        rmTarget[k] = !rmTarget[k];
        S.dirty = true; renderModalBody();
      }
    });

    rmWrap.addEventListener('input', e => {
      if (!rmTarget) return;
      const el = e.target, k = el.dataset.rmKey;
      if (!k) return;
      if (el.type === 'checkbox') rmTarget[k] = el.checked;
      else if (k === 'bgAlpha' || k === 'fontSize') rmTarget[k] = parseFloat(el.value);
      else rmTarget[k] = el.value;
      S.dirty = true;
    });
    rmWrap.addEventListener('change', e => {
      if (!rmTarget) return;
      const el = e.target, k = el.dataset.rmKey;
      if (!k) return;
      if (el.type === 'checkbox') rmTarget[k] = el.checked;
      else if (k === 'bgAlpha' || k === 'fontSize') rmTarget[k] = parseFloat(el.value);
      else rmTarget[k] = el.value;
      S.dirty = true; renderSel();
    });
  }

  function renderModalBody() {
    if (!rmWrap || !rmTarget) return;
    rmWrap.querySelectorAll('[data-rm-tab]').forEach(t => t.setAttribute('aria-selected', t.dataset.rmTab === rmTab));
    const c = rectCfg(rmTarget), body = rmWrap.querySelector('#rmBody');
    if (rmTab === 'style') {
      body.innerHTML = `
        <div class="rm-row">
          <span class="rm-lbl">Extend</span>
          <select class="rm-sel" data-rm-key="extend">
            <option value="none"${c.extend === 'none' ? ' selected' : ''}>Don't extend</option>
            <option value="left"${c.extend === 'left' ? ' selected' : ''}>Extend left</option>
            <option value="right"${c.extend === 'right' ? ' selected' : ''}>Extend right</option>
            <option value="both"${c.extend === 'both' ? ' selected' : ''}>Extend both</option>
          </select>
        </div>
        <div class="rm-row">
          <label class="rm-lbl"><input type="checkbox" data-rm-key="borderOn"${c.borderOn ? ' checked' : ''}>Border</label>
          <div class="rm-ctrl">
            <input class="rm-col" type="color" data-rm-key="borderColor" value="${c.borderColor}">
            <div class="rm-px">
              ${[1, 2, 3, 4].map(w => `<button type="button" data-rm-bw="${w}" aria-pressed="${c.borderWidth === w}">${w}px</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="rm-row">
          <label class="rm-lbl"><input type="checkbox" data-rm-key="midOn"${c.midOn ? ' checked' : ''}>Middle line</label>
          <div class="rm-ctrl">
            <input class="rm-col" type="color" data-rm-key="midColor" value="${c.midColor}">
            <select class="rm-sel" data-rm-key="midStyle">
              <option value="dashed"${c.midStyle === 'dashed' ? ' selected' : ''}>Dashed</option>
              <option value="solid"${c.midStyle === 'solid' ? ' selected' : ''}>Solid</option>
              <option value="dotted"${c.midStyle === 'dotted' ? ' selected' : ''}>Dotted</option>
            </select>
          </div>
        </div>
        <div class="rm-row">
          <label class="rm-lbl"><input type="checkbox" data-rm-key="bgOn"${c.bgOn ? ' checked' : ''}>Background</label>
          <div class="rm-ctrl">
            <input class="rm-col" type="color" data-rm-key="bgColor" value="${c.bgColor}">
            <input class="rm-rng" type="range" min="0.05" max="0.85" step="0.05" data-rm-key="bgAlpha" value="${c.bgAlpha}">
          </div>
        </div>`;
    } else {
      body.innerHTML = `
        <div class="rm-row" style="justify-content:flex-start">
          <input class="rm-col" type="color" data-rm-key="textColor" value="${c.textColor}">
          <select class="rm-sel" data-rm-key="fontSize">
            ${[10, 12, 14, 16, 18, 20, 24].map(s => `<option value="${s}"${c.fontSize === s ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
          <button class="rm-bi" type="button" data-rm-toggle="bold" aria-pressed="${c.bold}"><b>B</b></button>
          <button class="rm-bi" type="button" data-rm-toggle="italic" aria-pressed="${c.italic}"><i>I</i></button>
        </div>
        <textarea class="rm-ta" data-rm-key="text" placeholder="Add text">${esc(c.text)}</textarea>
        <div class="rm-row">
          <span class="rm-lbl">Text alignment</span>
          <div class="rm-ctrl">
            <select class="rm-sel" data-rm-key="vAlign">
              <option value="top"${c.vAlign === 'top' ? ' selected' : ''}>Top</option>
              <option value="middle"${c.vAlign === 'middle' ? ' selected' : ''}>Middle</option>
              <option value="bottom"${c.vAlign === 'bottom' ? ' selected' : ''}>Bottom</option>
            </select>
            <select class="rm-sel" data-rm-key="hAlign">
              <option value="left"${c.hAlign === 'left' ? ' selected' : ''}>Left</option>
              <option value="center"${c.hAlign === 'center' ? ' selected' : ''}>Center</option>
              <option value="right"${c.hAlign === 'right' ? ' selected' : ''}>Right</option>
            </select>
          </div>
        </div>`;
    }
  }

  function openRectSettings(d, tab = 'style') {
    ensureModal();
    Object.assign(d, rectCfg(d));
    rmTarget = d;
    rmSnap = { ...d };
    rmTab = tab;
    renderModalBody();
    rmWrap.hidden = false;
  }

  function renderSel() {
    const bar = $('#selbar'), d = S.drawings.find(x => x.id === S.selected);
    if (!d) { bar.hidden = true; bar.innerHTML = ''; return; }
    bar.hidden = false;
    if (d.type === 'rect') {
      const c = rectCfg(d);
      const extLbl = c.extend === 'none' ? 'Extend' : ('Ext: ' + c.extend);
      bar.innerHTML =
        `<button class="btn sm pri" data-rect-set="style" type="button">Settings</button>`
        + `<button class="btn sm" data-rect-set="text" type="button">Text</button>`
        + `<button class="btn sm" data-rect-mid type="button" aria-pressed="${c.midOn}">Mid</button>`
        + `<button class="btn sm" data-rect-ext type="button" aria-pressed="${c.extend !== 'none'}">${extLbl}</button>`
        + `<input type="color" data-rect-col="bgColor" value="${c.bgColor}" title="Fill color" style="width:28px;height:28px;padding:0;border-radius:50%;border:2px solid var(--panel)">`
        + `<input type="color" data-rect-col="borderColor" value="${c.borderColor}" title="Border color" style="width:28px;height:28px;padding:0;border-radius:50%;border:2px solid var(--panel)">`
        + '<button class="btn sm" data-del type="button" style="margin-left:auto;color:var(--down)">Delete</button>';
      return;
    }
    bar.innerHTML = PAL.map(c => `<button class="sw" data-c="${c}" style="background:${c}" type="button" aria-label="Color ${c}" aria-pressed="${d.color === c}"></button>`).join('')
      + [1, 2, 4].map(w => `<button class="btn sm" data-w="${w}" type="button" aria-pressed="${(d.width || 2) === w}">${w}px</button>`).join('')
      + (d.type === 'note' ? `<label class="field" style="flex:1;min-width:120px" for="selText">Text</label><input id="selText" type="text" value="${esc(d.text || '')}" autocomplete="off">` : '')
      + '<button class="btn sm" data-del type="button" style="margin-left:auto;color:var(--down)">Delete</button>';
  }

  $('#dock').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool) setTool(S.tool === b.dataset.tool ? 'cursor' : b.dataset.tool);
    else if (b.dataset.act === 'magnet') { S.magnet = !S.magnet; store.set('magnet', S.magnet); renderDock(); }
    else if (b.dataset.act === 'clear') {
      if (b.dataset.armed) { S.drawings = []; select(null); saveDraw(); S.dirty = true; renderDock(); }
      else { b.dataset.armed = '1'; b.lastChild.textContent = 'Sure?'; clearTimeout(clearTimer); clearTimer = setTimeout(renderDock, 2500); }
    }
  });
  $('#selbar').addEventListener('click', e => {
    const d = S.drawings.find(x => x.id === S.selected); if (!d) return;
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.rectSet) { openRectSettings(d, t.dataset.rectSet); return; }
    if ('rectMid' in t.dataset) { d.midOn = !rectCfg(d).midOn; if (d.midColor == null) d.midColor = '#9333ea'; }
    else if ('rectExt' in t.dataset) {
      const ord = ['none', 'right', 'left', 'both'];
      d.extend = ord[(ord.indexOf(d.extend || 'none') + 1) % ord.length];
    }
    else if (t.dataset.c) d.color = t.dataset.c;
    else if (t.dataset.w) d.width = +t.dataset.w;
    else if ('del' in t.dataset) { S.drawings = S.drawings.filter(x => x !== d); S.selected = null; }
    saveDraw(); S.dirty = true; renderSel();
  });
  $('#selbar').addEventListener('input', e => {
    const d = S.drawings.find(x => x.id === S.selected); if (!d) return;
    if (e.target.id === 'selText') { d.text = e.target.value; saveDraw(); S.dirty = true; }
    else if (e.target.dataset.rectCol) {
      const k = e.target.dataset.rectCol;
      d[k] = e.target.value;
      if (k === 'bgColor') d.bgOn = true;
      if (k === 'borderColor') d.borderOn = true;
      saveDraw(); S.dirty = true;
    }
  });

  function dseg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  function screenPts(d) {
    const P = d.pts.map(pt2s);
    return P.every(p => p.x != null && p.y != null && Number.isFinite(p.x) && Number.isFinite(p.y)) ? P : null;
  }
  function rayEnd(a, b) { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: a.x + dx / l * 6000, y: a.y + dy / l * 6000 }; }
  function rectScreenBounds(d, P, pr) {
    const c = rectCfg(d);
    const rx1 = Math.min(P[0].x, P[1].x), rx2 = Math.max(P[0].x, P[1].x);
    const y1 = Math.min(P[0].y, P[1].y), y2 = Math.max(P[0].y, P[1].y);
    const x1 = (c.extend === 'left' || c.extend === 'both') ? 0 : rx1;
    const x2 = (c.extend === 'right' || c.extend === 'both') ? pr.w : rx2;
    return { x1, x2, y1, y2, c };
  }

  function hitTest(x, y, touch) {
    const r = touch ? 18 : 10, hr = touch ? 22 : 13, p = { x, y }, pr = plotRect();
    for (let k = S.drawings.length - 1; k >= 0; k--) {
      const d = S.drawings[k], P = screenPts(d); if (!P) continue;
      for (let i = 0; i < P.length; i++) if (Math.hypot(P[i].x - x, P[i].y - y) <= hr) return { d, handle: i };
      let hit = false;
      switch (d.type) {
        case 'trend': hit = dseg(p, P[0], P[1]) <= r; break;
        case 'ray': hit = dseg(p, P[0], rayEnd(P[0], P[1])) <= r; break;
        case 'hline': hit = Math.abs(y - P[0].y) <= r; break;
        case 'vline': hit = Math.abs(x - P[0].x) <= r; break;
        case 'rect': {
          const b = rectScreenBounds(d, P, pr);
          hit = x >= b.x1 - r && x <= b.x2 + r && y >= b.y1 - r && y <= b.y2 + r;
          break;
        }
        case 'measure': {
          const x1 = Math.min(P[0].x, P[1].x), x2 = Math.max(P[0].x, P[1].x);
          const y1 = Math.min(P[0].y, P[1].y), y2 = Math.max(P[0].y, P[1].y);
          hit = x >= x1 - r && x <= x2 + r && y >= y1 - r && y <= y2 + r;
          break;
        }
        case 'fib': {
          const x1 = Math.min(P[0].x, P[1].x), x2 = Math.max(P[0].x, P[1].x);
          if (x >= x1 - r && x <= x2 + r) for (const f of FIB) { const fy = P[1].y + (P[0].y - P[1].y) * f; if (Math.abs(y - fy) <= r) { hit = true; break; } }
          break;
        }
        case 'note': {
          const w = (d.text || '').length * 7 + 16;
          hit = x >= P[0].x - 4 && x <= P[0].x + w && Math.abs(y - P[0].y) <= 14;
          break;
        }
      }
      if (hit) return { d, handle: null };
    }
    return null;
  }

  function finishCreate() {
    const d = S.creating.d; S.creating = null;
    saveDraw(); setTool('cursor'); select(d.id); S.dirty = true;
  }
  function startCreate(x, y) {
    const pt = toPoint(x, y, true); if (!pt) return;
    if (S.creating) { S.creating.d.pts[1] = pt; finishCreate(); return; }
    const d = S.tool === 'rect'
      ? {
          id: uid(), type: 'rect', pts: [pt, { ...pt }], color: '#5eb162', width: 1,
          extend: 'none', borderOn: true, borderColor: '#2563eb', borderWidth: 1,
          midOn: false, midColor: '#9333ea', midStyle: 'dashed',
          bgOn: true, bgColor: '#5eb162', bgAlpha: 0.24,
          text: '', textColor: '#1e2631', fontSize: 14, bold: false, italic: false, vAlign: 'middle', hAlign: 'center'
        }
      : { id: uid(), type: S.tool, pts: ONE[S.tool] ? [pt] : [pt, { ...pt }], color: PAL[0], width: 2, text: S.tool === 'note' ? 'Note' : '' };
    S.drawings.push(d); S.dirty = true;
    if (ONE[S.tool]) { S.creating = { d }; finishCreate(); return; }
    S.creating = { d, sx: x, sy: y, moved: false };
  }

  wrap.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const { x, y } = rel(e), pr = plotRect();
    if (x < 0 || y < 0 || x > pr.w || y > pr.h) { S.taken = false; return; }
    let take = false;
    if (S.tool !== 'cursor') { startCreate(x, y); take = true; S.pt = e.pointerType; }
    else {
      const h = hitTest(x, y, e.pointerType !== 'mouse');
      if (h) {
        const now = Date.now();
        if (h.d.type === 'rect' && lastTap.id === h.d.id && now - lastTap.t < 350) {
          lastTap = { id: null, t: 0 };
          select(h.d.id);
          openRectSettings(h.d, 'style');
          S.taken = true; e.stopPropagation(); e.preventDefault();
          return;
        }
        lastTap = { id: h.d.id, t: now };
        select(h.d.id);
        S.drag = { d: h.d, handle: h.handle, sx: x, sy: y, orig: h.d.pts.map(p => ({ ...p })), l0: xToLogical(x), p0: candle.coordinateToPrice(y) };
        take = true;
      } else if (S.selected) select(null);
    }
    S.taken = take;
    if (take) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  const guard = e => { if (S.taken) e.stopPropagation(); };
  wrap.addEventListener('touchstart', guard, true);
  wrap.addEventListener('mousedown', guard, true);
  window.addEventListener('blur', () => { S.taken = false; S.drag = null; });

  document.addEventListener('pointermove', e => {
    const { x, y } = rel(e);
    if (S.drag) {
      const g = S.drag, d = g.d;
      if (g.handle != null) { const pt = toPoint(x, y, true); if (pt) d.pts[g.handle] = pt; }
      else {
        const l = xToLogical(x), p = candle.coordinateToPrice(y);
        if (l != null && p != null && g.l0 != null && g.p0 != null) {
          const dl = l - g.l0, dp = p - g.p0;
          d.pts = g.orig.map(o => ({ t: logicalToTime(timeToLogical(o.t) + dl), p: o.p + dp }));
        }
      }
      S.dirty = true;
    } else if (S.creating && S.creating.d.pts.length > 1) {
      const pt = toPoint(x, y, true); if (pt) { S.creating.d.pts[1] = pt; S.dirty = true; }
      if (Math.hypot(x - S.creating.sx, y - S.creating.sy) > 10) S.creating.moved = true;
    }
  });
  const onUp = () => {
    if (S.drag) { S.drag = null; saveDraw(); }
    else if (S.creating && S.creating.moved && S.creating.d.pts.length > 1) finishCreate();
    S.taken = false;
  };
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') setTool('cursor');
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.selected && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) {
      S.drawings = S.drawings.filter(d => d.id !== S.selected); select(null); saveDraw();
    }
  });

  function line(a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  function tag(txt, x, y, bg, align) {
    ctx.font = '500 11px ' + MONO;
    const w = ctx.measureText(txt).width + 10, h = 18;
    const x0 = align === 'right' ? x - w : x;
    ctx.fillStyle = bg; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, y - h / 2, w, h, 4); else ctx.rect(x0, y - h / 2, w, h);
    ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x0 + 5, y + .5);
  }
  const fmtDur = s => { s = Math.abs(s); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };

  function paintRectBox(d, P, pr) {
    const { x1, x2, y1, y2, c } = rectScreenBounds(d, P, pr);
    const bw = Math.max(0, x2 - x1), bh = Math.max(0, y2 - y1);
    if (c.bgOn) {
      ctx.save(); ctx.globalAlpha = c.bgAlpha; ctx.fillStyle = c.bgColor;
      ctx.fillRect(x1, y1, bw, bh); ctx.restore();
    }
    if (c.borderOn && c.borderWidth > 0) {
      ctx.save(); ctx.strokeStyle = c.borderColor; ctx.lineWidth = c.borderWidth; ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y1);
      ctx.moveTo(x1, y2); ctx.lineTo(x2, y2);
      if (c.extend !== 'left' && c.extend !== 'both') { ctx.moveTo(x1, y1); ctx.lineTo(x1, y2); }
      if (c.extend !== 'right' && c.extend !== 'both') { ctx.moveTo(x2, y1); ctx.lineTo(x2, y2); }
      ctx.stroke(); ctx.restore();
    }
    if (c.midOn) {
      const ym = (y1 + y2) / 2;
      ctx.save(); ctx.strokeStyle = c.midColor; ctx.lineWidth = 1.5;
      ctx.setLineDash(c.midStyle === 'solid' ? [] : c.midStyle === 'dotted' ? [2, 3] : [6, 4]);
      line({ x: x1, y: ym }, { x: x2, y: ym }); ctx.restore();
    }
    if (c.text) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x1, y1, bw, bh); ctx.clip();
      ctx.fillStyle = c.textColor;
      ctx.font = `${c.italic ? 'italic ' : ''}${c.bold ? '700 ' : '500 '}${c.fontSize}px ${UIF}`;
      ctx.textBaseline = 'middle';
      const lines = c.text.split('\n'), lh = Math.round(c.fontSize * 1.25);
      let tx;
      if (c.hAlign === 'left') { ctx.textAlign = 'left'; tx = x1 + 8; }
      else if (c.hAlign === 'right') { ctx.textAlign = 'right'; tx = Math.min(x2, pr.w) - 8; }
      else { ctx.textAlign = 'center'; tx = (x1 + Math.min(x2, pr.w)) / 2; }
      let sy;
      if (c.vAlign === 'top') sy = y1 + 8 + lh / 2;
      else if (c.vAlign === 'bottom') sy = y2 - 8 - (lines.length - 1) * lh - lh / 2;
      else sy = (y1 + y2) / 2 - ((lines.length - 1) * lh) / 2;
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], tx, sy + i * lh);
      ctx.restore();
    }
  }

  function paint(d, sel, pr) {
    const P = screenPts(d); if (!P) return;
    ctx.strokeStyle = d.color; ctx.fillStyle = d.color; ctx.lineWidth = d.width || 2;
    ctx.setLineDash([]); ctx.lineCap = 'round';
    switch (d.type) {
      case 'trend': line(P[0], P[1]); break;
      case 'ray': line(P[0], rayEnd(P[0], P[1])); break;
      case 'hline': line({ x: 0, y: P[0].y }, { x: pr.w, y: P[0].y }); tag(fmt(d.pts[0].p), pr.w - 2, P[0].y, d.color, 'right'); break;
      case 'vline': line({ x: P[0].x, y: 0 }, { x: P[0].x, y: pr.h }); break;
      case 'rect': paintRectBox(d, P, pr); break;
      case 'fib': {
        const x1 = Math.min(P[0].x, P[1].x), x2 = Math.max(P[0].x, P[1].x);
        for (const f of FIB) {
          const pr2 = d.pts[1].p + (d.pts[0].p - d.pts[1].p) * f, y = P[1].y + (P[0].y - P[1].y) * f;
          ctx.globalAlpha = f === 0 || f === 1 ? 1 : .75; ctx.lineWidth = 1;
          ctx.setLineDash(f === 0 || f === 1 ? [] : [4, 4]); line({ x: x1, y }, { x: x2, y });
          ctx.globalAlpha = 1; ctx.setLineDash([]); ctx.fillStyle = d.color;
          ctx.font = '11px ' + MONO; ctx.textBaseline = 'bottom'; ctx.fillText(`${f} · ${fmt(pr2)}`, x1 + 4, y - 2);
        }
        ctx.lineWidth = 1; ctx.setLineDash([2, 4]); line(P[0], P[1]);
        break;
      }
      case 'measure': {
        const dp = d.pts[1].p - d.pts[0].p, pc = dp / d.pts[0].p * 100, up = dp >= 0, col = up ? css('--up') : css('--down');
        ctx.strokeStyle = col; ctx.fillStyle = col;
        ctx.globalAlpha = .14; ctx.fillRect(P[0].x, P[0].y, P[1].x - P[0].x, P[1].y - P[0].y);
        ctx.globalAlpha = 1; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
        ctx.strokeRect(P[0].x, P[0].y, P[1].x - P[0].x, P[1].y - P[0].y); ctx.setLineDash([]);
        const nb = Math.round((timeToLogical(d.pts[1].t) || 0) - (timeToLogical(d.pts[0].t) || 0));
        tag(`${up ? '+' : ''}${fmt(dp)} (${pc.toFixed(2)}%) · ${Math.abs(nb)} bars · ${fmtDur(d.pts[1].t - d.pts[0].t)}`, (P[0].x + P[1].x) / 2 - 60, P[1].y + (up ? -14 : 14), col);
        break;
      }
      case 'note': {
        ctx.font = '500 12px ' + MONO; ctx.textBaseline = 'middle';
        const t = d.text || '', w = ctx.measureText(t).width + 12;
        ctx.fillStyle = d.color; ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(P[0].x, P[0].y - 11, w, 22, 5); else ctx.rect(P[0].x, P[0].y - 11, w, 22);
        ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillText(t, P[0].x + 6, P[0].y + .5);
        break;
      }
    }
    if (sel || (S.creating && S.creating.d === d)) {
      const hc = d.type === 'rect' ? rectCfg(d).borderColor : d.color;
      ctx.setLineDash([]);
      for (const p of P) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 6.283);
        ctx.fillStyle = '#d6dae7'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = hc; ctx.stroke();
      }
    }
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1, W = wrap.clientWidth, H = wrap.clientHeight;
    if (ov.width !== Math.round(W * dpr) || ov.height !== Math.round(H * dpr)) {
      ov.width = Math.round(W * dpr); ov.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const pr = plotRect(); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, pr.w, pr.h); ctx.clip();
    for (const d of S.drawings) paint(d, d.id === S.selected, pr);
    ctx.restore();
  }

  function tick() {
    let sig = '';
    try {
      const r = ts.getVisibleLogicalRange();
      sig = (r ? r.from.toFixed(3) + '|' + r.to.toFixed(3) : '') + '|' + candle.coordinateToPrice(0) + '|' + candle.coordinateToPrice(300) + '|' + wrap.clientWidth + '|' + wrap.clientHeight;
    } catch (e) {}
    if (S.dirty || sig !== S.lastSig) { S.lastSig = sig; S.dirty = false; draw(); }
    requestAnimationFrame(tick);
  }

  return { renderDock, renderSel, select, setTool, saveDraw, startLoop: () => requestAnimationFrame(tick) };
}
