// ------------------------------------------------------------------
// Zustand der Simulation (Einstellungen der Netzgeräte)
// ------------------------------------------------------------------
import { RANGES } from './config.js';

export const state = {
  heater: true,                     // Kathodenheizung
  anode: RANGES.anode.start,        // Anodenspannung U_A in V
  plate: RANGES.plate.start,        // Betrag der Plattenspannung U_P in V
  platePolarity: 1,                 // +1: obere Platte positiv
  coil: RANGES.coil.start,          // Betrag des Spulenstroms I in A
  coilPolarity: 1,                  // +1: Magnetfeld zum Betrachter
  realistic: false,                 // Schalter „realistische Werte“
};

// Einstellungen mit Vorzeichen, wie sie physik.js erwartet
export function beamSettings() {
  return {
    heater: state.heater,
    anode: state.anode,
    plate: state.plate * state.platePolarity,
    coil: state.coil * state.coilPolarity,
    realistic: state.realistic,
  };
}

/**
 * Startwerte aus der Adresse übernehmen, z. B. index.html?UA=4&UP=-2&I=0.15&realistisch=1
 *   UA: Anodenspannung in kV · UP: Plattenspannung in kV (negativ: obere Platte Minuspol)
 *   I: Spulenstrom in A (negativ: umgekehrte Richtung) · heizung=0: Heizung aus · realistisch=1
 */
export function applyUrlParams(search = location.search) {
  const params = new URLSearchParams(search);
  const num = name => (params.has(name) ? Number(params.get(name).replace(',', '.')) : NaN);
  const clamp = (value, range) => Math.min(range.max, Math.max(range.min, value));
  const ua = num('UA'), up = num('UP'), i = num('I');
  if (Number.isFinite(ua)) state.anode = clamp(ua * 1000, RANGES.anode);
  if (Number.isFinite(up)) {
    state.plate = clamp(Math.abs(up) * 1000, RANGES.plate);
    state.platePolarity = up < 0 ? -1 : 1;
  }
  if (Number.isFinite(i)) {
    state.coil = clamp(Math.abs(i), RANGES.coil);
    state.coilPolarity = i < 0 ? -1 : 1;
  }
  if (params.get('heizung') === '0') state.heater = false;
  if (params.get('realistisch') === '1') state.realistic = true;
}
