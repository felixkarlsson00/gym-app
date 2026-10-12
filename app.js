'use strict';

// ---------- Data ----------

const KEY = 'gymlogg.v1';
const GROUPS = ['Bröst', 'Rygg', 'Ben', 'Axlar', 'Armar', 'Bål', 'Övrigt'];
// A trailing * marks a bodyweight exercise: the weight field is extra load (belt/vest), default 0.
const DEFAULTS = {
  'Bröst': ['Bench Press', 'Incline Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Fly', 'Cable Fly',
    'High-to-Low Cable Fly', 'Low-to-High Cable Fly', 'Machine Chest Press', 'Pec Deck', 'Dips*', 'Ring Dips*', 'Push-Up*'],
  'Rygg': ['Deadlift', 'Pull-Up*', 'Chin-Up*', 'Neutral-Grip Pull-Up*', 'Muscle-Up*', 'Barbell Row', 'Dumbbell Row', 'T-Bar Row',
    'Lat Pulldown', 'Seated Cable Row', 'Single-Arm Cable Row', 'Straight-Arm Pulldown', 'Inverted Row*', 'Back Extension*', 'Dumbbell Shrug'],
  'Ben': ['Squat', 'Front Squat', 'Goblet Squat', 'Leg Press', 'Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Bulgarian Split Squat',
    'Lunge', 'Walking Lunge', 'Leg Curl', 'Leg Extension', 'Hip Thrust', 'Calf Raise', 'Cable Pull-Through', 'Pistol Squat*', 'Nordic Curl*'],
  'Axlar': ['Overhead Press', 'Dumbbell Shoulder Press', 'Arnold Press', 'Dumbbell Lateral Raise', 'Cable Lateral Raise',
    'Dumbbell Front Raise', 'Face Pull', 'Reverse Fly', 'Cable Reverse Fly', 'Pike Push-Up*', 'Handstand Push-Up*'],
  'Armar': ['Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Incline Dumbbell Curl', 'Cable Curl', 'Preacher Curl', 'Concentration Curl',
    'Triceps Pushdown', 'Rope Pushdown', 'Overhead Cable Triceps Extension', 'Dumbbell Overhead Triceps Extension', 'Skull Crusher',
    'Close-Grip Bench Press', 'Bench Dips*', 'Diamond Push-Up*'],
  'Bål': ['Plank*', 'Hanging Leg Raise*', 'Hanging Knee Raise*', 'Toes-to-Bar*', 'Cable Crunch', 'Cable Woodchopper', 'Ab Wheel Rollout*',
    'Sit-Up*', 'Russian Twist*', 'L-Sit*', 'Dragon Flag*'],
};
// The first version shipped Swedish names; logged sets are moved over to the English ones.
const RENAMED = {
  'Bänkpress': 'Bench Press', 'Lutande bänkpress': 'Incline Bench Press', 'Hantelpress': 'Dumbbell Bench Press',
  'Lutande hantelpress': 'Incline Dumbbell Press', 'Cable flyes': 'Cable Fly', 'Armhävningar': 'Push-Up', 'Marklyft': 'Deadlift',
  'Chins': 'Chin-Up', 'Pull-ups': 'Pull-Up', 'Skivstångsrodd': 'Barbell Row', 'Hantelrodd': 'Dumbbell Row', 'Latsdrag': 'Lat Pulldown',
  'Sittande kabelrodd': 'Seated Cable Row', 'Knäböj': 'Squat', 'Benpress': 'Leg Press', 'Rumänska marklyft': 'Romanian Deadlift',
  'Bulgariska utfall': 'Bulgarian Split Squat', 'Utfall': 'Lunge', 'Lårcurl': 'Leg Curl', 'Benspark': 'Leg Extension',
  'Vadpress': 'Calf Raise', 'Militärpress': 'Overhead Press', 'Axelpress med hantlar': 'Dumbbell Shoulder Press',
  'Sidolyft': 'Dumbbell Lateral Raise', 'Face pulls': 'Face Pull', 'Omvända flyes': 'Reverse Fly', 'Bicepscurl': 'Dumbbell Curl',
  'Hammercurl': 'Hammer Curl', 'Skivstångscurl': 'Barbell Curl', 'Skullcrushers': 'Skull Crusher', 'Smal bänkpress': 'Close-Grip Bench Press',
  'Plankan': 'Plank', 'Hängande benlyft': 'Hanging Leg Raise', 'Ab wheel': 'Ab Wheel Rollout',
};

const slug = (s) => 'x-' + s.toLowerCase().replace(/[^a-z0-9åäö]+/g, '-');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch { /* corrupt or missing */ }
  if (!s || typeof s !== 'object') s = {};
  s.exercises = Array.isArray(s.exercises) ? s.exercises : [];
  s.workouts = Array.isArray(s.workouts) ? s.workouts : [];
  s.active = s.active || null;

  const remap = new Map(Object.entries(RENAMED).map(([from, to]) => [slug(from), slug(to)]));
  s.exercises = s.exercises.filter((e) => !remap.has(e.id));
  for (const w of s.active ? [...s.workouts, s.active] : s.workouts) {
    for (const e of w.entries) if (remap.has(e.exId)) e.exId = remap.get(e.exId);
  }

  for (const [group, names] of Object.entries(DEFAULTS)) {
    for (const raw of names) {
      const bw = raw.endsWith('*'), name = bw ? raw.slice(0, -1) : raw;
      const ex = s.exercises.find((e) => e.id === slug(name));
      if (!ex) s.exercises.push({ id: slug(name), name, group, bw });
      else {
        ex.name = name;
        if (ex.bw === undefined) ex.bw = bw; // keep the user's own choice once set
      }
    }
  }
  return s;
}

