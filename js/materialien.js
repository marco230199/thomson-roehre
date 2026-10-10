// ------------------------------------------------------------------
// Gemeinsam genutzte Materialien
// ------------------------------------------------------------------
import * as THREE from 'three';

export const mat = {
  table: new THREE.MeshStandardMaterial({ color: 0xc8a27a, roughness: 0.8 }),
  standBase: new THREE.MeshStandardMaterial({ color: 0xaeb5bd, roughness: 0.6 }),
  standDark: new THREE.MeshStandardMaterial({ color: 0x5b636c, roughness: 0.5 }),
  plastic: new THREE.MeshStandardMaterial({ color: 0xf2f2ef, roughness: 0.45 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xc8733a, metalness: 0.85, roughness: 0.35 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb9bec4, metalness: 0.9, roughness: 0.3 }),
  metalDark: new THREE.MeshStandardMaterial({ color: 0x6f757c, metalness: 0.8, roughness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xe6f2ff, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0,
    depthWrite: false, side: THREE.DoubleSide,
  }),
  housing: new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.5 }),
  panel: new THREE.MeshStandardMaterial({ color: 0x3b4450, roughness: 0.55 }),
  knob: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 }),
  cableRed: new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.5 }),
  cableBlue: new THREE.MeshStandardMaterial({ color: 0x1e5bc6, roughness: 0.5 }),
  cableBlack: new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5 }),
  socketYellow: new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.5 }),
  ledOff: new THREE.MeshStandardMaterial({ color: 0x1f4a24, roughness: 0.4 }),
  ledOn: new THREE.MeshStandardMaterial({ color: 0x39ff5a, emissive: 0x39ff5a, emissiveIntensity: 1.5 }),
  filamentOff: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5 }),
  filamentOn: new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff7a1a, emissiveIntensity: 2 }),
};
