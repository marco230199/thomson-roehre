// ------------------------------------------------------------------
// 2D-Ansicht: Ablenkung des Elektrons im Magnetfeld
// Blick auf den Leuchtschirm (wie im Handblatt), Elektron läuft verlangsamt die Bahn entlang.
// ------------------------------------------------------------------
import katex from 'katex';
import { TUBE, E_CHARGE, E_MASS, REALISTIC } from './config.js';
import { beamSettings } from './state.js';
import { traceBeam, beamIntensity, helmholtzField, electronSpeed, plateField, circleRadius } from './physik.js';
import { sci, num } from './auswertung.js';
import { formatNumber } from './hilfen.js';
import { registerView, currentView } from './ansichten.js';

const $ = id => document.getElementById(id);
const C = {
  v: '#2e7d32', fl: '#c62828', fel: '#ef6c00', b: '#1565c0', beam: '#0277bd',
  plate: '#8d969f', screen: '#e4f2e8', ink: '#33404d', circle: '#7b8794',
};
const SCREEN_LEN = TUBE.screenLength * 100;    // cm
const HALF_GAP = TUBE.plateDistance * 50;       // cm
const DURATION = 3.2;                            // s für einen Durchlauf des Elektrons
const MAX_CIRCLE = 300;                          // cm: größere Kreise nicht als ganze Bahn zeigen

let mode = 'roehre';       // 'roehre' oder 'kreis'
let showForces = false;    // Pfeile v, F_L, F_el (per Häkchen einblendbar)
let showCircle = true;
let playing = true;
let progress = 0;          // 0 … 1 (+ kurze Pause am Ende)
let lastTime = null;
let cache = { key: '', pts: [], lengths: [], total: 0 };

// ---------------- Physik der aktuellen Einstellung
function physics() {
  const s = beamSettings();
  const v = electronSpeed(s.anode);
  const b = helmholtzField(s.coil);                     // mit Vorzeichen (+: zum Betrachter)
  const e = plateField(s.plate, s.realistic);           // mit Vorzeichen (+: Kraft nach oben)
  const onlyB = b !== 0 && s.plate === 0;
  const r = b !== 0 ? circleRadius(s.anode, b) * 100 : Infinity;   // cm
  const x0 = s.realistic ? -REALISTIC.magnetLeadIn * 100 : 0;       // Beginn des Feldes
  return { s, v, b, e, onlyB, r, center: { x: x0, y: Math.sign(b) * r } };
}

function updateTrace() {
  const key = JSON.stringify(beamSettings());
  if (key === cache.key) return;
  const pts = traceBeam(beamSettings()).points.map(p => ({ x: p.x * 100, y: p.y * 100 }));
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  cache = { key, pts, lengths, total: lengths.at(-1) || 0 };
}

// Ort und Bewegungsrichtung bei Anteil t der Bahnlänge
function along(t) {
  const { pts, lengths, total } = cache;
  const target = Math.min(t, 1) * total;
  let i = 1;
  while (i < pts.length - 1 && lengths[i] < target) i++;
  const a = pts[i - 1], b = pts[i];
  const f = (target - lengths[i - 1]) / ((lengths[i] - lengths[i - 1]) || 1);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y), dir: { x: (b.x - a.x) / len, y: (b.y - a.y) / len } };
}

// ---------------- Zeichnen
function viewRegion(ph) {
  const tube = { x0: -1.6, x1: 11, y0: -3.4, y1: 3.4 };
  if (mode !== 'kreis' || !ph.onlyB || ph.r > MAX_CIRCLE) return tube;
  const { x, y } = ph.center;
  const pad = ph.r * 0.12;
  return {
    x0: Math.min(tube.x0, x - ph.r - pad), x1: Math.max(tube.x1, x + ph.r + pad),
    y0: Math.min(tube.y0, y - ph.r - pad), y1: Math.max(tube.y1, y + ph.r + pad),
  };
}

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(m => m * p).find(s => s >= raw) || 10 * p;
}

