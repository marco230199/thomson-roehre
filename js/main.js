// ------------------------------------------------------------------
// Start der Simulation, Antippen der Spulen und Render-Schleife
// ------------------------------------------------------------------
import * as THREE from 'three';
import { renderer, scene, camera, controls, resetView, screenView } from './szene.js';
import './roehre.js';
import { coils, fieldArrows, fieldMaterial } from './staender.js';
import { initUi, refresh } from './bedienfeld.js';
import { applyUrlParams } from './state.js';
import { initMeasure } from './messen.js';
import { initFieldView } from './feldansicht.js';
import { initViews, setView, currentView } from './ansichten.js';
import { mat } from './materialien.js';

applyUrlParams();
initUi();
initMeasure();
initFieldView();
initViews();
refresh({ cables: true });
resetView();

document.getElementById('viewAll').addEventListener('click', resetView);
document.getElementById('viewScreen').addEventListener('click', screenView);
// index.html?ansicht=messen bzw. ?ansicht=feld öffnet direkt die jeweilige Ansicht
const startView = new URLSearchParams(location.search).get('ansicht');
if (startView) setView(startView);

// ---------------- Spulen oder Feldpfeile antippen → 2D-Ansicht Magnetfeld
const raycaster = new THREE.Raycaster();
const canvas = renderer.domElement;
function hitsField(event) {
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  const targets = [...coils.children.filter(o => o.material === mat.copper)];
  if (fieldArrows.visible) targets.push(...fieldArrows.children);
  return raycaster.intersectObjects(targets, false).length > 0;
}
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', e => {
  // nur kurzes Antippen zählt, nicht Drehen der Ansicht
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 500 && hitsField(e)) {
    setView('feld');
  }
  down = null;
});
// Maus: Spulen und Pfeile beim Darüberfahren hervorheben
canvas.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || e.buttons) return;
  const hover = hitsField(e);
  canvas.style.cursor = hover ? 'pointer' : '';
  mat.copper.emissive.setHex(hover ? 0x5a2a08 : 0x000000);
  fieldMaterial.color.setHex(hover ? 0x42a5f5 : 0x1e88e5);
});

renderer.setAnimationLoop(() => {
  if (currentView() !== 'aufbau') return;   // 3D-Szene ist verdeckt: nicht zeichnen (spart Akku)
  controls.update();
  renderer.render(scene, camera);
});
