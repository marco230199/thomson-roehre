// Tests der Auswertung „Rechnung anzeigen“ (ohne Browser)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, checkReading, simulatedY, sci, num, LITERATURE_E_OVER_M } from '../js/auswertung.js';
import { compensationCurrent } from '../js/physik.js';

const base = { heater: true, anode: 4000, plate: 0, coil: 0, realistic: false };

test('Zahlenformat für LaTeX mit deutschem Komma', () => {
  assert.equal(num(1.234, 2), '1{,}23');
  assert.equal(sci(1.7588e11, 3), '1{,}76 \\cdot 10^{11}');
  assert.equal(sci(6.44e-4, 3), '6{,}44 \\cdot 10^{-4}');
  assert.equal(sci(9.996e3, 3), '1{,}00 \\cdot 10^{4}', 'Rundung auf 10 rückt in die nächste Potenz');
});

test('nur Magnetfeld: e/m aus dem simulierten Punkt trifft den Literaturwert', () => {
  const result = evaluate({ ...base, coil: 0.15 }, { x: 9 });
  assert.equal(result.kind, 'B');
  assert.equal(result.point.source, 'simulation');
  assert.equal(result.steps.length, 4, 'B, r, e/m, Vergleich');
  assert.ok(Math.abs(result.deviation) < 0.01, `Abweichung ${result.deviation}`);
});

test('nur Magnetfeld: mit eigener Ablesung wird mit dieser gerechnet', () => {
  const ySim = simulatedY({ ...base, coil: 0.15 }, 9);
  const result = evaluate({ ...base, coil: 0.15 }, { x: 9, yRead: ySim + 0.1 });
  assert.equal(result.point.source, 'ablesung');
  assert.ok(result.emRatio > LITERATURE_E_OVER_M, 'größeres y → kleinerer Radius → größeres e/m');
});

test('realistische Werte: e/m aus dem Magnetfeld fällt zu groß aus (wie im echten Versuch)', () => {
  const result = evaluate({ ...base, coil: 0.15, realistic: true }, { x: 9 });
  assert.ok(result.deviation > 0.05, `Abweichung ${result.deviation}`);
});

test('nur elektrisches Feld: y_theo nach Gl. 1, Hinweis dass e/m nicht bestimmbar ist', () => {
  const result = evaluate({ ...base, plate: 2000 }, { x: 9 });
  assert.equal(result.kind, 'E');
  assert.match(result.steps[1].tex, /= 1\{,\}84\\,\\mathrm\{cm\}/, 'y_theo = 1,84 cm');
  assert.match(result.note, /nicht bestimmen/);
  const real = evaluate({ ...base, plate: 2000, realistic: true }, { x: 9 });
  assert.match(real.steps[2].tex, /= 1\{,\}38\\,\\mathrm\{cm\}/, 'mit Faktor 0,75: 1,38 cm');
});

test('beide Felder: Kompensation liefert e/m, schiefer Strahl einen Hinweis', () => {
  const coil = -compensationCurrent(4000, 2000);
  const result = evaluate({ ...base, plate: 2000, coil }, { x: 9 });
  assert.equal(result.kind, 'EB');
  assert.ok(Math.abs(result.deviation) < 0.01, `Abweichung ${result.deviation}`);
  const crooked = evaluate({ ...base, plate: 2000, coil: 0.1 }, { x: 9 });
  assert.equal(crooked.kind, 'EB-schief');
  assert.equal(crooked.steps.length, 0);
});

test('ohne Feld: nur ein Hinweis', () => {
  const result = evaluate(base, { x: 9 });
  assert.equal(result.kind, 'none');
  assert.ok(result.note.length > 0);
});

test('Ablesung prüfen', () => {
  assert.equal(checkReading(1.4, 1.38), 'richtig');
  assert.equal(checkReading(1.6, 1.38), 'falsch');
  assert.equal(checkReading(1.4, -1.38), 'vorzeichen');
  assert.equal(checkReading(1.4, NaN), 'kein-strahl');
});