function arrow(ctx, x, y, dx, dy, color, label, side = 1) {
  const len = Math.hypot(dx, dy);
  if (len < 4) return;
  const ux = dx / len, uy = dy / len;
  const head = Math.min(14, len * 0.45);
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx - ux * head * 0.8, y + dy - uy * head * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - ux * head - uy * head * 0.5, y + dy - uy * head + ux * head * 0.5);
  ctx.lineTo(x + dx - ux * head + uy * head * 0.5, y + dy - uy * head - ux * head * 0.5);
  ctx.closePath();
  ctx.fill();
  if (label) {
    // Beschriftung mit Index: „F_L“ → F mit tiefgestelltem L
    const [main, sub = ''] = label.split('_');
    // side: Beschriftung rechts (+1) oder links (−1) neben der Pfeilspitze
    const lx = x + dx + ux * 10 - side * uy * 16, ly = y + dy + uy * 10 + side * ux * 16;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'italic 600 17px system-ui, sans-serif';
    const wMain = ctx.measureText(main).width;
    ctx.font = '600 12px system-ui, sans-serif';
    const wSub = ctx.measureText(sub).width;
    const left = lx - (wMain + wSub) / 2;
    ctx.font = 'italic 600 17px system-ui, sans-serif';
    ctx.fillText(main, left, ly);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(sub, left + wMain + 1, ly + 6);
  }
}

function draw() {
  const cv = $('fieldCanvas');
  const W = cv.clientWidth;
  if (W === 0) return;
  updateTrace();
  const ph = physics();
  const H = Math.round(W * (mode === 'kreis' ? 0.7 : 0.55));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.height = `${H}px`;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const reg = viewRegion(ph);
  const s = Math.min(W / (reg.x1 - reg.x0), H / (reg.y1 - reg.y0));     // Pixel pro cm
  const ox = (W - s * (reg.x1 - reg.x0)) / 2 - s * reg.x0;
  const oy = (H - s * (reg.y1 - reg.y0)) / 2 + s * reg.y1;
  const X = x => ox + s * x;
  const Y = y => oy - s * y;

  ctx.fillStyle = '#f7f9fb';
  ctx.fillRect(0, 0, W, H);

  // Leuchtschirm als Hintergrund der Röhre
  ctx.fillStyle = C.screen;
  ctx.fillRect(X(0), Y(HALF_GAP), s * SCREEN_LEN, s * 2 * HALF_GAP);

  // Magnetfeld: ⊙ (zum Betrachter) oder ⊗ (vom Betrachter weg)
  if (ph.b !== 0) {
    const step = mode === 'kreis' ? niceStep((reg.x1 - reg.x0) / 14) : 1;
    const alpha = 0.3 + 0.5 * Math.min(1, Math.abs(ph.b) / 1e-3);
    ctx.strokeStyle = ctx.fillStyle = `rgba(21, 101, 192, ${alpha})`;
    ctx.lineWidth = 1.5;
    const rad = 6;
    for (let x = Math.ceil(reg.x0 / step) * step + step / 2; x < reg.x1; x += step) {
      for (let y = Math.ceil(reg.y0 / step) * step + step / 2; y < reg.y1; y += step) {
        const px = X(x), py = Y(y);
        ctx.beginPath(); ctx.arc(px, py, rad, 0, 2 * Math.PI); ctx.stroke();
        if (ph.b > 0) {
          ctx.beginPath(); ctx.arc(px, py, 1.8, 0, 2 * Math.PI); ctx.fill();
        } else {
          const d = rad * 0.65;
          ctx.beginPath(); ctx.moveTo(px - d, py - d); ctx.lineTo(px + d, py + d);
          ctx.moveTo(px - d, py + d); ctx.lineTo(px + d, py - d); ctx.stroke();
        }
      }
    }
  }

  // Röhre: Platten, Schlitzblende
  ctx.fillStyle = C.plate;
  const plateH = Math.max(4, s * 0.15);
  ctx.fillRect(X(-0.2), Y(HALF_GAP) - plateH, s * (SCREEN_LEN + 0.4), plateH);
  ctx.fillRect(X(-0.2), Y(-HALF_GAP), s * (SCREEN_LEN + 0.4), plateH);
  ctx.fillRect(X(-0.65) - 2, Y(0.9), 4, s * 0.75);
  ctx.fillRect(X(-0.65) - 2, Y(-0.15), 4, s * 0.75);
  if (mode === 'roehre') {
    ctx.fillStyle = C.ink;
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Leuchtschirm', X(SCREEN_LEN / 2), Y(-HALF_GAP) + plateH + 4);
    ctx.textBaseline = 'bottom';
    ctx.fillText('Blende', X(-0.65), Y(-0.9) + 22);
  }
  if (ph.s.plate !== 0) {
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const top = ph.s.plate > 0 ? '+' : '−', bottom = ph.s.plate > 0 ? '−' : '+';
    ctx.fillStyle = top === '+' ? '#c62828' : '#1e5bc6';
    ctx.fillText(top, X(-0.3), Y(HALF_GAP) - plateH / 2);
    ctx.fillStyle = bottom === '+' ? '#c62828' : '#1e5bc6';
    ctx.fillText(bottom, X(-0.3), Y(-HALF_GAP) + plateH / 2);
  }

  const visible = beamIntensity(ph.s) > 0;
  if (!visible) {
    ctx.fillStyle = C.ink;
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ph.s.heater ? 'Anodenspannung zu klein: kein Strahl' : 'Heizung aus: kein Strahl', W / 2, H / 2);
    return;
  }

  // Kreisbahn mit Mittelpunkt (nur bei reinem Magnetfeld)
  if (showCircle && ph.onlyB && ph.r <= MAX_CIRCLE) {
    const cx = X(ph.center.x), cy = Y(ph.center.y);
    ctx.setLineDash([8, 7]);
    ctx.strokeStyle = C.circle;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, s * ph.r, 0, 2 * Math.PI); ctx.stroke();
    ctx.setLineDash([]);
    const e = along(progress);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(X(e.x), Y(e.y)); ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 2 * Math.PI); ctx.fill();
    ctx.font = 'italic 600 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    if (cx > -50 && cx < W + 50 && cy > -50 && cy < H + 50) ctx.fillText('M', cx + 7, cy - 4);
    const mx = (cx + X(e.x)) / 2, my = (cy + Y(e.y)) / 2;
    if (mx > 0 && mx < W && my > 0 && my < H) ctx.fillText('r', mx + 6, my);
  }

  // Bahn
  ctx.strokeStyle = C.beam;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  cache.pts.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.x), Y(p.y)));
  ctx.stroke();

  // Elektron mit Pfeilen
  const e = along(progress);
  const unit = mode === 'kreis' ? (reg.x1 - reg.x0) * 0.09 : 1.6;     // Pfeillänge in cm
  if (showForces) {
    const fl = E_CHARGE * ph.v * Math.abs(ph.b);
    const fel = E_CHARGE * Math.abs(ph.e);
    const fmax = Math.max(fl, fel) || 1;
    arrow(ctx, X(e.x), Y(e.y), s * unit * e.dir.x, -s * unit * e.dir.y, C.v, 'v');
    if (ph.b !== 0) {
      // F_L = −e · v × B: senkrecht zu v
      const k = Math.sign(ph.b) * unit * fl / fmax;
      arrow(ctx, X(e.x), Y(e.y), s * -e.dir.y * k, -s * e.dir.x * k, C.fl, 'F_L');
    }
    if (ph.e !== 0 && e.x >= 0 && e.x <= SCREEN_LEN) {
      const k = Math.sign(ph.e) * unit * fel / fmax;
      arrow(ctx, X(e.x), Y(e.y), 0, -s * k, C.fel, 'F_el', -1);
    }
  }
  ctx.fillStyle = '#263238';
  ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), 11, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('−', X(e.x), Y(e.y) - 1);
}

