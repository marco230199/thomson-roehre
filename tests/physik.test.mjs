// Tests der Physik (ohne Browser): npm test  bzw.  node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { E_OVER_M, TUBE } from '../js/config.js';
import {
  electronSpeed, helmholtzField, circleRadius, parabolaY, circleY, compensationCurrent,
  specificCharge, radiusFromPoint, beamIntensity, traceBeam, beamYAt,
} from '../js/physik.js';

const cm = 0.01;
const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: ${actual} statt ${expected} (± ${tol})`);
const yAt = (settings, xCm) => beamYAt(traceBeam(settings), xCm * cm) / cm;   // Ergebnis in cm

test('Konstanten und Helmholtz-Feld wie im Handblatt', () => {
  near(E_OVER_M, 1.7588e11, 0.0001e11, 'e/m');
  // Tabelle auf S. 3: I = 0,10 / 0,15 / 0,26 A → B = 0,429 / 0,644 / 1,12 mT
  near(helmholtzField(0.10) * 1e3, 0.429, 0.002, 'B bei 0,10 A');
  near(helmholtzField(0.15) * 1e3, 0.644, 0.002, 'B bei 0,15 A');
  near(helmholtzField(0.26) * 1e3, 1.12, 0.01, 'B bei 0,26 A');
  near(electronSpeed(4000), 3.75e7, 0.01e7, 'v bei 4 kV');
});

test('ohne Felder fliegt der Strahl geradeaus bis zum Schirmende', () => {
  const trace = traceBeam({ anode: 4000, plate: 0, coil: 0 });
  assert.equal(trace.end, 'screen');
  const last = trace.points.at(-1);
  near(last.x, TUBE.screenLength, 1e-9, 'Ende bei x = 10 cm');
  near(last.y, 0, 1e-12, 'keine Ablenkung');
});

test('elektrisches Feld: Bahn ist die Parabel aus Gl. (1), Richtung nach Polung', () => {
  for (const [anode, plate] of [[4000, 2000], [3000, 1500], [5000, 4000], [2000, -1000]]) {
    for (const x of [3, 6, 9]) {
      const expected = parabolaY(x * cm, anode, plate) / cm;
      const yNum = yAt({ anode, plate, coil: 0 }, x);
      if (Number.isNaN(yNum)) continue;   // Strahl schon an der Platte
      near(yNum, expected, 0.002, `U_A=${anode} V, U_P=${plate} V, x=${x} cm`);
    }
  }
  assert.ok(yAt({ anode: 4000, plate: 2000, coil: 0 }, 9) > 0, 'obere Platte positiv → nach oben');
  assert.ok(yAt({ anode: 4000, plate: -2000, coil: 0 }, 9) < 0, 'obere Platte negativ → nach unten');
});

test('Magnetfeld: Bahn ist der Kreis aus Gl. (3), Richtung nach Stromrichtung', () => {
  for (const [anode, coil] of [[4000, 0.10], [4000, 0.26], [2500, 0.2], [5000, -0.3]]) {
    for (const x of [3, 6, 9]) {
      near(yAt({ anode, plate: 0, coil }, x), circleY(x * cm, anode, coil) / cm, 0.002,
        `U_A=${anode} V, I=${coil} A, x=${x} cm`);
    }
  }
  assert.ok(yAt({ anode: 4000, plate: 0, coil: 0.2 }, 9) > 0, 'I > 0 → nach oben');
  assert.ok(yAt({ anode: 4000, plate: 0, coil: -0.2 }, 9) < 0, 'I < 0 → nach unten');
});

test('realistische Werte: E-Feld trifft die y_theo-Tabelle des Handblatts (Faktor 0,75)', () => {
  // S. 3: U_A = 4 kV; (U_P, x) → y_theo
  for (const [plate, x, yTheo] of [[2000, 9, 1.4], [3000, 9, 2.1], [5000, 8, 2.7]]) {
    near(yAt({ anode: 4000, plate, coil: 0, realistic: true }, x), yTheo, 0.05, `U_P=${plate} V, x=${x} cm`);
  }
  // ideale Theorie lenkt stärker ab
  assert.ok(yAt({ anode: 4000, plate: 2000, coil: 0 }, 9) > 1.7);
});

test('realistische Werte: Magnetfeld liegt näher an den Messwerten als die ideale Theorie', () => {
  // S. 3: U_A = 4 kV, x = 9 cm; I → y gemessen
  for (const [coil, yMeas] of [[0.10, 0.9], [0.15, 1.4], [0.26, 2.4]]) {
    const ideal = yAt({ anode: 4000, plate: 0, coil }, 9);
    const real = yAt({ anode: 4000, plate: 0, coil, realistic: true }, 9);
    near(real, yMeas, 0.35, `I=${coil} A`);
    assert.ok(real > ideal, `Vorlauf des Feldes vergrößert die Ablenkung (I=${coil} A)`);
  }
});

test('Strahl endet an der Platte, wenn die Ablenkung zu groß wird', () => {
  const trace = traceBeam({ anode: 1000, plate: 5000, coil: 0 });
  assert.equal(trace.end, 'plate');
  near(trace.points.at(-1).y, TUBE.plateDistance / 2, 1e-9, 'endet an der oberen Platte');
  assert.ok(trace.points.at(-1).x < TUBE.screenLength);
});

test('starkes Magnetfeld (bis 1 A): Strahl krümmt sich und trifft eine Platte', () => {
  for (const [anode, coil, top] of [[1000, 1, true], [5000, 1, true], [4000, -0.5, false]]) {
    const trace = traceBeam({ anode, plate: 0, coil });
    assert.equal(trace.end, 'plate', `U_A=${anode} V, I=${coil} A`);
    near(trace.points.at(-1).y, (top ? 1 : -1) * TUBE.plateDistance / 2, 1e-9, 'endet an der richtigen Platte');
  }
});

test('gekreuzte Felder: beim Kompensationsstrom fliegt der Strahl geradeaus (v = E/B)', () => {
  const anode = 4000, plate = 2000;
  const coil = -compensationCurrent(anode, plate);   // Magnetfeld lenkt entgegengesetzt ab
  near(yAt({ anode, plate, coil }, 10), 0, 0.001, 'ideal: keine Ablenkung');
  near(Math.abs(coil), 0.226, 0.003, 'Kompensationsstrom bei 4 kV / 2 kV');
  const coilReal = -compensationCurrent(anode, plate, true);
  assert.ok(Math.abs(yAt({ anode, plate, coil: coilReal, realistic: true }, 10)) < 0.3, 'realistisch: fast gerade');
});

test('e/m lässt sich aus einem abgelesenen Bahnpunkt zurückgewinnen (Gl. 5)', () => {
  const anode = 4000, coil = 0.15;
  const y = yAt({ anode, plate: 0, coil }, 9) * cm;
  const r = radiusFromPoint(9 * cm, y);
  near(r, circleRadius(anode, helmholtzField(coil)), 0.001, 'Radius');
  near(specificCharge(anode, helmholtzField(coil), r), E_OVER_M, 0.01 * E_OVER_M, 'e/m');
});

test('Strahl nur sichtbar mit Heizung und ausreichender Anodenspannung', () => {
  assert.equal(beamIntensity({ heater: false, anode: 4000 }), 0);
  assert.equal(beamIntensity({ heater: true, anode: 500 }), 0);
  assert.ok(beamIntensity({ heater: true, anode: 2000 }) < beamIntensity({ heater: true, anode: 4000 }));
  assert.equal(beamIntensity({ heater: true, anode: 5000 }), 1);
  assert.deepEqual(traceBeam({ anode: 0, plate: 0, coil: 0 }), { points: [], end: 'off' });
});

test('Startwerte aus der Adresse', async () => {
  const { state, applyUrlParams, beamSettings } = await import('../js/state.js');
  applyUrlParams('?UA=3,5&UP=-2&I=0.15&realistisch=1&heizung=0');
  assert.equal(state.anode, 3500);
  assert.deepEqual([state.plate, state.platePolarity], [2000, -1]);
  assert.equal(beamSettings().coil, 0.15);
  assert.equal(state.realistic, true);
  assert.equal(state.heater, false);
  applyUrlParams('?UA=99&I=-7');
  assert.equal(state.anode, 5000, 'auf den Reglerbereich begrenzt');
  assert.deepEqual([state.coil, state.coilPolarity], [1, -1]);
});

test('Teilchenschritt: positives Teilchen spiegelbildlich, neutrales geradeaus, |v| im B-Feld konstant', async () => {
  const { stepParticle, electronSpeed: speed } = await import('../js/physik.js');
  const s = { anode: 4000, plate: 2000, coil: 0.2, realistic: false };
  const v0 = speed(4000);
  const run = qm => {
    const p = { x: -0.005, y: 0, vx: v0, vy: 0 };
    for (let i = 0; i < 300; i++) stepParticle(p, 0.0002 / v0, s, qm);
    return p;
  };
  const neg = run(-E_OVER_M), pos = run(E_OVER_M), neutral = run(0);
  near(pos.x, neg.x, 1e-12, 'gleicher Weg in x');
  near(pos.y, -neg.y, 1e-12, 'gespiegelt in y');
  near(neutral.y, 0, 1e-15, 'neutral: keine Ablenkung');
  const p = { x: 0.01, y: 0, vx: v0, vy: 0 };
  for (let i = 0; i < 2000; i++) stepParticle(p, 0.0002 / v0, { ...s, plate: 0 }, -E_OVER_M);
  near(Math.hypot(p.vx, p.vy) / v0, 1, 1e-9, 'Betrag der Geschwindigkeit im Magnetfeld');
});

test('2D-Simulation: homogenes Magnetfeld überall, Kreisbahn mit r = m·v/(e·B)', async () => {
  const { stepParticle, fieldsAt } = await import('../js/physik.js');
  assert.deepEqual(fieldsAt(-0.5, { uniformB: 2e-3 }), { ey: 0, bz: 2e-3 }, 'auch weit vor dem Schirm');
  const v = 2e7, b = 2e-3;
  const r = v / (E_OVER_M * b);
  const p = { x: -0.3, y: 0, vx: v, vy: 0 };
  // halbe Umdrehung: danach liegt das Teilchen 2r höher (Elektron, B zum Betrachter → Ablenkung nach oben)
  const steps = 4000, dt = Math.PI * r / v / steps;
  for (let i = 0; i < steps; i++) stepParticle(p, dt, { uniformB: b }, -E_OVER_M);
  near(p.y, 2 * r, 1e-4 * r, 'Durchmesser');
  near(p.x, -0.3, 1e-4 * r, 'zurück über dem Startpunkt');
  near(p.vx, -v, 1e-3 * v, 'Gegenrichtung');
});
