// ------------------------------------------------------------------
// Netzgeräte (Anode, Spulen, Platten) mit Anzeigen und Kabeln
// ------------------------------------------------------------------
import * as THREE from 'three';
import { HEATER_VOLTAGE } from './config.js';
import { state } from './state.js';
import { addMesh, canvasTexture, makeTextPlane, makeCable, formatNumber } from './hilfen.js';
import { mat } from './materialien.js';
import { scene, TABLE_Y } from './szene.js';
import { PLATE_CONTACT_TOP, PLATE_CONTACT_BOTTOM } from './roehre.js';
import { STAND_SOCKETS, COIL_SOCKETS, COIL_SOCKET_MESHES, BASE_TOP } from './staender.js';

const SUPPLY_Z = -34;
const W = 24, H = 15, D = 18;

function buildSupply(x, title, sockets) {
  const group = new THREE.Group();
  group.position.set(x, TABLE_Y, SUPPLY_Z);
  scene.add(group);

  const housing = addMesh(new THREE.BoxGeometry(W, H, D), mat.housing, group);
  housing.position.y = H / 2 + 0.4;
  for (const fx of [-W / 2 + 2, W / 2 - 2]) for (const fz of [-D / 2 + 2, D / 2 - 2]) {
    const foot = addMesh(new THREE.CylinderGeometry(0.8, 0.8, 0.4, 12), mat.knob, group);
    foot.position.set(fx, 0.2, fz);
  }
  const panel = addMesh(new THREE.BoxGeometry(W - 1.5, H - 1.5, 0.3), mat.panel, group);
  panel.position.set(0, H / 2 + 0.4, D / 2 + 0.1);
  const front = D / 2 + 0.27;

  const label = makeTextPlane(title, 1.5, { color: '#ffffff' });
  label.position.set(0, H - 1.2, front);
  group.add(label);

  // Digitalanzeige
  const display = canvasTexture(320, 110);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.1), new THREE.MeshBasicMaterial({ map: display.texture }));
  screen.position.set(-4.5, H - 4.6, front);
  group.add(screen);
  const setDisplay = text => {
    const { ctx } = display;
    ctx.fillStyle = '#0d1a0d';
    ctx.fillRect(0, 0, 320, 110);
    ctx.fillStyle = '#5dff6a';
    ctx.font = 'bold 66px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 304, 58);
    display.texture.needsUpdate = true;
  };

  // Drehknopf und Kontrolllampe
  const knob = addMesh(new THREE.CylinderGeometry(1.9, 1.9, 1.4, 32), mat.knob, group);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(6, H - 4.6, front + 0.7);
  const mark = addMesh(new THREE.BoxGeometry(0.3, 0.1, 1.3), mat.housing, knob);
  mark.position.set(0, 0.72, -1.05);
  const led = addMesh(new THREE.SphereGeometry(0.45, 16, 12), mat.ledOn, group);
  led.position.set(W / 2 - 2.2, 2.6, front);

  // Buchsen mit Beschriftung
  const socketWorld = {};
  for (const { name, text, sx, material } of sockets) {
    const pos = new THREE.Vector3(sx, 3.6, front);
    const socket = addMesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 20), material, group);
    socket.rotation.x = Math.PI / 2;
    socket.position.copy(pos).add(new THREE.Vector3(0, 0, 0.5));
    const tag = makeTextPlane(text, 1, { color: '#ffffff', bold: false });
    tag.position.set(sx, 5.2, front);
    group.add(tag);
    socketWorld[name] = pos.clone().add(group.position).add(new THREE.Vector3(0, 0, 1));
  }
  return { group, setDisplay, knob, socketWorld };
}

const anodeSupply = buildSupply(-36, 'Anodenspannung', [
  { name: 'F1', text: `${formatNumber(HEATER_VOLTAGE, 1)} V`, sx: -8.5, material: mat.cableBlack },
  { name: 'F2', text: '', sx: -6, material: mat.cableBlack },
  { name: 'minus', text: '−', sx: 2, material: mat.cableBlue },
  { name: 'plus', text: '+', sx: 6, material: mat.cableRed },
]);
const coilSupply = buildSupply(-4, 'Spulenstrom', [
  { name: 'plus', text: '+', sx: -2, material: mat.cableRed },
  { name: 'minus', text: '−', sx: 2, material: mat.cableBlue },
]);
const plateSupply = buildSupply(28, 'Plattenspannung', [
  { name: 'plus', text: '+', sx: -2, material: mat.cableRed },
  { name: 'minus', text: '−', sx: 2, material: mat.cableBlue },
]);

// Anzeigen und Drehknöpfe passend zum Zustand
export function updateSupplies() {
  anodeSupply.setDisplay(`${formatNumber(state.anode / 1000, 1)} kV`);
  coilSupply.setDisplay(`${formatNumber(state.coil, 3)} A`);
  plateSupply.setDisplay(`${formatNumber(state.plate / 1000, 1)} kV`);
  const turn = (knob, f) => { knob.rotation.y = -(-0.75 + 1.5 * f) * Math.PI; };
  turn(anodeSupply.knob, state.anode / 5000);
  turn(coilSupply.knob, state.coil / 1);
  turn(plateSupply.knob, state.plate / 5000);
}

