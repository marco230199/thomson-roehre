// ------------------------------------------------------------------
// Röhrenständer mit Anschlussbuchsen und Helmholtz-Spulenpaar
// ------------------------------------------------------------------
import * as THREE from 'three';
import { GEO, COILS } from './config.js';
import { addMesh, makeTextPlane } from './hilfen.js';
import { mat } from './materialien.js';
import { scene, TABLE_Y } from './szene.js';
import { SCREEN_CENTER } from './roehre.js';

const BASE_H = 2.5;
export const BASE_TOP = TABLE_Y + BASE_H;

// ---------------- Grundplatte
const base = addMesh(new THREE.BoxGeometry(46, BASE_H, 26), mat.standBase, scene);
base.position.set(-5, TABLE_Y + BASE_H / 2, 0);

// ---------------- Säule und Halter unter dem Sockel
const HOLDER_X = GEO.neckStart - GEO.capLength / 2;
const post = addMesh(new THREE.CylinderGeometry(1.4, 1.6, -GEO.capRadius - 2 - BASE_TOP, 24), mat.plastic, scene);
post.position.set(HOLDER_X, (BASE_TOP - GEO.capRadius - 2) / 2, 0);
const holder = addMesh(new THREE.BoxGeometry(GEO.capLength + 1, 2, 7), mat.standDark, scene);
holder.position.set(HOLDER_X, -GEO.capRadius - 1, 0);
const cradle = addMesh(new THREE.CylinderGeometry(GEO.capRadius + 0.4, GEO.capRadius + 0.4, 2.2, 32, 1, true, Math.PI / 2, Math.PI),
  mat.standDark, scene);
cradle.rotation.z = Math.PI / 2;
cradle.position.set(HOLDER_X, 0, 0);
cradle.material = mat.standDark.clone();
cradle.material.side = THREE.DoubleSide;

// Buchsen an der Rückseite des Halters: F1, F2 (Heizung), C (Kathode), A (Anode)
export const STAND_SOCKETS = {};
const socketDefs = [['F1', mat.cableBlack], ['F2', mat.cableBlack], ['C', mat.cableBlue], ['A', mat.cableRed]];
socketDefs.forEach(([name, material], i) => {
  const x = HOLDER_X - 3 + i * 2;
  const pos = new THREE.Vector3(x, -GEO.capRadius - 1, -3.5);
  const socket = addMesh(new THREE.CylinderGeometry(0.45, 0.45, 0.7, 16), material, scene);
  socket.rotation.x = Math.PI / 2;
  socket.position.copy(pos).add(new THREE.Vector3(0, 0, -0.3));
  const label = makeTextPlane(name, 0.8, { color: '#ffffff' });
  label.rotation.y = Math.PI;
  label.position.set(x, pos.y + 0.75, -3.52);
  scene.add(label);
  STAND_SOCKETS[name] = pos.clone().add(new THREE.Vector3(0, 0, -0.6));
});

// ---------------- Helmholtz-Spulenpaar (Abstand = Radius)
const R = COILS.radius * 100;
export const coils = new THREE.Group();     // später anklickbar (Schritt 5)
scene.add(coils);
// Anschlüsse jeder Spule: „ein“ und „aus“ (eine Spule hat keine Polung).
// Die Buchsen nehmen die Farbe des eingesteckten Kabels an (siehe netzgeraete.js).
export const COIL_SOCKETS = {};
export const COIL_SOCKET_MESHES = {};
for (const [name, z] of [['vorne', R / 2], ['hinten', -R / 2]]) {
  const winding = addMesh(new THREE.TorusGeometry(R, GEO.coilWire, 16, 96), mat.copper, coils);
  winding.position.set(SCREEN_CENTER.x, 0, z);
  winding.scale.z = 1.4;   // Wicklung etwas breiter als hoch
  const legTop = -R - GEO.coilWire;
  const leg = addMesh(new THREE.BoxGeometry(1.6, legTop - BASE_TOP, 1.2), mat.plastic, coils);
  leg.position.set(SCREEN_CENTER.x, (legTop + BASE_TOP) / 2, z);
  const foot = addMesh(new THREE.BoxGeometry(10, 1, 3.4), mat.plastic, coils);
  foot.position.set(SCREEN_CENTER.x, BASE_TOP + 0.5, z);
  // Buchsen auf dem Fuß: „ein“ rechts, „aus“ links
  for (const [end, dx] of [['ein', 3.4], ['aus', -3.4]]) {
    const socket = addMesh(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 16), mat.cableBlack, coils);
    socket.position.set(SCREEN_CENTER.x + dx, BASE_TOP + 1.4, z);
    COIL_SOCKETS[`${name}-${end}`] = new THREE.Vector3(SCREEN_CENTER.x + dx, BASE_TOP + 1.8, z);
    COIL_SOCKET_MESHES[`${name}-${end}`] = socket;
  }
  // Markierung „H“ auf der Grundplatte
  const mark = makeTextPlane('H', 1.6, { color: '#5b636c' });
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(SCREEN_CENTER.x - 6.5, BASE_TOP + 0.01, z);
  scene.add(mark);
}

// ---------------- Magnetfeldpfeile zwischen den Spulen (bei Spulenstrom sichtbar, anklickbar)
export const fieldMaterial = new THREE.MeshBasicMaterial({
  color: 0x1e88e5, transparent: true, opacity: 0.6, depthWrite: false,
});
export const fieldArrows = new THREE.Group();
fieldArrows.position.set(SCREEN_CENTER.x, 0, 0);
scene.add(fieldArrows);
const ARROW_LEN = 12;
for (const x of [-3.5, 0, 3.5]) {
  for (const y of [-1.7, 1.7]) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, ARROW_LEN - 1.2, 10), fieldMaterial);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(x, y, -0.6);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.2, 14), fieldMaterial);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(x, y, ARROW_LEN / 2 - 0.6);
    for (const part of [shaft, tip]) { part.renderOrder = 11; fieldArrows.add(part); }
  }
}
const fieldLabel = makeTextPlane('B', 1.8, { color: '#1e88e5' });
fieldLabel.renderOrder = 12;
scene.add(fieldLabel);

/** Pfeile ein-/ausblenden, Richtung und Deutlichkeit nach dem Spulenstrom (mit Vorzeichen) */
export function updateFieldArrows(coil) {
  const on = coil !== 0;
  fieldArrows.visible = fieldLabel.visible = on;
  if (!on) return;
  fieldArrows.rotation.y = coil > 0 ? 0 : Math.PI;            // +z: zum Betrachter
  fieldMaterial.opacity = 0.3 + 0.45 * Math.min(1, Math.abs(coil) / 0.3);
  fieldLabel.position.set(SCREEN_CENTER.x + 4.4, 2.6, Math.sign(coil) * (ARROW_LEN / 2 - 0.4));
}