// ---------------- Werte und Erklärung
const tex = (t, display = false) => katex.renderToString(t, { displayMode: display, throwOnError: false });

function updateInfo() {
  const ph = physics();
  const s = ph.s;
  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '');
  $('fieldSettings').innerHTML = `U<sub>A</sub> = ${formatNumber(s.anode / 1000, 1)} kV · U<sub>P</sub> = ${sign(s.plate)}${formatNumber(Math.abs(s.plate) / 1000, 1)} kV · `
    + `I = ${sign(s.coil)}${formatNumber(Math.abs(s.coil), 3)} A${s.realistic ? ' · realistische Werte' : ''}`;

  const rows = [];
  rows.push(['Geschwindigkeit', `v = \\sqrt{\\tfrac{2\\,e\\,U_A}{m}} = ${sci(ph.v, 3)}\\,\\mathrm{\\tfrac{m}{s}}`]);
  if (ph.b !== 0) {
    const fl = E_CHARGE * ph.v * Math.abs(ph.b);
    rows.push(['Magnetfeld', `B = ${num(Math.abs(ph.b) * 1000, 3)}\\,\\mathrm{mT}`]);
    rows.push(['Lorentzkraft', `F_L = e\\,v\\,B = ${sci(fl, 3)}\\,\\mathrm{N}`]);
    rows.push(['Bahnradius', `r = \\frac{m\\,v}{e\\,B} = ${num(ph.r, 1)}\\,\\mathrm{cm}`]);
  }
  if (ph.e !== 0) {
    const e = Math.abs(ph.e);
    rows.push(['Elektrisches Feld', `E = ${s.realistic ? '0{,}75 \\cdot ' : ''}\\frac{U_P}{d} = ${sci(e, 3)}\\,\\mathrm{\\tfrac{V}{m}}`]);
    rows.push(['Elektrische Kraft', `F_{el} = e\\,E = ${sci(E_CHARGE * e, 3)}\\,\\mathrm{N}`]);
    if (ph.b !== 0) rows.push(['Gerader Strahl bei', `v = \\frac{E}{B} = ${sci(e / Math.abs(ph.b), 3)}\\,\\mathrm{\\tfrac{m}{s}}`]);
  }
  $('fieldValues').innerHTML = rows.map(([label, t]) => `<tr><td>${label}</td><td>${tex(t)}</td></tr>`).join('');

  const notes = [];
  if (ph.b === 0) {
    notes.push('<p>Es fließt kein Spulenstrom, also gibt es kein Magnetfeld. Stelle im Bedienfeld einen Spulenstrom ein.</p>');
  } else {
    notes.push(`<p>Das Magnetfeld zeigt ${ph.b > 0 ? 'aus dem Bildschirm heraus (⊙)' : 'in den Bildschirm hinein (⊗)'}.
      Die Lorentzkraft steht immer senkrecht zur Geschwindigkeit. Sie ändert nur die Richtung der Bewegung,
      nicht den Betrag der Geschwindigkeit. Deshalb läuft das Elektron auf einer <strong>Kreisbahn</strong>.</p>`);
    notes.push(`<p>Die Lorentzkraft wirkt als Zentripetalkraft:</p>${tex('e\\,v\\,B = \\frac{m\\,v^2}{r} \\quad\\Rightarrow\\quad r = \\frac{m\\,v}{e\\,B}', true)}`);
    notes.push(`<p><strong>Richtung:</strong> Für Elektronen gilt die Drei-Finger-Regel der <strong>linken</strong> Hand:
      Daumen in Bewegungsrichtung, Zeigefinger in Richtung des Magnetfelds, der Mittelfinger zeigt die Richtung der Kraft.</p>`);
    if (!ph.onlyB) notes.push('<p>Zusätzlich wirkt das elektrische Feld. Die Bahn ist dann kein Kreis mehr.</p>');
    if (ph.onlyB && ph.r > MAX_CIRCLE) notes.push('<p>Das Magnetfeld ist so schwach, dass der Kreis zu groß zum Zeichnen ist.</p>');
  }
  if (mode === 'kreis' && ph.onlyB && ph.r <= MAX_CIRCLE) {
    notes.push('<p>In der Röhre siehst du nur ein kurzes Stück dieser Kreisbahn. Außerhalb der Röhre ist sie nur gedacht.</p>');
  }
  $('fieldExplain').innerHTML = notes.join('');
  $('modeCircle').disabled = !(ph.onlyB && ph.r <= MAX_CIRCLE);
  if ($('modeCircle').disabled && mode === 'kreis') setMode('roehre');
}

