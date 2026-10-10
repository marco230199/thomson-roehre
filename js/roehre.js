// ------------------------------------------------------------------
// Thomson-Röhre: Glaskolben, Elektronenkanone, Platten, Leuchtschirm, Strahl
// Koordinaten in cm, Ursprung am Beginn des Leuchtschirms auf der Strahlachse
// ------------------------------------------------------------------
import * as THREE from 'three';
import { GEO, TUBE } from './config.js';
import { traceBeam, beamIntensity } from './physik.js';
import { addMesh, canvasTexture } from './hilfen.js';
import { mat } from './materialien.js';
import { scene } from './szene.js';

const SCREEN_LEN = TUBE.screenLength * 100;     // 10 cm
const GAP = TUBE.plateDistance * 100;           // 5,5 cm
const BULB_CENTER = new THREE.Vector3(SCREEN_LEN / 2, 0, 0);

export const tube = new THREE.Group();
scene.add(tube);

// ---------------- Glas: Kolben, Hals, Ansätze für die Plattenanschlüsse
const glassParts = [];
const bulb = addMesh(new THREE.SphereGeometry(GEO.bulbRadius, 48, 32), mat.glass, tube);
bulb.position.copy(BULB_CENTER);
glassParts.push(bulb);

const neckLen = -1 - GEO.neckStart;
const neck = addMesh(new THREE.CylinderGeometry(GEO.neckRadius, GEO.neckRadius, neckLen, 32, 1, true), mat.glass, tube);
neck.rotation.z = Math.PI / 2;
neck.position.set(GEO.neckStart + neckLen / 2, 0, 0);
glassParts.push(neck);

// Plattenanschlüsse oben und unten am Kolben
export const PLATE_CONTACT_TOP = new THREE.Vector3(BULB_CENTER.x, GEO.bulbRadius + 1.6, 0);
export const PLATE_CONTACT_BOTTOM = new THREE.Vector3(BULB_CENTER.x, -GEO.bulbRadius - 1.6, 0);
for (const sign of [1, -1]) {
  const arm = addMesh(new THREE.CylinderGeometry(0.55, 0.7, 1.4, 20, 1, true), mat.glass, tube);
  arm.position.set(BULB_CENTER.x, sign * (GEO.bulbRadius + 0.3), 0);
  glassParts.push(arm);
  const cap = addMesh(new THREE.CylinderGeometry(0.65, 0.65, 0.9, 20), mat.metal, tube);
  cap.position.set(BULB_CENTER.x, sign * (GEO.bulbRadius + 1.15), 0);
  // Zuleitung im Inneren von der Platte zum Anschluss
  const lead = addMesh(new THREE.CylinderGeometry(0.06, 0.06, GEO.bulbRadius - GAP / 2 + 0.6, 8), mat.metal, tube);
  lead.position.set(BULB_CENTER.x, sign * (GAP / 2 + (GEO.bulbRadius - GAP / 2 + 0.6) / 2), 0);
}
for (const part of glassParts) {
  part.castShadow = false;
  part.renderOrder = 10;   // Glas zuletzt zeichnen, damit das Innere sichtbar bleibt
}

// ---------------- Sockel (Kathodenkappe)
const capGeo = new THREE.CylinderGeometry(GEO.capRadius, GEO.capRadius, GEO.capLength, 40);
const cap = addMesh(capGeo, mat.plastic, tube);
cap.rotation.z = Math.PI / 2;
cap.position.set(GEO.neckStart - GEO.capLength / 2, 0, 0);
const capRing = addMesh(new THREE.CylinderGeometry(GEO.capRadius + 0.15, GEO.capRadius + 0.15, 0.6, 40), mat.metalDark, tube);
capRing.rotation.z = Math.PI / 2;
capRing.position.set(GEO.neckStart - 0.25, 0, 0);   // nicht bündig mit der Stirnfläche (kein Flackern)

// ---------------- Elektronenkanone im Hals
const filament = addMesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 16), mat.filamentOff, tube);
filament.rotation.z = Math.PI / 2;
filament.position.set(-13.3, 0, 0);
const wehnelt = addMesh(new THREE.CylinderGeometry(0.75, 0.75, 1.6, 24, 1, true), mat.metalDark, tube);
wehnelt.rotation.z = Math.PI / 2;
wehnelt.position.set(-11.9, 0, 0);
const anode = addMesh(new THREE.CylinderGeometry(0.8, 0.8, 3, 24, 1, true), mat.metal, tube);
anode.rotation.z = Math.PI / 2;
anode.position.set(-7.5, 0, 0);
const anodeDisc = addMesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 24), mat.metal, tube);
anodeDisc.rotation.z = Math.PI / 2;
anodeDisc.position.set(-6, 0, 0);
// Halterungsstäbe zum Sockel
for (const z of [-0.9, 0.9]) {
  const rod = addMesh(new THREE.CylinderGeometry(0.05, 0.05, 9.5, 6), mat.metalDark, tube);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(-10.8, -1.1, z * 0.6);
}

// Schlitzblende kurz vor dem Schirm
const slitPlate = addMesh(new THREE.BoxGeometry(0.08, 1.8, 1.8), mat.metal, tube);
slitPlate.position.set(-0.6, 0, 0);
const slit = addMesh(new THREE.BoxGeometry(0.1, 0.12, 1.1), new THREE.MeshBasicMaterial({ color: 0x111111 }), tube);
slit.position.set(-0.6, 0, 0);

