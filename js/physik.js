// ------------------------------------------------------------------
// Physik der Thomson-Röhre (ohne 3D, testbar mit node --test)
//
// Koordinaten wie im Handblatt: x in Strahlrichtung ab Beginn des
// Leuchtschirms, y senkrecht dazu nach oben (Blick auf den Schirm).
// Einheiten: SI (m, s, V, A, T).
//
// Vorzeichen der Einstellungen:
//   plate > 0  → obere Platte positiv  → Ablenkung nach oben
//   coil  > 0  → Magnetfeld zeigt zum Betrachter (+z) → Ablenkung nach oben
// ------------------------------------------------------------------
import { E_OVER_M, MU0, TUBE, COILS, REALISTIC, BEAM_MIN_ANODE } from './config.js';

/** Geschwindigkeit nach der Beschleunigung: e·U_A = ½·m·v² (nicht relativistisch). */
export function electronSpeed(anode) {
  return Math.sqrt(2 * E_OVER_M * anode);
}

/** Feld im Zentrum des Helmholtz-Spulenpaars, Gl. (4): B = μ0 · (4/5)^(3/2) · N·I / R. */
export function helmholtzField(coil) {
  return MU0 * Math.pow(4 / 5, 1.5) * COILS.turns * coil / COILS.radius;
}

/** Elektrische Feldstärke zwischen den Platten (Betrag mit Vorzeichen der Polung), Gl. (2). */
export function plateField(plate, realistic = false) {
  const factor = realistic ? REALISTIC.fieldFactorE : 1;
  return factor * plate / TUBE.plateDistance;
}

/** Bahnradius im Magnetfeld, Gl. (3): r = √(2·m·U_A / e) / B. */
export function circleRadius(anode, field) {
  return Math.sqrt(2 * anode / E_OVER_M) / Math.abs(field);
}

/** Parabelbahn im elektrischen Feld, Gl. (1): y = E / (4·U_A) · x². */
export function parabolaY(x, anode, plate, realistic = false) {
  return plateField(plate, realistic) / (4 * anode) * x * x;
}

/** Kreisbahn im Magnetfeld, Gl. (3): y = r − √(r² − x²), Vorzeichen nach Feldrichtung. */
export function circleY(x, anode, coil) {
  const field = helmholtzField(coil);
  if (field === 0) return 0;
  const r = circleRadius(anode, field);
  if (Math.abs(x) > r) return NaN;
  return Math.sign(field) * (r - Math.sqrt(r * r - x * x));
}

/** Spulenstrom, bei dem sich elektrische und magnetische Kraft aufheben (v = E/B). */
export function compensationCurrent(anode, plate, realistic = false) {
  const unitField = helmholtzField(1);
  return plateField(plate, realistic) / (electronSpeed(anode) * unitField);
}

/** Spezifische Ladung aus Messwerten, Gl. (5): e/m = 2·U_A / (B·r)². */
export function specificCharge(anode, field, radius) {
  return 2 * anode / (field * radius) ** 2;
}

/** Radius eines Kreises durch (0|0) mit waagrechter Tangente und durch (x|y): r = (x² + y²) / (2y). */
export function radiusFromPoint(x, y) {
  return (x * x + y * y) / (2 * Math.abs(y));
}

/** Helligkeit des Strahls 0 … 1 (aus bei kalter Kathode oder zu kleiner Anodenspannung). */
export function beamIntensity({ heater, anode }) {
  if (!heater || anode < BEAM_MIN_ANODE) return 0;
  return Math.min(1, Math.sqrt((anode - BEAM_MIN_ANODE) / 3000));
}

/**
 * Felder am Ort x (in m) für die Einstellung s, in SI.
 * ey: elektrische Feldstärke in y (nur zwischen den Platten), bz: Magnetfeld in z.
 * Mit { uniformB } gilt stattdessen überall dasselbe Magnetfeld ohne E-Feld (2D-Simulation).
 */
