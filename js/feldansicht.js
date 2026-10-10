// ------------------------------------------------------------------
// 2D-Ansicht: Ablenkung des Elektrons im Magnetfeld
// Blick auf den Leuchtschirm (wie im Handblatt), Elektron läuft verlangsamt die Bahn entlang.
// ------------------------------------------------------------------
import katex from 'katex';
import { TUBE, E_CHARGE, E_OVER_M, REALISTIC } from './config.js';
import { beamSettings } from './state.js';
import {
  beamIntensity, helmholtzField, electronSpeed, plateField, circleRadius,
  stepParticle, fieldsAt, beamStartX,
} from './physik.js';
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
const DURATION = 3.2;                            // s, um die Breite des Ausschnitts zu durchfliegen
const MAX_CIRCLE = 300;                          // cm: größere Kreise nicht als ganze Bahn zeigen

let mode = 'roehre';       // 'roehre' oder 'kreis'
let showForces = false;    // Pfeile v, F_L, F_el (per Häkchen einblendbar)
let showCircle = true;
let charge = -1;           // Teilchen: −1 Elektron, +1 „positives Elektron“, 0 neutral (gleiche Masse)
let showTrail = true;      // Spur: tatsächlich zurückgelegter Weg des Teilchens
let playing = true;
let lastTime = null;
// Das einzelne Teilchen: Ort in m, Geschwindigkeit in m/s. Angehalten bleibt es genau hier,
// auch wenn sich die Felder ändern.
let part = null;
let hitAt = null;          // Zeitpunkt, zu dem das Teilchen auf eine Platte getroffen ist
let drag = null;           // 'pos' oder 'dir' beim Ziehen
let trail = [];            // Spur in cm: Liste von Teilstücken (neues Stück nach dem Verschieben)
const TRAIL_MAX = 6000;     // höchstens so viele Punkte, die ältesten fallen weg
let view = null;           // Abbildung cm → Pixel des letzten Bildes

// ---------------- Physik der aktuellen Einstellung
function physics() {
  const s = beamSettings();
  const v = electronSpeed(s.anode);
  const b = helmholtzField(s.coil);                     // mit Vorzeichen (+: zum Betrachter)
  const e = plateField(s.plate, s.realistic);           // mit Vorzeichen (+: Kraft nach oben)
  const onlyB = b !== 0 && s.plate === 0;
  const r = b !== 0 && charge !== 0 ? circleRadius(s.anode, b) * 100 : Infinity;   // cm
  const x0 = s.realistic ? -REALISTIC.magnetLeadIn * 100 : 0;       // Beginn des Feldes
  // flip: Ablenkung relativ zum Elektron (+1 Elektron, −1 positiv, 0 neutral)
  const flip = -charge;
  const circle = onlyB && charge !== 0;                              // Kreisbahn vorhanden?
  return { s, v, b, e, onlyB, circle, flip, r, center: { x: x0, y: Math.sign(b) * flip * r } };
}


// ---------------- Das einzelne Teilchen
function resetParticle() {
  const st = beamSettings();
  part = { x: beamStartX(st.realistic), y: 0, vx: electronSpeed(Math.max(st.anode, 1)), vy: 0 };
  hitAt = null;
  trail = [[{ x: part.x * 100, y: part.y * 100 }]];
}

const HALF_GAP_M = TUBE.plateDistance / 2;
const PLATE_X = [-0.002, TUBE.screenLength + 0.002];       // Ausdehnung der Platten in m

