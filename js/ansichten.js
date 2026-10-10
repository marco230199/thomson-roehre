// ------------------------------------------------------------------
// Ansichten: 3D-Aufbau, Messansicht, 2D-Simulation
// Die Zusatzansichten liegen anstelle der 3D-Szene. Eine Ansicht mit eigenem Steuerfeld
// (panel) ersetzt dabei das Bedienfeld des Experiments.
// ------------------------------------------------------------------
const views = {};          // name → { element, panel, onOpen }
let current = 'aufbau';

export const currentView = () => current;

export function registerView(name, { element, panel = null, onOpen = () => {} }) {
  views[name] = { element, panel, onOpen };
}

/** Ansicht wechseln ('aufbau', 'messen', 'feld' = 2D-Simulation). Knöpfe mit data-view schalten um. */
export function setView(name) {
  current = views[name] ? name : 'aufbau';
  for (const [key, view] of Object.entries(views)) {
    view.element.hidden = key !== current;
    if (view.panel) view.panel.hidden = key !== current;
  }
  document.getElementById('expPanel').hidden = Boolean(views[current]?.panel);
  document.body.classList.toggle('overlay-open', current !== 'aufbau');
  for (const button of document.querySelectorAll('[data-view]')) {
    const active = button.dataset.view === current;
    button.textContent = active ? 'Zurück zum 3D-Aufbau' : button.dataset.label;
    button.setAttribute('aria-expanded', String(active));
  }
  if (current !== 'aufbau') requestAnimationFrame(() => views[current].onOpen());
}

export function initViews() {
  for (const button of document.querySelectorAll('[data-view]')) {
    button.dataset.label = button.textContent.trim();
    button.addEventListener('click', () => setView(current === button.dataset.view ? 'aufbau' : button.dataset.view));
  }
  for (const button of document.querySelectorAll('[data-close-view]')) {
    button.addEventListener('click', () => setView('aufbau'));
  }
}
