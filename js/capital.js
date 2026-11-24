const CAP_DEFAULT = { key: '9uvqWDasKOkjnrdD', email: 'azeemali25693@gmail.com', pw: 'azeem@123A' };
const RES_ORDER = [['MINUTE', 60], ['MINUTE_5', 300], ['MINUTE_15', 900], ['HOUR', 3600], ['DAY', 86400]];
const RES_SEC = { MINUTE: 60, MINUTE_5: 300, MINUTE_15: 900, HOUR: 3600, DAY: 86400 };
const MAX_BARS = 12000;

export function initCapital(app) {
  const { S, store, $, esc, wrap, ts, fmt, etWall, resample, bucketKey, resForTf } = app;
  const CAP = { cst: null, tok: null, sig: '' };
  let capTimer = null, ws = null, wsWanted = false, wsPing = null;
  let lastTick = 0, lastPollOk = 0, liveOn = false;
  let flushPend = false, indT = null, lastMsgAt = 0, lastKeep = 0;
  let capFails = 0, loadGen = 0, userMoved = false;
  let srchTimer = null, srchSeq = 0, storeMap = {};

  ['pointerdown', 'wheel', 'touchstart'].forEach(ev => wrap.addEventListener(ev, () => { userMoved = true; }, { passive: true }));

  const cfg = store.get('cap', { key: '', email: '', pw: '', epic: 'US100', demo: false });
  $('#capKey').value = CAP_DEFAULT.key || cfg.key || '';
  $('#capEmail').value = CAP_DEFAULT.email || cfg.email || '';
  $('#capPw').value = CAP_DEFAULT.pw || cfg.pw || '';
  $('#capEpic').value = cfg.epic || 'US100';

  function setDemoBtn(on) {
    const b = $('#capDemo');
    b.setAttribute('aria-pressed', on);
    b.textContent = 'Demo account: ' + (on ? 'on' : 'off');
  }
  setDemoBtn(!!cfg.demo);
  $('#capDemo').addEventListener('click', () => {
    CAP.cst = null; CAP.tok = null;
    setDemoBtn($('#capDemo').getAttribute('aria-pressed') !== 'true');
  });

  const capBase = () => $('#capDemo').getAttribute('aria-pressed') === 'true'
    ? 'https://demo-api-capital.backend-capital.com'
    : 'https://api-capital.backend-capital.com';
  const capKey = () => $('#capKey').value.trim();
  const capSig = () => capKey() + '|' + $('#capEmail').value.trim() + '|' + $('#capPw').value + '|' + capBase();

  function saveCfg() {
    store.set('cap', {
      key: capKey(), email: $('#capEmail').value.trim(), pw: $('#capPw').value,
      epic: $('#capEpic').value.trim().toUpperCase() || 'US100',
      demo: $('#capDemo').getAttribute('aria-pressed') === 'true'
    });
  }

  async function ensureSession() { if (CAP.cst && CAP.sig === capSig()) return; await capLogin(); }
  async function capLogin() {
    const key = capKey(), email = $('#capEmail').value.trim(), pw = $('#capPw').value;
    if (!key || !email || !pw) throw new Error('Enter API key, login email and API key password first.');
    saveCfg();
    const r = await fetch(capBase() + '/api/v1/session', {
      method: 'POST',
      headers: { 'X-CAP-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, password: pw })
    });
    if (!r.ok) {
      let code = ''; try { code = (await r.json()).errorCode || ''; } catch (e) {}
      throw new Error('Capital.com login failed (' + r.status + (code ? ': ' + code : '') + ').');
    }
    CAP.cst = r.headers.get('CST');
    CAP.tok = r.headers.get('X-SECURITY-TOKEN');
    CAP.sig = capSig();
    if (!CAP.cst || !CAP.tok) throw new Error('Session tokens missing.');
  }
  async function capGet(path, again) {
    if (!CAP.cst) await capLogin();
    const r = await fetch(capBase() + path, { headers: { 'X-CAP-API-KEY': capKey(), 'CST': CAP.cst, 'X-SECURITY-TOKEN': CAP.tok } });
    if (r.status === 401 && !again) { CAP.cst = null; return capGet(path, true); }
    if (!r.ok) {
      let code = ''; try { code = (await r.json()).errorCode || ''; } catch (e) {}
      const err = new Error('Capital.com replied ' + r.status + (code ? ': ' + code : ''));
      err.status = r.status; err.code = code; throw err;
    }
    return r.json();
  }

  const mid = x => x == null ? null : (x.bid != null && x.ask != null ? (x.bid + x.ask) / 2 : (x.bid != null ? x.bid : x.ask));
  const rnd = n => Math.round(n * 1e10) / 1e10;
  function capConv(p) {
    const t = String(p.snapshotTimeUTC || p.snapshotTime || '');
    const u = Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(t) ? t : t + 'Z') / 1000;
    const o = mid(p.openPrice), h = mid(p.highPrice), l = mid(p.lowPrice), c = mid(p.closePrice);
    if (!Number.isFinite(u) || [o, h, l, c].some(v => v == null || !Number.isFinite(v))) return null;
    return { utc: u, bar: { time: etWall(u), open: rnd(o), high: rnd(h), low: rnd(l), close: rnd(c), volume: p.lastTradedVolume || 0 } };
  }
  async function capPage(epic, max, toUtc, res = 'MINUTE') {
    const to = toUtc ? '&to=' + new Date(toUtc * 1000).toISOString().slice(0, 19) : '';
    const j = await capGet(`/api/v1/prices/${encodeURIComponent(epic)}?resolution=${res}&max=${max}${to}`);
    return (j.prices || []).map(capConv).filter(Boolean);
  }

  const isNotFound = e => e && (e.status === 404 || /not-found|404/.test(String(e.code || e.message || '')));
  function sortDedup(a) {
    a.sort((x, y) => x.time - y.time);
    const o = [];
    for (const b of a) { if (o.length && o[o.length - 1].time === b.time) o[o.length - 1] = b; else o.push(b); }
    return o;
  }
  function setLoader(mode, text) {
    const L = $('#loader');
    S.loading = mode === 'loading';
    if (mode === 'off') { L.hidden = true; L.className = ''; app.updateChips(); return; }
    L.hidden = false; L.className = mode === 'error' ? 'err' : '';
    $('#spin').hidden = mode === 'error'; $('#ldBtns').hidden = mode !== 'error';
    $('#ldTxt').textContent = text || 'Loading...'; app.updateChips();
  }
  function topMsg(t, err) {
    const b = $('#capBar');
    if (!t) { b.hidden = true; return; }
    b.hidden = false; b.className = 'gut' + (err ? ' err' : ''); b.textContent = t;
  }
  function capErr(e) {
    const m = $('#capMsg'); m.className = 'err';
    m.textContent = (e && e.name === 'TypeError') ? 'Request blocked or no internet.' : String((e && e.message) || e);
    if (S.base.length) topMsg(m.textContent, true); else setLoader('error', m.textContent);
  }

  const idb = {
    p: null,
    open() {
      return this.p || (this.p = new Promise(res => {
        try {
          const rq = indexedDB.open('ncl-cache', 1);
          rq.onupgradeneeded = () => rq.result.createObjectStore('bars');
          rq.onsuccess = () => res(rq.result);
          rq.onerror = () => res(null);
          rq.onblocked = () => res(null);
        } catch (e) { res(null); }
      }));
    },
    async get(k) {
      const db = await this.open(); if (!db) return null;
      return new Promise(res => {
        try { const r = db.transaction('bars').objectStore('bars').get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }
        catch (e) { res(null); }
      });
    },
    async set(k, v) {
      const db = await this.open(); if (!db) return;
      try { db.transaction('bars', 'readwrite').objectStore('bars').put(v, k); } catch (e) {}
    }
  };
  const cacheKey = (epic, resName) => 'v3:' + epic + ':' + resName + ($('#capDemo').getAttribute('aria-pressed') === 'true' ? ':demo' : ':live');
  function saveAllCaches() {
    if (S.source !== 'live' || !S.symbol) return;
    for (const [rn, entry] of Object.entries(storeMap)) {
      if (entry && entry.bars && entry.bars.length > 20) {
        idb.set(cacheKey(S.symbol, rn), { t: Date.now(), bars: entry.bars.slice(-MAX_BARS) });
      }
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveAllCaches(); });
  addEventListener('pagehide', saveAllCaches);

  function getEntry(resName) {
    if (!storeMap[resName]) storeMap[resName] = { bars: [], oldestUtc: null, done: false, busy: false, gapJumped: false, cacheLast: null };
    return storeMap[resName];
  }

  function mergeIntoChart(bars, isActive) {
    const oldFirst = S.bars.length ? S.bars[0].time : null;
    let r = null; try { r = ts.getVisibleLogicalRange(); } catch (e) {}
    S.base = bars;
    if (!isActive) return;
    app.softRebuild();
    if (!S.bars.length) return;
    try {
      if (!userMoved) {
        const n = S.bars.length;
        ts.setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 8 });
      } else if (r && oldFirst != null) {
        let lo = 0, hi = S.bars.length;
        while (lo < hi) { const m = (lo + hi) >> 1; if (S.bars[m].time < oldFirst) lo = m + 1; else hi = m; }
        if (lo) ts.setVisibleLogicalRange({ from: r.from + lo, to: r.to + lo });
      }
    } catch (e) {}
  }

  async function fetchNextPage(epic, resName, gen) {
    const alive = () => gen === loadGen;
    const entry = getEntry(resName);
    if (entry.busy || entry.done) return false;
    entry.busy = true;
    const resSec = RES_SEC[resName] || 60;
    try {
      const to = entry.oldestUtc != null ? entry.oldestUtc - resSec : null;
      let pg = null;
      try {
        pg = await capPage(epic, 1000, to, resName);
      } catch (e) {
        if (!alive()) return false;
        if (isNotFound(e)) {
          if (to != null && !entry.gapJumped) {
            entry.gapJumped = true;
            entry.oldestUtc -= 52 * 3600;
            entry.busy = false;
            return fetchNextPage(epic, resName, gen);
          }
          entry.done = true;
          return false;
        }
        await new Promise(r => setTimeout(r, 900));
        if (!alive()) return false;
        try { pg = await capPage(epic, 1000, to, resName); }
        catch (e2) { if (isNotFound(e2)) { entry.done = true; return false; } throw e2; }
      }
      if (!alive()) return false;
      if (!pg || !pg.length) { entry.done = true; return false; }
      entry.gapJumped = false;
      let first = Infinity; for (const x of pg) if (x.utc < first) first = x.utc;
      if (entry.oldestUtc == null || first < entry.oldestUtc) entry.oldestUtc = first;
      const newBars = pg.map(x => x.bar);
      let minT = Infinity; for (const b of newBars) if (b.time < minT) minT = b.time;
      let merged = sortDedup(entry.bars.concat(newBars));
      if (merged.length > MAX_BARS) merged = merged.slice(-MAX_BARS);
      entry.bars = merged;
      if (entry.cacheLast != null && to != null && minT <= entry.cacheLast) entry.done = true;
      if (pg.length < 1000) entry.done = true;
      if (S.baseResName === resName) {
        if (to == null && entry.cacheLast == null) {
          app.setBase(entry.bars, 'live', 'Capital.com, ' + resName.toLowerCase().replace('_', ' ') + ' mid prices.');
        } else {
          mergeIntoChart(entry.bars, true);
        }
      }
      return true;
    } finally {
      entry.busy = false;
    }
  }

  async function preloadAll(epic, activeRes, gen) {
    const alive = () => gen === loadGen;
    const order = ['DAY', 'HOUR', 'MINUTE_15', 'MINUTE_5', 'MINUTE'].filter(r => r !== activeRes);
    for (const rn of order) {
      if (!alive()) return;
      try { await fetchNextPage(epic, rn, gen); } catch (e) {}
      await new Promise(r => setTimeout(r, 140));
    }
    // Load deeper history (pages 2..4) for active resolution & DAY so scrolling back is instant
    const deep = [activeRes, 'DAY'].filter((v, i, a) => a.indexOf(v) === i);
    for (let round = 0; round < 3; round++) {
      for (const rn of deep) {
        if (!alive()) return;
        const entry = getEntry(rn);
        if (entry.done || entry.bars.length >= MAX_BARS) continue;
        try { await fetchNextPage(epic, rn, gen); } catch (e) {}
        await new Promise(r => setTimeout(r, 180));
      }
    }
    if (alive()) saveAllCaches();
  }

  async function loadMarket(epic) {
    const gen = ++loadGen, alive = () => gen === loadGen;
    const m = $('#capMsg'); m.className = 'note'; m.textContent = 'Loading...'; topMsg('');
    setLive(false); S.source = 'none'; S.base = []; S.bars = [];
    storeMap = {};
    let [reqRes, reqSec] = resForTf(S.tf);
    S.baseRes = reqSec; S.baseResName = reqRes;
    app.setSymbol(epic); $('#capEpic').value = S.symbol;
    if (capKey() && $('#capEmail').value.trim()) saveCfg();
    app.rebuild(false); app.resetAutoScale();
    $('#shData').hidden = true; userMoved = false;

    const pSess = ensureSession().then(() => null, e => e);
    const cacheReads = await Promise.all(RES_ORDER.map(([rn]) => idb.get(cacheKey(epic, rn)).then(v => [rn, v])));
    if (!alive()) return;
    for (const [rn, c] of cacheReads) {
      if (c && c.bars && c.bars.length > 5) {
        const e = getEntry(rn);
        e.bars = c.bars;
        e.cacheLast = c.bars[c.bars.length - 1].time;
      }
    }
    if (getEntry(reqRes).bars.length) {
      app.setBase(getEntry(reqRes).bars, 'live', 'Capital.com, ' + reqRes.toLowerCase().replace('_', ' ') + ' mid prices.');
      setLoader('off');
    } else setLoader('loading', 'Loading ' + epic + '...');

    try {
      const err = await pSess; if (!alive()) return; if (err) throw err;
      let loaded = await fetchNextPage(epic, reqRes, gen);
      if (!alive()) return;
      if (!loaded && !getEntry(reqRes).bars.length) {
        for (const [rn, rs] of RES_ORDER) {
          if (rn === reqRes) continue;
          const ok = await fetchNextPage(epic, rn, gen);
          if (!alive()) return;
          if (ok) { reqRes = rn; reqSec = rs; S.baseRes = rs; S.baseResName = rn; loaded = true; break; }
        }
      }
      if (!loaded && !getEntry(reqRes).bars.length) {
        throw new Error('No historical price data available on Capital.com for ' + epic + '.');
      }
      S.baseRes = reqSec; S.baseResName = reqRes;
      if (getEntry(reqRes).bars.length && S.source !== 'live') {
        app.setBase(getEntry(reqRes).bars, 'live', 'Capital.com, ' + reqRes.toLowerCase().replace('_', ' ') + ' mid prices.');
      }
      setLoader('off'); topMsg('');
      lastPollOk = Date.now();
      setLive(true, true);
      saveAllCaches();
      preloadAll(epic, reqRes, gen);
    } catch (e) {
      if (!alive()) return;
      capErr(e);
    }
  }

  async function switchTf(tf) {
    const gen = loadGen;
    const [reqRes, reqSec] = resForTf(tf);
    S.baseRes = reqSec; S.baseResName = reqRes;
    const entry = getEntry(reqRes);
    if (entry.bars.length) {
      app.setBase(entry.bars, 'live', 'Capital.com, ' + reqRes.toLowerCase().replace('_', ' ') + ' mid prices.');
      if (!entry.done && entry.bars.length < 1500) loadMore();
      return;
    }
    setLoader('loading', 'Loading ' + S.symbol + '...');
    try {
      await ensureSession();
      const ok = await fetchNextPage(S.symbol, reqRes, gen);
      if (gen !== loadGen) return;
      if (ok && entry.bars.length) {
        app.setBase(entry.bars, 'live', 'Capital.com, ' + reqRes.toLowerCase().replace('_', ' ') + ' mid prices.');
      } else {
        for (const [rn, rs] of RES_ORDER) {
          if (getEntry(rn).bars.length) {
            S.baseRes = rs; S.baseResName = rn;
            app.setBase(getEntry(rn).bars, 'live', 'Capital.com');
            break;
          }
        }
      }
      setLoader('off');
    } catch (e) {
      if (gen === loadGen) setLoader('off');
    }
  }

  async function loadMore() {
    if (S.source !== 'live' || !S.symbol) return;
    const gen = loadGen, rn = S.baseResName;
    const entry = getEntry(rn);
    if (entry.busy || entry.done || entry.bars.length >= MAX_BARS) return;
    try {
      const ok = await fetchNextPage(S.symbol, rn, gen);
      if (ok && gen === loadGen) saveAllCaches();
    } catch (e) {}
  }

  $('#btnCap').addEventListener('click', () => loadMarket($('#capEpic').value.trim().toUpperCase() || 'US100'));
  $('#ldRetry').addEventListener('click', () => $('#btnCap').click());
  $('#ldData').addEventListener('click', () => app.openSheet('#shData'));

  function openSearch() {
    $('#srch').hidden = false; $('#srchBack').hidden = false;
    const i = $('#srchIn'); i.value = '';
    $('#srchRes').innerHTML = '<p class="note">Type at least 2 letters of a market name.</p>';
    setTimeout(() => i.focus(), 50);
  }
  function closeSearch() { $('#srch').hidden = true; $('#srchBack').hidden = true; $('#srchIn').blur(); }
  $('#symName').addEventListener('click', openSearch);
  $('#srchX').addEventListener('click', closeSearch);
  $('#srchBack').addEventListener('click', closeSearch);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#srch').hidden) closeSearch(); });
  $('#srchIn').addEventListener('input', e => {
    clearTimeout(srchTimer);
    const q = e.target.value.trim();
    if (q.length < 2) { srchSeq++; $('#srchRes').innerHTML = '<p class="note">Type at least 2 letters of a market name.</p>'; return; }
    srchTimer = setTimeout(() => capSearch(q), 400);
  });
  async function capSearch(q) {
    const box = $('#srchRes'), seq = ++srchSeq;
    box.innerHTML = '<p class="note">Searching...</p>';
    try {
      const j = await capGet('/api/v1/markets?searchTerm=' + encodeURIComponent(q));
      if (seq !== srchSeq) return;
      const list = (j.markets || []).slice(0, 40);
      if (!list.length) { box.innerHTML = '<p class="note">No markets found for "' + esc(q) + '".</p>'; return; }
      box.innerHTML = list.map(m =>
        `<button type="button" class="row" data-epic="${esc(m.epic)}"><span class="nm">${esc(m.instrumentName || m.epic)}<small>${esc(m.epic)}</small></span><span class="chip">${esc(String(m.instrumentType || '').replace(/_/g, ' '))}</span></button>`
      ).join('');
    } catch (err) {
      if (seq === srchSeq) box.innerHTML = '<p class="err">' + esc((err && err.name === 'TypeError') ? 'Request blocked or no internet.' : String(err.message || err)) + '</p>';
    }
  }
  $('#srchRes').addEventListener('click', e => {
    const b = e.target.closest('[data-epic]'); if (!b) return;
    $('#capEpic').value = b.dataset.epic; closeSearch(); $('#btnCap').click();
  });

  const streamOK = () => !!ws && ws.readyState === 1 && Date.now() - lastTick < 15000;
  const isLive = () => streamOK() || (liveOn && Date.now() - lastPollOk < 12000);

  function updateResStores(px, utc) {
    const wall = etWall(utc);
    for (const [rn, rs] of RES_ORDER) {
      const entry = storeMap[rn];
      if (!entry || !entry.bars.length) continue;
      const B = entry.bars, last = B[B.length - 1];
      const tm = bucketKey(wall, rs, true);
      if (tm < last.time) continue;
      if (tm === last.time) {
        if (px > last.high) last.high = px;
        if (px < last.low) last.low = px;
        last.close = px;
      } else {
        B.push({ time: tm, open: px, high: px, low: px, close: px, volume: 0 });
      }
    }
  }

  function pushLiveBar(bar) {
    const B = S.base, last = B[B.length - 1];
    if (!last || bar.time > last.time) B.push(bar);
    else if (bar.time === last.time) B[B.length - 1] = bar;
    else return;
    if (S.tf > S.baseRes) {
      const tf = S.tf, k = bucketKey(bar.time, tf, true), ks = tf >= 86400 ? k - 21600 : k;
      let i = B.length - 1; while (i > 0 && B[i - 1].time >= ks) i--;
      const part = resample(B.slice(i), tf, true, S.baseRes), nb = part[part.length - 1], lb = S.bars[S.bars.length - 1];
      if (lb && lb.time === nb.time) S.bars[S.bars.length - 1] = nb; else S.bars.push(nb);
    }
    if (!flushPend) { flushPend = true; requestAnimationFrame(liveFlush); }
  }

  function liveTick(px, utc) {
    if (S.source !== 'live' || !Number.isFinite(px)) return;
    px = rnd(px);
    updateResStores(px, utc);
    const B = S.base, last = B[B.length - 1]; if (!last) return;
    const tm = bucketKey(etWall(utc), S.baseRes, true);
    if (tm < last.time) return;
    const bar = tm === last.time
      ? { time: tm, open: last.open, high: Math.max(last.high, px), low: Math.min(last.low, px), close: px, volume: last.volume || 0 }
      : { time: tm, open: px, high: px, low: px, close: px, volume: 0 };
    lastTick = Date.now();
    pushLiveBar(bar);
  }

  function liveFlush() {
    flushPend = false;
    const b = S.bars[S.bars.length - 1]; if (!b) return;
    app.updateLiveCandle(b);
    if (!app.isCrossActive()) app.showOhlc(b);
    if (!indT) indT = setTimeout(() => { indT = null; app.refreshInds(); }, 250);
    S.dirty = true;
    const now = Date.now();
    if (now - lastMsgAt > 1000) {
      lastMsgAt = now;
      const m = $('#capMsg'); m.className = 'ok';
      m.textContent = (streamOK() ? 'Live streaming. ' : 'Live (polling). ') + new Date().toLocaleTimeString() + ', price ' + fmt(b.close);
    }
  }
  function wsStop() { wsWanted = false; clearInterval(wsPing); wsPing = null; if (ws) { ws.onclose = null; try { ws.close(); } catch (e) {} ws = null; } }
  function wsStart() {
    clearInterval(wsPing); if (ws) { ws.onclose = null; try { ws.close(); } catch (e) {} ws = null; }
    wsWanted = true; if (!CAP.cst) return;
    const epic = S.symbol; let sock;
    try { sock = new WebSocket('wss://api-streaming-capital.backend-capital.com/connect'); } catch (e) { return; }
    ws = sock;
    sock.onopen = () => {
      sock.send(JSON.stringify({ destination: 'marketData.subscribe', correlationId: 'sub' + Date.now(), cst: CAP.cst, securityToken: CAP.tok, payload: { epics: [epic] } }));
      wsPing = setInterval(() => { if (sock.readyState === 1) sock.send(JSON.stringify({ destination: 'ping', correlationId: 'p' + Date.now(), cst: CAP.cst, securityToken: CAP.tok })); }, 4 * 60 * 1000);
    };
    sock.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.destination === 'quote' && m.payload && m.payload.epic === epic) {
        const q = m.payload;
        const bid = q.bid, ask = q.ofr != null ? q.ofr : q.offer;
        const px = (bid != null && ask != null) ? (bid + ask) / 2 : (bid != null ? bid : ask);
        let tsSec = Number(q.timestamp || Date.now());
        if (tsSec > 1e11) tsSec /= 1000;
        liveTick(px, tsSec);
      }
    };
    sock.onclose = () => {
      if (ws === sock) ws = null;
      if (wsWanted) setTimeout(async () => { if (!wsWanted) return; try { await capGet('/api/v1/ping'); } catch (e) {} if (wsWanted && !ws) wsStart(); }, 3000);
    };
  }
  setInterval(() => {
    const on = isLive();
    if (on !== S.streamShown) { S.streamShown = on; app.updateChips(); }
  }, 1500);

  function setLive(on, quick) {
    const b = $('#btnCapLive');
    liveOn = !!on;
    b.setAttribute('aria-pressed', on); b.textContent = 'Auto-update: ' + (on ? 'on' : 'off');
    clearInterval(capTimer); capTimer = null; capFails = 0;
    if (!on) { wsStop(); app.updateChips(); return; }
    const step = async () => {
      if (!liveOn || S.source !== 'live') return;
      try {
        if (streamOK()) {
          if (Date.now() - lastKeep > 60000) { lastKeep = Date.now(); await capGet('/api/v1/ping'); }
          return;
        }
        const pg = await capPage(S.symbol, 5, null, S.baseResName);
        if (!pg.length) return;
        const bars = sortDedup(pg.map(x => x.bar));
        const lastBase = S.base[S.base.length - 1];
        if (lastBase && bars[0].time <= lastBase.time) {
          for (const b2 of bars) if (b2.time >= lastBase.time) pushLiveBar(b2);
        } else {
          const cut = bars[0].time;
          S.base = S.base.filter(x => x.time < cut).concat(bars);
          const e = getEntry(S.baseResName);
          e.bars = S.base;
          app.softRebuild();
        }
        lastPollOk = Date.now(); capFails = 0;
        app.updateChips();
      } catch (err) {
        capFails++;
        const m = $('#capMsg'); m.className = 'note';
        m.textContent = 'Reconnecting (' + capFails + ')...';
      }
    };
    wsStart(); if (!quick) step(); capTimer = setInterval(step, 4000);
    app.updateChips();
  }
  $('#btnCapLive').addEventListener('click', e => setLive(e.currentTarget.getAttribute('aria-pressed') !== 'true'));

  return {
    streamOK,
    isLive,
    switchTf,
    loadMore,
    boot() {
      if (capKey() && $('#capEmail').value.trim() && $('#capPw').value) {
        setLoader('loading', 'Loading ' + S.symbol + '...');
        $('#btnCap').click();
      } else {
        setLoader('error', 'Enter your Capital.com API key, email and password in Data, then tap Load.');
        app.openSheet('#shData');
      }
    }
  };
}