/** Teilchen um die Weglänge ds (in cm) weiterbewegen; trifft es eine Platte, bleibt es dort. */
function advance(ds) {
  const speed = Math.hypot(part.vx, part.vy);
  if (speed === 0) return;
  const steps = Math.max(1, Math.ceil(ds / 0.05));
  const dt = ds / 100 / speed / steps;
  const st = beamSettings();
  const qm = charge * E_OVER_M;
  for (let i = 0; i < steps; i++) {
    const prev = { x: part.x, y: part.y };
    stepParticle(part, dt, st, qm);
    addTrailPoint();
    for (const yp of [HALF_GAP_M, -HALF_GAP_M]) {
      if ((prev.y - yp) * (part.y - yp) < 0) {
        const f = (yp - prev.y) / (part.y - prev.y);
        const xHit = prev.x + f * (part.x - prev.x);
        if (xHit >= PLATE_X[0] && xHit <= PLATE_X[1]) {
          part.x = xHit;
          part.y = yp;
          trail.at(-1).pop();
          addTrailPoint();
          hitAt = performance.now();
          return;
        }
      }
    }
  }
}

function addTrailPoint() {
  const segment = trail.at(-1);
  const p = { x: part.x * 100, y: part.y * 100 };
  const last = segment.at(-1);
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.03) segment.push(p);
  let count = trail.reduce((n, seg) => n + seg.length, 0);
  while (count > TRAIL_MAX && trail.length) {
    trail[0].shift();
    count--;
    if (trail[0].length === 0 && trail.length > 1) trail.shift();
  }
}

/** Kreisbahn, auf der das Teilchen von seinem jetzigen Zustand aus weiterfliegen würde (cm) */
function particleCircle(ph) {
  if (!ph.circle || !part) return null;
  const speed = Math.hypot(part.vx, part.vy);
  const r = speed / (E_OVER_M * Math.abs(ph.b)) * 100;
  // Kraft q·v×B zeigt zum Mittelpunkt: Richtung sign(q·B)·(vy, −vx)
  const k = Math.sign(charge * ph.b) / speed;
  return { x: part.x * 100 + r * k * part.vy, y: part.y * 100 - r * k * part.vx, r };
}

// ---------------- Zeichnen
function viewRegion(ph) {
  const tube = { x0: -1.6, x1: 11, y0: -3.4, y1: 3.4 };
  if (mode !== 'kreis' || !ph.circle || ph.r > MAX_CIRCLE) return tube;
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

  if (!part) resetParticle();
  const px = X(part.x * 100), py = Y(part.y * 100);

  // Kreisbahn, auf der das Teilchen von hier aus weiterfliegt (nur bei reinem Magnetfeld)
  const circ = particleCircle(ph);
  if (showCircle && circ && circ.r <= MAX_CIRCLE) {
    const cx = X(circ.x), cy = Y(circ.y);
    ctx.setLineDash([8, 7]);
    ctx.strokeStyle = C.circle;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, s * circ.r, 0, 2 * Math.PI); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 2 * Math.PI); ctx.fill();
    ctx.font = 'italic 600 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    if (cx > -50 && cx < W + 50 && cy > -50 && cy < H + 50) ctx.fillText('M', cx + 7, cy - 4);
    const mx = (cx + px) / 2, my = (cy + py) / 2;
    if (mx > 0 && mx < W && my > 0 && my < H) ctx.fillText('r', mx + 6, my);
  }

  // Spur: tatsächlich zurückgelegter Weg des Teilchens
  if (showTrail) {
    ctx.strokeStyle = C.beam;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const segment of trail) {
      if (segment.length < 2) continue;
      ctx.beginPath();
      segment.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.x), Y(p.y)));
      ctx.stroke();
    }
  }

  // Teilchen mit Pfeilen. Angehalten: v-Pfeil mit Griff zum Drehen der Flugrichtung
  const speed = Math.hypot(part.vx, part.vy) || 1;
  const dir = { x: part.vx / speed, y: part.vy / speed };
  const unit = mode === 'kreis' ? (reg.x1 - reg.x0) * 0.09 : 1.6;     // Pfeillänge in cm
  const vTip = { x: px + s * unit * dir.x, y: py - s * unit * dir.y };
  if (showForces && charge !== 0) {
    const { ey } = fieldsAt(part.x, ph.s);
    const fl = E_CHARGE * speed * Math.abs(ph.b);
    const fel = E_CHARGE * Math.abs(ey);
    const fmax = Math.max(fl, fel) || 1;
    if (ph.b !== 0) {
      // F_L = q · v × B: senkrecht zu v, zum Kreismittelpunkt
      const k = -Math.sign(charge * ph.b) * unit * fl / fmax;
      arrow(ctx, px, py, s * -dir.y * k, -s * dir.x * k, C.fl, 'F_L');
    }
    if (ey !== 0) {
      const k = Math.sign(charge * ey) * unit * fel / fmax;           // F_el = q · E (E nur in y)
      arrow(ctx, px, py, 0, -s * k, C.fel, 'F_el', -1);
    }
  }
  if (showForces || !playing) {
    arrow(ctx, px, py, vTip.x - px, vTip.y - py, C.v, 'v');
  }
  if (!playing) {
    ctx.strokeStyle = C.v;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(vTip.x, vTip.y, 10, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  }
  const look = PARTICLES[charge];
  ctx.fillStyle = look.color;
  ctx.beginPath(); ctx.arc(px, py, 11, 0, 2 * Math.PI); ctx.fill();
  if (!playing) {
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, 14, 0, 2 * Math.PI); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(look.sign, px, py - 1);

  view = { s, ox, oy, reg, particle: { x: px, y: py }, vTip };
}