let S = load();
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('Kunde inte spara – lagringen är full'); }
}
function saveSoon() {
  if (!saveTimer) saveTimer = setTimeout(save, 300);
}

// UI-only state (not persisted)
const ui = { metric: 'n', exId: null, rest: 0, picker: { q: '', group: null }, exQ: '' };

// ---------- Helpers ----------

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });
const fmt = (n) => nf.format(n);
const compact = (n) => (n >= 1000 ? fmt(n / 1000) + 'k' : fmt(n));
const parseNum = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const exById = (id) => S.exercises.find((e) => e.id === id);
const exName = (id) => (exById(id) || { name: 'Okänd övning' }).name;
const sorted = () => [...S.workouts].sort((a, b) => b.start - a.start);
const validSet = (s) => s.r > 0;
const e1rm = (s) => (s.r === 1 ? s.w || 0 : (s.w || 0) * (1 + s.r / 30)); // Epley
const isBW = (id) => !!(exById(id) || {}).bw;
const setText = (s, exId) => (isBW(exId) ? `BW${s.w ? ' +' + fmt(s.w) + ' kg' : ''} × ${s.r}` : s.w ? `${fmt(s.w)} kg × ${s.r}` : `${s.r} reps`);

function workoutStats(w) {
  let sets = 0, vol = 0;
  for (const e of w.entries) for (const s of e.sets) if (validSet(s)) { sets++; vol += (s.w || 0) * s.r; }
  return { sets, vol, dur: (w.end || Date.now()) - w.start };
}

