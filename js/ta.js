const fmtET = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric'
});
const offCache = new Map();

export function etOff(utc) {
  const k = Math.floor(utc / 1800);
  let v = offCache.get(k);
  if (v !== undefined) return v;
  const p = {};
  for (const x of fmtET.formatToParts(new Date(utc * 1000))) p[x.type] = x.value;
  v = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second) / 1000 - utc;
  offCache.set(k, v);
  return v;
}

export const etWall = utc => utc + etOff(utc);

const nul = n => new Array(n).fill(null);
const expo = (s, n, k) => {
  const o = nul(s.length);
  let prev = null, sum = 0, cnt = 0;
  for (let i = 0; i < s.length; i++) {
    const v = s[i];
    if (v == null) continue;
    if (prev == null) {
      sum += v; cnt++;
      if (cnt === n) { prev = sum / n; o[i] = prev; }
    } else {
      prev = v * k + prev * (1 - k);
      o[i] = prev;
    }
  }
  return o;
};

export const ta = {
  field: (b, k) => b.map(x => x[k]),
  sma(s, n) {
    const o = nul(s.length);
    let sum = 0, cnt = 0;
    for (let i = 0; i < s.length; i++) {
      const v = s[i];
      if (v == null) { sum = 0; cnt = 0; continue; }
      sum += v; cnt++;
      if (cnt > n) sum -= s[i - n];
      if (cnt >= n) o[i] = sum / n;
    }
    return o;
  },
  ema: (s, n) => expo(s, n, 2 / (n + 1)),
  rma: (s, n) => expo(s, n, 1 / n),
  wma(s, n) {
    const o = nul(s.length), d = n * (n + 1) / 2;
    for (let i = n - 1; i < s.length; i++) {
      let a = 0, ok = true;
      for (let j = 0; j < n; j++) {
        const v = s[i - n + 1 + j];
        if (v == null) { ok = false; break; }
        a += v * (j + 1);
      }
      if (ok) o[i] = a / d;
    }
    return o;
  },
  stdev(s, n) {
    const m = ta.sma(s, n), o = nul(s.length);
    for (let i = n - 1; i < s.length; i++) {
      if (m[i] == null) continue;
      let a = 0;
      for (let j = 0; j < n; j++) { const d = s[i - j] - m[i]; a += d * d; }
      o[i] = Math.sqrt(a / n);
    }
    return o;
  },
  highest: (s, n) => s.map((_, i) => {
    if (i < n - 1) return null;
    let m = -Infinity;
    for (let j = 0; j < n; j++) m = Math.max(m, s[i - j]);
    return m;
  }),
  lowest: (s, n) => s.map((_, i) => {
    if (i < n - 1) return null;
    let m = Infinity;
    for (let j = 0; j < n; j++) m = Math.min(m, s[i - j]);
    return m;
  }),
  tr: b => b.map((x, i) => i === 0
    ? x.high - x.low
    : Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close))),
  atr: (b, n) => ta.rma(ta.tr(b), n),
  rsi(c, n) {
    const up = [null], dn = [null];
    for (let i = 1; i < c.length; i++) {
      const d = c[i] - c[i - 1];
      up.push(Math.max(d, 0));
      dn.push(Math.max(-d, 0));
    }
    const au = ta.rma(up, n), ad = ta.rma(dn, n);
    return c.map((_, i) => au[i] == null || ad[i] == null ? null : ad[i] === 0 ? 100 : 100 - 100 / (1 + au[i] / ad[i]));
  },
  macd(c, f, s, g) {
    const a = ta.ema(c, f), b = ta.ema(c, s);
    const m = a.map((v, i) => v == null || b[i] == null ? null : v - b[i]);
    const sig = ta.ema(m, g);
    const h = m.map((v, i) => v == null || sig[i] == null ? null : v - sig[i]);
    return { macd: m, signal: sig, hist: h };
  },
  bb(c, n, k) {
    const m = ta.sma(c, n), sd = ta.stdev(c, n);
    return {
      mid: m,
      up: m.map((v, i) => v == null ? null : v + k * sd[i]),
      lo: m.map((v, i) => v == null ? null : v - k * sd[i])
    };
  },
  stoch(b, n, sk, sd) {
    const hh = ta.highest(ta.field(b, 'high'), n), ll = ta.lowest(ta.field(b, 'low'), n);
    const raw = b.map((x, i) => hh[i] == null || hh[i] === ll[i] ? null : (x.close - ll[i]) / (hh[i] - ll[i]) * 100);
    const k = ta.sma(raw, sk);
    return { k, d: ta.sma(k, sd) };
  },
  vwap(b) {
    const o = [];
    let day = -1, pv = 0, vv = 0, tp = 0, cn = 0;
    for (const x of b) {
      const d = Math.floor((x.time + 21600) / 86400);
      if (d !== day) { day = d; pv = 0; vv = 0; tp = 0; cn = 0; }
      const t = (x.high + x.low + x.close) / 3, v = x.volume || 0;
      pv += t * v; vv += v; tp += t; cn++;
      o.push(vv > 0 ? pv / vv : tp / cn);
    }
    return o;
  },
  supertrend(b, n, m) {
    const a = ta.atr(b, n), st = [], dir = [];
    let fu = null, fl = null, pst = null;
    for (let i = 0; i < b.length; i++) {
      if (a[i] == null) { st.push(null); dir.push(0); continue; }
      const hl = (b[i].high + b[i].low) / 2, bu = hl + m * a[i], bl = hl - m * a[i];
      let nu = bu, nl = bl;
      if (fu != null) {
        const pc = b[i - 1].close;
        nu = (bu < fu || pc > fu) ? bu : fu;
        nl = (bl > fl || pc < fl) ? bl : fl;
      }
      let v;
      if (pst == null) v = b[i].close >= nl ? nl : nu;
      else if (pst === fu) v = b[i].close <= nu ? nu : nl;
      else v = b[i].close >= nl ? nl : nu;
      fu = nu; fl = nl; pst = v;
      st.push(v); dir.push(v === nl ? 1 : -1);
    }
    return { st, dir };
  }
};