const PARTICLES = {
  [-1]: { color: '#263238', sign: '−', name: 'Elektron' },
  [1]: { color: '#c62828', sign: '+', name: 'positives Teilchen' },
  [0]: { color: '#78909c', sign: '', name: 'neutrales Teilchen' },
};

// ---------------- Werte und Erklärung
const tex = (t, display = false) => katex.renderToString(t, { displayMode: display, throwOnError: false });

function updateInfo() {
  const ph = physics();
  const s = ph.s;
  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '');
  $('fieldSettings').innerHTML = `U<sub>A</sub> = ${formatNumber(s.anode / 1000, 1)} kV · U<sub>P</sub> = ${sign(s.plate)}${formatNumber(Math.abs(s.plate) / 1000, 1)} kV · `
    + `I = ${sign(s.coil)}${formatNumber(Math.abs(s.coil), 3)} A${s.realistic ? ' · realistische Werte' : ''}`
    + ` · Teilchen: ${PARTICLES[charge].name}`;

  const rows = [];
  rows.push(['Geschwindigkeit', `v = \\sqrt{\\tfrac{2\\,e\\,U_A}{m}} = ${sci(ph.v, 3)}\\,\\mathrm{\\tfrac{m}{s}}`]);
  if (ph.b !== 0) {
    rows.push(['Magnetfeld', `B = ${num(Math.abs(ph.b) * 1000, 3)}\\,\\mathrm{mT}`]);
    if (charge !== 0) {
      const fl = E_CHARGE * ph.v * Math.abs(ph.b);
      rows.push(['Lorentzkraft', `F_L = e\\,v\\,B = ${sci(fl, 3)}\\,\\mathrm{N}`]);
      rows.push(['Bahnradius', `r = \\frac{m\\,v}{e\\,B} = ${num(ph.r, 1)}\\,\\mathrm{cm}`]);
    } else {
      rows.push(['Lorentzkraft', 'F_L = q\\,v\\,B = 0 \\quad (q = 0)']);
    }
  }
  if (ph.e !== 0) {
    const e = Math.abs(ph.e);
    rows.push(['Elektrisches Feld', `E = ${s.realistic ? '0{,}75 \\cdot ' : ''}\\frac{U_P}{d} = ${sci(e, 3)}\\,\\mathrm{\\tfrac{V}{m}}`]);
    rows.push(['Elektrische Kraft', charge !== 0 ? `F_{el} = e\\,E = ${sci(E_CHARGE * e, 3)}\\,\\mathrm{N}` : 'F_{el} = q\\,E = 0']);
    if (ph.b !== 0 && charge !== 0) rows.push(['Gerader Strahl bei', `v = \\frac{E}{B} = ${sci(e / Math.abs(ph.b), 3)}\\,\\mathrm{\\tfrac{m}{s}}`]);
  }
  $('fieldValues').innerHTML = rows.map(([label, t]) => `<tr><td>${label}</td><td>${tex(t)}</td></tr>`).join('');

  const notes = [];
  const particle = PARTICLES[charge].name;
  if (charge === 1) {
    notes.push('<p class="calc-note">Gedankenexperiment: ein Teilchen mit derselben Masse und Geschwindigkeit wie das Elektron, aber mit <strong>positiver</strong> Ladung.</p>');
  } else if (charge === 0) {
    notes.push('<p class="calc-note">Gedankenexperiment: ein <strong>ungeladenes</strong> Teilchen mit derselben Masse und Geschwindigkeit wie das Elektron.</p>');
  }
  if (charge === 0) {
    notes.push(`<p>Auf ein ungeladenes Teilchen wirken weder die Lorentzkraft noch die elektrische Kraft (beide sind proportional zur Ladung q).
      Es fliegt deshalb <strong>geradeaus</strong> – egal wie stark die Felder sind.</p>`);
  } else if (ph.b === 0) {
    notes.push('<p>Es fließt kein Spulenstrom, also gibt es kein Magnetfeld. Stelle im Bedienfeld einen Spulenstrom ein.</p>');
  } else {
    notes.push(`<p>Das Magnetfeld zeigt ${ph.b > 0 ? 'aus dem Bildschirm heraus (⊙)' : 'in den Bildschirm hinein (⊗)'}.
      Die Lorentzkraft steht immer senkrecht zur Geschwindigkeit. Sie ändert nur die Richtung der Bewegung,
      nicht den Betrag der Geschwindigkeit. Deshalb läuft das ${particle === 'Elektron' ? 'Elektron' : 'Teilchen'} auf einer <strong>Kreisbahn</strong>.</p>`);
    notes.push(`<p>Die Lorentzkraft wirkt als Zentripetalkraft:</p>${tex('e\\,v\\,B = \\frac{m\\,v^2}{r} \\quad\\Rightarrow\\quad r = \\frac{m\\,v}{e\\,B}', true)}`);
    notes.push(charge < 0
      ? `<p><strong>Richtung:</strong> Für Elektronen (negative Ladung) gilt die Drei-Finger-Regel der <strong>linken</strong> Hand:
        Daumen in Bewegungsrichtung, Zeigefinger in Richtung des Magnetfelds, der Mittelfinger zeigt die Richtung der Kraft.</p>`
      : `<p><strong>Richtung:</strong> Für positive Ladungen gilt die Drei-Finger-Regel der <strong>rechten</strong> Hand:
        Daumen in Bewegungsrichtung, Zeigefinger in Richtung des Magnetfelds, der Mittelfinger zeigt die Richtung der Kraft.
        Deshalb wird das positive Teilchen zur anderen Seite abgelenkt als das Elektron.</p>`);
    if (!ph.onlyB) notes.push('<p>Zusätzlich wirkt das elektrische Feld. Die Bahn ist dann kein Kreis mehr.</p>');
    if (ph.circle && ph.r > MAX_CIRCLE) notes.push('<p>Das Magnetfeld ist so schwach, dass der Kreis zu groß zum Zeichnen ist.</p>');
  }
  if (mode === 'kreis' && ph.circle && ph.r <= MAX_CIRCLE) {
    notes.push('<p>In der Röhre siehst du nur ein kurzes Stück dieser Kreisbahn. Außerhalb der Röhre ist sie nur gedacht.</p>');
  }
  $('fieldExplain').innerHTML = notes.join('');
  $('modeCircle').disabled = !(ph.circle && ph.r <= MAX_CIRCLE);
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
  if (!part) resetParticle();
  if (playing && beamIntensity(beamSettings()) > 0 && view) {
    if (hitAt !== null) {
      if (time - hitAt > 700) resetParticle();          // nach dem Aufprall kurz liegen lassen
    } else {
      // Breite des Ausschnitts in DURATION Sekunden: stark verlangsamt
      advance((view.reg.x1 - view.reg.x0) / DURATION * dt);
      const r = view.reg, mx = (r.x1 - r.x0) * 0.05;
      const x = part.x * 100, y = part.y * 100;
      if (x < r.x0 - mx || x > r.x1 + mx || y < r.y0 - mx || y > r.y1 + mx) resetParticle();
    }
  }
  draw();
  requestAnimationFrame(frame);
}

