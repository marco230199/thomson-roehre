// ------------------------------------------------------------------
// Bedienfeld: Regler, Knöpfe, Statusanzeigen
// ------------------------------------------------------------------
import { RANGES } from './config.js';
import { state, beamSettings } from './state.js';
import { formatNumber } from './hilfen.js';
import { updateBeam } from './roehre.js';
import { updateSupplies, buildCables } from './netzgeraete.js';
import { updateMeasure } from './messen.js';
import { updateFieldArrows } from './staender.js';

const $ = id => document.getElementById(id);

const sliders = {
  anodeSlider: { key: 'anode', range: RANGES.anode, out: 'anodeOut', format: v => `${formatNumber(v / 1000, 1)} kV` },
  plateSlider: { key: 'plate', range: RANGES.plate, out: 'plateOut', format: v => `${formatNumber(v / 1000, 1)} kV` },
  coilSlider: { key: 'coil', range: RANGES.coil, out: 'coilOut', format: v => `${formatNumber(v, 3)} A` },
};

// Alles, was vom Zustand abhängt, neu darstellen
export function refresh({ cables = false } = {}) {
  for (const [id, s] of Object.entries(sliders)) {
    $(id).value = state[s.key];
    $(s.out).textContent = s.format(state[s.key]);
  }
  const heater = $('heaterBtn');
  heater.classList.toggle('on', state.heater);
  heater.textContent = state.heater ? 'Heizung ausschalten' : 'Heizung einschalten';
  heater.setAttribute('aria-pressed', String(state.heater));

  $('plateStatus').textContent = state.platePolarity > 0
    ? 'Obere Platte: Pluspol, untere Platte: Minuspol'
    : 'Obere Platte: Minuspol, untere Platte: Pluspol';
  $('coilStatus').textContent = state.coilPolarity > 0
    ? 'Magnetfeld zeigt zum Betrachter hin (aus dem Bildschirm heraus).'
    : 'Magnetfeld zeigt vom Betrachter weg (in den Bildschirm hinein).';
  $('realisticCheck').checked = state.realistic;
  $('realisticStatus').textContent = state.realistic
    ? 'Wie beim echten Gerät: Das elektrische Feld ist schwächer, das Magnetfeld wirkt schon vor dem Schirm.'
    : 'Ideale Theorie: Formeln aus dem Unterricht.';

  if (cables) buildCables();
  updateSupplies();
  const beam = updateBeam(beamSettings());
  $('beamStatus').textContent = beamText(beam);
  $('beamStatus').classList.toggle('warn', beam.end === 'plate' || beam.end === 'turned' || !beam.visible);
  updateMeasure();
  updateFieldArrows(beamSettings().coil);
}

function beamText(beam) {
  if (!state.heater) return 'Die Kathode ist nicht geheizt: Es treten keine Elektronen aus.';
  if (!beam.visible) return 'Die Anodenspannung ist zu klein: Der Strahl ist nicht zu sehen.';
  if (beam.end === 'plate') return `Der Strahl wird so stark abgelenkt, dass er auf die ${beam.endY > 0 ? 'obere' : 'untere'} Platte trifft.`;
  if (beam.end === 'turned') return 'Der Strahl ist so stark gekrümmt, dass er umkehrt.';
  return 'Der Elektronenstrahl läuft über den ganzen Leuchtschirm.';
}

export function initUi() {
  for (const [id, s] of Object.entries(sliders)) {
    const input = $(id);
    Object.assign(input, { min: s.range.min, max: s.range.max, step: s.range.step });
    input.addEventListener('input', () => {
      state[s.key] = Number(input.value);
      refresh();
    });
  }
  // −/+ Knöpfe: ein Schritt pro Tipp, bei gedrückt halten wiederholt
  for (const button of document.querySelectorAll('.stepper button[data-target]')) {
    const s = sliders[button.dataset.target];
    const step = () => {
      const value = state[s.key] + Number(button.dataset.dir) * s.range.step;
      state[s.key] = Math.min(s.range.max, Math.max(s.range.min, Math.round(value / s.range.step) * s.range.step));
      refresh();
    };
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
  $('heaterBtn').addEventListener('click', () => { state.heater = !state.heater; refresh(); });
  $('platePolarityBtn').addEventListener('click', () => { state.platePolarity *= -1; refresh({ cables: true }); });
  $('coilPolarityBtn').addEventListener('click', () => { state.coilPolarity *= -1; refresh({ cables: true }); });
  $('realisticCheck').addEventListener('change', event => { state.realistic = event.target.checked; refresh(); });
}
