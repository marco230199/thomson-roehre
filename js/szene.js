// ------------------------------------------------------------------
// Renderer, Szene, Kamera, Licht und Tisch
// ------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { addMesh } from './hilfen.js';
import { mat } from './materialien.js';
import { GEO } from './config.js';

export const TABLE_Y = -GEO.beamHeight;   // Oberkante des Tischs

const container = document.getElementById('scene');
export const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8edf2);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;

export const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 1000);
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 12;
controls.maxDistance = 200;

const START = { position: [8, 26, 96], target: [-2, -6, -8] };
export function resetView() {
  camera.position.set(...START.position);
  controls.target.set(...START.target);
  // Kamera per Adresse setzen (zum Prüfen): …/index.html#cam=x,y,z,zielX,zielY,zielZ
  const cam = location.hash.match(/cam=([-\d.,]+)/);
  if (cam) {
    const v = cam[1].split(',').map(Number);
    camera.position.set(v[0], v[1], v[2]);
    controls.target.set(v[3], v[4], v[5]);
  }
}

// Blick von vorne auf den Leuchtschirm (zum Ablesen)
export function screenView() {
  camera.position.set(5, 1.2, 19);
  controls.target.set(5, 0, 0);
}

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(30, 90, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 250 });
sun.shadow.bias = -0.0005;
scene.add(sun);

const table = addMesh(new THREE.BoxGeometry(160, 4, 110), mat.table, scene);
table.position.set(0, TABLE_Y - 2, -12);

// Größe anpassen; im Hochformat das Sichtfeld vergrößern, damit der ganze Aufbau sichtbar bleibt
function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  const BASE_FOV = 38;
  const BASE_ASPECT = 1.6;
  camera.fov = camera.aspect >= BASE_ASPECT
    ? BASE_FOV
    : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) * BASE_ASPECT / camera.aspect));
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