// ---------------- Ziehen im angehaltenen Zustand
function pointerPos(event) {
  const rect = $('fieldCanvas').getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function grabTarget(pos) {
  if (playing || !view) return null;
  if (Math.hypot(pos.x - view.vTip.x, pos.y - view.vTip.y) <= 22) return 'dir';
  if (Math.hypot(pos.x - view.particle.x, pos.y - view.particle.y) <= 24) return 'pos';
  return null;
}
function initDragging() {
  const cv = $('fieldCanvas');
  cv.addEventListener('pointerdown', event => {
    drag = grabTarget(pointerPos(event));
    if (!drag) return;
    if (drag === 'pos') trail.push([{ x: part.x * 100, y: part.y * 100 }]);
    event.preventDefault();
    cv.setPointerCapture(event.pointerId);
    hitAt = null;
  });
  cv.addEventListener('pointermove', event => {
    const pos = pointerPos(event);
    if (!drag) {
      if (event.pointerType === 'mouse') cv.style.cursor = grabTarget(pos) ? 'grab' : '';
      return;
    }
    const r = view.reg;
    const x = Math.min(r.x1, Math.max(r.x0, (pos.x - view.ox) / view.s));     // cm
    const y = Math.min(r.y1, Math.max(r.y0, (view.oy - pos.y) / view.s));
    if (drag === 'pos') {
      part.x = x / 100;
      part.y = y / 100;
      trail.at(-1).length = 0;                    // neues Spurstück beginnt an der neuen Stelle
      trail.at(-1).push({ x, y });
    } else {
      // Richtung zur Pfeilspitze, Betrag der Geschwindigkeit bleibt
      const dx = x - part.x * 100, dy = y - part.y * 100;
      const len = Math.hypot(dx, dy);
      if (len > 0.01) {
        const speed = Math.hypot(part.vx, part.vy);
        part.vx = speed * dx / len;
        part.vy = speed * dy / len;
      }
    }
    draw();
  });
  const end = () => { drag = null; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
}

function setPlaying(value) {
  playing = value;
  $('playBtn').textContent = playing ? 'Anhalten' : 'Weiter';
  $('fieldCanvas').style.touchAction = playing ? '' : 'none';   // beim Ziehen nicht scrollen
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
  for (const button of document.querySelectorAll('[data-charge]')) {
    button.addEventListener('click', () => {
      charge = Number(button.dataset.charge);
      for (const b of document.querySelectorAll('[data-charge]')) {
        b.classList.toggle('active', b === button);
        b.setAttribute('aria-pressed', String(b === button));
      }
      resetParticle();
      updateInfo();
      draw();
    });
  }
  $('modeCircle').addEventListener('click', () => setMode('kreis'));
  const syncForces = () => {
    showForces = $('showForces').checked;
    for (const item of document.querySelectorAll('.arrow-legend')) item.hidden = !showForces;
  };
  $('showForces').addEventListener('change', syncForces);
  syncForces();
  $('showCircle').addEventListener('change', e => { showCircle = e.target.checked; draw(); });
  $('showTrail').addEventListener('change', e => { showTrail = e.target.checked; draw(); });
  $('playBtn').addEventListener('click', () => setPlaying(!playing));
  $('restartBtn').addEventListener('click', () => { resetParticle(); draw(); });
  initDragging();
  setPlaying(true);
}