// ---------------- Kabel
const floor = TABLE_Y;
const out = p => [[p.x, p.y, p.z], [p.x, p.y - 1, p.z + 3], [p.x, floor, p.z + 6]];
const onBase = BASE_TOP + 0.4;
// zur Rückseite des Röhrenständers: über die Kante der Grundplatte hinauf zur Buchse
const into = p => [[p.x, floor, -17], [p.x, onBase + 0.3, -12.5], [p.x, onBase, p.z - 6],
  [p.x, p.y - 1, p.z - 2.5], [p.x, p.y, p.z]];

let cables = [];
export function buildCables() {
  for (const c of cables) { scene.remove(c); c.geometry.dispose(); }
  const a = anodeSupply.socketWorld, s = STAND_SOCKETS;
  const c = coilSupply.socketWorld, k = COIL_SOCKETS;
  const p = plateSupply.socketWorld;
  // Plattenspannung: Polung über die Kabel (wie am echten Gerät umstecken)
  const [topWire, bottomWire] = state.platePolarity > 0 ? [p.plus, p.minus] : [p.minus, p.plus];
  const [topMat, bottomMat] = state.platePolarity > 0 ? [mat.cableRed, mat.cableBlue] : [mat.cableBlue, mat.cableRed];
  // Spulenstrom: Richtung ebenso über die Kabel
  const [coilIn, coilOut] = state.coilPolarity > 0 ? [c.plus, c.minus] : [c.minus, c.plus];
  const [inMat, outMat] = state.coilPolarity > 0 ? [mat.cableRed, mat.cableBlue] : [mat.cableBlue, mat.cableRed];

  // Buchsen an den Spulen in der Farbe des eingesteckten Kabels
  COIL_SOCKET_MESHES['vorne-ein'].material = inMat;
  COIL_SOCKET_MESHES['hinten-aus'].material = outMat;

  cables = [
    // Heizung und Anodenspannung zum Röhrenständer
    makeCable([...out(a.F1), ...into(s.F1)], mat.cableBlack, scene, floor),
    makeCable([...out(a.F2), [a.F2.x + 1, floor, a.F2.z + 8], ...into(s.F2)], mat.cableBlack, scene, floor),
    makeCable([...out(a.minus), [a.minus.x - 2, floor, a.minus.z + 9], ...into(s.C)], mat.cableBlue, scene, floor),
    makeCable([...out(a.plus), [a.plus.x - 2, floor, a.plus.z + 10], ...into(s.A)], mat.cableRed, scene, floor),
    // Spulen in Reihe: Netzgerät → vordere Spule → hintere Spule → Netzgerät
    makeCable([...out(coilIn), [coilIn.x + 6, floor, coilIn.z + 10], [k['vorne-ein'].x + 3, onBase, -16],
      [k['vorne-ein'].x + 3, onBase + 2.5, 0], [k['vorne-ein'].x, k['vorne-ein'].y + 3, k['vorne-ein'].z],
      k['vorne-ein'].toArray()], inMat, scene, floor),
    makeCable([k['vorne-aus'].toArray(), [k['vorne-aus'].x, k['vorne-aus'].y + 3.5, k['vorne-aus'].z],
      [k['hinten-ein'].x - 1, k['hinten-ein'].y + 4, 0], [k['hinten-ein'].x, k['hinten-ein'].y + 3, k['hinten-ein'].z],
      k['hinten-ein'].toArray()], mat.cableBlack, scene, floor),
    makeCable([...out(coilOut), [coilOut.x + 4, floor, coilOut.z + 9], [k['hinten-aus'].x - 1, onBase, -14],
      [k['hinten-aus'].x, k['hinten-aus'].y + 3, k['hinten-aus'].z], k['hinten-aus'].toArray()], outMat, scene, floor),
    // Plattenspannung zu den Anschlüssen oben und unten am Kolben
    makeCable([...out(topWire), [topWire.x - 4, floor + 6, -16], [PLATE_CONTACT_TOP.x + 6, 14, -6],
      [PLATE_CONTACT_TOP.x, PLATE_CONTACT_TOP.y + 4, 0], PLATE_CONTACT_TOP.toArray()], topMat, scene, floor),
    makeCable([...out(bottomWire), [bottomWire.x - 6, floor, bottomWire.z + 9], [PLATE_CONTACT_BOTTOM.x + 2, onBase, -9],
      [PLATE_CONTACT_BOTTOM.x, onBase + 4, 0], [PLATE_CONTACT_BOTTOM.x, PLATE_CONTACT_BOTTOM.y - 3, 0],
      PLATE_CONTACT_BOTTOM.toArray()], bottomMat, scene, floor),
  ];
}
