// ------------------------------------------------------------------
// 2D-Simulation: geladene Teilchen im Magnetfeld
// Entkoppelt vom Experiment (Gedankenexperiment, auch positive und neutrale Teilchen).
// Eigenes Steuerfeld: Magnetfeld B per Regler, Geschwindigkeit per ziehbarem v-Pfeil.
// Beim Öffnen werden v (aus U_A) und B (aus dem Spulenstrom) einmalig aus dem Experiment übernommen.
// Die Röhre bleibt als Hintergrund; das Magnetfeld ist überall homogen, es gibt kein E-Feld.
// ------------------------------------------------------------------
import katex from 'katex';
import { TUBE, E_CHARGE, E_OVER_M } from './config.js';
import { beamSettings } from './state.js';
import { helmholtzField, electronSpeed, stepParticle, beamStartX } from './physik.js';
import { sci, num } from './auswertung.js';
import { formatNumber } from './hilfen.js';
import { registerView, currentView } from './ansichten.js';

const $ = id => document.getElementById(id);
const C = {
  v: '#2e7d32', fl: '#c62828', beam: '#0277bd',
  plate: '#8d969f', screen: '#e4f2e8', ink: '#33404d', circle: '#7b8794',
};
const SCREEN_LEN = TUBE.screenLength * 100;    // cm
const HALF_GAP = TUBE.plateDistance * 50;       // cm
const DURATION = 3.2;                            // s, um bei V_REF die Breite des Ausschnitts zu durchfliegen
const MAX_CIRCLE = 300;                          // cm: größere Kreise nicht als ganze Bahn zeigen
const START_X = beamStartX(false);               // Startpunkt hinter der Blende, in m

// Regler und Grenzen der 2D-Simulation
const B_RANGE = { min: 0, max: 5e-3, step: 0.05e-3 };   // Magnetfeld in T
const V_REF = electronSpeed(4000);                       // Bezugsgeschwindigkeit (Pfeillänge = 1 Einheit)
const V_RANGE = { min: 0.5e7, max: 8e7 };                // Geschwindigkeit in m/s

let fieldMag = 0;          // Betrag des Magnetfelds in T
let fieldDir = 1;          // +1: aus dem Bildschirm heraus (⊙), −1: hinein (⊗)
const simBField = () => fieldDir * fieldMag;   // Magnetfeld mit Vorzeichen
let startSpeed = V_REF;    // Betrag der Geschwindigkeit beim Neustart
let charge = -1;           // Teilchen: −1 Elektron, +1 „positives Elektron“, 0 neutral (gleiche Masse)
let mode = 'roehre';       // 'roehre' oder 'kreis'
let showForces = false;    // Pfeile v, F_L (per Häkchen einblendbar)
let showCircle = true;
let showTrail = true;      // Spur: tatsächlich zurückgelegter Weg des Teilchens
let playing = true;
let lastTime = null;
// Das einzelne Teilchen: Ort in m, Geschwindigkeit in m/s. Angehalten bleibt es genau hier,
// auch wenn sich das Magnetfeld ändert.
let part = null;
let hitAt = null;          // Zeitpunkt, zu dem das Teilchen auf eine Platte getroffen ist
let drag = null;           // 'pos' oder 'dir' beim Ziehen
let trail = [];            // Spur in cm: Liste von Teilstücken (neues Stück nach dem Verschieben)
const TRAIL_MAX = 6000;     // höchstens so viele Punkte, die ältesten fallen weg
let view = null;           // Abbildung cm → Pixel des letzten Bildes

const clamp = (v, r) => Math.min(r.max, Math.max(r.min, v));
const simSettings = () => ({ uniformB: simBField() });

// ---------------- Physik der aktuellen Einstellung
function physics() {
  const speed = part ? Math.hypot(part.vx, part.vy) : startSpeed;
  const b = simBField();
  const circle = b !== 0 && charge !== 0;                            // Kreisbahn vorhanden?
  const r = circle ? speed / (E_OVER_M * Math.abs(b)) * 100 : Infinity;   // cm
  // Kreis durch den Startpunkt (für den Ausschnitt „ganze Kreisbahn“)
  const center = { x: START_X * 100, y: Math.sign(b) * -charge * r };
  return { b, speed, circle, r, center };
}

// ---------------- Das einzelne Teilchen
function resetParticle() {
  part = { x: START_X, y: 0, vx: startSpeed, vy: 0 };
  hitAt = null;
  trail = [[{ x: part.x * 100, y: part.y * 100 }]];
}

