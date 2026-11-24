async function boot() {
  'use strict';
  if (window.__nclStarted) return;
  window.__nclStarted = true;

  const V = new URL(import.meta.url).search || ('?v=' + Date.now());
  const [{ ta, resample, bucketKey, etWall, resForTf }, { initDrawings }, { initCapital }] = await Promise.all([
    import('./ta.js' + V),
    import('./drawings.js' + V),
    import('./capital.js' + V)
  ]);

  const LW = window.LightweightCharts;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 8);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ncl:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ncl:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  let pricePrec = 2;
  const fmt = n => n == null ? '–' : Number(n).toLocaleString('en-US', { minimumFractionDigits: pricePrec, maximumFractionDigits: pricePrec });
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  if (!LW) return;

  const CHART_BG = '#d6dae7';
  const AXIS_TXT = '#1e2631';
  const AXIS_LINE = '#b4bac9';
  const CANDLE_STYLE = {
    upColor: '#5eb162',
    downColor: '#000000',
    borderVisible: true,
    borderUpColor: '#6c6c6c',
    borderDownColor: '#000000',
    wickUpColor: '#000000',
    wickDownColor: '#000000'
  };

  const TFS = [
    ['1m', 60], ['2m', 120], ['3m', 180], ['4m', 240], ['5m', 300],
    ['15m', 900], ['30m', 1800], ['1h', 3600], ['4h', 14400],
    ['1D', 86400], ['1W', 604800], ['1M', 2592000], ['3M', 7776000], ['6M', 15552000], ['1Y', 31536000]
  ];
  const PAL = ['#2563eb', '#000000', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#ffffff'];
  const C1 = b => b.map(x => x.close);
  const IND = {
    SMA: { label: 'SMA', params: [['len', 20]], calc: (b, p) => ({ pane: false, lines: [{ name: 'SMA ' + p.len, data: ta.sma(C1(b), p.len) }] }) },
    EMA: { label: 'EMA', params: [['len', 21]], calc: (b, p) => ({ pane: false, lines: [{ name: 'EMA ' + p.len, data: ta.ema(C1(b), p.len) }] }) },
    WMA: { label: 'WMA', params: [['len', 20]], calc: (b, p) => ({ pane: false, lines: [{ name: 'WMA ' + p.len, data: ta.wma(C1(b), p.len) }] }) },
    VWAP: { label: 'VWAP', params: [], calc: b => ({ pane: false, lines: [{ name: 'VWAP', data: ta.vwap(b) }] }) },
    BB: { label: 'Bollinger', params: [['len', 20], ['mult', 2]], calc: (b, p) => { const r = ta.bb(C1(b), p.len, p.mult); return { pane: false, lines: [{ name: 'Basis', data: r.mid }, { name: 'Upper', data: r.up, ci: 0 }, { name: 'Lower', data: r.lo, ci: 0 }] }; } },
    ST: { label: 'Supertrend', params: [['atr', 10], ['mult', 3]], calc: (b, p) => { const r = ta.supertrend(b, p.atr, p.mult); return { pane: false, lines: [{ name: 'Supertrend', data: r.st, colors: r.dir.map(d => d > 0 ? 'up' : d < 0 ? 'down' : null) }] }; } },
    RSI: { label: 'RSI', params: [['len', 14]], calc: (b, p) => ({ pane: true, levels: [30, 70], lines: [{ name: 'RSI ' + p.len, data: ta.rsi(C1(b), p.len) }] }) },
    MACD: { label: 'MACD', params: [['fast', 12], ['slow', 26], ['signal', 9]], calc: (b, p) => { const r = ta.macd(C1(b), p.fast, p.slow, p.signal); return { pane: true, lines: [{ name: 'Hist', data: r.hist, kind: 'hist' }, { name: 'MACD', data: r.macd }, { name: 'Signal', data: r.signal }] }; } },
    STOCH: { label: 'Stochastic', params: [['len', 14], ['smoothK', 3], ['smoothD', 3]], calc: (b, p) => { const r = ta.stoch(b, p.len, p.smoothK, p.smoothD); return { pane: true, levels: [20, 80], lines: [{ name: '%K', data: r.k }, { name: '%D', data: r.d }] }; } },
    ATR: { label: 'ATR', params: [['len', 14]], calc: (b, p) => ({ pane: true, lines: [{ name: 'ATR ' + p.len, data: ta.atr(b, p.len) }] }) }
  };

  const S = {
    symbol: store.get('sym', 'US100'), source: 'none', loading: true, baseNote: '', base: [], bars: [],
    tf: store.get('tf', 60), baseRes: 60, baseResName: 'MINUTE',
    tool: 'cursor', magnet: store.get('magnet', true), indicators: [],
    drawings: [], selected: null, drag: null, creating: null, taken: false, dirty: true, lastSig: '', streamShown: false
  };
  S.drawings = store.get('draw:' + S.symbol, []);
  if (!TFS.some(t => t[1] === S.tf)) S.tf = 60;

  const wrap = $('#chartWrap'), ov = $('#ov');
  wrap.style.background = CHART_BG;
  const mono = "'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";
  const chart = LW.createChart($('#chart'), {
    autoSize: true,
    layout: { attributionLogo: false, background: { type: LW.ColorType.Solid, color: CHART_BG }, textColor: AXIS_TXT, fontFamily: mono, fontSize: 11 },
    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    rightPriceScale: { borderColor: AXIS_LINE, scaleMargins: { top: .08, bottom: .08 } },
    timeScale: { borderColor: AXIS_LINE, timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 7, minBarSpacing: 1.5 },
    crosshair: { mode: LW.CrosshairMode.Normal },
    kineticScroll: { touch: true, mouse: false },
    handleScale: { axisPressedMouseMove: true, pinch: true },
    localization: { priceFormatter: p => fmt(p) }
  });
  const candle = chart.addSeries(LW.CandlestickSeries, {
    ...CANDLE_STYLE,
    lastValueVisible: false,
    priceLineVisible: true,
    priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
  });
  const ts = chart.timeScale();
  let indSeries = [], indMeta = [], indLen = 0, markersApi = null, crossActive = false;
  let drawings = null, cap = null;

  /* ---------- Unified Dynamic Price + Countdown Badge ---------- */
  const cdEl = document.createElement('div');
  cdEl.style.cssText = 'position:absolute;right:0;z-index:12;pointer-events:none;color:#ffffff;font:500 11px/1.2 ' + mono + ';text-align:center;border-radius:3px 0 0 3px;padding:3px 4px;display:none;font-variant-numeric:tabular-nums;box-sizing:border-box';
  const cdPx = document.createElement('div');
  cdPx.style.cssText = 'font-weight:600;line-height:14px;white-space:nowrap';
  const cdTm = document.createElement('div');
  cdTm.style.cssText = 'font-size:10px;line-height:13px;opacity:.92;white-space:nowrap';
  cdEl.append(cdPx, cdTm);
  wrap.appendChild(cdEl);

  function fmtCountdown(sec) {
    sec = Math.max(0, Math.floor(sec));
    if (sec >= 86400) {
      const d = Math.floor(sec / 86400);
      const h = Math.floor((sec % 86400) / 3600);
      const m = Math.floor((sec % 3600) / 60);
      return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function nextBarCloseWall(tf, nowWall) {
    if (tf < 86400) return bucketKey(nowWall, tf, true) + tf;
    const d = new Date((nowWall + 21600) * 1000);
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    if (tf === 86400) return Date.UTC(y, m, day + 1) / 1000 - 21600;
    if (tf === 604800) {
      const dow = (d.getUTCDay() + 6) % 7;
      return Date.UTC(y, m, day - dow + 7) / 1000 - 21600;
    }
    if (tf === 2592000) return Date.UTC(y, m + 1, 1) / 1000 - 21600;
    if (tf === 7776000) return Date.UTC(y, Math.floor(m / 3) * 3 + 3, 1) / 1000 - 21600;
    if (tf === 15552000) return Date.UTC(y, m < 6 ? 6 : 12, 1) / 1000 - 21600;
    return Date.UTC(y + 1, 0, 1) / 1000 - 21600;
  }

  let lastCdPx = '', lastCdTm = '', lastCdTop = -1, lastCdW = -1, lastCdBg = '';
  function updateCountdown() {
    const last = S.bars[S.bars.length - 1];
    if (!last || S.source !== 'live') { cdEl.style.display = 'none'; return; }
    let y = candle.priceToCoordinate(last.close), pw = 0, ph = wrap.clientHeight;
    try {
      pw = chart.priceScale('right').width();
      const p0 = chart.panes && chart.panes()[0];
      const h = p0 && p0.getHeight && p0.getHeight();
      if (Number.isFinite(h) && h > 0) ph = h;
    } catch (e) {}
    if (y == null || !Number.isFinite(y) || pw <= 0) { cdEl.style.display = 'none'; return; }
    const nowWall = etWall(Date.now() / 1000);
    const pxTxt = fmt(last.close);
    const tmTxt = fmtCountdown(nextBarCloseWall(S.tf, nowWall) - nowWall);
    const bg = last.close >= last.open ? '#5eb162' : '#000000';
    if (pxTxt !== lastCdPx) { cdPx.textContent = pxTxt; lastCdPx = pxTxt; }
    if (tmTxt !== lastCdTm) { cdTm.textContent = tmTxt; lastCdTm = tmTxt; }
    if (bg !== lastCdBg) { cdEl.style.background = bg; lastCdBg = bg; }
    if (cdEl.style.display !== 'block') cdEl.style.display = 'block';
    const w = Math.round(pw);
    if (w !== lastCdW) { cdEl.style.width = w + 'px'; lastCdW = w; }
    const hBox = cdEl.offsetHeight || 33;
    const top = Math.round(Math.max(2, Math.min(ph - hBox - 2, y - hBox / 2)));
    if (top !== lastCdTop) { cdEl.style.top = top + 'px'; lastCdTop = top; }
  }

  function detectPrecision(bars) {
    if (!bars || !bars.length) return 2;
    const sample = bars.slice(-100);
    const prices = sample.map(b => b.close).filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    const p = prices.length ? prices[prices.length >> 1] : 0;
    let maxDec = 0;
    for (const b of sample) {
      for (const k of ['open', 'high', 'low', 'close']) {
        const v = b[k]; if (!Number.isFinite(v)) continue;
        const s = v.toFixed(8).replace(/\.?0+$/, ''), i = s.indexOf('.');
        if (i !== -1) maxDec = Math.max(maxDec, s.length - i - 1);
      }
    }
    if (p >= 500) return 2;
    if (p >= 20) return Math.min(3, Math.max(2, maxDec));
    if (p >= 0.1) return Math.min(5, Math.max(4, maxDec));
    if (p >= 0.001) return Math.min(6, Math.max(5, maxDec));
    return Math.min(8, Math.max(6, maxDec));
  }
  function applyPricePrecision(bars) {
    const prec = detectPrecision(bars);
    if (prec === pricePrec) return;
    pricePrec = prec;
    candle.applyOptions({ priceFormat: { type: 'price', precision: prec, minMove: Number((10 ** -prec).toFixed(prec)) } });
    chart.applyOptions({ localization: { priceFormatter: p => fmt(p) } });
  }
  function resetAutoScale() { try { chart.priceScale('right').applyOptions({ autoScale: true }); } catch (e) {} }

  function applyTheme() {
    wrap.style.background = CHART_BG;
    chart.applyOptions({
      layout: { attributionLogo: false, background: { type: LW.ColorType.Solid, color: CHART_BG }, textColor: AXIS_TXT },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderColor: AXIS_LINE }, timeScale: { borderColor: AXIS_LINE }
    });
    candle.applyOptions(CANDLE_STYLE);
    renderIndicators(); S.dirty = true;
  }

  function setBase(base, source, note) {
    S.base = base; S.source = source; S.baseNote = note || '';
    if (base.length) applyPricePrecision(base);
    resetAutoScale();
    rebuild(true); updateChips();
  }
  function rebuild(fit) {
    if (S.tf < S.baseRes) S.tf = S.baseRes;
    renderTf();
    S.bars = resample(S.base, S.tf, S.source === 'live', S.baseRes);
    if (S.bars.length) applyPricePrecision(S.bars);
    candle.setData(S.bars);
    renderIndicators();
    if (fit) {
      resetAutoScale();
      if (S.bars.length) { const n = S.bars.length; ts.setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 8 }); }
    }
    showOhlc(S.bars[S.bars.length - 1]); S.dirty = true; updateDataInfo();
    updateCountdown();
  }
  function softRebuild() {
    S.bars = resample(S.base, S.tf, S.source === 'live', S.baseRes);
    if (S.bars.length) applyPricePrecision(S.bars);
    candle.setData(S.bars); indLen = -1; refreshInds();
    showOhlc(S.bars[S.bars.length - 1]); S.dirty = true; updateDataInfo();
    updateCountdown();
  }
  function updateChips() {
    const c = $('#srcChip'), live = S.source === 'live';
    const isOnline = live && cap && (typeof cap.isLive === 'function' ? cap.isLive() : (typeof cap.streamOK === 'function' && cap.streamOK()));
    c.textContent = live ? (isOnline ? 'LIVE' : 'Sync') : (S.loading ? 'Loading' : 'Offline');
    c.className = 'chip ' + (isOnline ? 'live' : 'demo');
    $('#symName').textContent = S.symbol;
  }
  function updateDataInfo() {
    const b = S.base, t = x => new Date(x * 1000).toISOString().slice(0, 16).replace('T', ' ');
    $('#dataInfo').textContent = b.length
      ? `${b.length.toLocaleString()} bars (${S.baseResName}), ${t(b[0].time)} to ${t(b[b.length - 1].time)} (NY time). ${S.baseNote}`
      : 'No data loaded.';
  }
  function showOhlc(d) {
    const el = $('#ohlc'); if (!el) return;
    if (!d) { el.textContent = ''; return; }
    const up = d.close >= d.open; el.className = 'ohlc ' + (up ? 'up' : 'dn');
    el.innerHTML = `<span>O <b>${fmt(d.open)}</b></span><span>H <b>${fmt(d.high)}</b></span><span>L <b>${fmt(d.low)}</b></span><span>C <b>${fmt(d.close)}</b></span>`;
  }
  chart.subscribeCrosshairMove(p => {
    crossActive = !!(p && p.point);
    const d = p && p.seriesData && p.seriesData.get(candle);
    showOhlc(d ? { open: d.open, high: d.high, low: d.low, close: d.close } : S.bars[S.bars.length - 1]);
  });

  const colorFor = (inst, i, ln) => (ln.ci != null || i === 0) ? inst.color : PAL[(Math.max(0, PAL.indexOf(inst.color)) + i) % PAL.length];
  function mkLineData(ln) {
    const up = css('--up'), dn = css('--down');
    if (ln.kind === 'hist') return S.bars.map((b, k) => ln.data[k] == null ? null : { time: b.time, value: ln.data[k], color: ln.data[k] >= 0 ? up + '99' : dn + '99' }).filter(Boolean);
    return S.bars.map((b, k) => {
      const v = ln.data[k]; if (v == null || !Number.isFinite(v)) return null;
      const o = { time: b.time, value: v }; if (ln.colors && ln.colors[k]) o.color = ln.colors[k] === 'up' ? up : dn;
      return o;
    }).filter(Boolean);
  }
  function lastPt(ln) {
    const k = S.bars.length - 1, b = S.bars[k], v = ln.data[k];
    if (!b || v == null || !Number.isFinite(v)) return null;
    const up = css('--up'), dn = css('--down');
    if (ln.kind === 'hist') return { time: b.time, value: v, color: v >= 0 ? up + '99' : dn + '99' };
    const o = { time: b.time, value: v }; if (ln.colors && ln.colors[k]) o.color = ln.colors[k] === 'up' ? up : dn;
    return o;
  }
  function renderIndicators() {
    for (const s of indSeries) { try { chart.removeSeries(s); } catch (e) {} }
    indSeries = []; indMeta = [];
    const allMarkers = []; let pane = 1;
    for (const inst of S.indicators) {
      inst.error = null; if (inst.hidden || !IND[inst.type]) continue;
      let res; try { res = IND[inst.type].calc(S.bars, inst.p); } catch (e) { inst.error = String(e.message || e); continue; }
      const pi = res.pane ? pane++ : 0;
      res.lines.forEach((ln, i) => {
        const s = ln.kind === 'hist'
          ? chart.addSeries(LW.HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pi)
          : chart.addSeries(LW.LineSeries, { color: colorFor(inst, i, ln), lineWidth: inst.w || 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false }, pi);
        s.setData(mkLineData(ln)); indSeries.push(s); indMeta.push({ s, inst, i, kind: ln.kind });
        if (i === 0 && res.levels && pi > 0) for (const lv of res.levels) s.createPriceLine({ price: lv, color: css('--mute'), lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' });
      });
    }
    try { const panes = chart.panes(); for (let i = 1; i < panes.length; i++) panes[i].setHeight(Math.round(Math.max(90, wrap.clientHeight * 0.2))); } catch (e) {}
    try { if (LW.createSeriesMarkers) { if (!markersApi) markersApi = LW.createSeriesMarkers(candle, allMarkers); else markersApi.setMarkers(allMarkers); } } catch (e) {}
    indLen = S.bars.length; S.dirty = true;
  }
  function refreshInds() {
    const full = S.bars.length !== indLen, cache = new Map();
    for (const m of indMeta) {
      let res = cache.get(m.inst);
      if (!res) { try { res = IND[m.inst.type].calc(S.bars, m.inst.p); } catch (e) { continue; } cache.set(m.inst, res); }
      const ln = res.lines[m.i]; if (!ln) continue;
      try { if (full) m.s.setData(mkLineData(ln)); else { const pt = lastPt(ln); if (pt) m.s.update(pt); } } catch (e) {}
    }
    indLen = S.bars.length;
  }

  function renderTf() {
    $('#tfrow').innerHTML = TFS.map(([n, s]) => `<button class="tf" data-tf="${s}" type="button" aria-pressed="${s === S.tf}">${n}</button>`).join('');
  }
  $('#tfrow').addEventListener('click', e => {
    const b = e.target.closest('[data-tf]'); if (!b) return;
    S.tf = +b.dataset.tf; store.set('tf', S.tf); renderTf();
    if (cap && cap.switchTf) cap.switchTf(S.tf); else rebuild(true);
  });

  function openSheet(id) { $(id).hidden = false; if (id === '#shData') updateDataInfo(); }
  $('#btnData')?.addEventListener('click', () => openSheet('#shData'));
  document.querySelectorAll('.sheet').forEach(sh => sh.addEventListener('click', e => { if (e.target.closest('[data-close]')) sh.hidden = true; }));

  function setSymbol(sym) {
    sym = (sym || 'US100').trim().toUpperCase().slice(0, 24) || 'US100';
    if (sym === S.symbol) return;
    S.drawings = []; S.selected = null; if (drawings) drawings.renderSel();
    S.symbol = sym; store.set('sym', sym); S.drawings = store.get('draw:' + sym, []);
    updateChips(); S.dirty = true;
  }

  drawings = initDrawings({ S, store, $, esc, uid, css, fmt, wrap, ov, chart, candle, ts });
  cap = initCapital({
    S, store, $, esc, wrap, ts, fmt, etWall, resample, bucketKey, resForTf,
    setBase, softRebuild, rebuild, setSymbol, resetAutoScale, updateChips, openSheet,
    showOhlc, refreshInds,
    isCrossActive: () => crossActive,
    updateLiveCandle(b) {
      try { candle.update(b); } catch (e) {}
      updateCountdown();
    }
  });

  ts.subscribeVisibleLogicalRangeChange(r => {
    if (r && r.from < 25 && cap && cap.loadMore) cap.loadMore();
  });

  renderTf(); drawings.renderDock(); applyTheme();
  setBase([], 'none', '');
  cap.boot();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(applyTheme, 50));
  drawings.startLoop();
  setInterval(updateCountdown, 250);
  (function cdLoop() { updateCountdown(); requestAnimationFrame(cdLoop); })();
}

window.__nclStart = boot;
if (window.__libReady) boot();
