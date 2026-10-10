// ------------------------------------------------------------------
// Auswertung „Rechnung anzeigen“: Rechenschritte mit eingesetzten Zahlen
// (ohne DOM, testbar). Formeln als LaTeX für KaTeX.
// ------------------------------------------------------------------
import { E_OVER_M, MU0, COILS, TUBE, REALISTIC } from './config.js';
import { helmholtzField, electronSpeed, radiusFromPoint, specificCharge, traceBeam, beamYAt } from './physik.js';

export const LITERATURE_E_OVER_M = E_OVER_M;
const STRAIGHT_TOLERANCE = 0.05;   // cm: so gerade muss der Strahl bei der Kompensation sein

// ---------------- Zahlen für LaTeX (deutsches Komma)
export function num(value, digits) {
  return value.toFixed(digits).replace('.', '{,}');
}
/** Zahl in Zehnerpotenz-Schreibweise mit `sig` gültigen Ziffern, z. B. 1{,}76 \cdot 10^{11} */
export function sci(value, sig = 3) {
  if (value === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(value)));
  let mant = value / 10 ** exp;
  let e = exp;
  if (Math.abs(Number(mant.toFixed(sig - 1))) >= 10) { mant /= 10; e += 1; }
  return e === 0 ? num(mant, sig - 1) : `${num(mant, sig - 1)} \\cdot 10^{${e}}`;
}
const unit = u => `\\,\\mathrm{${u}}`;
/** Rechnung untereinander, am Gleichheitszeichen ausgerichtet: lhs = r1 = r2 = … */
const lines = (lhs, ...rhs) => `\\begin{aligned} ${lhs} &= ${rhs.join(' \\\\ &= ')} \\end{aligned}`;

/** y der simulierten Bahn an der Stelle x (beides in cm), NaN falls der Strahl dort nicht mehr läuft */
export function simulatedY(settings, xCm) {
  return beamYAt(traceBeam(settings), xCm / 100) * 100;
}

/** Welche Felder sind eingeschaltet? */
export function fieldCase(settings) {
  const e = settings.plate !== 0, b = settings.coil !== 0;
  if (e && b) return 'EB';
  if (e) return 'E';
  if (b) return 'B';
  return 'none';
}

/**
 * Rechenschritte für die aktuelle Einstellung.
 * @param settings  Einstellungen mit Vorzeichen (state.beamSettings())
 * @param point     { x: cm, yRead: cm oder null } – abgelesener Messpunkt der Schüler
 * @returns {{ kind, steps: {title, tex}[], note?: string, emRatio?: number, deviation?: number, point? }}
 */
