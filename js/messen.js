// ------------------------------------------------------------------
// Messansicht: großer Leuchtschirm, Wertetabelle mit Kontrolle,
// Auswertung „Rechnung anzeigen“
// ------------------------------------------------------------------
import katex from 'katex';
import { TUBE } from './config.js';
import { state, beamSettings } from './state.js';
import { traceBeam, beamIntensity } from './physik.js';
import { evaluate, checkReading, simulatedY } from './auswertung.js';
import { formatNumber } from './hilfen.js';
import { registerView, currentView } from './ansichten.js';

const $ = id => document.getElementById(id);
const X_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SCREEN_LEN = TUBE.screenLength * 100;   // cm
const HALF_GAP = TUBE.plateDistance * 50;      // cm

const readings = new Map();   // x (cm) → abgelesenes y (cm)
let seriesKey = null;         // Einstellungen, zu denen die Messreihe gehört
let seriesText = '';
let checked = false;
let calcShown = false;

// ---------------- Hilfen
const settingsKey = () => JSON.stringify(beamSettings());
function settingsText() {
  const s = beamSettings();
  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '');
  return `U<sub>A</sub> = ${formatNumber(s.anode / 1000, 1)} kV · U<sub>P</sub> = ${sign(s.plate)}${formatNumber(Math.abs(s.plate) / 1000, 1)} kV · `
    + `I = ${sign(s.coil)}${formatNumber(Math.abs(s.coil), 3)} A${s.realistic ? ' · realistische Werte' : ''}`;
}
function parseNumber(text) {
  const t = text.trim().replace(',', '.').replace('−', '-');
  if (t === '' || t === '-' ) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
}
const cm = v => `${formatNumber(v, 2)} cm`;

// ---------------- Leuchtschirm groß zeichnen
const canvas = () => $('screenCanvas');
const M = { left: 46, right: 16, top: 16, bottom: 40 };

function drawScreen() {
  const cv = canvas();
  const width = cv.clientWidth;
  if (width === 0) return;
  const ppc = (width - M.left - M.right) / SCREEN_LEN;            // Pixel pro cm
  const height = Math.round(2 * HALF_GAP * ppc + M.top + M.bottom);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.height = `${height}px`;
  cv.width = Math.round(width * dpr);
  cv.height = Math.round(height * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const X = x => M.left + x * ppc;
  const Y = y => M.top + (HALF_GAP - y) * ppc;

  ctx.clearRect(0, 0, width, height);
  // Schirm
  ctx.fillStyle = '#25322e';
  ctx.fillRect(X(0), Y(HALF_GAP), SCREEN_LEN * ppc, 2 * HALF_GAP * ppc);
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  // Millimeter
  ctx.strokeStyle = 'rgba(200, 225, 212, 0.13)';
  ctx.lineWidth = 1;
  for (let i = 1; i < SCREEN_LEN * 10; i++) if (i % 10) line(X(i / 10), Y(HALF_GAP), X(i / 10), Y(-HALF_GAP));
  for (let i = -27; i <= 27; i++) if (i % 10) line(X(0), Y(i / 10), X(SCREEN_LEN), Y(i / 10));
  // halbe Zentimeter
  ctx.strokeStyle = 'rgba(205, 228, 216, 0.28)';
  for (let x = 0.5; x < SCREEN_LEN; x += 1) line(X(x), Y(HALF_GAP), X(x), Y(-HALF_GAP));
  for (const y of [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5]) line(X(0), Y(y), X(SCREEN_LEN), Y(y));
  // Zentimeter
  ctx.strokeStyle = 'rgba(220, 236, 228, 0.6)';
  ctx.lineWidth = 1.5;
  for (let x = 1; x < SCREEN_LEN; x++) line(X(x), Y(HALF_GAP), X(x), Y(-HALF_GAP));
  for (let y = -2; y <= 2; y++) {
    ctx.lineWidth = y === 0 ? 2.5 : 1.5;
    line(X(0), Y(y), X(SCREEN_LEN), Y(y));
  }
  // Platten oben und unten
  ctx.fillStyle = '#9aa3ad';
  ctx.fillRect(X(-0.2), Y(HALF_GAP) - 6, (SCREEN_LEN + 0.4) * ppc, 6);
  ctx.fillRect(X(-0.2), Y(-HALF_GAP), (SCREEN_LEN + 0.4) * ppc, 6);
  // Achsenbeschriftung
  ctx.fillStyle = '#33404d';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = 0; x <= SCREEN_LEN; x++) ctx.fillText(String(x), X(x), Y(-HALF_GAP) + 10);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = -2; y <= 2; y++) ctx.fillText(String(y).replace('-', '−'), X(0) - 8, Y(y));
  ctx.textAlign = 'left';
  ctx.fillText('x / cm', X(SCREEN_LEN) - 38, Y(-HALF_GAP) + 30);
  ctx.save();
  ctx.translate(14, Y(0));
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('y / cm', 0, 0);
  ctx.restore();

  // Strahl
  const settings = beamSettings();
  const intensity = beamIntensity(settings);
  if (intensity > 0) {
    const pts = traceBeam(settings).points.filter(p => p.x >= 0);
    const path = () => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.x * 100), Y(p.y * 100)));
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(0), Y(HALF_GAP), SCREEN_LEN * ppc, 2 * HALF_GAP * ppc);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    path();
    ctx.strokeStyle = `rgba(54, 200, 255, ${0.35 * intensity})`;
    ctx.lineWidth = 9;
    ctx.stroke();
    path();
    ctx.strokeStyle = `rgba(200, 248, 255, ${0.5 + 0.5 * intensity})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // eingetragene Messwerte
  for (const [x, y] of readings) {
    const result = checked ? checkReading(y, simulatedY(settings, x)) : null;
    ctx.fillStyle = result === 'richtig' ? '#43d17a' : result ? '#ff6b5b' : '#ffd54f';
    ctx.strokeStyle = '#1d2733';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(X(x), Y(y), 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }
}

// ---------------- Wertetabelle
function buildTable() {
  const body = $('valueRows');
  for (const x of X_VALUES) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${formatNumber(x, 1)}</td>
      <td><input type="text" inputmode="decimal" autocomplete="off" aria-label="y bei x = ${x} cm" data-x="${x}" /></td>
      <td class="check-cell" data-x="${x}"></td>`;
    body.appendChild(row);
  }
  body.addEventListener('input', event => {
    const input = event.target;
    const x = Number(input.dataset.x);
    const value = parseNumber(input.value);
    input.classList.toggle('invalid', Number.isNaN(value));
    if (value === null || Number.isNaN(value)) readings.delete(x);
    else readings.set(x, value);
    if (readings.size > 0 && seriesKey === null) {
      seriesKey = settingsKey();
      seriesText = settingsText();
    }
    if (readings.size === 0) seriesKey = null;
    checked = false;
    updateMeasure();
  });
}