const HALF_GAP_M = TUBE.plateDistance / 2;
const PLATE_X = [-0.002, TUBE.screenLength + 0.002];       // Ausdehnung der Platten in m

/** Teilchen um die Weglänge ds (in cm) weiterbewegen; trifft es eine Platte, bleibt es dort. */
function advance(ds) {
  const speed = Math.hypot(part.vx, part.vy);
  if (speed === 0 || ds <= 0) return;
  const steps = Math.max(1, Math.ceil(ds / 0.05));
  const dt = ds / 100 / speed / steps;
  const qm = charge * E_OVER_M;
  for (let i = 0; i < steps; i++) {
    const prev = { x: part.x, y: part.y };
    stepParticle(part, dt, simSettings(), qm);
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
  if (!part) resetParticle();
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

  // Magnetfeld: ⊙ (aus dem Bildschirm heraus) oder ⊗ (hinein)
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

  const px = X(part.x * 100), py = Y(part.y * 100);

  // Kreisbahn, auf der das Teilchen von hier aus weiterfliegt
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

  // Teilchen mit Pfeilen. Angehalten: v-Pfeil mit Griff (Länge = Betrag, Richtung = Flugrichtung)
  const speed = Math.hypot(part.vx, part.vy) || 1;
  const dir = { x: part.vx / speed, y: part.vy / speed };
  const unit = mode === 'kreis' ? (reg.x1 - reg.x0) * 0.09 : 1.6;     // Pfeillänge in cm bei V_REF
  const vLen = unit * speed / V_REF;
  const vTip = { x: px + s * vLen * dir.x, y: py - s * vLen * dir.y };
  if (showForces && charge !== 0 && ph.b !== 0) {
    // F_L = q · v × B: senkrecht zu v, zum Kreismittelpunkt
    const k = -Math.sign(charge * ph.b) * unit;
    arrow(ctx, px, py, s * -dir.y * k, -s * dir.x * k, C.fl, 'F_L');
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

  view = { s, ox, oy, reg, unit, particle: { x: px, y: py }, vTip };
}

const PARTICLES = {
  [-1]: { color: '#263238', sign: '−', name: 'Elektron' },
  [1]: { color: '#c62828', sign: '+', name: 'positives Teilchen' },
  [0]: { color: '#78909c', sign: '', name: 'neutrales Teilchen' },
};

// ---------------- Werte, Erklärung und Steuerfeld
const tex = (t, display = false) => katex.renderToString(t, { displayMode: display, throwOnError: false });

function updateInfo() {
  const ph = physics();
  const bText = ph.b === 0 ? 'kein Magnetfeld' : `B = ${formatNumber(Math.abs(ph.b) * 1000, 2)} mT ${ph.b > 0 ? '⊙' : '⊗'}`;

  // Steuerfeld
  $('simBSlider').value = fieldMag;
  $('simBOut').textContent = `${formatNumber(fieldMag * 1000, 2)} mT`;
  $('simBStatus').textContent = fieldDir > 0
    ? 'Magnetfeld zeigt aus dem Bildschirm heraus (⊙).'
    : 'Magnetfeld zeigt in den Bildschirm hinein (⊗).';
  $('simVOut').innerHTML = tex(`v = ${sci(ph.speed, 3)}\\,\\mathrm{\\tfrac{m}{s}}`);

  $('fieldSettings').innerHTML = `${bText} · v = ${tex(`${sci(ph.speed, 3)}\\,\\mathrm{\\tfrac{m}{s}}`)} · Teilchen: ${PARTICLES[charge].name}`;

  const rows = [];
  rows.push(['Geschwindigkeit', `v = ${sci(ph.speed, 3)}\\,\\mathrm{\\tfrac{m}{s}}`]);
  rows.push(['Magnetfeld', `B = ${num(Math.abs(ph.b) * 1000, 2)}\\,\\mathrm{mT}`]);
  if (ph.b !== 0) {
    if (charge !== 0) {
      const fl = E_CHARGE * ph.speed * Math.abs(ph.b);
      rows.push(['Lorentzkraft', `F_L = e\\,v\\,B = ${sci(fl, 3)}\\,\\mathrm{N}`]);
      rows.push(['Bahnradius', `r = \\frac{m\\,v}{e\\,B} = ${num(ph.r, 1)}\\,\\mathrm{cm}`]);
    } else {
      rows.push(['Lorentzkraft', 'F_L = q\\,v\\,B = 0 \\quad (q = 0)']);
    }
  }
  $('fieldValues').innerHTML = rows.map(([label, t]) => `<tr><td>${label}</td><td>${tex(t)}</td></tr>`).join('');

  const notes = [];
  const particle = PARTICLES[charge].name;
  if (charge === 1) {
    notes.push('<p class="calc-note">Gedankenexperiment: ein Teilchen mit derselben Masse wie das Elektron, aber mit <strong>positiver</strong> Ladung.</p>');
  } else if (charge === 0) {
    notes.push('<p class="calc-note">Gedankenexperiment: ein <strong>ungeladenes</strong> Teilchen mit derselben Masse wie das Elektron.</p>');
  }
  if (charge === 0) {
    notes.push(`<p>Auf ein ungeladenes Teilchen wirkt keine Lorentzkraft (sie ist proportional zur Ladung q).
      Es fliegt deshalb <strong>geradeaus</strong> – egal wie stark das Magnetfeld ist.</p>`);
  } else if (ph.b === 0) {
    notes.push('<p>Das Magnetfeld ist ausgeschaltet. Stelle im Steuerfeld ein Magnetfeld ein.</p>');
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

function setField(value) {
  fieldMag = clamp(value, B_RANGE);
  updateInfo();
}

// ---------------- Animation
function frame(time) {
  if (currentView() !== 'feld') { lastTime = null; return; }
  const dt = lastTime === null ? 0 : Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;
  if (!part) resetParticle();
  if (playing && view) {
    if (hitAt !== null) {
      if (time - hitAt > 700) resetParticle();          // nach dem Aufprall kurz liegen lassen
    } else {
      // stark verlangsamt: bei V_REF die Breite des Ausschnitts in DURATION Sekunden
      const speed = Math.hypot(part.vx, part.vy);
      advance((view.reg.x1 - view.reg.x0) / DURATION * (speed / V_REF) * dt);
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
      // Pfeil zur Fingerposition: Richtung = Flugrichtung, Länge = Betrag der Geschwindigkeit
      const dx = x - part.x * 100, dy = y - part.y * 100;
      const len = Math.hypot(dx, dy);
      if (len > 0.01) {
        const speed = clamp(len / view.unit * V_REF, V_RANGE);
        part.vx = speed * dx / len;
        part.vy = speed * dy / len;
        startSpeed = speed;
        updateInfo();
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
  const button = $('playBtn');
  button.textContent = playing ? 'Anhalten' : 'Weiter';
  button.classList.toggle('on', playing);
  $('fieldCanvas').style.touchAction = playing ? '' : 'none';   // beim Ziehen nicht scrollen
}

/** Beim Öffnen: v und B einmalig aus dem Experiment übernehmen, danach unabhängig */
function takeOverFromExperiment() {
  const s = beamSettings();
  startSpeed = s.anode >= 500 ? clamp(electronSpeed(s.anode), V_RANGE) : V_REF;
  const b = helmholtzField(s.coil);
  fieldMag = clamp(Math.abs(b), B_RANGE);
  fieldDir = b < 0 ? -1 : 1;
  resetParticle();
}

export function initFieldView() {
  registerView('feld', {
    element: $('fieldView'),
    panel: $('simPanel'),
    onOpen: () => { takeOverFromExperiment(); updateInfo(); lastTime = null; requestAnimationFrame(frame); },
  });

  // Teilchen
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

  // Magnetfeld: Regler, −/+, Richtung
  const slider = $('simBSlider');
  Object.assign(slider, { min: B_RANGE.min, max: B_RANGE.max, step: B_RANGE.step });
  slider.addEventListener('input', () => setField(Number(slider.value)));
  for (const button of document.querySelectorAll('[data-sim-step]')) {
    const step = () => setField(Math.round(fieldMag / B_RANGE.step + Number(button.dataset.simStep)) * B_RANGE.step);
    let timer = null;
    const stop = () => { clearTimeout(timer); clearInterval(timer); timer = null; };
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      step();
      timer = setTimeout(() => { timer = setInterval(step, 70); }, 400);
    });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, stop);
    button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') step(); });
  }
  $('simBDirBtn').addEventListener('click', () => { fieldDir = -fieldDir; updateInfo(); });

  // Bewegung und Darstellung
  $('modeTube').addEventListener('click', () => setMode('roehre'));
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