export function evaluate(settings, { x, yRead = null }) {
  const kind = fieldCase(settings);
  const steps = [];
  const ua = settings.anode;
  const uaTex = `${Math.round(ua)}${unit('V')}`;

  if (kind === 'none') {
    return { kind, steps, note: 'Es ist kein Feld eingeschaltet: Der Strahl läuft gerade. Stelle eine Plattenspannung oder einen Spulenstrom ein.' };
  }

  // Messpunkt: Ablesung der Schüler oder (falls leer) Wert aus der Simulation
  const ySim = simulatedY(settings, x);
  const useRead = yRead !== null && Number.isFinite(yRead);
  const y = useRead ? yRead : ySim;
  const point = { x, y, source: useRead ? 'ablesung' : 'simulation', ySim };

  if (kind === 'E') {
    const up = Math.abs(settings.plate);
    const d = TUBE.plateDistance;
    const e = up / d;
    const yTheo = e / (4 * ua) * (x / 100) ** 2 * 100;
    steps.push({
      title: 'Elektrische Feldstärke zwischen den Platten',
      tex: lines('E', `\\frac{U_P}{d}`, `\\frac{${Math.round(up)}${unit('V')}}{${num(d, 3)}${unit('m')}}`, `${sci(e, 3)}${unit('\\tfrac{V}{m}')}`),
    });
    steps.push({
      title: `Ablenkung nach der Parabelformel (Gl. 1) bei x = ${num(x, 1).replace('{,}', ',')} cm`,
      tex: lines('y', `\\frac{E}{4\\,U_A}\\,x^2`,
        `\\frac{${sci(e, 3)}${unit('\\tfrac{V}{m}')}}{4 \\cdot ${uaTex}} \\cdot (${num(x / 100, 3)}${unit('m')})^2`,
        `${num(yTheo, 2)}${unit('cm')}`),
    });
    if (settings.realistic) {
      const yReal = REALISTIC.fieldFactorE * yTheo;
      steps.push({
        title: 'Echtes Gerät: Das Feld ist nur 75 % so stark (Gl. 2)',
        tex: `y = 0{,}75 \\cdot ${num(yTheo, 2)}${unit('cm')} = ${num(yReal, 2)}${unit('cm')}`,
      });
    }
    if (useRead) {
      steps.push({ title: 'Deine Ablesung', tex: `y = ${num(Math.abs(yRead), 2)}${unit('cm')}` });
    }
    return {
      kind, steps, point,
      note: 'In der Parabelformel kommen e und m nicht vor: Die Bahn im elektrischen Feld ist für alle Teilchen mit gleicher Ladung gleich. e/m lässt sich so nicht bestimmen – dafür brauchst du das Magnetfeld.',
    };
  }

  const i = Math.abs(settings.coil);
  const b = helmholtzField(i);
  const factor = Math.pow(4 / 5, 1.5);
  const bStep = {
    title: 'Magnetfeld der Helmholtz-Spulen (Gl. 4)',
    tex: lines('B', `\\mu_0 \\left(\\tfrac{4}{5}\\right)^{3/2} \\frac{N\\,I}{R}`,
      `${sci(MU0, 4)}${unit('\\tfrac{Vs}{Am}')} \\cdot ${num(factor, 3)} \\cdot \\frac{${COILS.turns} \\cdot ${num(i, 3)}${unit('A')}}{${num(COILS.radius, 3)}${unit('m')}}`,
      `${num(b * 1000, 3)}${unit('mT')}`),
  };

  if (kind === 'B') {
    if (!Number.isFinite(y) || Math.abs(y) < 0.01) {
      return { kind, steps: [bStep], point, note: 'An dieser Stelle ist keine Ablenkung ablesbar. Wähle ein größeres x oder einen größeren Spulenstrom.' };
    }
    const yAbs = Math.abs(y);
    const r = radiusFromPoint(x, yAbs);                 // cm
    const em = specificCharge(ua, b, r / 100);
    steps.push(bStep);
    steps.push({
      title: `Bahnradius aus dem Messpunkt (${num(x, 1).replace('{,}', ',')} cm | ${num(yAbs, 2).replace('{,}', ',')} cm)`,
      tex: lines('r', `\\frac{x^2 + y^2}{2\\,y}`,
        `\\frac{(${num(x, 1)}${unit('cm')})^2 + (${num(yAbs, 2)}${unit('cm')})^2}{2 \\cdot ${num(yAbs, 2)}${unit('cm')}}`,
        `${num(r, 1)}${unit('cm')}`),
    });
    steps.push({
      title: 'Spezifische Ladung (Gl. 5)',
      tex: lines('\\frac{e}{m}', `\\frac{2\\,U_A}{(B\\,r)^2}`,
        `\\frac{2 \\cdot ${uaTex}}{(${sci(b, 3)}${unit('T')} \\cdot ${num(r / 100, 3)}${unit('m')})^2}`,
        `${sci(em, 3)}${unit('\\tfrac{C}{kg}')}`),
    });
    return finish({ kind, steps, point }, em);
  }

  // Beide Felder: Kompensation (Wien-Filter)
  const yEnd = simulatedY(settings, TUBE.screenLength * 100);
  if (!Number.isFinite(yEnd) || Math.abs(yEnd) > STRAIGHT_TOLERANCE) {
    return {
      kind: 'EB-schief', steps: [], point,
      note: 'Beide Felder sind eingeschaltet, aber der Strahl ist noch gekrümmt. Für die Kompensationsmethode stellst du den Spulenstrom (oder die Plattenspannung) so ein, dass der Strahl genau gerade läuft. Achte darauf, dass die beiden Felder in entgegengesetzte Richtungen ablenken.',
    };
  }
  const up = Math.abs(settings.plate);
  const e = up / TUBE.plateDistance;
  const v = e / b;
  const em = v * v / (2 * ua);
  steps.push({
    title: 'Elektrische Feldstärke',
    tex: lines('E', `\\frac{U_P}{d}`, `\\frac{${Math.round(up)}${unit('V')}}{${num(TUBE.plateDistance, 3)}${unit('m')}}`, `${sci(e, 3)}${unit('\\tfrac{V}{m}')}`),
  });
  steps.push(bStep);
  steps.push({
    title: 'Gerader Strahl: elektrische Kraft = Lorentzkraft',
    tex: `e\\,E = e\\,v\\,B \\;\\Rightarrow\\; ` + lines('v', `\\frac{E}{B}`, `\\frac{${sci(e, 3)}${unit('\\tfrac{V}{m}')}}{${sci(b, 3)}${unit('T')}}`, `${sci(v, 3)}${unit('\\tfrac{m}{s}')}`),
  });
  steps.push({
    title: 'Energie aus der Beschleunigung: e · U<sub>A</sub> = ½ m v²',
    tex: lines('\\frac{e}{m}', `\\frac{v^2}{2\\,U_A}`, `\\frac{(${sci(v, 3)}${unit('\\tfrac{m}{s}')})^2}{2 \\cdot ${uaTex}}`, `${sci(em, 3)}${unit('\\tfrac{C}{kg}')}`),
  });
  return finish({ kind, steps, point }, em);
}

// Abweichung in Prozent mit Vorzeichen; gerundet 0 % als „≈ 0 %“
function percent(deviation) {
  const rounded = Math.round(deviation * 100);
  if (rounded === 0) return '\\approx 0\\,\\%';
  return `${rounded > 0 ? '+' : '-'}\\,${Math.abs(rounded)}\\,\\%`;
}

function finish(result, em) {
  const deviation = (em - LITERATURE_E_OVER_M) / LITERATURE_E_OVER_M;
  result.steps.push({
    title: 'Vergleich mit dem Literaturwert',
    tex: `\\left(\\tfrac{e}{m}\\right)_{\\text{Lit}} = ${sci(LITERATURE_E_OVER_M, 3)}${unit('\\tfrac{C}{kg}')} \\quad\\Rightarrow\\quad \\text{Abweichung } ${percent(deviation)}`,
  });
  return { ...result, emRatio: em, deviation };
}

/**
 * Ablesung prüfen: richtig, wenn höchstens 0,1 cm von der Simulation entfernt.
 * 'vorzeichen' heißt: Betrag stimmt, aber das Vorzeichen nicht.
 */
export function checkReading(yRead, ySim, tolerance = 0.1) {
  if (!Number.isFinite(ySim)) return 'kein-strahl';
  if (Math.abs(yRead - ySim) <= tolerance) return 'richtig';
  if (Math.abs(Math.abs(yRead) - Math.abs(ySim)) <= tolerance) return 'vorzeichen';
  return 'falsch';
}