function updateTable() {
  const settings = beamSettings();
  for (const cell of document.querySelectorAll('.check-cell')) {
    const x = Number(cell.dataset.x);
    cell.className = 'check-cell';
    cell.textContent = '';
    if (!checked || !readings.has(x)) continue;
    const ySim = simulatedY(settings, x);
    const result = checkReading(readings.get(x), ySim);
    cell.classList.add(result);
    cell.textContent = {
      richtig: `✓ (${cm(ySim)})`,
      falsch: `✗ Simulation: ${cm(ySim)}`,
      vorzeichen: `Vorzeichen? (${cm(ySim)})`,
      'kein-strahl': 'Strahl erreicht x nicht',
    }[result];
  }
  const status = $('tableStatus');
  const changed = seriesKey !== null && seriesKey !== settingsKey();
  status.classList.toggle('warn', changed);
  if (changed) {
    status.innerHTML = `Achtung: Die Einstellungen wurden geändert. Deine Werte gehören zu ${seriesText}. `
      + 'Stelle die alten Werte wieder ein oder beginne eine neue Messreihe.';
  } else if (seriesKey !== null) {
    status.innerHTML = `Messreihe bei ${seriesText}`;
  } else {
    status.textContent = 'Lies am Leuchtschirm für jedes x den Wert y ab (nach oben positiv, nach unten negativ) und trage ihn ein.';
  }
}

// ---------------- Auswertung
function updateCalc() {
  const button = $('calcBtn');
  button.textContent = calcShown ? 'Rechnung ausblenden' : 'Rechnung anzeigen';
  button.setAttribute('aria-expanded', String(calcShown));
  const out = $('calcOut');
  out.hidden = !calcShown;
  if (!calcShown) return;

  const settings = beamSettings();
  if (beamIntensity(settings) === 0) {
    out.innerHTML = '<p class="calc-note">Es ist kein Strahl zu sehen. Schalte die Heizung ein und stelle mindestens 1 kV Anodenspannung ein.</p>';
    return;
  }
  const x = Number($('calcX').value);
  const result = evaluate(settings, { x, yRead: readings.has(x) ? readings.get(x) : null });
  const parts = [];
  if (result.point && result.kind !== 'EB' && result.kind !== 'EB-schief') {
    const p = result.point;
    parts.push(Number.isFinite(p.y)
      ? `<p class="calc-source">${p.source === 'ablesung'
        ? `Gerechnet mit deiner Ablesung bei x = ${formatNumber(x, 1)} cm: y = ${cm(p.y)}.`
        : `Für x = ${formatNumber(x, 1)} cm hast du noch keinen Wert eingetragen. Gerechnet wird mit dem Wert aus der Simulation: y = ${cm(p.y)}.`}</p>`
      : `<p class="calc-source">Bei x = ${formatNumber(x, 1)} cm ist kein Strahl mehr – wähle ein kleineres x.</p>`);
  }
  for (const step of result.steps) {
    parts.push(`<div class="calc-step"><h4>${step.title}</h4>${katex.renderToString(step.tex, { displayMode: true, throwOnError: false })}</div>`);
  }
  if (result.note) parts.push(`<p class="calc-note">${result.note}</p>`);
  out.innerHTML = parts.join('');
}

// ---------------- öffnen, schließen, aktualisieren
export function updateMeasure() {
  if (currentView() !== 'messen') return;
  $('measureSettings').innerHTML = settingsText();
  drawScreen();
  updateTable();
  updateCalc();
}

export function initMeasure() {
  buildTable();
  const select = $('calcX');
  for (let x = 1; x <= SCREEN_LEN; x++) {
    const option = new Option(`${formatNumber(x, 1)} cm`, String(x), x === 9, x === 9);
    select.add(option);
  }
  select.addEventListener('change', updateMeasure);
  registerView('messen', { element: $('measure'), onOpen: updateMeasure });
  $('checkBtn').addEventListener('click', () => { checked = true; updateMeasure(); });
  $('clearBtn').addEventListener('click', () => {
    readings.clear();
    seriesKey = null;
    checked = false;
    for (const input of document.querySelectorAll('#valueRows input')) { input.value = ''; input.classList.remove('invalid'); }
    updateMeasure();
  });
  $('calcBtn').addEventListener('click', () => { calcShown = !calcShown; updateMeasure(); });
  window.addEventListener('resize', () => { if (currentView() === 'messen') drawScreen(); });
}