function setMode(next) {
  mode = next;
  $('modeTube').classList.toggle('active', mode === 'roehre');
  $('modeCircle').classList.toggle('active', mode === 'kreis');
  updateInfo();
  draw();
}

// ---------------- Animation
function frame(time) {
  if (currentView() !== 'feld') { lastTime = null; return; }
  const dt = lastTime === null ? 0 : Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;
  if (playing) {
    progress += dt / DURATION;
    if (progress > 1.15) progress = 0;     // kurze Pause am Ende, dann von vorne
  }
  draw();
  requestAnimationFrame(frame);
}

/** Bei geänderten Einstellungen (vom Bedienfeld aufgerufen) */
export function updateFieldView() {
  if (currentView() !== 'feld') return;
  updateInfo();
}

export function initFieldView() {
  registerView('feld', {
    element: $('fieldView'),
    onOpen: () => { updateInfo(); lastTime = null; requestAnimationFrame(frame); },
  });
  $('modeTube').addEventListener('click', () => setMode('roehre'));
  $('modeCircle').addEventListener('click', () => setMode('kreis'));
  const syncForces = () => {
    showForces = $('showForces').checked;
    for (const item of document.querySelectorAll('.arrow-legend')) item.hidden = !showForces;
  };
  $('showForces').addEventListener('change', syncForces);
  syncForces();
  $('showCircle').addEventListener('change', e => { showCircle = e.target.checked; });
  $('playBtn').addEventListener('click', () => {
    playing = !playing;
    $('playBtn').textContent = playing ? 'Anhalten' : 'Weiter';
  });
}