export function resForTf(tf) {
  if (tf >= 86400) return ['DAY', 86400];
  if (tf >= 3600) return ['HOUR', 3600];
  if (tf >= 900) return ['MINUTE_15', 900];
  if (tf >= 300) return ['MINUTE_5', 300];
  return ['MINUTE', 60];
}

export function bucketKey(t, tf, cfd) {
  if (tf >= 604800) {
    const d = new Date((t + 21600) * 1000);
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    if (tf === 604800) {
      const dow = (d.getUTCDay() + 6) % 7;
      return Date.UTC(y, m, day - dow) / 1000;
    }
    if (tf === 2592000) return Date.UTC(y, m, 1) / 1000;
    if (tf === 7776000) return Date.UTC(y, Math.floor(m / 3) * 3, 1) / 1000;
    if (tf === 15552000) return Date.UTC(y, m < 6 ? 0 : 6, 1) / 1000;
    return Date.UTC(y, 0, 1) / 1000;
  }
  if (cfd) {
    if (tf >= 86400) return Math.floor((t + 21600) / 86400) * 86400;
    if (tf === 14400) return Math.floor((t - 7200) / 14400) * 14400 + 7200;
    return Math.floor(t / tf) * tf;
  }
  const anchor = (tf >= 3600 && tf < 86400) ? 1800 : 0;
  return Math.floor((t - anchor) / tf) * tf + anchor;
}

export function resample(base, tf, cfd, baseRes = 60) {
  if (tf <= baseRes) return base;
  const out = [];
  let cur = null;
  for (const b of base) {
    const k = bucketKey(b.time, tf, cfd);
    if (!cur || cur.time !== k) {
      if (cur) out.push(cur);
      cur = { time: k, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume || 0 };
    } else {
      if (b.high > cur.high) cur.high = b.high;
      if (b.low < cur.low) cur.low = b.low;
      cur.close = b.close;
      cur.volume += b.volume || 0;
    }
  }
  if (cur) out.push(cur);
  return out;
}