export function fieldsAt(x, { plate, coil, realistic = false, uniformB }) {
  if (uniformB !== undefined) return { ey: 0, bz: uniformB };
  const inPlates = x >= 0 && x <= TUBE.screenLength;
  const xField = realistic ? -REALISTIC.magnetLeadIn : 0;   // ab hier wirkt das Magnetfeld
  return {
    ey: inPlates ? -plateField(plate, realistic) : 0,       // obere Platte positiv → E zeigt nach unten
    bz: x >= xField ? helmholtzField(coil) : 0,
  };
}

/**
 * Ein Zeitschritt dt (in s) für ein Teilchen mit spezifischer Ladung qm (in C/kg, Vorzeichen!)
 * nach dem Boris-Verfahren, symmetrisch: halber Ortsschritt – Geschwindigkeit ändern – halber Ortsschritt.
 * p = { x, y, vx, vy } in m und m/s wird verändert.
 */
export function stepParticle(p, dt, settings, qm) {
  p.x += p.vx * dt / 2;
  p.y += p.vy * dt / 2;
  const { ey, bz } = fieldsAt(p.x, settings);
  // halber Schritt im E-Feld
  let ux = p.vx;
  let uy = p.vy + qm * ey * dt / 2;
  // Drehung im B-Feld (B in z-Richtung)
  const t = qm * bz * dt / 2;
  const sFac = 2 * t / (1 + t * t);
  const px = ux + uy * t, py = uy - ux * t;
  ux += py * sFac;
  uy -= px * sFac;
  // zweiter halber Schritt im E-Feld
  p.vx = ux;
  p.vy = uy + qm * ey * dt / 2;
  p.x += p.vx * dt / 2;
  p.y += p.vy * dt / 2;
  return p;
}

/** Startpunkt des Strahls hinter der Blende (vor Beginn der Felder), in m */
export function beamStartX(realistic = false) {
  return Math.min(realistic ? -REALISTIC.magnetLeadIn : 0, 0) - 0.005;
}

/**
 * Bahn des Elektronenstrahls numerisch berechnen.
 * Funktioniert für E-Feld, B-Feld und beide zusammen (Kompensation).
 *
 * @param {{anode:number, plate:number, coil:number, realistic?:boolean}} s
 * @returns {{points: {x:number, y:number}[], end: 'screen'|'plate'|'turned'|'off'}}
 *          points beginnen bei x ≤ 0 und enden am Schirmende oder an einer Platte
 */
export function traceBeam(s) {
  if (!(s.anode > 0)) return { points: [], end: 'off' };

  const qm = -E_OVER_M;                        // q/m des Elektrons
  const halfGap = TUBE.plateDistance / 2;
  const xStart = beamStartX(s.realistic);
  const v0 = electronSpeed(s.anode);
  const dt = 0.0002 / v0;                       // Schrittweite ≈ 0,2 mm Weg

  const p = { x: xStart, y: 0, vx: v0, vy: 0 };
  const points = [{ x: p.x, y: p.y }];
  let end = 'screen';

  for (let i = 0; i < 20000; i++) {
    stepParticle(p, dt, s, qm);
    const { x, y } = p;
    if (x < xStart) { end = 'turned'; points.push({ x, y }); break; }   // Strahl läuft zurück
    if (Math.abs(y) >= halfGap) {
      // Schnittpunkt mit der Platte linear einpassen
      const prev = points[points.length - 1];
      const yEdge = Math.sign(y) * halfGap;
      const f = (yEdge - prev.y) / (y - prev.y);
      points.push({ x: prev.x + f * (x - prev.x), y: yEdge });
      end = 'plate';
      break;
    }
    if (x >= TUBE.screenLength) {
      const prev = points[points.length - 1];
      const f = (TUBE.screenLength - prev.x) / (x - prev.x);
      points.push({ x: TUBE.screenLength, y: prev.y + f * (y - prev.y) });
      break;
    }
    points.push({ x, y });
  }
  return { points, end };
}

/** y-Wert der berechneten Bahn an der Stelle x (lineare Interpolation), sonst NaN. */
export function beamYAt(trace, x) {
  const p = trace.points;
  for (let i = 1; i < p.length; i++) {
    if (p[i].x >= x) {
      const f = (x - p[i - 1].x) / (p[i].x - p[i - 1].x);
      return p[i - 1].y + f * (p[i].y - p[i - 1].y);
    }
  }
  return NaN;
}