// ---------------- Kondensatorplatten (oben / unten)
for (const sign of [1, -1]) {
  const plate = addMesh(new THREE.BoxGeometry(SCREEN_LEN + 0.6, 0.12, GEO.plateWidth), mat.metal, tube);
  plate.position.set(SCREEN_LEN / 2, sign * (GAP / 2 + 0.06), 0);
}

// ---------------- Leuchtschirm mit cm-Raster (schräg gestellt)
const PX = 100;   // Pixel pro cm
const screenTex = canvasTexture(SCREEN_LEN * PX, Math.round(GAP * PX));
function drawScreen() {
  const { ctx, canvas } = screenTex;
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#26332f';
  ctx.fillRect(0, 0, W, H);
  const yPx = y => H / 2 - y * PX;   // y in cm → Pixel
  // Millimeter-Hilfslinien (fein), cm-Linien (deutlich), Achse
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(200, 220, 210, 0.12)';
  for (let i = 1; i < SCREEN_LEN * 2; i++) {
    if (i % 2 === 0) continue;
    ctx.beginPath(); ctx.moveTo(i * PX / 2, 0); ctx.lineTo(i * PX / 2, H); ctx.stroke();
  }
  for (let y = -2.5; y <= 2.5; y += 1) {
    ctx.beginPath(); ctx.moveTo(0, yPx(y)); ctx.lineTo(W, yPx(y)); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(215, 230, 222, 0.55)';
  ctx.lineWidth = 2;
  for (let x = 1; x < SCREEN_LEN; x++) {
    ctx.beginPath(); ctx.moveTo(x * PX, 0); ctx.lineTo(x * PX, H); ctx.stroke();
  }
  for (let y = -2; y <= 2; y++) {
    ctx.lineWidth = y === 0 ? 4 : 2;
    ctx.beginPath(); ctx.moveTo(0, yPx(y)); ctx.lineTo(W, yPx(y)); ctx.stroke();
  }
  // Beschriftung: x unten, y links
  ctx.fillStyle = 'rgba(225, 238, 230, 0.85)';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let x = 1; x < SCREEN_LEN; x++) ctx.fillText(String(x), x * PX, H - 6);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let y = -2; y <= 2; y++) if (y !== 0) ctx.fillText(String(y), 8, yPx(y));
  screenTex.texture.needsUpdate = true;
}
drawScreen();

// Gruppe mit der Lage des Schirms: lokale Koordinaten (x − 5 cm, y) auf der Schirmfläche
const screenGroup = new THREE.Group();
screenGroup.position.copy(BULB_CENTER);
screenGroup.rotation.x = -THREE.MathUtils.degToRad(GEO.screenTilt);
tube.add(screenGroup);
const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_LEN, GAP),
  new THREE.MeshStandardMaterial({ map: screenTex.texture, roughness: 0.8, side: THREE.DoubleSide }));
screen.receiveShadow = true;
screenGroup.add(screen);
// Halterungen des Schirms an den Platten
for (const x of [-SCREEN_LEN / 2, SCREEN_LEN / 2]) {
  const holder = addMesh(new THREE.BoxGeometry(0.15, GAP, 0.15), mat.metalDark, screenGroup);
  holder.position.set(x, 0, -0.08);
}

// ---------------- Elektronenstrahl auf dem Leuchtschirm
const beamCore = new THREE.MeshBasicMaterial({ color: 0xbff6ff, transparent: true });
const beamGlow = new THREE.MeshBasicMaterial({
  color: 0x36c8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
});
const beam = new THREE.Group();
screenGroup.add(beam);

/**
 * Strahl neu zeichnen. Gibt zurück, ob ein Strahl sichtbar ist und wo er endet
 * ('screen' = Schirmende, 'plate' = an einer Platte, 'turned' = kehrt um).
 */
export function updateBeam(settings) {
  for (const mesh of beam.children) mesh.geometry.dispose();
  beam.clear();
  filament.material = settings.heater ? mat.filamentOn : mat.filamentOff;

  const intensity = beamIntensity(settings);
  if (intensity === 0) return { visible: false, end: 'off', endY: 0 };
  const trace = traceBeam(settings);
  const endY = trace.points.at(-1).y;
  // Nur der Teil auf dem Schirm leuchtet
  const pts = trace.points
    .filter(p => p.x >= 0)
    .map(p => new THREE.Vector3(p.x * 100 - SCREEN_LEN / 2, p.y * 100, 0.03));
  if (pts.length >= 2) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const segments = Math.min(400, pts.length * 2);
    beamCore.opacity = 0.35 + 0.65 * intensity;
    beamGlow.opacity = 0.5 * intensity;
    beam.add(new THREE.Mesh(new THREE.TubeGeometry(curve, segments, 0.045, 8, false), beamCore));
    beam.add(new THREE.Mesh(new THREE.TubeGeometry(curve, segments, 0.13, 8, false), beamGlow));
  }
  return { visible: true, end: trace.end, endY };
}

// Anschlusspunkte für die Kabel (Weltkoordinaten)
export const SCREEN_CENTER = BULB_CENTER.clone();