function fmtDate(ts, long) {
  const d = new Date(ts);
  const opts = { weekday: long ? 'long' : 'short', day: 'numeric', month: long ? 'long' : 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('sv-SE', opts);
}
const shortDate = (ts) => new Date(ts).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
function fmtDur(ms) {
  const min = Math.max(1, Math.round(ms / 60000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}
function clock(ms) {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}

// Weeks start on Monday
function weekStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
function isoWeek(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}
function lastWeeks(n) {
  const out = [];
  const d = new Date(weekStart(Date.now()));
  for (let i = 0; i < n; i++) {
    out.unshift({ t: d.getTime(), n: 0, vol: 0 });
    d.setDate(d.getDate() - 7);
  }
  return out;
}

// One row per finished workout that contains the exercise, oldest first
function exHistory(id) {
  const out = [];
  // Bodyweight lifts are ranked by extra load (then reps); everything else by estimated 1RM
  const score = isBW(id) ? (s) => s.w || 0 : e1rm;
  for (const w of sorted().reverse()) {
    for (const e of w.entries) {
      if (e.exId !== id) continue;
      let best = null, vol = 0, reps = 0;
      for (const s of e.sets) {
        if (!validSet(s)) continue;
        vol += (s.w || 0) * s.r;
        reps = Math.max(reps, s.r);
        if (!best || score(s) > score(best) || (score(s) === score(best) && s.r > best.r)) best = s;
      }
      if (best) out.push({ t: w.start, wid: w.id, sets: e.sets.filter(validSet), best, e1: score(best), vol, reps });
    }
  }
  return out;
}
function lastEntry(exId) {
  for (const w of sorted()) {
    const e = w.entries.find((x) => x.exId === exId);
    if (e && e.sets.length) return e;
  }
  return null;
}

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

// ---------- Charts (plain SVG) ----------

function niceStep(raw, integer) {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw * 0.999);
  return integer ? Math.max(1, Math.ceil(step)) : step;
}

function attachHover(el, svg, pick) {
  const tip = $('.tip', el);
  const hide = () => { tip.hidden = true; pick(null); };
  const show = (ev) => {
    const box = svg.getBoundingClientRect();
    const p = pick(ev.clientX - box.left);
    if (!p) return hide();
    tip.innerHTML = p.html;
    tip.hidden = false;
    tip.style.left = Math.max(0, Math.min(box.width - tip.offsetWidth, p.x - tip.offsetWidth / 2)) + 'px';
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  // On touch the tooltip stays until the next tap; with a mouse it follows the pointer.
  svg.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') hide(); });
}

// data: [{ label, v, tip }]
function barChart(el, data, { integer = false } = {}) {
  if (!el) return;
  const W = el.clientWidth || 320, H = 170, m = { l: 34, r: 6, t: 26, b: 22 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = Math.max(...data.map((d) => d.v), integer ? 1 : 0.001);
  const step = niceStep(max / 4, integer);
  const top = Math.ceil(max / step) * step;
  const y = (v) => m.t + ih - (v / top) * ih;
  const band = iw / data.length, bw = Math.min(24, band - 2);
  const every = Math.ceil(data.length / 6);

  let g = '';
  for (let v = 0; v <= top + step / 2; v += step) {
    g += `<line class="${v ? 'gridline' : 'baseline'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    g += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`;
  }
  data.forEach((d, i) => {
    const x = m.l + i * band + (band - bw) / 2, y0 = y(0), y1 = y(d.v);
    if (d.v > 0) {
      const r = Math.min(4, bw / 2, y0 - y1);
      g += `<path class="bar" data-i="${i}" d="M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + bw - r}Q${x + bw},${y1} ${x + bw},${y1 + r}V${y0}Z"/>`;
    }
    if ((data.length - 1 - i) % every === 0) g += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img">${g}</svg><div class="tip" hidden></div>`;

  const bars = [...el.querySelectorAll('.bar')];
  attachHover(el, $('svg', el), (px) => {
    const i = px == null ? -1 : Math.floor((px - m.l) / band);
    bars.forEach((b) => b.classList.toggle('dim', i >= 0 && i < data.length && +b.dataset.i !== i));
    if (i < 0 || i >= data.length) return null;
    return { x: m.l + (i + 0.5) * band, html: data[i].tip };
  });
}

// points: [{ t, v, tip }] sorted by time
function lineChart(el, points, unit) {
  if (!el) return;
  const W = el.clientWidth || 320, H = 180, m = { l: 34, r: 46, t: 26, b: 22 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const vs = points.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (lo === hi) { lo = Math.max(0, lo - 5); hi += 5; }
  const step = niceStep((hi - lo) / 4, false);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const x = (t) => (t1 === t0 ? m.l + iw / 2 : m.l + ((t - t0) / (t1 - t0)) * iw);
  const y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;

  let g = '';
  for (let v = lo; v <= hi + step / 2; v += step) {
    g += `<line class="${v === lo ? 'baseline' : 'gridline'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    g += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${compact(+v.toFixed(2))}</text>`;
  }
  const path = points.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ',' + y(p.v).toFixed(1)).join('');
  if (points.length > 1) {
    g += `<path class="area" d="${path}L${x(t1)},${y(lo)}L${x(t0)},${y(lo)}Z"/><path class="line" d="${path}"/>`;
    g += `<text x="${m.l}" y="${H - 6}">${shortDate(t0)}</text><text x="${m.l + iw}" y="${H - 6}" text-anchor="end">${shortDate(t1)}</text>`;
  } else {
    g += `<text x="${x(t0)}" y="${H - 6}" text-anchor="middle">${shortDate(t0)}</text>`;
  }
  g += `<line class="cross" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>`;
  const last = points[points.length - 1];
  if (points.length <= 24) for (const p of points) g += `<circle class="dot" cx="${x(p.t)}" cy="${y(p.v)}" r="4"/>`;
  else g += `<circle class="dot" cx="${x(last.t)}" cy="${y(last.v)}" r="4"/>`;
  g += `<circle class="dot hover" r="5" visibility="hidden"/>`;
  g += `<text class="end-label" x="${x(last.t) + 9}" y="${y(last.v) + 4}">${fmt(Math.round(last.v * 10) / 10)}</text>`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img">${g}</svg><div class="tip" hidden></div>`;

  const cross = $('.cross', el), dot = $('.dot.hover', el);
  attachHover(el, $('svg', el), (px) => {
    if (px == null) {
      cross.setAttribute('visibility', 'hidden');
      dot.setAttribute('visibility', 'hidden');
      return null;
    }
    let p = points[0];
    for (const q of points) if (Math.abs(x(q.t) - px) < Math.abs(x(p.t) - px)) p = q;
    cross.setAttribute('x1', x(p.t)); cross.setAttribute('x2', x(p.t)); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', x(p.t)); dot.setAttribute('cy', y(p.v)); dot.setAttribute('visibility', 'visible');
    return { x: x(p.t), html: p.tip };
  });
}

function tableView(head, rows) {
  return `<details class="tbl"><summary>Visa som tabell</summary><table>
    <tr>${head.map((h, i) => `<th${i ? ' class="num"' : ''}>${h}</th>`).join('')}</tr>
    ${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}
  </table></details>`;
}

// Progress chart for one exercise; falls back to max reps for bodyweight-only lifts
function progressChart(id, hist, after) {
  const bodyweight = hist.every((h) => h.e1 === 0);
  const unit = bodyweight ? 'reps' : 'kg';
  const points = hist.map((h) => ({
    t: h.t,
    v: bodyweight ? h.reps : h.e1,
    tip: `${fmtDate(h.t)}<br><b>${bodyweight ? h.reps + ' reps' : fmt(Math.round(h.e1 * 10) / 10) + ' kg'}</b> · ${setText(h.best, id)}`,
  }));
  after.push(() => lineChart($('#c-prog'), points, unit));
  const extra = isBW(id);
  return `<p class="muted">${bodyweight ? 'Flest reps i ett set per pass' : extra ? 'Tyngsta extra vikt (kg) per pass' : 'Beräknat 1RM (kg) per pass'}</p>
    <div class="chart" id="c-prog"></div>
    ${tableView(['Datum', 'Bästa set', bodyweight ? 'Reps' : extra ? 'Extra kg' : '1RM'], [...hist].reverse().map((h) => [fmtDate(h.t), setText(h.best, id), bodyweight ? h.reps : fmt(Math.round(h.e1 * 10) / 10)]))}`;
}

// ---------- Views ----------

function workoutItem(w) {
  const st = workoutStats(w);
  const names = w.entries.map((e) => exName(e.exId)).join(', ');
  return `<a class="item" href="#/history/${w.id}">
    <div class="main"><div><b>${esc(w.name)}</b></div><div class="muted">${fmtDate(w.start)} · ${esc(names)}</div></div>
    <div class="side">${fmtDur(st.dur)}<br><span class="muted">${st.sets} set · ${compact(Math.round(st.vol))} kg</span></div>
  </a>`;
}

function viewHome(arg, after) {
  const ws = sorted();
  const start = S.active
    ? `<a class="card banner" href="#/workout"><div><b>Pågående pass</b><div class="sub">${esc(S.active.name)}</div></div><span class="btn small">Fortsätt</span></a>`
    : `<button class="btn" data-act="start">Starta nytt pass</button>`;
  const head = `<div class="top"><h1>Gymlogg</h1><a class="icon-btn" href="#/settings" aria-label="Inställningar" style="display:grid;place-items:center">⚙</a></div>`;

  if (!ws.length) {
    return `${head}${start}<div class="card empty"><p><b>Inga pass loggade än</b></p><p>Starta ditt första pass så fylls översikten på med statistik.</p></div>`;
  }

  const weeks = lastWeeks(12);
  const first = weeks[0].t;
  for (const w of ws) {
    if (w.start < first) continue;
    const wk = weeks.find((x) => x.t === weekStart(w.start));
    if (wk) { wk.n++; wk.vol += workoutStats(w).vol; }
  }
  const cur = weeks[11], prev = weeks[10];

  // Consecutive weeks with at least one workout (the current week may still be empty)
  const active = new Set(ws.map((w) => weekStart(w.start)));
  let streak = 0;
  const d = new Date(weekStart(Date.now()));
  if (!active.has(d.getTime())) d.setDate(d.getDate() - 7);
  while (active.has(d.getTime())) { streak++; d.setDate(d.getDate() - 7); }

  const vol = ui.metric === 'vol';
  const bars = weeks.map((w) => ({
    label: 'v' + isoWeek(w.t),
    v: vol ? Math.round(w.vol) : w.n,
    tip: `Vecka ${isoWeek(w.t)}<br><b>${vol ? fmt(Math.round(w.vol)) + ' kg' : w.n + ' pass'}</b>`,
  }));
  after.push(() => barChart($('#c-week'), bars, { integer: !vol }));

  // Exercises with history, most trained first
  const counts = new Map();
  for (const w of ws) for (const e of w.entries) counts.set(e.exId, (counts.get(e.exId) || 0) + 1);
  const trained = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));
  if (!counts.has(ui.exId)) ui.exId = trained[0];
  const hist = exHistory(ui.exId);

  const prs = trained.slice(0, 6).map((id) => {
    const h = exHistory(id);
    if (!h.length) return '';
    const best = h.reduce((a, b) => (b.e1 > a.e1 || (b.e1 === a.e1 && b.reps > a.reps) ? b : a));
    return `<a class="item" href="#/exercise/${id}"><div class="main"><div>${esc(exName(id))}</div><div class="muted">${fmtDate(best.t)}</div></div><div class="side">${setText(best.best, id)}</div></a>`;
  }).join('');

  return `${head}${start}
    <div class="tiles">
      <div class="card tile"><div class="label">Pass denna vecka</div><div class="value">${cur.n}</div><div class="muted">Förra veckan: ${prev.n}</div></div>
      <div class="card tile"><div class="label">Volym denna vecka</div><div class="value">${compact(Math.round(cur.vol))} <small>kg</small></div><div class="muted">Förra veckan: ${compact(Math.round(prev.vol))} kg</div></div>
      <div class="card tile"><div class="label">Pass totalt</div><div class="value">${ws.length}</div></div>
      <div class="card tile"><div class="label">Veckor i rad</div><div class="value">${streak}</div></div>
    </div>
    <div class="card">
      <div class="card-head"><h2>${vol ? 'Volym per vecka (kg)' : 'Pass per vecka'}</h2>
        <div class="seg"><button data-act="metric" data-v="n" class="${vol ? '' : 'on'}">Pass</button><button data-act="metric" data-v="vol" class="${vol ? 'on' : ''}">Volym</button></div>
      </div>
      <div class="chart" id="c-week"></div>
      ${tableView(['Vecka', vol ? 'Volym (kg)' : 'Pass'], [...bars].reverse().map((b) => [b.label, fmt(b.v)]))}
    </div>
    <div class="card">
      <h2>Styrkeutveckling</h2>
      <select data-ui="exId" aria-label="Övning">${trained.map((id) => `<option value="${id}"${id === ui.exId ? ' selected' : ''}>${esc(exName(id))}</option>`).join('')}</select>
      <div style="height:10px"></div>
      ${hist.length ? progressChart(ui.exId, hist, after) : ''}
    </div>
    <div class="card"><h2>Personbästa</h2><div class="list">${prs}</div></div>
    <div class="card"><div class="card-head"><h2>Senaste pass</h2><a class="link" href="#/history">Visa alla</a></div><div class="list">${ws.slice(0, 3).map(workoutItem).join('')}</div></div>`;
}

function viewWorkout() {
  const a = S.active;
  if (!a) {
    const recent = sorted().slice(0, 5);
    return `<div class="top"><h1>Pass</h1></div>
      <button class="btn" data-act="start">Starta tomt pass</button>
      ${recent.length ? `<div class="card"><h2>Upprepa ett tidigare pass</h2><div class="list">${recent.map((w) => `
        <button class="item" data-act="start" data-from="${w.id}">
          <div class="main"><div><b>${esc(w.name)}</b></div><div class="muted">${fmtDate(w.start)} · ${esc(w.entries.map((e) => exName(e.exId)).join(', '))}</div></div><span class="chev">›</span>
        </button>`).join('')}</div></div>` : ''}`;
  }

  const entries = a.entries.map((e, i) => {
    const prev = lastEntry(e.exId);
    const bw = isBW(e.exId);
    const rows = e.sets.map((s, j) => {
      const p = prev ? prev.sets[Math.min(j, prev.sets.length - 1)] : null;
      return `<div class="setrow${s.done ? ' done' : ''}" data-s="${j}">
        <span class="n">${j + 1}</span>
        <input type="text" inputmode="decimal" data-f="w" value="${bw && !s.w ? '' : s.w ?? ''}" placeholder="${bw ? (p && p.w ? p.w : 'BW') : p ? p.w || 0 : ''}" aria-label="${bw ? 'Extra vikt' : 'Vikt'}">
        <input type="text" inputmode="numeric" data-f="r" value="${s.r ?? ''}" placeholder="${p ? p.r : ''}" aria-label="Reps">
        <button class="check" data-act="done" aria-label="Klart">✓</button>
        <button class="x" data-act="rm-set" aria-label="Ta bort set">×</button>
      </div>`;
    }).join('');
    return `<section class="card entry" data-i="${i}">
      <header><h3>${esc(exName(e.exId))}</h3><button class="link danger" data-act="rm-entry">Ta bort</button></header>
      <div class="prev">${prev ? 'Senast: ' + prev.sets.map((s) => setText(s, e.exId)).join(' · ') : 'Första gången du loggar övningen'}${bw ? '<br>Kroppsvikt – lämna vikten tom eller fyll i extra kg' : ''}</div>
      <div class="setrow head"><span>Set</span><span>${bw ? '+ Kg' : 'Kg'}</span><span>Reps</span><span></span><span></span></div>
      ${rows}
      <button class="link" data-act="add-set">+ Lägg till set</button>
    </section>`;
  }).join('');

  return `<div class="wk-head">
      <input class="title" type="text" data-f="name" value="${esc(a.name)}" aria-label="Passets namn">
      <div class="wk-meta"><span class="timer"><small>Passtid</small><b id="elapsed">${clock(Date.now() - a.start)}</b></span><span id="rest"></span><button class="btn small" data-act="finish">Avsluta</button></div>
    </div>
    ${entries || `<div class="card empty"><p>Lägg till din första övning för att börja logga.</p></div>`}
    <button class="btn ghost" data-act="add-ex">+ Lägg till övning</button>
    <button class="btn danger" data-act="discard">Ta bort pass</button>`;
}

function viewHistory(id) {
  if (id) {
    const w = S.workouts.find((x) => x.id === id);
    if (!w) return `<div class="top"><a class="back" href="#/history">‹</a><h1>Passet finns inte</h1></div>`;
    const st = workoutStats(w);
    return `<div class="top"><a class="back" href="#/history" aria-label="Tillbaka">‹</a><h1>${esc(w.name)}</h1></div>
      <p class="sub">${fmtDate(w.start, true)} kl. ${new Date(w.start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</p>
      <div class="tiles" style="grid-template-columns:1fr 1fr 1fr">
        <div class="card tile"><div class="label">Tid</div><div class="value" style="font-size:19px">${fmtDur(st.dur)}</div></div>
        <div class="card tile"><div class="label">Set</div><div class="value" style="font-size:19px">${st.sets}</div></div>
        <div class="card tile"><div class="label">Volym</div><div class="value" style="font-size:19px">${compact(Math.round(st.vol))} <small>kg</small></div></div>
      </div>
      ${w.entries.map((e) => `<div class="card">
        <div class="card-head"><h2><a href="#/exercise/${e.exId}">${esc(exName(e.exId))}</a></h2><a class="chev" href="#/exercise/${e.exId}">›</a></div>
        <table><tr><th>Set</th><th class="num">${isBW(e.exId) ? 'Extra kg' : 'Kg'}</th><th class="num">Reps</th></tr>
        ${e.sets.map((s, i) => `<tr><td>${i + 1}</td><td class="num">${isBW(e.exId) ? (s.w ? '+' + fmt(s.w) : 'BW') : fmt(s.w || 0)}</td><td class="num">${s.r}</td></tr>`).join('')}</table>
      </div>`).join('')}
      <button class="btn ghost" data-act="start" data-from="${w.id}">Kör passet igen</button>
      <button class="btn danger" data-act="del-workout" data-id="${w.id}">Ta bort pass</button>`;
  }

  const ws = sorted();
  if (!ws.length) return `<div class="top"><h1>Historik</h1></div><div class="card empty"><p>Dina avslutade pass hamnar här.</p></div>`;
  let out = `<div class="top"><h1>Historik</h1></div>`, month = '', open = false;
  for (const w of ws) {
    const label = new Date(w.start).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
    if (label !== month) {
      if (open) out += `</div></div>`;
      out += `<div class="group-title">${label}</div><div class="card"><div class="list">`;
      month = label;
      open = true;
    }
    out += workoutItem(w);
  }
  return out + `</div></div>`;
}

const RECENT = 'recent'; // picker tab: only exercises already logged (a search still covers everything)

function exerciseList(q, group, act) {
  const needle = q.trim().toLowerCase();
  const recent = group === RECENT;
  if (recent) group = null;
  // In the picker the most logged exercises come first, so the usual ones are one tap away
  const used = new Map();
  if (act) for (const w of S.workouts) for (const e of w.entries) used.set(e.exId, (used.get(e.exId) || 0) + 1);
  const n = (e) => used.get(e.id) || 0;
  const list = S.exercises
    .filter((e) => !e.hidden && (!group || e.group === group) && (!recent || needle || n(e)) && e.name.toLowerCase().includes(needle))
    .sort((a, b) => n(b) - n(a) || !a.name.toLowerCase().startsWith(needle) - !b.name.toLowerCase().startsWith(needle) || a.name.localeCompare(b.name, 'sv'));
  const rows = list.map((e) => {
    const inner = `<div class="main"><div>${esc(e.name)}</div><div class="muted">${esc(e.group)}${e.bw ? ' · Kroppsvikt' : ''}${n(e) ? ` · ${n(e)} pass` : ''}</div></div><span class="chev">${act ? '+' : '›'}</span>`;
    return act ? `<button class="item" data-act="pick" data-id="${e.id}">${inner}</button>` : `<a class="item" href="#/exercise/${e.id}">${inner}</a>`;
  });
  const exact = S.exercises.some((e) => !e.hidden && e.name.toLowerCase() === needle);
  if (needle && !exact) rows.push(`<button class="item" data-act="create-ex"><div class="main"><div class="link">+ Skapa ”${esc(q.trim())}”</div><div class="muted">Ny egen övning${group ? ' i ' + esc(group) : ''}</div></div></button>`);
  return rows.join('') || `<div class="empty">${recent ? 'Du har inte loggat några övningar än. Välj ”Alla” för att se hela listan.' : 'Inga övningar hittades.'}</div>`;
}

function viewExercises() {
  return `<div class="top"><h1>Övningar</h1></div>
    <input type="search" data-ui="exQ" value="${esc(ui.exQ)}" placeholder="Sök eller skapa övning">
    <div class="card"><div class="list" id="ex-list">${exerciseList(ui.exQ, null, false)}</div></div>`;
}

function viewExercise(id, after) {
  const ex = exById(id);
  if (!ex) return `<div class="top"><a class="back" href="#/exercises">‹</a><h1>Övningen finns inte</h1></div>`;
  const hist = exHistory(id);
  const head = `<div class="top"><a class="back" href="#/exercises" aria-label="Tillbaka">‹</a><h1>${esc(ex.name)}</h1></div><p class="sub">${esc(ex.group)}${ex.bw ? ' · Kroppsvikt' : ''}</p>`;
  const manage = `<div class="card"><h2>Hantera övning</h2>
      <button class="item" data-act="toggle-bw" data-id="${ex.id}"><div class="main"><div>Kroppsviktsövning</div><div class="muted">Vikten räknas som extra vikt utöver kroppsvikten</div></div><span class="side">${ex.bw ? 'På' : 'Av'}</span></button>
      <button class="btn danger" data-act="del-ex" data-id="${ex.id}">Ta bort övning</button>
    </div>`;
  if (!hist.length) return `${head}<div class="card empty"><p>Du har inte loggat den här övningen än.</p></div>${manage}`;
  const best = hist.reduce((a, b) => (b.e1 > a.e1 ? b : a));
  const heavy = Math.max(...hist.flatMap((h) => h.sets.map((s) => s.w || 0)));
  const tile = (label, value) => `<div class="card tile"><div class="label">${label}</div><div class="value" style="font-size:19px">${value}</div></div>`;
  return `${head}
    <div class="tiles" style="grid-template-columns:1fr 1fr 1fr">
      ${ex.bw
        ? tile('Flest reps', Math.max(...hist.map((h) => h.reps))) + tile('Mest extra vikt', heavy ? `+${fmt(heavy)} <small>kg</small>` : 'BW')
        : tile('Bästa 1RM', `${fmt(Math.round(best.e1 * 10) / 10)} <small>kg</small>`) + tile('Tyngsta set', `${fmt(heavy)} <small>kg</small>`)}
      ${tile('Pass', hist.length)}
    </div>
    <div class="card"><h2>Utveckling</h2>${progressChart(id, hist, after)}</div>
    <div class="card"><h2>Historik</h2><div class="list">${[...hist].reverse().map((h) => `
      <a class="item" href="#/history/${h.wid}"><div class="main"><div>${fmtDate(h.t)}</div><div class="muted">${h.sets.map((s) => setText(s, id)).join(' · ')}</div></div><span class="chev">›</span></a>`).join('')}</div></div>
    ${manage}`;
}

function viewSettings() {
  return `<div class="top"><a class="back" href="#/home" aria-label="Tillbaka">‹</a><h1>Inställningar</h1></div>
    <div class="card"><h2>Säkerhetskopia</h2>
      <p class="sub" style="margin-bottom:12px">All data sparas lokalt i den här webbläsaren. Exportera en fil då och då så att du kan återställa eller flytta till en annan telefon.</p>
      <div class="row"><button class="btn ghost" data-act="export">Exportera</button><button class="btn ghost" data-act="import">Importera</button></div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
    </div>
    <div class="card"><h2>Data</h2>
      <p class="sub">${S.workouts.length} pass · ${S.exercises.length} övningar</p>
      <button class="btn danger" data-act="wipe">Radera all data</button>
    </div>`;
}

// ---------- Exercise picker (bottom sheet) ----------

function openPicker() {
  ui.picker = { q: '', group: S.workouts.length ? RECENT : null };
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="sheet-body">
    <div class="card-head" style="margin:0"><h2>Lägg till övning</h2><button class="link" data-act="close-sheet">Stäng</button></div>
    <input type="search" data-ui="pickQ" placeholder="Sök eller skapa övning">
    <div class="chips" id="pick-chips"></div>
    <div class="list" id="pick-list"></div>
  </div>`;
  sheet.hidden = false;
  refreshPicker();
}
function refreshPicker() {
  const p = ui.picker;
  $('#pick-chips').innerHTML = `<button class="chip${p.group === RECENT ? ' on' : ''}" data-act="pick-group" data-g="${RECENT}">Senaste</button>` +
    `<button class="chip${p.group ? '' : ' on'}" data-act="pick-group" data-g="">Alla</button>` +
    GROUPS.map((g) => `<button class="chip${p.group === g ? ' on' : ''}" data-act="pick-group" data-g="${g}">${g}</button>`).join('');
  $('#pick-list').innerHTML = exerciseList(p.q, p.group, true);
}
function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheet').innerHTML = '';
}

// ---------- Router ----------

const VIEWS = { home: viewHome, workout: viewWorkout, history: viewHistory, exercises: viewExercises, exercise: viewExercise, settings: viewSettings };
const TAB_OF = { exercise: 'exercises', settings: 'home' };
let lastHash = null;

function render() {
  const [, name = 'home', arg] = location.hash.split('/');
  const view = VIEWS[name] || viewHome;
  const after = [];
  $('#view').innerHTML = view(arg, after);
  for (const fn of after) fn();
  const tab = TAB_OF[name] || (VIEWS[name] ? name : 'home');
  for (const a of document.querySelectorAll('#tabs a')) a.classList.toggle('on', a.dataset.tab === tab);
  if (location.hash !== lastHash) window.scrollTo(0, 0);
  lastHash = location.hash;
}
function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// ---------- Actions ----------

function defaultName() {
  const h = new Date().getHours();
  return h < 10 ? 'Morgonpass' : h < 14 ? 'Lunchpass' : h < 18 ? 'Eftermiddagspass' : 'Kvällspass';
}
const emptySets = (n) => Array.from({ length: n }, () => ({ w: null, r: null, done: false }));

function startWorkout(fromId) {
  if (S.active) return go('#/workout');
  const from = S.workouts.find((w) => w.id === fromId);
  S.active = {
    id: uid(),
    name: from ? from.name : defaultName(),
    start: Date.now(),
    entries: from ? from.entries.map((e) => ({ exId: e.exId, sets: emptySets(e.sets.length) })) : [],
  };
  ui.rest = 0;
  save();
  go('#/workout');
}

function finishWorkout() {
  const a = S.active;
  const entries = a.entries.map((e) => ({ exId: e.exId, sets: e.sets.filter(validSet).map((s) => ({ w: s.w || 0, r: s.r })) })).filter((e) => e.sets.length);
  if (!entries.length) return toast('Logga minst ett set med reps först');
  const w = { id: a.id, name: a.name.trim() || defaultName(), start: a.start, end: Date.now(), entries };
  S.workouts.push(w);
  S.active = null;
  ui.rest = 0;
  save();
  toast('Pass sparat');
  go('#/history/' + w.id);
}

function addExercise(id) {
  const prev = lastEntry(id);
  S.active.entries.push({ exId: id, sets: emptySets(prev ? prev.sets.length : 3) });
  save();
  closeSheet();
  render();
  window.scrollTo(0, document.body.scrollHeight);
}

function exportData() {
  const blob = new Blob([JSON.stringify({ exercises: S.exercises, workouts: S.workouts }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gymlogg-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importData(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast('Filen gick inte att läsa'); }
  if (!data || !Array.isArray(data.workouts) || !Array.isArray(data.exercises)) return toast('Fel filformat');
  if (!confirm(`Ersätta nuvarande data med ${data.workouts.length} pass från filen?`)) return;
  localStorage.setItem(KEY, JSON.stringify({ exercises: data.exercises, workouts: data.workouts, active: null }));
  S = load();
  toast('Data importerad');
  go('#/home');
}

const ACTIONS = {
  start: (el) => startWorkout(el.dataset.from),
  finish: finishWorkout,
  'toggle-bw'(el) {
    const ex = exById(el.dataset.id);
    ex.bw = !ex.bw;
    save();
    render();
  },
  'del-ex'(el) {
    if (!confirm('Ta bort övningen från listan? Pass du redan loggat påverkas inte.')) return;
    const used = [...S.workouts, ...(S.active ? [S.active] : [])].some((w) => w.entries.some((e) => e.exId === el.dataset.id));
    const ex = exById(el.dataset.id);
    // Built-in or already logged exercises are only hidden, so history keeps its names
    if (ex.custom && !used) S.exercises = S.exercises.filter((e) => e !== ex);
    else ex.hidden = true;
    save();
    toast('Övningen borttagen');
    go('#/exercises');
  },
  discard() {
    if (!confirm('Ta bort passet? Det du loggat i passet försvinner.')) return;
    S.active = null;
    ui.rest = 0;
    save();
    render();
  },
  'add-ex': openPicker,
  'close-sheet': closeSheet,
  'pick-group'(el) {
    ui.picker.group = el.dataset.g || null;
    refreshPicker();
  },
  pick: (el) => addExercise(el.dataset.id),
  'create-ex'() {
    const inPicker = !$('#sheet').hidden;
    const name = (inPicker ? ui.picker.q : ui.exQ).trim();
    if (!name) return;
    // Re-creating a removed exercise brings the old one (and its history) back
    let ex = S.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (ex) ex.hidden = false;
    else S.exercises.push(ex = { id: 'c-' + uid(), name, group: (inPicker && ui.picker.group !== RECENT && ui.picker.group) || 'Övrigt', custom: true });
    save();
    if (inPicker) return addExercise(ex.id);
    ui.exQ = '';
    go('#/exercise/' + ex.id);
  },
  'add-set'(el) {
    const e = S.active.entries[el.closest('.entry').dataset.i];
    const last = e.sets[e.sets.length - 1];
    e.sets.push({ w: last ? last.w : null, r: null, done: false });
    save();
    render();
  },
  'rm-set'(el) {
    S.active.entries[el.closest('.entry').dataset.i].sets.splice(el.closest('.setrow').dataset.s, 1);
    save();
    render();
  },
  'rm-entry'(el) {
    const i = el.closest('.entry').dataset.i;
    if (S.active.entries[i].sets.some(validSet) && !confirm('Ta bort övningen och dess set?')) return;
    S.active.entries.splice(i, 1);
    save();
    render();
  },
  done(el) {
    const e = S.active.entries[el.closest('.entry').dataset.i];
    const j = +el.closest('.setrow').dataset.s;
    const s = e.sets[j];
    if (!s.done) {
      // Tapping the check on an empty set copies last session's numbers
      const prev = lastEntry(e.exId);
      const p = prev ? prev.sets[Math.min(j, prev.sets.length - 1)] : null;
      if (s.r == null && p) { s.r = p.r; if (s.w == null) s.w = p.w || 0; }
      if (s.r == null) return toast('Fyll i reps först');
      ui.rest = Date.now();
    }
    s.done = !s.done;
    save();
    render();
  },
  metric(el) {
    ui.metric = el.dataset.v;
    render();
  },
  'del-workout'(el) {
    if (!confirm('Ta bort passet permanent?')) return;
    S.workouts = S.workouts.filter((w) => w.id !== el.dataset.id);
    save();
    go('#/history');
  },
  export: exportData,
  import: () => $('#import-file').click(),
  wipe() {
    if (!confirm('Radera alla pass och egna övningar? Detta går inte att ångra.')) return;
    localStorage.removeItem(KEY);
    S = load();
    toast('All data raderad');
    go('#/home');
  },
};

document.addEventListener('click', (ev) => {
  if (ev.target.id === 'sheet') return closeSheet();
  const el = ev.target.closest('[data-act]');
  if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el);
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.ui === 'pickQ') { ui.picker.q = el.value; return refreshPicker(); }
  if (el.dataset.ui === 'exQ') { ui.exQ = el.value; $('#ex-list').innerHTML = exerciseList(ui.exQ, null, false); return; }
  if (!el.dataset.f || !S.active) return;
  if (el.dataset.f === 'name') S.active.name = el.value;
  else {
    const set = S.active.entries[el.closest('.entry').dataset.i].sets[el.closest('.setrow').dataset.s];
    set[el.dataset.f] = el.dataset.f === 'r' ? (parseNum(el.value) == null ? null : Math.round(parseNum(el.value))) : parseNum(el.value);
  }
  saveSoon();
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.ui === 'exId') { ui.exId = el.value; render(); }
  if (el.id === 'import-file' && el.files[0]) importData(el.files[0]);
});

document.addEventListener('focusin', (ev) => {
  if (ev.target.matches('.setrow input')) ev.target.select();
});

// Workout clock and rest timer
setInterval(() => {
  const el = $('#elapsed');
  if (el && S.active) el.textContent = clock(Date.now() - S.active.start);
  const rest = $('#rest');
  if (rest) rest.textContent = ui.rest ? 'Vila ' + clock(Date.now() - ui.rest) : '';
}, 1000);

window.addEventListener('hashchange', render);
window.addEventListener('pagehide', () => { if (saveTimer) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) save(); });
let resizeTimer = 0, lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
  if (window.innerWidth === lastWidth) return; // ignore the mobile keyboard opening
  lastWidth = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (!document.activeElement.matches('input')) render(); }, 150);
});

if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js');
}

render();
